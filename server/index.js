require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const { initDb } = require("./db");
const authRouter = require("./routes/auth");
const messagesRouter = require("./routes/messages");
const rankingsRouter = require("./routes/rankings");

const uploadsDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  "http://localhost:3000",
  "https://www.olivialovesmiles.com",
];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/uploads", express.static(uploadsDir));
app.use("/api/auth", authRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/rankings", rankingsRouter);
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Serve React build in production
const buildDir = path.join(__dirname, "../build");
if (fs.existsSync(buildDir)) {
  app.use(express.static(buildDir));
  // Let React Router handle all non-API routes
  app.get("*", (req, res) => res.sendFile(path.join(buildDir, "index.html")));
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initDb()
    .then(() => console.log("Database initialized"))
    .catch((err) => console.error("Failed to initialize database:", err));
});
