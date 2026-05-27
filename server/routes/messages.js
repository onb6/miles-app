const express = require("express");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { pool } = require("../db");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, "../uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

// GET /api/messages — public
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM messages ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// POST /api/messages — requires auth
router.post("/", requireAuth, upload.single("image"), async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim())
    return res.status(400).json({ error: "content is required" });

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const { rows } = await pool.query(
      "INSERT INTO messages (content, user_id, author, image_url) VALUES ($1, $2, $3, $4) RETURNING *",
      [content.trim(), req.user.user_id, req.user.username, imageUrl]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create message" });
  }
});

// PATCH /api/messages/:id — requires auth, only own messages
router.patch("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  if (!content || !content.trim())
    return res.status(400).json({ error: "content is required" });

  try {
    const { rows, rowCount } = await pool.query(
      "UPDATE messages SET content = $1 WHERE id = $2 AND user_id = $3 RETURNING *",
      [content.trim(), id, req.user.user_id]
    );
    if (rowCount === 0)
      return res.status(404).json({ error: "Message not found or not yours" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update message" });
  }
});

// DELETE /api/messages/:id — requires auth, only own messages
router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM messages WHERE id = $1 AND user_id = $2",
      [id, req.user.user_id]
    );
    if (rowCount === 0)
      return res.status(404).json({ error: "Message not found or not yours" });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

module.exports = router;
