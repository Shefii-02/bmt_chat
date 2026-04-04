// const http = require('http');
// const app = require('./app');
// const { initSocket } = require('./config/socket');
// require('dotenv').config();

// const server = http.createServer(app);

// initSocket(server);

// const PORT = process.env.PORT || 4000;
// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });
const http = require("http");
const app = require("./app");
const { initSocket } = require("./config/socket");

const server = http.createServer(app);
initSocket(server);

server.listen(3000, () =>
  console.log("Chat server running on port 3000")
);
