const net = require("net");
const http = require("http");
const dotenv = require("dotenv");
dotenv.config();

function createTunnelHttp(localPort, targetHost = "localhost", remoteHost = process.env.TUNNEL_HOST || "localhost") {
  const tunnelSocket = net.connect(9001, remoteHost, () => {
    tunnelSocket.write(`HTTP:${targetHost}:${localPort}`);
  });

  tunnelSocket.on("data", (data) => {
    const msg = data.toString();
    if (msg.startsWith("URL:")) {
      console.log("🌍 Public URL:", msg.replace("URL:", "").trim());
    }

    if (msg.includes("HTTP_REQ_START")) {
      // Extract raw request
      const rawReq = msg
        .split("HTTP_REQ_START\n")[1]
        .split("\nHTTP_REQ_END")[0];

      // Split into lines
      const lines = rawReq.split("\r\n");
      const [method, path] = lines[0].split(" "); // e.g. "GET /foo HTTP/1.1"

      // Extract headers
      const headers = {};
      let i = 1;
      for (; i < lines.length; i++) {
        if (lines[i] === "") break; // end of headers
        const [key, value] = lines[i].split(/:\s*/);
        headers[key] = value;
      }

      // Extract body (after headers)
      const body = lines.slice(i + 1).join("\r\n");

      const localReq = http.request(
        {
          host: targetHost,
          port: localPort,
          method,
          path,
          headers,
          body,
        },
        (res) => {
          let respBody = "";
          res.on("data", (chunk) => (respBody += chunk));
          res.on("end", () => {
            // Wrap response back to tunnel
            tunnelSocket.write(`${respBody}`);
          });
        }
      );

      localReq.on("error", (err) => {
        tunnelSocket.write("Local error: " + err.message);
      });

      localReq.end();
    }
  });
}

module.exports = { createTunnelHttp };
