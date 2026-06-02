const express = require("express");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { Resend } = require("resend");
const { pool } = require("../db");
const requireAuth = require("../middleware/requireAuth");

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const APP_URL = process.env.APP_URL || "";
const FROM = process.env.RESEND_FROM || "For Miles <notifications@yourdomain.com>";

async function notifyNewMessage(message, posterUserId) {
  if (!resend) return;
  try {
    const { rows } = await pool.query(
      "SELECT email FROM users WHERE id != $1",
      [posterUserId]
    );
    if (rows.length === 0) return;
    await resend.emails.send({
      from: FROM,
      to: rows.map((r) => r.email),
      subject: `New message from ${message.author}`,
      html: `<p><strong>${message.author}</strong> posted on the message board:</p><blockquote style="border-left:3px solid #ccc;padding-left:1em;color:#555">${message.content}</blockquote><p><a href="${APP_URL}">View it here</a></p>`,
    });
  } catch (err) {
    console.error("Email notification failed:", err);
  }
}

async function notifyNewReply(reply, parentId, replierUserId) {
  if (!resend) return;
  try {
    const { rows } = await pool.query(
      `SELECT u.email FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.id = $1 AND m.user_id != $2`,
      [parentId, replierUserId]
    );
    if (rows.length === 0) return;
    await resend.emails.send({
      from: FROM,
      to: rows[0].email,
      subject: `${reply.author} replied to your message`,
      html: `<p><strong>${reply.author}</strong> replied to your message:</p><blockquote style="border-left:3px solid #ccc;padding-left:1em;color:#555">${reply.content}</blockquote><p><a href="${APP_URL}">View it here</a></p>`,
    });
  } catch (err) {
    console.error("Email notification failed:", err);
  }
}

const router = express.Router();

const USE_S3 = !!(
  process.env.BUCKET_ENDPOINT &&
  process.env.BUCKET_NAME &&
  process.env.BUCKET_ACCESS_KEY &&
  process.env.BUCKET_SECRET_KEY
);

let s3, storage;
if (USE_S3) {
  const multerS3 = require("multer-s3");
  const { S3Client } = require("@aws-sdk/client-s3");
  const endpoint = process.env.BUCKET_ENDPOINT.startsWith("http")
    ? process.env.BUCKET_ENDPOINT
    : `https://${process.env.BUCKET_ENDPOINT}`;
  s3 = new S3Client({
    region: process.env.BUCKET_REGION,
    endpoint,
    credentials: {
      accessKeyId: process.env.BUCKET_ACCESS_KEY,
      secretAccessKey: process.env.BUCKET_SECRET_KEY,
    },
    forcePathStyle: true,
  });
  storage = multerS3({
    s3,
    bucket: process.env.BUCKET_NAME,
    contentType: (_req, file, cb) => cb(null, file.mimetype),
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });
} else {
  storage = multer.diskStorage({
    destination: path.join(__dirname, "../uploads"),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });
}

// Proxy S3 files through the server so the bucket doesn't need public access
router.get("/uploads/:key", async (req, res) => {
  if (!USE_S3) return res.status(404).json({ error: "Not found" });
  try {
    const { GetObjectCommand } = require("@aws-sdk/client-s3");
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: req.params.key,
      }),
    );
    res.set("Content-Type", response.ContentType);
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    response.Body.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: "File not found" });
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

/**
 * @swagger
 * /api/messages:
 *   get:
 *     summary: Get all messages (newest first)
 *     tags: [Messages]
 *     responses:
 *       200:
 *         description: List of messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Message' }
 */
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT m.*, COALESCE(COUNT(r.id), 0)::int AS reply_count,
             MAX(r.created_at) AS latest_reply_at
      FROM messages m
      LEFT JOIN messages r ON r.parent_id = m.id
      WHERE m.parent_id IS NULL
      GROUP BY m.id
      ORDER BY m.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.get("/:id/replies", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM messages WHERE parent_id = $1 ORDER BY created_at ASC",
      [req.params.id],
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch replies" });
  }
});

/**
 * @swagger
 * /api/messages:
 *   post:
 *     summary: Create a new message (with optional image)
 *     tags: [Messages]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string, example: Hello Miles! }
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Message created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Message' }
 *       400:
 *         description: Missing content
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post("/", requireAuth, async (req, res) => {
  await new Promise((resolve, reject) =>
    upload.single("image")(req, res, (err) => (err ? reject(err) : resolve())),
  ).catch((err) => {
    console.error("Upload error:", err);
    return res.status(500).json({ error: err.message || "Upload failed" });
  });
  if (res.headersSent) return;

  const { content, parent_id } = req.body;
  if (!content || !content.trim())
    return res.status(400).json({ error: "content is required" });

  const imageUrl = req.file
    ? USE_S3
      ? `/api/messages/uploads/${req.file.key}`
      : `/uploads/${req.file.filename}`
    : null;

  const parentId = parent_id ? parseInt(parent_id) : null;

  try {
    const { rows } = await pool.query(
      "INSERT INTO messages (content, user_id, author, image_url, parent_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [content.trim(), req.user.user_id, req.user.username, imageUrl, parentId],
    );
    const message = rows[0];
    res.status(201).json(message);

    if (parentId) {
      notifyNewReply(message, parentId, req.user.user_id);
    } else {
      notifyNewMessage(message, req.user.user_id);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create message" });
  }
});

/**
 * @swagger
 * /api/messages/{id}:
 *   patch:
 *     summary: Edit your own message
 *     tags: [Messages]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string, example: Updated message }
 *     responses:
 *       200:
 *         description: Updated message
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Message' }
 *       400:
 *         description: Missing content
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Message not found or not yours
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  if (!content || !content.trim())
    return res.status(400).json({ error: "content is required" });

  try {
    const { rows, rowCount } = await pool.query(
      "UPDATE messages SET content = $1 WHERE id = $2 AND user_id = $3 RETURNING *",
      [content.trim(), id, req.user.user_id],
    );
    if (rowCount === 0)
      return res.status(404).json({ error: "Message not found or not yours" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update message" });
  }
});

/**
 * @swagger
 * /api/messages/{id}:
 *   delete:
 *     summary: Delete your own message
 *     tags: [Messages]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Deleted
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Message not found or not yours
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM messages WHERE id = $1 AND user_id = $2",
      [id, req.user.user_id],
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
