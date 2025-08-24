const net = require('net');
const http = require('http');
const { v4:uuidv4 } = require('uuid');
const dotenv  = require('dotenv');
dotenv.config();

const PUBLIC_HTTP_PORT = process.env.PUBLIC_HTTP_PORT || 80;

const tunnels = new Map(); // subdomain -> { type, socket, port, targetHost, targetPort }

// -------------------- Control Server --------------------
const controlServer = net.createServer(tunnelSocket => {
  tunnelSocket.once('data', data => {
    try {
      const msg = data.toString().trim();
      console.log('🔗 Registration received:', msg);

      const [type, targetHost, targetPort] = msg.split(':');
      if (!type || !targetHost || !targetPort) {
        tunnelSocket.write('ERROR: Invalid registration\n');
        return tunnelSocket.end();
      }

      const id = uuidv4().slice(0, 6);
      const subdomain = `${id}.${targetPort}.${targetHost}`;

      tunnels.set(subdomain, { type, socket: tunnelSocket, targetHost, targetPort });
      console.log(`✅ Tunnel registered: ${subdomain} (${type})`);

      if (type === 'TCP') {
        createTcpTunnel(tunnelSocket, subdomain, targetHost, targetPort);
      } else if (type === 'HTTP') {
        tunnelSocket.write(`URL:http://${subdomain}:${PUBLIC_HTTP_PORT}\n`);
      } else {
        tunnelSocket.write('ERROR: Unsupported tunnel type\n');
        return tunnelSocket.end();
      }

      tunnelSocket.on('close', () => {
        tunnels.delete(subdomain);
        console.log(`❌ Tunnel closed: ${subdomain}`);
      });

      tunnelSocket.on('error', err => {
        console.error(`⚠️ Tunnel error (${subdomain}):`, err.message);
        tunnels.delete(subdomain);
      });

    } catch (err) {
      console.error('🚨 Control server error:', err.message);
      tunnelSocket.end();
    }
  });
});

// -------------------- TCP Tunnel Helper --------------------
function createTcpTunnel(tunnelSocket, subdomain, targetHost, targetPort) {
  const tcpServer = net.createServer(clientSocket => {
    const relayServer = net.createServer(localSocket => {
      clientSocket.pipe(localSocket);
      localSocket.pipe(clientSocket);

      clientSocket.on('close', () => localSocket.end());
      localSocket.on('close', () => clientSocket.end());
    });

    relayServer.listen(0, () => {
      const relayPort = relayServer.address().port;
      tunnelSocket.write(`RELAY:${relayPort}`);
      console.log(`🔄 Relay established for ${subdomain} (relay port: ${relayPort})`);
    });
  });

  tcpServer.listen(0, () => {
    const publicPort = tcpServer.address().port;
    tunnels.set(subdomain, { type: 'TCP', socket: tunnelSocket, port: publicPort, targetHost, targetPort });
    tunnelSocket.write(`URL:http://${subdomain}:${publicPort}\n`);
    console.log(`🌐 TCP tunnel ready: ${subdomain}:${publicPort}`);
  });

  tcpServer.on('error', err => console.error(`TCP server error for ${subdomain}:`, err.message));
}

// -------------------- HTTP Public Server (Optional) --------------------
const publicHttp = http.createServer((req, res) => {
  const host = req.headers.host?.split(':')[0];
  if (!host) return res.end('Bad Request');

  const tunnel = tunnels.get(host);
  if (!tunnel || tunnel.type !== 'HTTP') {
    res.writeHead(404);
    return res.end('Tunnel not found');
  }

  let raw = `${req.method} ${req.url} HTTP/1.1\r\n`;
  for (const [k, v] of Object.entries(req.headers)) raw += `${k}: ${v}\r\n`;
  raw += '\r\n';

  req.on('data', chunk => { raw += chunk.toString() });
  req.on('end', () => {
    tunnel.socket.write(`HTTP_REQ_START\n${raw}\nHTTP_REQ_END\n`);
    tunnel.socket.once('data', resp => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(resp.toString());
    });
  });
});

module.exports = { controlServer, publicHttp };
