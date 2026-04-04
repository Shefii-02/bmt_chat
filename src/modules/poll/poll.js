const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

module.exports = sequelize.define('polls', {
  class_id: DataTypes.BIGINT,
  question: DataTypes.TEXT,
  options: DataTypes.JSON,
  is_active: DataTypes.BOOLEAN,
});
