const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

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
    key: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });
} else {
  storage = multer.diskStorage({
    destination: path.join(__dirname, "../uploads"),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });
}

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

module.exports = { upload, USE_S3, s3 };
