const { getDB } = require("../config/database");

/**
 * GET /api/chat/conversations
 * Returns all conversations for the authenticated user,
 * with last message, unread count, and other-user info.
 */
const getConversations = async (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.data.id;

    const [rows] = await db.query(
      `
      SELECT
        c.id,
        c.name,
        c.type,
        c.avatar_url,

        m.id            AS last_message_id,
        m.content       AS last_message,
        m.message_type  AS last_message_type,
        m.created_at    AS last_message_time,
        m.sender_id     AS last_sender_id,

        COUNT(CASE
          WHEN m2.sender_id != ? AND mr.id IS NULL THEN 1
        END) AS unread_count,

        u.user_id    AS other_user_id,
        u.name       AS other_user_name,
        u.avatar_url AS other_user_avatar,
        u.is_online  AS other_user_online,
        u.last_seen  AS other_user_last_seen,
        u.role       AS acc_type

      FROM conversation_members cm
      JOIN conversations c ON c.id = cm.conversation_id

      LEFT JOIN messages m
        ON m.id = (
          SELECT id FROM messages
          WHERE conversation_id = c.id
          ORDER BY id DESC LIMIT 1
        )

      LEFT JOIN messages m2
        ON m2.conversation_id = c.id

      LEFT JOIN message_reads mr
        ON mr.message_id = m2.id AND mr.user_id = ?

      LEFT JOIN conversation_members cm2
        ON cm2.conversation_id = c.id
        AND cm2.user_id != ?
        AND c.type = 'direct'

      LEFT JOIN users u ON u.user_id = cm2.user_id

      WHERE cm.user_id = ?

      GROUP BY c.id

      ORDER BY last_message_time DESC
      `,
      [userId, userId, userId, userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("[getConversations]", err.message);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
};

/**
 * GET /api/chat/messages/:id?limit=30&offset=0
 * Returns paginated messages for a conversation.
 */
const getMessages = async (req, res) => {
  try {
    const db = getDB();
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
  } catch (err) {
    console.error("[getMessages]", err.message);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

/**
 * POST /api/chat/create
 * Creates a direct conversation or returns the existing one.
 * Body: { targetUserId }
 */
const createConversation = async (req, res) => {
  try {
    const db = getDB();
    const myId = req.user.data.id;
    const { targetUserId } = req.body;

    if (!targetUserId)
      return res.status(400).json({ error: "targetUserId required" });

    // Return existing conversation if found
    const [existing] = await db.query(
      `
      SELECT cm1.conversation_id AS id
      FROM conversation_members cm1
      JOIN conversation_members cm2
        ON cm1.conversation_id = cm2.conversation_id
      JOIN conversations c ON c.id = cm1.conversation_id
      WHERE cm1.user_id = ? AND cm2.user_id = ? AND c.type = 'direct'
      LIMIT 1
      `,
      [myId, targetUserId]
    );

    if (existing.length > 0) {
      return res.json({ conversationId: existing[0].id, existing: true });
    }

    const [r] = await db.query(
      "INSERT INTO conversations (type, created_by) VALUES ('direct', ?)",
      [myId]
    );
    const cid = r.insertId;

    await db.query(
      "INSERT INTO conversation_members VALUES (?,?), (?,?)",
      [cid, myId, cid, targetUserId]
    );

    res.json({ conversationId: cid, existing: false });
  } catch (err) {
    console.error("[createConversation]", err.message);
    res.status(500).json({ error: "Failed to create conversation" });
  }
};

module.exports = { getConversations, getMessages, createConversation };