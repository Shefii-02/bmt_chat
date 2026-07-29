require("dotenv").config();

const CONFIG = {
  PORT: process.env.PORT || 3000,
  BASE_URL: process.env.BASE_URL || "http://192.168.1.50:3000",
  JWT_SECRET: process.env.JWT_SECRET || "secret",
  LARAVEL_API: process.env.LARAVEL_API || "https://www.bookmyteacher.cloud/api/user",
  DB: {
    host:     process.env.DB_HOST     || "localhost",
    user:     process.env.DB_USER     || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME     || "chatBMT3",
  },
};

module.exports = CONFIG;