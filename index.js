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

// ================= CONFIG =================
const CONFIG = {
  PORT: 3000,
  BASE_URL: "http://192.168.1.6:3000",     // 🔥 CHANGE THIS
  JWT_SECRET: "secret",
  LARAVEL_API: "https://bookmyteacher.cloud/api/user",  // ✅ FIX 2: single source of truth
  DB: { host: "localhost", user: "root", password: "", database: "chatBMT3" }
};
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

  const [msgs] = await db.query(
    `SELECT * FROM messages
     WHERE conversation_id = ?
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [req.params.id, limit, offset]
  );


  res.json(msgs);
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
      const [r] = await db.query(
        `INSERT INTO messages
           (conversation_id, sender_id, content, message_type, file_url, file_name, file_size, duration_sec)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.conversationId,
          userId,                                   // always from verified socket user
          data.content ?? null,
          data.messageType ?? "text",
          data.fileUrl ?? null,
          data.fileName ?? null,
          data.fileSize ?? null,
          data.durationSec ?? null,
        ]
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