require("dotenv").config();

const CONFIG = {
  PORT: process.env.PORT,
  BASE_URL: process.env.BASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  LARAVEL_API: process.env.LARAVEL_API,
  DB: {
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME ,
  },
};

module.exports = CONFIG;