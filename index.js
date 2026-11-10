// ================= IMPORTS =================
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const Redis = require("ioredis");
const axios = require("axios");          // ✅ FIX 1: moved to top

const CONFIG = require("./src/config/index.js");

// ================= CONFIG =================
// const CONFIG = {
//   PORT: 3000,
//   BASE_URL: "http://192.168.1.6:3000",     // 🔥 CHANGE THIS
//   JWT_SECRET: "secret",
//   LARAVEL_API: "https://bookmyteacher.cloud/api/user",  // ✅ FIX 2: single source of truth
//   DB: { host: "localhost", user: "root", password: "", database: "chatBMT3" }
// };
// const CONFIG = {
//   PORT: 3000,
//   BASE_URL: "https://communication.bookmyteacher.cloud",     // 🔥 CHANGE THIS
//   JWT_SECRET: "secret",
//   LARAVEL_API: "https://www.bookmyteacher.cloud/api/user",  // ✅ FIX 2: single source of truth
//   DB: { host: "localhost", user: "cloudUserChat", password: "chatBMT@002!", database: "chatBMT" }
// };

// ================= INIT =================
const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// ================= DASHBOARD =================
app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html><html lang="en">
  <head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>BookMyTeacher — Chat Server</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
           background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;
           flex-direction:column;align-items:center;justify-content:center;padding:32px}
      .card{background:#1e293b;border:1px solid #334155;border-radius:16px;
            padding:40px;max-width:720px;width:100%}
      h1{font-size:28px;font-weight:700;color:#fff;margin-bottom:6px}
      .badge{display:inline-block;background:#22c55e;color:#fff;
             font-size:12px;padding:3px 10px;border-radius:20px;margin-left:10px}
      p{color:#94a3b8;margin:8px 0 24px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:28px}
      .ep{background:#0f172a;border-radius:10px;padding:16px}
      .method{font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;
              display:inline-block;margin-bottom:6px}
      .get{background:#1d4ed8;color:#bfdbfe}
      .post{background:#15803d;color:#bbf7d0}
      .ep-path{font-size:13px;font-family:monospace;color:#f8fafc;margin-bottom:4px}
      .ep-desc{font-size:12px;color:#64748b}
      .section{font-size:13px;font-weight:600;color:#94a3b8;
               letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px}
      .socket-list{list-style:none}
      .socket-list li{background:#0f172a;border-radius:8px;padding:10px 14px;
                      margin-bottom:8px;font-size:13px;font-family:monospace;color:#c084fc}
      .socket-list span{color:#64748b;font-family:sans-serif;font-size:12px;margin-left:8px}
      .url-box{background:#020617;border:1px solid #1e3a5f;border-radius:8px;
               padding:12px 16px;font-family:monospace;font-size:14px;
               color:#38bdf8;margin-bottom:24px;word-break:break-all}
      .footer{font-size:12px;color:#475569;margin-top:20px;text-align:center}
    </style>
  </head>
  <body>
    <div class="card">
      <h1>📚 BookMyTeacher <span class="badge">● LIVE</span></h1>
      <p>Chat backend is running. Connect your Flutter app to:</p>
      <div class="url-box">${CONFIG.BASE_URL}</div>

      <div class="section">REST API Endpoints</div>
      <div class="grid">
        <div class="ep"><span class="method post">POST</span>
          <div class="ep-path">/api/auth/register</div><div class="ep-desc">Register new user</div></div>
        <div class="ep"><span class="method post">POST</span>
          <div class="ep-path">/api/auth/login</div><div class="ep-desc">Login → JWT token</div></div>
        <div class="ep"><span class="method get">GET</span>
          <div class="ep-path">/api/chat/conversations</div><div class="ep-desc">List all chats</div></div>
        <div class="ep"><span class="method get">GET</span>
          <div class="ep-path">/api/chat/messages/:convId</div><div class="ep-desc">Get messages (paginated)</div></div>
        <div class="ep"><span class="method post">POST</span>
          <div class="ep-path">/api/chat/create</div><div class="ep-desc">Create / get direct chat</div></div>
        <div class="ep"><span class="method post">POST</span>
          <div class="ep-path">/api/upload</div><div class="ep-desc">Upload voice / PDF / DOCX</div></div>
        <div class="ep"><span class="method get">GET</span>
          <div class="ep-path">/api/users</div><div class="ep-desc">List users (admin)</div></div>
      </div>

      <div class="section">Socket.IO Events</div>
      <ul class="socket-list">
        <li>user_online <span>→ join rooms, set online</span></li>
        <li>join         <span>→ join a specific conversation room</span></li>
        <li>send_message <span>→ store + broadcast to conversation</span></li>
        <li>new_message  <span>← received by conversation members</span></li>
        <li>typing_start / typing_stop <span>↔ real-time typing indicator</span></li>
        <li>mark_read    <span>→ mark messages as read</span></li>
        <li>messages_read<span>← broadcast read receipt</span></li>
        <li>user_status  <span>← online / offline broadcast</span></li>
      </ul>
    </div>
    <div class="footer">BookMyTeacher Chat Server • Port ${CONFIG.PORT}</div>
  </body></html>
  `);
});

// At the top of server.js
const SOCKET_TEST_HTML = require('./socket_test.js');

// After app.use(express.json()) — add this route
app.get('/test', (req, res) => res.send(SOCKET_TEST_HTML));

// ================= REDIS =================
let redis;
try {
  redis = new Redis();
  redis.on("error", () => console.log("⚠️ Redis not running"));
} catch {
  console.log("⚠️ Redis disabled");
}

// ================= DB =================
let db;

// ================= SCHEMA =================
async function runSchema() {
  db = await mysql.createPool(CONFIG.DB);

  // USERS TABLE
  //   await db.query(`
  // CREATE TABLE IF NOT EXISTS users (
  //   id           INT AUTO_INCREMENT PRIMARY KEY,
  //   user_id      BIGINT UNIQUE,
  //   name         VARCHAR(100),
  //   email        VARCHAR(100),
  //   mobile       VARCHAR(20),
  //   company_id   BIGINT,
  //   role         VARCHAR(50),
  //   avatar_url   TEXT,
  //   is_online    TINYINT DEFAULT 0,
  //   last_seen    DATETIME,
  //   socket_id    VARCHAR(100),
  //   created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  //   deleted_at   DATETIME NULL,

  //   INDEX idx_user_id (user_id),
  //   INDEX idx_company (company_id),
  //   INDEX idx_online (is_online)
  // )
  // `);

  //   await db.query(`
  //     CREATE TABLE IF NOT EXISTS conversations (
  //       id         INT AUTO_INCREMENT PRIMARY KEY,
  //       type       ENUM('direct','group') DEFAULT 'direct',
  //       name       VARCHAR(150),
  //       avatar_url TEXT,
  //      created_by   BIGINT,
  //   created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  //   deleted_at   DATETIME NULL,
  //     )
  //   `);

  //   await db.query(`
  //     CREATE TABLE IF NOT EXISTS conversation_members (
  //       conversation_id INT,
  //       user_id         BIGINT,
  //       PRIMARY KEY(conversation_id, user_id)
  //     )
  //   `);

  //   // ✅ FIX 3: message_type DEFAULT 'text' so NULLs never slip through
  //   await db.query(`
  //     CREATE TABLE IF NOT EXISTS messages (
  //       id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  //       conversation_id  INT,
  //       sender_id        BIGINT,
  //       content          TEXT,
  //       message_type     VARCHAR(20) DEFAULT 'text',
  //       file_url         TEXT,
  //       file_name        VARCHAR(255),
  //       file_size        INT,
  //       duration_sec     INT,
  //       status           ENUM('sent','delivered','seen') DEFAULT 'sent',
  //       created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  //       deleted_at       DATETIME NULL,
  //       reported_status  NULL,
  //       INDEX idx_conv   (conversation_id),
  //       INDEX idx_status (status)
  //     )
  //   `);
  //   await db.query(`
  // CREATE TABLE IF NOT EXISTS message_report (
  //   id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  //   message_id       BIGINT NOT NULL,
  //   conversation_id  INT NOT NULL,
  //   reported_by      BIGINT NOT NULL,
  //   reported_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  //   verified_by      BIGINT NULL,
  //   verified_at      DATETIME NULL,
  //   status           VARCHAR(20) DEFAULT 'pending',

  //   INDEX idx_message (message_id),
  //   INDEX idx_conversation (conversation_id),
  //   INDEX idx_reported_by (reported_by),
  //   INDEX idx_status (status),

  //   UNIQUE KEY uniq_report (message_id, reported_by)
  // )
  // `);

  console.log("✅ DB Ready");
  await detectChatColumns();
}

// ================= AUTH MIDDLEWARE =================
// ✅ FIX 2: uses CONFIG.LARAVEL_API — one URL everywhere
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "No token" });

    const response = await axios.get(CONFIG.LARAVEL_API, {
      headers: { Authorization: `Bearer ${token}` }
    });

    req.user = response.data;
    next();
  } catch (err) {
    console.log("AUTH ERROR:", err.response?.data || err.message);
    res.status(401).json({ error: "Unauthorized" });
  }
};

// ================= FILE UPLOAD =================
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.use("/uploads", express.static(UPLOAD_DIR));

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file received" });
  res.json({
    url: `${CONFIG.BASE_URL}/uploads/${req.file.filename}`,
    originalName: req.file.originalname,
    size: req.file.size,
  });
});
// app.get("/api/chat/conversations", auth, async (req, res) => {
//   const userId = req.user.data.id;

//   const [rows] = await db.query(`
//     SELECT
//       c.id,
//       c.name,
//       c.type,
//       c.avatar_url,

//       m.id            AS last_message_id,
//       m.content       AS last_message,
//       m.message_type  AS last_message_type,
//       m.created_at    AS last_message_time,
//       m.sender_id     AS last_sender_id,

//       -- ✅ unread count
//       COUNT(CASE 
//         WHEN m2.sender_id != ? AND mr.id IS NULL THEN 1 
//       END) AS unread_count,

//       -- other user (direct chat)
//       u.user_id    AS other_user_id,
//       u.name       AS other_user_name,
//       u.avatar_url AS other_user_avatar,
//       u.is_online  AS other_user_online,
//       u.last_seen  AS other_user_last_seen,
//       u.role AS acc_type

//     FROM conversation_members cm
//     JOIN conversations c ON c.id = cm.conversation_id

//     -- ✅ last message (FAST)
//     LEFT JOIN messages m 
//       ON m.id = (
//         SELECT id FROM messages 
//         WHERE conversation_id = c.id 
//         ORDER BY id DESC LIMIT 1
//       )

//     -- ✅ unread calculation
//     LEFT JOIN messages m2 
//       ON m2.conversation_id = c.id

//     LEFT JOIN message_reads mr 
//       ON mr.message_id = m2.id AND mr.user_id = ?

//     -- other user join
//     LEFT JOIN conversation_members cm2
//       ON cm2.conversation_id = c.id 
//       AND cm2.user_id != ? 
//       AND c.type = 'direct'

//     LEFT JOIN users u ON u.user_id = cm2.user_id

//     WHERE cm.user_id = ?

//     GROUP BY c.id

//     ORDER BY last_message_time DESC
//   `, [userId, userId, userId, userId]);

//   res.json(rows);
// });

app.get("/api/chat/conversations", auth, async (req, res) => {
  try {
    const userId = req.user.data.id;
    const [rows] = await db.query(`
      SELECT
          c.id,
          c.name,
          c.type,
          c.avatar_url,

          -- Last message
          m.id            AS last_message_id,
          m.content       AS last_message,
          m.message_type  AS last_message_type,
          m.created_at    AS last_message_time,
          m.sender_id     AS last_sender_id,

          -- UNREAD COUNT (0 sent,1 delivered = unread | 2 seen = read)
          (
            SELECT COUNT(*)
            FROM message_reads mr
            JOIN messages mx
              ON mx.id = mr.message_id
            WHERE mx.conversation_id = c.id
              AND mx.sender_id != ?
              AND mr.user_id = ?
              AND mr.status < 2
          ) AS unread_count,

          -- Other user details (for direct chat)
          u.user_id       AS other_user_id,
          u.name          AS other_user_name,
          u.avatar_url    AS other_user_avatar,
          u.is_online     AS other_user_online,
          u.last_seen     AS other_user_last_seen,
          u.role          AS acc_type

      FROM conversation_members cm

      JOIN conversations c
        ON c.id = cm.conversation_id

      -- Latest message per conversation
      LEFT JOIN messages m
      ON m.id = (
          SELECT id
          FROM messages
          WHERE conversation_id = c.id
            ${HAS_CLEARED ? "AND (cm.cleared_at IS NULL OR created_at > cm.cleared_at)" : ""}
          ORDER BY id DESC
          LIMIT 1
      )

      -- Direct chat other user
      LEFT JOIN conversation_members cm2
        ON cm2.conversation_id = c.id
       AND cm2.user_id != ?
       AND c.type='direct'

      LEFT JOIN users u
        ON u.user_id = cm2.user_id

      WHERE cm.user_id = ?

      ORDER BY
        m.created_at DESC,
        c.id DESC
    `, [userId, userId, userId, userId]);

    res.json(rows);

  } catch (err) {

    console.error("Conversation list error:", err.message);

    res.status(500).json({
      error: "Failed to load conversations"
    });

  }

});

// ================= MESSAGES (paginated) =================
// ✅ FIX 5: LIMIT + OFFSET so Flutter pagination actually works
app.get("/api/chat/messages/:id", auth, async (req, res) => {
  const limit = parseInt(req.query.limit ?? "30", 10);
  const offset = parseInt(req.query.offset ?? "0", 10);

  const userId = req.user.data.id;

  // "Clear chat" hides older messages for this member only
  let sinceSql = "";
  const params = [req.params.id];
  if (HAS_CLEARED) {
    const [[row]] = await db.query(
      "SELECT cleared_at FROM conversation_members WHERE conversation_id = ? AND user_id = ?", [req.params.id, userId]);
    if (row?.cleared_at) { sinceSql = "AND created_at > ?"; params.push(row.cleared_at); }
  }

  const [msgs] = await db.query(
    `SELECT * FROM messages
     WHERE conversation_id = ? ${sinceSql}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // Attach poll data (options, counts, my votes) to poll messages
  if (HAS_POLLS) {
    const polls = await pollPayloads(msgs.map((m) => m.poll_id), userId);
    for (const m of msgs) if (m.poll_id && polls[m.poll_id]) m.poll = polls[m.poll_id];
  }

  res.json(msgs);
});

// ================= POLL RESPONSES (who voted for what) =================
// Only for accounts with the admin's "See everyone's poll responses" permission.
app.get("/api/chat/poll/:id/responses", auth, async (req, res) => {
  if (!HAS_POLLS) return res.status(404).json({ error: "Polls are not enabled yet." });

  const [[poll]] = await db.query("SELECT id, conversation_id, question FROM chat_polls WHERE id = ?", [req.params.id]);
  if (!poll) return res.status(404).json({ error: "Poll not found." });

  const userId = req.user.data.id;
  const [[member]] = await db.query(
    "SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id = ?", [poll.conversation_id, userId]);
  if (!member) return res.status(403).json({ error: "You are not in this conversation." });

  const perms = await permsForAuthHeader(req.headers.authorization, poll.conversation_id);
  if (perms && perms.can?.poll_view_results === false) {
    return res.status(403).json({ error: "You are not allowed to see poll responses in this chat." });
  }

  const [rows] = await db.query(
    `SELECT o.id AS option_id, o.text, v.user_id, u.name
       FROM chat_poll_options o
       LEFT JOIN chat_poll_votes v ON v.option_id = o.id
       LEFT JOIN users u ON u.user_id = v.user_id
      WHERE o.poll_id = ? ORDER BY o.position, o.id, v.id`, [poll.id]);

  const options = [];
  for (const r of rows) {
    let o = options.find((x) => x.id === r.option_id);
    if (!o) { o = { id: r.option_id, text: r.text, voters: [] }; options.push(o); }
    if (r.user_id) o.voters.push({ user_id: r.user_id, name: r.name ?? "User" });
  }
  res.json({ id: poll.id, question: poll.question, options });
});

// ================= CREATE DIRECT CHAT =================
app.post("/api/chat/create", auth, async (req, res) => {
  const myId = req.user.data.id;
  const { targetUserId } = req.body;

  if (!targetUserId) return res.status(400).json({ error: "targetUserId required" });

  // Return existing conversation if one already exists
  const [existing] = await db.query(`
    SELECT cm1.conversation_id AS id
    FROM conversation_members cm1
    JOIN conversation_members cm2
      ON cm1.conversation_id = cm2.conversation_id
    JOIN conversations c ON c.id = cm1.conversation_id
    WHERE cm1.user_id = ? AND cm2.user_id = ? AND c.type = 'direct'
    LIMIT 1
  `, [myId, targetUserId]);

  if (existing.length > 0) {
    return res.json({ conversationId: existing[0].id, existing: true });
  }

  // Starting a NEW individual chat needs the admin's "Start individual chats" permission
  try {
    const p = await axios.post(PERMISSIONS_URL, {}, {
      headers: { Authorization: req.headers.authorization }, timeout: 4000,
    });
    if (p.data?.data?.can?.direct_chat_create === false) {
      return res.status(403).json({ error: "You are not allowed to start individual chats." });
    }
  } catch (e) {
    console.log("[create chat] permissions unavailable, allowing:", e.message);
  }

  const [r] = await db.query(
    "INSERT INTO conversations (type, created_by) VALUES ('direct', ?)", [myId]
  );
  const cid = r.insertId;

  await db.query(
    "INSERT INTO conversation_members VALUES (?,?), (?,?)",
    [cid, myId, cid, targetUserId]
  );

  res.json({ conversationId: cid, existing: false });
});

// ================= CHAT PERMISSIONS (set by the admin in Laravel) =================
// Laravel is the single source of truth: POST {api}/chat/permissions answers what this user may do in a conversation.
// Answers are cached for 30s. If Laravel can't be reached we FAIL OPEN so chat keeps working.
const PERMISSIONS_URL = (CONFIG.LARAVEL_API || "").replace(/\/user\/?$/, "") + "/chat/permissions";
const permCache = new Map();

async function chatPermissions(socket, conversationId) {
  const key = `${socket.user.data.id}:${conversationId}`;
  const hit = permCache.get(key);
  if (hit && Date.now() - hit.at < 30000) return hit.data;

  try {
    const res = await axios.post(
      PERMISSIONS_URL,
      { conversation_id: conversationId },
      { headers: { Authorization: `Bearer ${socket.handshake.auth.token}` }, timeout: 4000 }
    );
    const data = res.data?.data ?? null;
    permCache.set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    if (err.response?.status === 403) return { denied: true };   // not a member of this conversation
    console.log("[permissions] unavailable, allowing:", err.message);
    return null;
  }
}

// Which admin-set permission a message needs. `source` is 'camera' for photos/videos captured in the app.
function capabilityFor(messageType, source) {
  const t = String(messageType || "text").toLowerCase();
  const camera = String(source || "").toLowerCase() === "camera";
  switch (t) {
    case "text":  return "text";
    case "voice": return "voice_message";
    case "audio": return "audio_share";
    case "image": return camera ? "capture_image" : "image_share";
    case "video": return camera ? "capture_video" : "video_share";
    case "poll":  return "poll_create";
    default:      return "document_share";   // pdf, docx, other attachments
  }
}

const CAPABILITY_LABELS = {
  text: "send text messages",
  voice_message: "send voice messages",
  audio_share: "share audio files",
  image_share: "share photos",
  capture_image: "capture and share photos",
  video_share: "share videos",
  capture_video: "capture and share videos",
  document_share: "share attachments",
  poll_create: "create polls",
};

// Which optional columns/tables exist yet (the Laravel chat migrations may not have run)
let HAS_CHAT_COLS = false;   // messages.reply_to_id / mentions
let HAS_CLEARED   = false;   // conversation_members.cleared_at
let HAS_POLLS     = false;   // chat_polls tables + messages.poll_id
async function detectChatColumns() {
  const has = async (sql) => { try { const [r] = await db.query(sql); return r.length > 0; } catch { return false; } };
  HAS_CHAT_COLS = await has("SHOW COLUMNS FROM messages LIKE 'reply_to_id'");
  HAS_CLEARED   = await has("SHOW COLUMNS FROM conversation_members LIKE 'cleared_at'");
  HAS_POLLS     = (await has("SHOW COLUMNS FROM messages LIKE 'poll_id'")) && (await has("SHOW TABLES LIKE 'chat_polls'"));
  console.log("Chat columns — replies/mentions:", HAS_CHAT_COLS, "| clear chat:", HAS_CLEARED, "| polls:", HAS_POLLS);
}

// Permissions for an arbitrary request (REST): same answer the socket uses, never cached.
async function permsForAuthHeader(authHeader, conversationId) {
  try {
    const res = await axios.post(PERMISSIONS_URL, conversationId ? { conversation_id: conversationId } : {},
      { headers: { Authorization: authHeader }, timeout: 4000 });
    return res.data?.data ?? null;
  } catch (err) {
    if (err.response?.status === 403) return { denied: true };
    return null;   // Laravel unreachable -> fail open
  }
}

// Poll objects for the given poll ids: counts per option + this user's own votes
async function pollPayloads(pollIds, userId) {
  const ids = [...new Set(pollIds.filter(Boolean))];
  if (!ids.length || !HAS_POLLS) return {};

  const [polls]   = await db.query("SELECT id, conversation_id, question, multiple FROM chat_polls WHERE id IN (?)", [ids]);
  const [options] = await db.query(
    `SELECT o.id, o.poll_id, o.text, COUNT(v.id) AS votes
       FROM chat_poll_options o LEFT JOIN chat_poll_votes v ON v.option_id = o.id
      WHERE o.poll_id IN (?) GROUP BY o.id ORDER BY o.position, o.id`, [ids]);
  const [mine] = await db.query("SELECT poll_id, option_id FROM chat_poll_votes WHERE poll_id IN (?) AND user_id = ?", [ids, userId]);

  const out = {};
  for (const p of polls) {
    const opts = options.filter((o) => o.poll_id === p.id).map((o) => ({ id: o.id, text: o.text, votes: Number(o.votes) }));
    out[p.id] = {
      id: p.id, conversation_id: p.conversation_id, question: p.question, multiple: !!p.multiple,
      options: opts, total_votes: opts.reduce((n, o) => n + o.votes, 0),
      my_option_ids: mine.filter((m) => m.poll_id === p.id).map((m) => m.option_id),
    };
  }
  return out;
}

// ================= SOCKET AUTH =================
// ✅ FIX 2: uses CONFIG.LARAVEL_API — same URL as REST
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("No token"));

    const res = await axios.get(CONFIG.LARAVEL_API, {
      headers: { Authorization: `Bearer ${token}` }
    });

    // ✅ FIX 4: store the whole object; access via socket.user.data.id
    socket.user = res.data;
    next();
  } catch (err) {
    console.log("SOCKET AUTH ERROR:", err.message);
    next(new Error("Unauthorized"));
  }
});

// ================= SOCKET EVENTS =================
io.on("connection", async (socket) => {
  // ✅ FIX 4: Laravel wraps user in { data: { id, name, ... } }
  const userId = socket.user.data.id;

  console.log(`[Socket] User ${userId} connected`);

  // Mark online
  await db.query(
    "UPDATE users SET is_online=1, last_seen=NOW() WHERE user_id=?", [userId]
  );

  // Broadcast online status to everyone
  socket.broadcast.emit("user_status", { userId, isOnline: true });

  // ✅ join a conversation room (called by Flutter when entering chat screen)
  socket.on("join", async (cid) => {
    socket.join("conv_" + cid);

    await db.query(
      `
 UPDATE message_reads
 SET status=1,
     updated_at=NOW()
 WHERE conversation_id=?
 AND user_id=?
 AND status=0
 `,
      [cid, userId]
    );
    console.log(`[Socket] User ${userId} joined conv_${cid}`);
  });

  // ✅ FIX 5: save all fields including message_type, file_url, etc.
  socket.on("send_message", async (data, ack) => {

    console.log("USER:", socket.user);        // see the shape
    console.log("DATA:", data);               // see what Flutter sends
    console.log("USER ID:", socket.user.data?.id); // is this correct?
    try {
      // ---- admin-controlled permissions ----
      const reject = (error) => {
        socket.emit("message_denied", { conversationId: data.conversationId, error });
        if (typeof ack === "function") ack({ ok: false, code: "not_allowed", error });
      };

      const perms = await chatPermissions(socket, data.conversationId);
      if (perms?.denied) return reject("You are not in this conversation.");

      let mentions = Array.isArray(data.mentions) ? data.mentions.map(Number).filter(Boolean) : [];
      let replyToId = data.replyToId ? Number(data.replyToId) : null;

      if (perms) {
        const need = capabilityFor(data.messageType, data.source);
        if (perms.can?.[need] === false) return reject(`You are not allowed to ${CAPABILITY_LABELS[need] ?? "do this"} in this chat.`);
        if (replyToId && perms.can?.reply === false) return reject("Replying is turned off in this chat.");
        if (mentions.length && perms.can?.mention === false) return reject("Mentions are turned off in this chat.");

        const maxBytes = (perms.max_file_mb ?? 20) * 1024 * 1024;
        if (data.fileSize && Number(data.fileSize) > maxBytes) return reject(`Files must be under ${perms.max_file_mb} MB.`);
      }

      // a reply must point at a message of the same conversation; mentions must be members
      if (replyToId) {
        const [ok] = await db.query("SELECT id FROM messages WHERE id=? AND conversation_id=?", [replyToId, data.conversationId]);
        if (!ok.length) replyToId = null;
      }
      if (mentions.length) {
        const [mem] = await db.query(
          "SELECT user_id FROM conversation_members WHERE conversation_id=? AND user_id IN (?)",
          [data.conversationId, mentions]
        );
        mentions = mem.map((m) => Number(m.user_id));
      }

      const baseCols = "conversation_id, sender_id, content, message_type, file_url, file_name, file_size, duration_sec";
      const baseVals = [
        data.conversationId,
        userId,                                   // always from verified socket user
        data.content ?? null,
        data.messageType ?? "text",
        data.fileUrl ?? null,
        data.fileName ?? null,
        data.fileSize ?? null,
        data.durationSec ?? null,
      ];

      const [r] = HAS_CHAT_COLS
        ? await db.query(
            `INSERT INTO messages (${baseCols}, reply_to_id, mentions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [...baseVals, replyToId, mentions.length ? JSON.stringify(mentions) : null]
          )
        : await db.query(
            `INSERT INTO messages (${baseCols}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            baseVals
          );


     const messageId = r.insertId;

      const [members] = await db.query(
        `SELECT user_id
 FROM conversation_members
 WHERE conversation_id = ?
 AND user_id != ?`,
        [data.conversationId, userId]
      );

      console.log(members);

      for (const member of members) {

      const  msR =   await  db.query(
          `INSERT INTO message_reads
 (message_id, conversation_id, user_id, status, created_at, updated_at)
 VALUES (?, ?, ?, 0, NOW(), NOW())`,
          [
            messageId,
            data.conversationId,
            member.user_id
          ]
        );

        console.log(msR);

      }


      const msg = {
        id: r.insertId,
        conversation_id: data.conversationId,       // ✅ FIX 6: included so Flutter can filter
        sender_id: userId,
        content: data.content ?? null,
        message_type: data.messageType ?? "text",
        file_url: data.fileUrl ?? null,
        file_name: data.fileName ?? null,
        file_size: data.fileSize ?? null,
        duration_sec: data.durationSec ?? null,
        reply_to_id: replyToId,
        mentions,
        status: "sent",
        created_at: new Date().toISOString(),
      };

      // Broadcast to everyone in the conversation room
      io.to("conv_" + msg.conversation_id).emit("new_message", msg);

      // Acknowledge the sender
      if (typeof ack === "function") ack({ ok: true, messageId: r.insertId });

    } catch (err) {
      console.error("[send_message] error:", err.message);
      if (typeof ack === "function") ack({ ok: false, error: err.message });
    }
  });

  // ---- Polls ----
  socket.on("create_poll", async (data, ack) => {
    const done = (r) => { if (typeof ack === "function") ack(r); };
    try {
      if (!HAS_POLLS) return done({ ok: false, error: "Polls are not enabled yet." });

      const cid = Number(data.conversationId);
      const question = String(data.question ?? "").trim().slice(0, 300);
      const options = (Array.isArray(data.options) ? data.options : [])
        .map((o) => String(o ?? "").trim().slice(0, 120)).filter(Boolean);

      if (!question) return done({ ok: false, error: "A poll needs a question." });
      if (options.length < 2 || options.length > 10) return done({ ok: false, error: "A poll needs 2 to 10 options." });

      const perms = await chatPermissions(socket, cid);
      if (perms?.denied) return done({ ok: false, error: "You are not in this conversation." });
      if (perms && perms.can?.poll_create === false) {
        socket.emit("message_denied", { conversationId: cid, error: "You are not allowed to create polls in this chat." });
        return done({ ok: false, code: "not_allowed", error: "You are not allowed to create polls in this chat." });
      }

      const [[member]] = await db.query("SELECT user_id FROM conversation_members WHERE conversation_id=? AND user_id=?", [cid, userId]);
      if (!member) return done({ ok: false, error: "You are not in this conversation." });

      const [pr] = await db.query(
        "INSERT INTO chat_polls (conversation_id, created_by, question, multiple, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())",
        [cid, userId, question, data.multiple ? 1 : 0]);
      const pollId = pr.insertId;

      for (let i = 0; i < options.length; i++) {
        await db.query("INSERT INTO chat_poll_options (poll_id, text, position) VALUES (?, ?, ?)", [pollId, options[i], i]);
      }

      const [mr] = await db.query(
        "INSERT INTO messages (conversation_id, sender_id, content, message_type, poll_id) VALUES (?, ?, ?, 'poll', ?)",
        [cid, userId, question, pollId]);

      const [members] = await db.query("SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?", [cid, userId]);
      for (const m of members) {
        await db.query(
          "INSERT INTO message_reads (message_id, conversation_id, user_id, status, created_at, updated_at) VALUES (?, ?, ?, 0, NOW(), NOW())",
          [mr.insertId, cid, m.user_id]);
      }

      const poll = (await pollPayloads([pollId], userId))[pollId];
      const msg = {
        id: mr.insertId, conversation_id: cid, sender_id: userId, content: question, message_type: "poll",
        poll_id: pollId, poll: { ...poll, my_option_ids: [] },   // everyone starts with no vote
        status: "sent", created_at: new Date().toISOString(),
      };
      io.to("conv_" + cid).emit("new_message", msg);
      done({ ok: true, messageId: mr.insertId, pollId });
    } catch (err) {
      console.error("[create_poll] error:", err.message);
      done({ ok: false, error: err.message });
    }
  });

  socket.on("vote_poll", async (data, ack) => {
    const done = (r) => { if (typeof ack === "function") ack(r); };
    try {
      if (!HAS_POLLS) return done({ ok: false, error: "Polls are not enabled yet." });

      const pollId = Number(data.pollId);
      const [[poll]] = await db.query("SELECT id, conversation_id, multiple FROM chat_polls WHERE id = ?", [pollId]);
      if (!poll) return done({ ok: false, error: "Poll not found." });

      const [[member]] = await db.query(
        "SELECT user_id FROM conversation_members WHERE conversation_id=? AND user_id=?", [poll.conversation_id, userId]);
      if (!member) return done({ ok: false, error: "You are not in this conversation." });

      const perms = await chatPermissions(socket, poll.conversation_id);
      if (perms && perms.can?.poll_vote === false) {
        return done({ ok: false, code: "not_allowed", error: "You are not allowed to vote in polls in this chat." });
      }

      // only options that belong to this poll; single-choice polls keep one
      let optionIds = (Array.isArray(data.optionIds) ? data.optionIds : []).map(Number);
      const [valid] = await db.query("SELECT id FROM chat_poll_options WHERE poll_id = ? AND id IN (?)", [pollId, optionIds.length ? optionIds : [0]]);
      optionIds = valid.map((o) => o.id);
      if (!poll.multiple) optionIds = optionIds.slice(0, 1);

      await db.query("DELETE FROM chat_poll_votes WHERE poll_id = ? AND user_id = ?", [pollId, userId]);
      for (const oid of optionIds) {
        await db.query("INSERT INTO chat_poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)", [pollId, oid, userId]);
      }

      // counts only — who voted is shared through the permission-checked responses endpoint
      const fresh = (await pollPayloads([pollId], userId))[pollId];
      io.to("conv_" + poll.conversation_id).emit("poll_updated", {
        conversationId: poll.conversation_id, pollId,
        options: fresh.options.map((o) => ({ id: o.id, votes: o.votes })), total_votes: fresh.total_votes,
      });
      done({ ok: true, my_option_ids: fresh.my_option_ids });
    } catch (err) {
      console.error("[vote_poll] error:", err.message);
      done({ ok: false, error: err.message });
    }
  });

  // Typing indicators
  socket.on("typing_start", (data) => {
    socket.to("conv_" + data.conversationId).emit("typing_start", {
      conversationId: data.conversationId,
      userId,
      userName: socket.user.data.name ?? "",
    });
  });

  socket.on("typing_stop", (data) => {
    socket.to("conv_" + data.conversationId).emit("typing_stop", {
      conversationId: data.conversationId,
      userId,
    });
  });

  // Mark messages as read
  socket.on("mark_read", async (data) => {
    const { conversationId } = data;

    const [updated] = await db.query(
      `UPDATE messages SET status='seen'
       WHERE conversation_id=? AND sender_id != ? AND status != 'seen'`,
      [conversationId, userId]
    );

    await db.query(
      `
 UPDATE message_reads
 SET status=2,
 read_at=NOW(),
 updated_at=NOW()
 WHERE conversation_id=?
 AND user_id=?
 AND status < 2
 `,
      [conversationId, userId]
    );

    // socket.to("conv_" + conversationId)
    //   .emit("messages_read", {
    //     conversationId,
    //     userId
    //   });

    // if (updated.affectedRows > 0) {
    // Tell the other side their messages were read
    socket.to("conv_" + conversationId).emit("messages_read", {
      conversationId,
      userId,
    });
    // }
  });

  socket.on("disconnect", async () => {
    console.log(`[Socket] User ${userId} disconnected`);
    await db.query(
      "UPDATE users SET is_online=0, last_seen=NOW() WHERE user_id=?", [userId]
    );
    socket.broadcast.emit("user_status", { userId, isOnline: false });
  });
});

// ================= START =================
(async () => {
  await runSchema();
  server.listen(CONFIG.PORT, "0.0.0.0", () => {
    console.log(`🚀 Running: ${CONFIG.BASE_URL}`);
  });
})();