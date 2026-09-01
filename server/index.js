require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const { pool, initDb } = require("./db");
const authRouter = require("./routes/auth");
const messagesRouter = require("./routes/messages");
const rankingsRouter = require("./routes/rankings");
const readRouter = require("./routes/read");
const stampsRouter = require("./routes/stamps");

const uploadsDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  "http://localhost:3000",
  "https://www.olivialovesmiles.com",
];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Socket.io with CORS matching express
const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
});

// Authenticate socket connections via session cookie
io.use(async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie || "";
    const match = cookieHeader.match(/session_token=([^;]+)/);
    const token = match ? decodeURIComponent(match[1]) : null;
    if (!token) return next(new Error("Unauthorized"));
    const { rows } = await pool.query(
      `SELECT s.user_id, u.username FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );
    if (!rows.length) return next(new Error("Session expired"));
    socket.user = rows[0];
    next();
  } catch (err) {
    next(new Error("Auth failed"));
  }
});

// userId → socketId → {userId, username} per room
const roomUsers = new Map();

io.on("connection", (socket) => {
  const leaveRoom = (room) => {
    const users = roomUsers.get(room);
    if (!users) return;
    users.delete(socket.id);
    if (users.size === 0) roomUsers.delete(room);
    socket.to(room).emit("presence-left", { userId: socket.user.user_id });
  };

  socket.on("join-list", (listId) => {
    const room = `list:${listId}`;
    socket.join(room);
    if (!roomUsers.has(room)) roomUsers.set(room, new Map());
    const users = roomUsers.get(room);
    // Send existing occupants to the newcomer
    socket.emit("presence-init", [...users.values()]);
    // Register and announce arrival
    users.set(socket.id, { userId: socket.user.user_id, username: socket.user.username });
    socket.to(room).emit("presence-joined", {
      userId: socket.user.user_id,
      username: socket.user.username,
    });
    socket.data.currentRoom = room;
  });

  socket.on("leave-list", (listId) => {
    const room = `list:${listId}`;
    leaveRoom(room);
    socket.leave(room);
    socket.data.currentRoom = null;
  });

  socket.on("user-activity", ({ listId, type, itemId, field }) => {
    socket.to(`list:${listId}`).emit("user-activity", {
      userId: socket.user.user_id,
      username: socket.user.username,
      type,
      itemId: itemId || null,
      field: field || null,
    });
  });

  socket.on("disconnect", () => {
    if (socket.data.currentRoom) leaveRoom(socket.data.currentRoom);
  });
});

app.use("/uploads", express.static(uploadsDir));
app.use("/api/auth", authRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/rankings", rankingsRouter);
app.use("/api/read", readRouter);
app.use("/api/stamps", stampsRouter);
app.use("/api/todos", require("./routes/todos")(io));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Serve React build in production
const buildDir = path.join(__dirname, "../build");
if (fs.existsSync(buildDir)) {
  app.use(express.static(buildDir));
  app.get("*", (req, res) => res.sendFile(path.join(buildDir, "index.html")));
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initDb()
    .then(() => console.log("Database initialized"))
    .catch((err) => console.error("Failed to initialize database:", err));
});
