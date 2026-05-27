const express = require("express");
const crypto = require("crypto");
const { pool } = require("../db");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: SEVEN_DAYS,
};

const hashPassword = (password, salt) =>
  new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, 64, (err, key) =>
      err ? reject(err) : resolve(key.toString("hex"))
    )
  );

const createSession = async (userId) => {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SEVEN_DAYS);
  await pool.query(
    "INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)",
    [userId, token, expiresAt]
  );
  return token;
};

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: "username, email, and password are required" });

  try {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = await hashPassword(password, salt);
    const passwordHash = `${salt}:${hash}`;

    const { rows } = await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email",
      [username.trim(), email.trim().toLowerCase(), passwordHash]
    );
    const user = rows[0];
    const token = await createSession(user.id);
    res.cookie("session_token", token, COOKIE_OPTIONS);
    res.status(201).json({ id: user.id, username: user.username, email: user.email });
  } catch (err) {
    if (err.constraint === "users_username_key")
      return res.status(409).json({ error: "Username already taken" });
    if (err.constraint === "users_email_key")
      return res.status(409).json({ error: "Email already registered" });
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "email and password are required" });

  try {
    const { rows } = await pool.query(
      "SELECT id, username, email, password_hash FROM users WHERE email = $1",
      [email.trim().toLowerCase()]
    );
    if (rows.length === 0)
      return res.status(401).json({ error: "Invalid email or password" });

    const user = rows[0];
    const [salt, storedHash] = user.password_hash.split(":");
    const hash = await hashPassword(password, salt);

    if (hash !== storedHash)
      return res.status(401).json({ error: "Invalid email or password" });

    const token = await createSession(user.id);
    res.cookie("session_token", token, COOKIE_OPTIONS);
    res.json({ id: user.id, username: user.username, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
  const token = req.cookies.session_token;
  if (token) {
    await pool.query("DELETE FROM sessions WHERE token = $1", [token]).catch(() => {});
  }
  res.clearCookie("session_token");
  res.json({ ok: true });
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

module.exports = router;
