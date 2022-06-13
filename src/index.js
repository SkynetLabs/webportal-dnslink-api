const { Server } = require("./server");

const host = process.env.DNSLINK_API_HOSTNAME || "0.0.0.0";
const port = Number(process.env.DNSLINK_API_PORT) || 3100;

const server = new Server();

server.start(port, host);
