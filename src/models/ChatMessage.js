const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ChatMessage = sequelize.define('chat_messages', {
  class_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  course_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  sender_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
});

module.exports = ChatMessage;
