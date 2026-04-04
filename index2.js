// ╔══════════════════════════════════════════════════════════════════╗
// ║        BookMyTeacher Chat Server  —  SINGLE FILE SETUP          ║
// ║   Run:  node index.js   OR   npm start                          ║
// ║   URL:  http://localhost:3000                                    ║
// ╚══════════════════════════════════════════════════════════════════╝

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const mysql = require('mysql2');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────
//  CONFIG  — edit these values
// ─────────────────────────────────────────────
const CONFIG = {
  PORT: process.env.PORT || 3000,
  BASE_URL: process.env.BASE_URL || 'http://192.168.29.145:3000',
  JWT_SECRET: process.env.JWT_SECRET || 'bookmyteacher_secret_2025',

  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: process.env.DB_PORT || 3306,
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',          // ← your MySQL password
  DB_NAME: process.env.DB_NAME || 'chatBMT',
};

// ─────────────────────────────────────────────
//  MYSQL POOL
// ─────────────────────────────────────────────
const db = mysql.createPool({
  host: CONFIG.DB_HOST,
  port: CONFIG.DB_PORT,
  user: CONFIG.DB_USER,
  password: CONFIG.DB_PASSWORD,
  database: CONFIG.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
}).promise();  // use promise API everywhere

// ─────────────────────────────────────────────
//  AUTO-RUN SQL SCHEMA (creates tables if not exist)
// ─────────────────────────────────────────────
async function runSchema() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
       id            INT AUTO_INCREMENT PRIMARY KEY,
       user_id       VARCHAR(120)  NOT NULL,
       name          VARCHAR(120)  NOT NULL,
       email         VARCHAR(180)  NOT NULL UNIQUE,
       password_hash VARCHAR(255)  NOT NULL,
       role          ENUM('admin','teacher','student') NOT NULL DEFAULT 'student',
       avatar_url    VARCHAR(500)  DEFAULT NULL,
       is_online     TINYINT(1)    DEFAULT 0,
       last_seen     DATETIME      DEFAULT NULL,
       socket_id     VARCHAR(120)  DEFAULT NULL,
       created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS conversations (
       id         INT AUTO_INCREMENT PRIMARY KEY,
       type       ENUM('direct','group') NOT NULL DEFAULT 'direct',
       name       VARCHAR(180)  DEFAULT NULL,
       avatar_url VARCHAR(500)  DEFAULT NULL,
       created_by INT           NOT NULL,
       created_at DATETIME      DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (created_by) REFERENCES users(id)
     )`,

    `CREATE TABLE IF NOT EXISTS conversation_members (
       id              INT AUTO_INCREMENT PRIMARY KEY,
       conversation_id INT NOT NULL,
       user_id         INT NOT NULL,
       joined_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
       UNIQUE KEY uq_conv_user (conversation_id, user_id),
       FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
       FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
     )`,

    `CREATE TABLE IF NOT EXISTS messages (
       id              INT AUTO_INCREMENT PRIMARY KEY,
       conversation_id INT          NOT NULL,
       sender_id       INT          NOT NULL,
       message_type    ENUM('text','voice','pdf','docx','image') NOT NULL DEFAULT 'text',
       content         TEXT         DEFAULT NULL,
       file_url        VARCHAR(600) DEFAULT NULL,
       file_name       VARCHAR(300) DEFAULT NULL,
       file_size       INT          DEFAULT NULL,
       duration_sec    INT          DEFAULT NULL,
       is_read         TINYINT(1)   DEFAULT 0,
       created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
       FOREIGN KEY (sender_id)       REFERENCES users(id)         ON DELETE CASCADE
     )`,

    `CREATE TABLE IF NOT EXISTS message_reads (
       id         INT AUTO_INCREMENT PRIMARY KEY,
       message_id INT NOT NULL,
       user_id    INT NOT NULL,
       read_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
       UNIQUE KEY uq_msg_user (message_id, user_id),
       FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
       FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
     )`,
  ];

  for (const q of queries) {
    await db.query(q);
  }
  console.log('✅ Schema ready');
}

// ─────────────────────────────────────────────
//  EXPRESS + SOCKET.IO
// ─────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
  maxHttpBufferSize: 50e6,  // 50 MB
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files as static
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

// Serve a simple web dashboard at /
app.get('/', (req, res) => {
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
        <div class="ep">
          <span class="method post">POST</span>
          <div class="ep-path">/api/auth/register</div>
          <div class="ep-desc">Register new user</div>
        </div>
        <div class="ep">
          <span class="method post">POST</span>
          <div class="ep-path">/api/auth/login</div>
          <div class="ep-desc">Login → JWT token</div>
        </div>
        <div class="ep">
          <span class="method get">GET</span>
          <div class="ep-path">/api/chat/conversations</div>
          <div class="ep-desc">List all chats</div>
        </div>
        <div class="ep">
          <span class="method get">GET</span>
          <div class="ep-path">/api/chat/messages/:convId</div>
          <div class="ep-desc">Get messages (paginated)</div>
        </div>
        <div class="ep">
          <span class="method post">POST</span>
          <div class="ep-path">/api/chat/conversations/direct</div>
          <div class="ep-desc">Create / get direct chat</div>
        </div>
        <div class="ep">
          <span class="method post">POST</span>
          <div class="ep-path">/api/chat/conversations/group</div>
          <div class="ep-desc">Create group (admin only)</div>
        </div>
        <div class="ep">
          <span class="method post">POST</span>
          <div class="ep-path">/api/upload</div>
          <div class="ep-desc">Upload voice / PDF / DOCX</div>
        </div>
        <div class="ep">
          <span class="method get">GET</span>
          <div class="ep-path">/api/users</div>
          <div class="ep-desc">List users (admin)</div>
        </div>
      </div>

      <div class="section">Socket.IO Events</div>
      <ul class="socket-list">
        <li>user_online <span>→ join rooms, set online</span></li>
        <li>send_message <span>→ store + broadcast to conversation</span></li>
        <li>new_message <span>← received by conversation members</span></li>
        <li>typing_start / typing_stop <span>↔ real-time typing indicator</span></li>
        <li>mark_read <span>→ mark messages as read</span></li>
        <li>messages_read <span>← broadcast read receipt</span></li>
        <li>user_status <span>← online / offline broadcast</span></li>
      </ul>
    </div>
    <div class="footer">BookMyTeacher Chat Server • Port ${CONFIG.PORT}</div>
  </body></html>
  `);
});

// ─────────────────────────────────────────────
//  JWT MIDDLEWARE
// ─────────────────────────────────────────────
function authMiddleware(req, res, next) {
  // const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  // if (!token) return res.status(401).json({ success: false, error: 'No token' });
  // try {
  // req.user = jwt.verify(token, CONFIG.JWT_SECRET);
  next();
  // } catch {
  //   res.status(403).json({ success: false, error: 'Invalid token' });
  // }
}

// ─────────────────────────────────────────────
//  FILE UPLOAD (Multer)
// ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// POST /api/upload
app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file' });
  res.json({
    success: true,
    url: `${CONFIG.BASE_URL}/uploads/${req.file.filename}`,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
});

// ─────────────────────────────────────────────
//  AUTH ROUTES
// ─────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role = 'student' } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: 'name, email, password required' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)',
      [name, email, hash, role]
    );
    const token = jwt.sign(
      { id: result.insertId, role },
      CONFIG.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({
      success: true,
      token,
      user: { id: result.insertId, name, email, role },
    });
  } catch (err) {
    const isDup = err.code === 'ER_DUP_ENTRY';
    res.status(isDup ? 409 : 500).json({
      success: false,
      error: isDup ? 'Email already exists' : err.message,
    });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, error: 'email and password required' });

    const [[user]] = await db.query('SELECT * FROM users WHERE email=?', [email]);
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      CONFIG.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
//  USER ROUTES
// ─────────────────────────────────────────────

// GET /api/users  — list users (for admin/finding people to chat with)
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const { role, search } = req.query;
    let sql = 'SELECT id, name, email, role, avatar_url, is_online, last_seen FROM users WHERE id != ?';
    const args = [req.user.id];

    if (role) { sql += ' AND role=?'; args.push(role); }
    if (search) { sql += ' AND name LIKE ?'; args.push(`%${search}%`); }

    sql += ' ORDER BY name ASC';
    const [rows] = await db.query(sql, args);
    res.json({ success: true, users: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
//  CHAT ROUTES
// ─────────────────────────────────────────────

// GET /api/chat/conversations
app.get('/api/chat/conversations', async (req, res) => {
  try {
    const u_id = 69;

    // 🔹 get internal ID
    const [userRows] = await db.query(
      `SELECT id FROM users WHERE user_id=?`,
      [u_id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const uid = userRows[0].id;

    console.log("✅ UID:", uid);

    // 🔹 main query
    const [rows] = await db.query(
      `SELECT
          c.id, c.type, c.name, c.avatar_url,

          lm.content        AS last_message,
          lm.message_type   AS last_message_type,
          lm.created_at     AS last_message_time,
          lm.sender_id      AS last_sender_id,

          (SELECT COUNT(*) FROM messages
           WHERE conversation_id=c.id 
           AND sender_id != ? 
           AND is_read = 0) AS unread_count,

          ou.user_id        AS other_user_id,
          ou.name           AS other_user_name,
          ou.avatar_url     AS other_user_avatar,
          ou.role           AS other_user_role,
          ou.is_online      AS other_user_online,
          ou.last_seen      AS other_user_last_seen

       FROM conversations c

       JOIN conversation_members cm  
         ON cm.conversation_id = c.id 
         AND cm.user_id = ?

       LEFT JOIN messages lm 
         ON lm.id = (
           SELECT id 
           FROM messages 
           WHERE conversation_id = c.id 
           ORDER BY created_at DESC 
           LIMIT 1
         )

       LEFT JOIN conversation_members cm2
         ON cm2.conversation_id = c.id 
         AND cm2.user_id != ? 
         AND c.type = 'direct'

       LEFT JOIN users ou 
         ON ou.user_id = cm2.user_id

       ORDER BY last_message_time DESC`,
      [uid, uid, uid]
    );

    console.log("🔥 ROWS:", rows);

    res.json({ success: true, conversations: rows });

  } catch (err) {
    console.log("❌ ERROR:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/chat/messages/:convId  — paginated (oldest first)
app.get('/api/chat/messages/:convId', authMiddleware, async (req, res) => {
  try {
    const convId = req.params.convId;
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const offset = parseInt(req.query.offset) || 0;

    // Auth: must be a member
    const [[mem]] = await db.query(
      'SELECT id FROM conversation_members WHERE conversation_id=? AND user_id=?',
      [convId, req.user.id]
    );
    if (!mem) return res.status(403).json({ success: false, error: 'Not a member' });

    const [msgs] = await db.query(
      `SELECT m.*, u.name AS sender_name, u.avatar_url AS sender_avatar, u.role AS sender_role
       FROM messages m
       JOIN users u ON u.id=m.sender_id
       WHERE m.conversation_id=?
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`,
      [convId, limit, offset]
    );
    res.json({ success: true, messages: msgs.reverse() });
  } catch (err) {

    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/chat/conversations/direct
app.post('/api/chat/conversations/direct', authMiddleware, async (req, res) => {
  try {
    const myId = req.user.id;
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ success: false, error: 'targetUserId required' });

    // Return existing if found
    const [[existing]] = await db.query(
      `SELECT c.id FROM conversations c
       JOIN conversation_members cm1 ON cm1.conversation_id=c.id AND cm1.user_id=?
       JOIN conversation_members cm2 ON cm2.conversation_id=c.id AND cm2.user_id=?
       WHERE c.type='direct' LIMIT 1`,
      [myId, targetUserId]
    );
    if (existing) return res.json({ success: true, conversationId: existing.id, isNew: false });

    const [r] = await db.query(
      'INSERT INTO conversations (type, created_by) VALUES (?,?)', ['direct', myId]
    );
    const cid = r.insertId;
    await db.query(
      'INSERT INTO conversation_members (conversation_id, user_id) VALUES (?,?),(?,?)',
      [cid, myId, cid, targetUserId]
    );
    res.json({ success: true, conversationId: cid, isNew: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/chat/conversations/group  (admin only)
app.post('/api/chat/conversations/group', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ success: false, error: 'Admin only' });

    const { name, memberIds = [] } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name required' });

    const [r] = await db.query(
      'INSERT INTO conversations (type, name, created_by) VALUES (?,?,?)',
      ['group', name, req.user.id]
    );
    const cid = r.insertId;

    const allMembers = [...new Set([req.user.id, ...memberIds.map(Number)])];
    await db.query(
      'INSERT INTO conversation_members (conversation_id, user_id) VALUES ?',
      [allMembers.map(uid => [cid, uid])]
    );
    res.json({ success: true, conversationId: cid });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/chat/conversations/:convId/members  (add member to group)
app.post('/api/chat/conversations/:convId/members', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.body;
    await db.query(
      'INSERT IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?,?)',
      [req.params.convId, userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
//  SOCKET.IO — REAL-TIME
// ─────────────────────────────────────────────
const onlineUsers = new Map();   // userId → socketId

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // ── 1. User comes online ──────────────────────────────────────
  socket.on('user_online', async ({ userId }) => {
    try {
      onlineUsers.set(String(userId), socket.id);
      socket.userId = String(userId);

      await db.query(
        'UPDATE users SET is_online=1, socket_id=?, last_seen=NOW() WHERE id=?',
        [socket.id, userId]
      );

      // Auto-join all conversation rooms
      const [rooms] = await db.query(
        'SELECT conversation_id FROM conversation_members WHERE user_id=?', [userId]
      );
      rooms.forEach(r => socket.join(`conv_${r.conversation_id}`));

      io.emit('user_status', { userId: Number(userId), isOnline: true });
      console.log(`[Socket] User ${userId} online`);
    } catch (err) {
      console.error('[user_online]', err.message);
    }
  });

  // ── 2. Send a message ─────────────────────────────────────────
  socket.on('send_message', async (data, ack) => {
    try {
      const {
        conversationId, senderId,
        messageType = 'text',
        content = null,
        fileUrl = null,
        fileName = null,
        fileSize = null,
        durationSec = null,
      } = data;

      // Validate sender is a member
      const [[mem]] = await db.query(
        'SELECT id FROM conversation_members WHERE conversation_id=? AND user_id=?',
        [conversationId, senderId]
      );
      if (!mem) {
        if (ack) ack({ success: false, error: 'Not a member of this conversation' });
        return;
      }

      // Insert message
      const [result] = await db.query(
        `INSERT INTO messages
           (conversation_id, sender_id, message_type, content,
            file_url, file_name, file_size, duration_sec)
         VALUES (?,?,?,?,?,?,?,?)`,
        [conversationId, senderId, messageType, content,
          fileUrl, fileName, fileSize, durationSec]
      );

      // Fetch full message with sender info
      const [[msg]] = await db.query(
        `SELECT m.*, u.name AS sender_name, u.avatar_url AS sender_avatar, u.role AS sender_role
         FROM messages m JOIN users u ON u.id=m.sender_id
         WHERE m.id=?`,
        [result.insertId]
      );

      // Broadcast to conversation room
      io.to(`conv_${conversationId}`).emit('new_message', msg);

      if (ack) ack({ success: true, message: msg });
      console.log(`[Message] conv:${conversationId} type:${messageType} from:${senderId}`);
    } catch (err) {
      console.error('[send_message]', err.message);
      if (ack) ack({ success: false, error: err.message });
    }
  });

  // ── 3. Mark messages as read ──────────────────────────────────
  socket.on('mark_read', async ({ conversationId, userId }) => {
    try {
      const [unread] = await db.query(
        'SELECT id FROM messages WHERE conversation_id=? AND sender_id!=? AND is_read=0',
        [conversationId, userId]
      );
      if (!unread.length) return;

      const ids = unread.map(r => r.id);
      await db.query('UPDATE messages SET is_read=1 WHERE id IN (?)', [ids]);
      await db.query(
        'INSERT IGNORE INTO message_reads (message_id, user_id) VALUES ?',
        [ids.map(id => [id, userId])]
      );

      io.to(`conv_${conversationId}`).emit('messages_read', {
        conversationId, userId, messageIds: ids,
      });
    } catch (err) {
      console.error('[mark_read]', err.message);
    }
  });

  // ── 4. Typing indicators ──────────────────────────────────────
  socket.on('typing_start', ({ conversationId, userId, userName }) => {
    socket.to(`conv_${conversationId}`)
      .emit('typing_start', { conversationId, userId, userName });
  });

  socket.on('typing_stop', ({ conversationId, userId }) => {
    socket.to(`conv_${conversationId}`)
      .emit('typing_stop', { conversationId, userId });
  });

  // ── 5. Disconnect ─────────────────────────────────────────────
  socket.on('disconnect', async () => {
    const userId = socket.userId;
    if (userId) {
      onlineUsers.delete(userId);
      await db.query(
        'UPDATE users SET is_online=0, last_seen=NOW() WHERE id=?', [userId]
      ).catch(() => { });
      io.emit('user_status', { userId: Number(userId), isOnline: false });
      console.log(`[Socket] User ${userId} offline`);
    }
  });
});

// ─────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────
(async () => {
  try {
    // Test DB connection
    await db.query('SELECT 1');
    console.log('✅ MySQL connected');

    // Run schema migrations
    await runSchema();

    // Start HTTP + Socket server
    server.listen(CONFIG.PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════╗');
      console.log(`║  📚 BookMyTeacher Chat Server            ║`);
      console.log(`║  🌐 ${CONFIG.BASE_URL.padEnd(38)}║`);
      console.log(`║  🔌 Socket.IO ready                      ║`);
      console.log(`║  🗄  MySQL → ${CONFIG.DB_NAME.padEnd(28)}║`);
      console.log('╚══════════════════════════════════════════╝');
      console.log('');
      console.log('  Open browser → ' + CONFIG.BASE_URL);
      console.log('');
    });
  } catch (err) {
    console.error('❌ Startup failed:', err.message);
    console.error('   Check your DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in CONFIG above');
    process.exit(1);
  }
})();
