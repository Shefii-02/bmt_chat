// const { Server } = require('socket.io');

// let io;

// const initSocket = (server) => {
//   io = new Server(server, {
//     cors: {
//       origin: '*',
//     },
//   });

//   io.on('connection', (socket) => {
//     console.log('User connected:', socket.id);

//     socket.on('join_class', ({ classId }) => {
//       socket.join(`class_${classId}`);
//     });

//     socket.on('send_message', (data) => {
//       io.to(`class_${data.classId}`).emit('new_message', data);
//     });

//     socket.on('publish_poll', (data) => {
//       io.to(`class_${data.classId}`).emit('new_poll', data);
//     });

//     socket.on('disconnect', () => {
//       console.log('User disconnected:', socket.id);
//     });
//   });
// };

module.exports = { initSocket };
const { Server } = require("socket.io");
const chatSocket = require("../modules/chat/chat.socket");

let io;

exports.initSocket = (server) => {
  io = new Server(server, {
    cors: { origin: "*" }
  });

  io.on("connection", (socket) => {
    chatSocket(io, socket);
  });
};

exports.getIO = () => io;
