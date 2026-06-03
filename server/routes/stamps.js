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
