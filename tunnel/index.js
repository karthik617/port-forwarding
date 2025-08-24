const dotenv = require("dotenv");
dotenv.config();
const { controlServer, publicHttp } = require("./remote-tunnel");

controlServer.listen(process.env.TUNNEL_PORT || 9001, () => {
  console.log(`🛡 Control server listening on port ${process.env.TUNNEL_PORT || 9001}`);
});

// Attach a listener BEFORE requests are processed
publicHttp.on("request", (req, res) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
});

publicHttp.listen(process.env.PUBLIC_HTTP_PORT || 80, () => {
  console.log(`🌍 HTTP public server on port ${process.env.PUBLIC_HTTP_PORT || 80}`);
});
