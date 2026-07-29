const axios = require("axios");
const CONFIG = require("../config");

/**
 * Validates the Bearer token against the Laravel API.
 * Attaches the full Laravel user object to req.user on success.
 */
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "No token" });

    const response = await axios.get(CONFIG.LARAVEL_API, {
      headers: { Authorization: `Bearer ${token}` },
    });

    req.user = response.data; // shape: { data: { id, name, ... } }
    next();
  } catch (err) {
    console.log("AUTH ERROR:", err.response?.data || err.message);
    res.status(401).json({ error: "Unauthorized" });
  }
};

module.exports = auth;