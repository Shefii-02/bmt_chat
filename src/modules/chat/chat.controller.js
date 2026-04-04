const chatService = require("./chat.service");

exports.getClassMessages = async (req, res) => {
  const { class_id } = req.params;
  const page = req.query.page || 1;

  const messages = await chatService.getMessages(class_id, page);
  res.json(messages);
};
