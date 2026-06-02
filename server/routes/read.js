const express = require("express");
const { pool } = require("../db");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// Records the current board visit and returns the previous visited_at + all thread reads.
// Called once on board mount so the frontend knows which messages/replies are new.
router.post("/board", requireAuth, async (req, res) => {
  const userId = req.user.user_id;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: visitRows } = await client.query(
      "SELECT visited_at FROM user_board_visits WHERE user_id = $1",
      [userId]
    );
    const prevVisitedAt = visitRows.length > 0 ? visitRows[0].visited_at : null;

    const { rows: readRows } = await client.query(
      "SELECT message_id, read_at FROM user_thread_reads WHERE user_id = $1",
      [userId]
    );

    await client.query(
      `INSERT INTO user_board_visits (user_id, visited_at) VALUES ($1, NOW())
       ON CONFLICT (user_id) DO UPDATE SET visited_at = NOW()`,
      [userId]
    );

    await client.query("COMMIT");

    const threadReads = {};
    readRows.forEach((r) => { threadReads[r.message_id] = r.read_at; });

    res.json({ prev_visited_at: prevVisitedAt, thread_reads: threadReads });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to record board visit" });
  } finally {
    client.release();
  }
});

// Marks a thread as read at the current time.
router.post("/thread/:id", requireAuth, async (req, res) => {
  const userId = req.user.user_id;
  const messageId = parseInt(req.params.id);
  try {
    await pool.query(
      `INSERT INTO user_thread_reads (user_id, message_id, read_at) VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, message_id) DO UPDATE SET read_at = NOW()`,
      [userId, messageId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to mark thread as read" });
  }
});

module.exports = router;
