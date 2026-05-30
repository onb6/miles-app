const express = require("express");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { pool } = require("../db");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

const USE_S3 = !!(
  process.env.BUCKET_ENDPOINT &&
  process.env.BUCKET_NAME &&
  process.env.BUCKET_ACCESS_KEY &&
  process.env.BUCKET_SECRET_KEY
);

let storage;
if (USE_S3) {
  const multerS3 = require("multer-s3");
  const { S3Client } = require("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: process.env.BUCKET_REGION,
    endpoint: `https://${process.env.BUCKET_ENDPOINT}`,
    credentials: {
      accessKeyId: process.env.BUCKET_ACCESS_KEY,
      secretAccessKey: process.env.BUCKET_SECRET_KEY,
    },
    forcePathStyle: true,
  });
  storage = multerS3({
    s3,
    bucket: process.env.BUCKET_NAME,
    acl: "public-read",
    contentType: multerS3.AUTO_CONTENT_TYPE,
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

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
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
    const { rows } = await pool.query(
      "SELECT * FROM messages ORDER BY created_at DESC",
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
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
router.post("/", requireAuth, upload.single("image"), async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim())
    return res.status(400).json({ error: "content is required" });

  const imageUrl = req.file
    ? USE_S3
      ? `https://${process.env.BUCKET_ENDPOINT}/${process.env.BUCKET_NAME}/${req.file.key}`
      : `/uploads/${req.file.filename}`
    : null;

  try {
    const { rows } = await pool.query(
      "INSERT INTO messages (content, user_id, author, image_url) VALUES ($1, $2, $3, $4) RETURNING *",
      [content.trim(), req.user.user_id, req.user.username, imageUrl],
    );
    res.status(201).json(rows[0]);
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
