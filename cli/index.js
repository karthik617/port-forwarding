#!/usr/bin/env node
const { createTunnelTcp } = require("./tcp/tcp");
const { createTunnelHttp } = require("./http/http");

// Read args: node index.js tcp|http <localPort> <remoteUrl>
// tunnel tcp|http <localPort> [targetHost] [remoteUrl]
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log("Usage: node index.js tcp|http <localPort> <remoteUrl>");
    process.exit(1);
}

const [mode, localPort, targetHost, remoteUrl] = args;

if (mode === "tcp") {
    createTunnelTcp(parseInt(localPort), targetHost, remoteUrl);
} else if (mode === "http") {
    createTunnelHttp(parseInt(localPort), targetHost, remoteUrl);
} else {
    console.log("Invalid mode! Use 'tcp' or 'http'");
    process.exit(1);
}
 


