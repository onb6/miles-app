const express = require("express");
const { pool } = require("../db");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// GET /api/stamps/wishlist — return slugs in the current user's wishlist
router.get("/wishlist", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT slug FROM stamp_wishlist WHERE user_id = $1 ORDER BY added_at",
      [req.user.user_id]
    );
    res.json(rows.map((r) => r.slug));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch wishlist" });
  }
});

// POST /api/stamps/wishlist/:slug — add to wishlist, remove from collection
router.post("/wishlist/:slug", requireAuth, async (req, res) => {
  const { user_id } = req.user;
  const { slug } = req.params;
  try {
    await pool.query("BEGIN");
    await pool.query(
      "DELETE FROM stamp_collection WHERE user_id = $1 AND slug = $2",
      [user_id, slug]
    );
    await pool.query(
      "INSERT INTO stamp_wishlist (user_id, slug) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [user_id, slug]
    );
    await pool.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to add to wishlist" });
  }
});

// DELETE /api/stamps/wishlist/:slug — remove a stamp from the wishlist
router.delete("/wishlist/:slug", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM stamp_wishlist WHERE user_id = $1 AND slug = $2",
      [req.user.user_id, req.params.slug]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove from wishlist" });
  }
});

// GET /api/stamps/collection — return slugs in the current user's collection
router.get("/collection", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT slug FROM stamp_collection WHERE user_id = $1 ORDER BY added_at",
      [req.user.user_id]
    );
    res.json(rows.map((r) => r.slug));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch collection" });
  }
});

// POST /api/stamps/collection/:slug — add to collection, remove from wishlist
router.post("/collection/:slug", requireAuth, async (req, res) => {
  const { user_id } = req.user;
  const { slug } = req.params;
  try {
    await pool.query("BEGIN");
    await pool.query(
      "DELETE FROM stamp_wishlist WHERE user_id = $1 AND slug = $2",
      [user_id, slug]
    );
    await pool.query(
      "INSERT INTO stamp_collection (user_id, slug) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [user_id, slug]
    );
    await pool.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to add to collection" });
  }
});

// DELETE /api/stamps/collection/:slug — remove a stamp from the collection
router.delete("/collection/:slug", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM stamp_collection WHERE user_id = $1 AND slug = $2",
      [req.user.user_id, req.params.slug]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove from collection" });
  }
});

// GET /api/stamps/goals — current user's goals with their linked filters
router.get("/goals", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT g.id, g.title, g.completed, g.created_at,
         COALESCE(
           json_agg(json_build_object('filter_type', gf.filter_type, 'filter_value', gf.filter_value))
           FILTER (WHERE gf.id IS NOT NULL),
           '[]'
         ) AS filters
       FROM stamp_goals g
       LEFT JOIN stamp_goal_filters gf ON gf.goal_id = g.id
       WHERE g.user_id = $1
       GROUP BY g.id
       ORDER BY g.created_at`,
      [req.user.user_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch goals" });
  }
});

// POST /api/stamps/goals — create a new goal
router.post("/goals", requireAuth, async (req, res) => {
  const { title, filters = [] } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "Title required" });
  try {
    await pool.query("BEGIN");
    const { rows } = await pool.query(
      "INSERT INTO stamp_goals (user_id, title) VALUES ($1, $2) RETURNING id, title, completed, created_at",
      [req.user.user_id, title.trim()]
    );
    const goal = rows[0];
    for (const { filter_type, filter_value } of filters) {
      await pool.query(
        "INSERT INTO stamp_goal_filters (goal_id, filter_type, filter_value) VALUES ($1, $2, $3)",
        [goal.id, filter_type, filter_value]
      );
    }
    await pool.query("COMMIT");
    res.json({ ...goal, filters });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to create goal" });
  }
});

// PATCH /api/stamps/goals/:id — toggle completion (own goals only)
router.patch("/goals/:id", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE stamp_goals SET completed = NOT completed
       WHERE id = $1 AND user_id = $2
       RETURNING completed`,
      [req.params.id, req.user.user_id]
    );
    if (!rows.length) return res.status(404).json({ error: "Goal not found" });
    res.json({ completed: rows[0].completed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update goal" });
  }
});

// PUT /api/stamps/goals/:id — update title and filters (own goals only)
router.put("/goals/:id", requireAuth, async (req, res) => {
  const { title, filters = [] } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "Title required" });
  try {
    await pool.query("BEGIN");
    const { rows } = await pool.query(
      `UPDATE stamp_goals SET title = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, title, completed, created_at`,
      [title.trim(), req.params.id, req.user.user_id]
    );
    if (!rows.length) {
      await pool.query("ROLLBACK");
      return res.status(404).json({ error: "Goal not found" });
    }
    await pool.query("DELETE FROM stamp_goal_filters WHERE goal_id = $1", [req.params.id]);
    for (const { filter_type, filter_value } of filters) {
      await pool.query(
        "INSERT INTO stamp_goal_filters (goal_id, filter_type, filter_value) VALUES ($1, $2, $3)",
        [req.params.id, filter_type, filter_value]
      );
    }
    await pool.query("COMMIT");
    res.json({ ...rows[0], filters });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to update goal" });
  }
});

// DELETE /api/stamps/goals/:id — delete a goal (own goals only)
router.delete("/goals/:id", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM stamp_goals WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.user_id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete goal" });
  }
});

// GET /api/stamps/user/:username/goals — another user's goals (read-only)
router.get("/user/:username/goals", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT g.id, g.title, g.completed, g.created_at,
         COALESCE(
           json_agg(json_build_object('filter_type', gf.filter_type, 'filter_value', gf.filter_value))
           FILTER (WHERE gf.id IS NOT NULL),
           '[]'
         ) AS filters
       FROM stamp_goals g
       JOIN users u ON u.id = g.user_id
       LEFT JOIN stamp_goal_filters gf ON gf.goal_id = g.id
       WHERE LOWER(u.username) = LOWER($1)
       GROUP BY g.id
       ORDER BY g.created_at`,
      [req.params.username]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch goals" });
  }
});

// GET /api/stamps/users — list all other users with wishlist/collection counts
router.get("/users", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.username,
         COUNT(DISTINCT w.slug) AS wishlist_count,
         COUNT(DISTINCT c.slug) AS collection_count
       FROM users u
       LEFT JOIN stamp_wishlist w ON w.user_id = u.id
       LEFT JOIN stamp_collection c ON c.user_id = u.id
       WHERE u.id != $1
       GROUP BY u.username
       ORDER BY u.username`,
      [req.user.user_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// GET /api/stamps/user/:username/wishlist — another user's wishlist slugs
router.get("/user/:username/wishlist", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT w.slug FROM stamp_wishlist w
       JOIN users u ON u.id = w.user_id
       WHERE LOWER(u.username) = LOWER($1)
       ORDER BY w.added_at`,
      [req.params.username]
    );
    res.json(rows.map((r) => r.slug));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch wishlist" });
  }
});

// GET /api/stamps/user/:username/collection — another user's collection slugs
router.get("/user/:username/collection", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.slug FROM stamp_collection c
       JOIN users u ON u.id = c.user_id
       WHERE LOWER(u.username) = LOWER($1)
       ORDER BY c.added_at`,
      [req.params.username]
    );
    res.json(rows.map((r) => r.slug));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch collection" });
  }
});

module.exports = router;
