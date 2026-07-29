const Redis = require("ioredis");

let redis;

function connectRedis() {
  try {
    redis = new Redis();
    redis.on("error", () => console.log("⚠️  Redis not running — caching disabled"));
    console.log("✅ Redis connected");
  } catch {
    console.log("⚠️  Redis disabled");
  }
}

function getRedis() {
  return redis; // may be undefined if Redis is down — callers should check
}

module.exports = { connectRedis, getRedis };ls
