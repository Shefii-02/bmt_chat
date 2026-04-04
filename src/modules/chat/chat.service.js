const db = require("../../config/db");

exports.saveMessage = async (data) => {
  const { course_id, class_id, sender_id, sender_role, message } = data;

  const [res] = await db.query(`
    INSERT INTO class_messages
    (course_id, class_id, sender_id, sender_role, message)
    VALUES (?, ?, ?, ?, ?)
  `, [course_id, class_id, sender_id, sender_role, message]);

  return {
    id: res.insertId,
    ...data,
    created_at: new Date()
  };
};

exports.getMessages = async (classId, page) => {
  const limit = 50;
  const offset = (page - 1) * limit;

  const [rows] = await db.query(`
    SELECT * FROM class_messages
    WHERE class_id = ?
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `, [classId, limit, offset]);

  return rows.reverse();
};
