const CONFIG = require("../config");

/**
 * POST /api/upload
 * Accepts a single file (voice, PDF, DOCX, etc.) via multipart/form-data.
 * Returns the public URL, original name, and size.
 */
const uploadFile = (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file received" });

  res.json({
    url: `${CONFIG.BASE_URL}/uploads/${req.file.filename}`,
    originalName: req.file.originalname,
    size: req.file.size,
  });
};

module.exports = { uploadFile };