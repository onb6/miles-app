require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { initDb } = require("./db");
const messagesRouter = require("./routes/messages");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/messages", messagesRouter);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
