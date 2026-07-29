const mysql = require("mysql2/promise");
const CONFIG = require("./index");

let db;

async function connectDB() {
  db = await mysql.createPool(CONFIG.DB);
  console.log("✅ DB Ready");
}

function getDB() {
  if (!db) throw new Error("DB not initialized. Call connectDB() first.");
  return db;
}

module.exports = { connectDB, getDB };