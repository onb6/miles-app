const { pool } = require("../db");

const requireAuth = async (req, res, next) => {
  const token = req.cookies.session_token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { rows } = await pool.query(
      `SELECT s.user_id, u.username, u.email
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );
    if (rows.length === 0) return res.status(401).json({ error: "Session expired" });
    req.user = rows[0];
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Auth check failed" });
  }
};

module.exports = requireAuth;
