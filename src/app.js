const express = require("express");
const cors = require("cors");
const path = require("path");

const routes = require("./routes");
const getDashboardHTML = require("./utils/dashboard");
const { UPLOAD_DIR } = require("./middlewares/upload.middleware");

const app = express();

// ── Core middleware ───────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Static file serving ───────────────────────────────────────
app.use("/uploads", express.static(UPLOAD_DIR));

// ── Dashboard ─────────────────────────────────────────────────
app.get("/", (req, res) => res.send(getDashboardHTML()));

// ── API routes ────────────────────────────────────────────────
app.use("/api", routes);

module.exports = app;