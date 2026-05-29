const express = require("express");
const { pool } = require("../db");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// GET /api/rankings — all users' rankings grouped by user
router.get("/", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.username, r.flavor, r.position
      FROM olipop_rankings r
      JOIN users u ON r.user_id = u.id
      ORDER BY u.username, r.position
    `);

    const byUser = {};
    for (const row of rows) {
      if (!byUser[row.username]) byUser[row.username] = [];
      byUser[row.username].push(row.flavor);
    }
    res.json(Object.entries(byUser).map(([username, flavors]) => ({ username, flavors })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch rankings" });
  }
});

// GET /api/rankings/me — current user's ranking
router.get("/me", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT flavor FROM olipop_rankings WHERE user_id = $1 ORDER BY position",
      [req.user.user_id]
    );
    res.json(rows.map((r) => r.flavor));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch your ranking" });
  }
});

// PUT /api/rankings — replace current user's full ranking
router.put("/", requireAuth, async (req, res) => {
  const { flavors } = req.body;
  if (!Array.isArray(flavors)) return res.status(400).json({ error: "flavors must be an array" });

  try {
    await pool.query("DELETE FROM olipop_rankings WHERE user_id = $1", [req.user.user_id]);
    for (let i = 0; i < flavors.length; i++) {
      await pool.query(
        "INSERT INTO olipop_rankings (user_id, flavor, position) VALUES ($1, $2, $3)",
        [req.user.user_id, flavors[i], i + 1]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save ranking" });
  }
});

module.exports = router;
