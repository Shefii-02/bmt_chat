const chatService = require("./chat.service");

module.exports = (io, socket) => {

  socket.on("join_class", ({ class_id }) => {
    socket.join(`class_${class_id}`);
  });

  socket.on("send_message", async (data) => {
    const saved = await chatService.saveMessage(data);

    io.to(`class_${data.class_id}`).emit("receive_message", saved);
  });

};
