const express = require("express");
const { pool } = require("../db");

const router = express.Router();

// GET /api/messages
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

// POST /api/messages
router.post("/", async (req, res) => {
  const { content, author } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: "content is required" });
  }
  try {
    const { rows } = await pool.query(
      "INSERT INTO messages (content, author) VALUES ($1, $2) RETURNING *",
      [content.trim(), (author || "Anonymous").trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create message" });
  }
});

// DELETE /api/messages/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM messages WHERE id = $1",
      [id]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Message not found" });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

module.exports = router;
