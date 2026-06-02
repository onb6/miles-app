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

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username: { type: string, example: miles }
 *               email: { type: string, format: email, example: miles@example.com }
 *               password: { type: string, example: hunter2 }
 *     responses:
 *       201:
 *         description: User created and session cookie set
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Missing fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Username or email already taken
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
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

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: miles@example.com }
 *               password: { type: string, example: hunter2 }
 *     responses:
 *       200:
 *         description: Logged in and session cookie set
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Missing fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post("/login", async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password)
    return res.status(400).json({ error: "email/username and password are required" });

  try {
    const normalized = identifier.trim().toLowerCase();
    const { rows } = await pool.query(
      "SELECT id, username, email, password_hash FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1",
      [normalized]
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

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Log out and clear session cookie
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 */
router.post("/logout", async (req, res) => {
  const token = req.cookies.session_token;
  if (token) {
    await pool.query("DELETE FROM sessions WHERE token = $1", [token]).catch(() => {});
  }
  res.clearCookie("session_token");
  res.json({ ok: true });
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get the currently authenticated user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

module.exports = router;
