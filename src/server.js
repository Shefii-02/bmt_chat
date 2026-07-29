const http = require("http");
const socketIO = require("socket.io");

const app = require("./src/app");
const CONFIG = require("./src/config");
const { connectDB } = require("./src/config/database");
const { connectRedis } = require("./src/config/redis");
const initSocket = require("./src/sockets");

const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: "*" } });

(async () => {
  // ── Connect services ─────────────────────────────────────────
  await connectDB();
  connectRedis();

  // ── Attach Socket.IO ─────────────────────────────────────────
  initSocket(io);

  // ── Start listening ───────────────────────────────────────────
  server.listen(CONFIG.PORT, "0.0.0.0", () => {
    console.log(`🚀 Running: ${CONFIG.BASE_URL}`);
  });
})();