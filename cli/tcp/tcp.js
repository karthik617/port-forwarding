const net = require("net");
const dotenv = require("dotenv");
dotenv.config();

function createTunnelTcp(localPort, targetHost = process.env.TARGET_HOST || "localhost", remoteHost = process.env.REMOTE_HOST || "localhost") {
  const tunnelSocket = net.connect(9001, remoteHost, () => {
    tunnelSocket.write(`TCP:${targetHost}:${localPort}`);
  });

  tunnelSocket.on("data", (data) => {
    const msg = data.toString();
    if (msg.startsWith("URL:")) {
      console.log("🌍 Public URL:", msg.replace("URL:", "").trim());
    }
    if (msg.startsWith("RELAY:")) {
      const relayPort = parseInt(msg.split(":")[1]);
      const relaySocket = net.connect(relayPort, remoteHost, () => {
        const localApp = net.connect(localPort, targetHost);

        relaySocket.pipe(localApp);
        localApp.pipe(relaySocket);

        relaySocket.on("close", () => localApp.end());
        localApp.on("close", () => relaySocket.end());
      });
    }
  });
}

module.exports = { createTunnelTcp };

