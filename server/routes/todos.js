const express = require("express");
const { pool } = require("../db");
const requireAuth = require("../middleware/requireAuth");
const { upload, USE_S3, s3 } = require("../middleware/upload");

module.exports = (io) => {
  const router = express.Router();

  const broadcastToList = (listId, event, data) => {
    io.to(`list:${listId}`).emit(event, data);
  };

  // GET /api/todos — all lists, newest updated first
  router.get("/", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM todo_lists ORDER BY updated_at DESC"
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch lists" });
    }
  });

  // POST /api/todos — create new list
  router.post("/", requireAuth, async (req, res) => {
    const { title = "Untitled List" } = req.body;
    try {
      const { rows } = await pool.query(
        "INSERT INTO todo_lists (title) VALUES ($1) RETURNING *",
        [title.trim() || "Untitled List"]
      );
      const list = rows[0];
      io.emit("list-added", list);
      res.status(201).json(list);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create list" });
    }
  });

  // PATCH /api/todos/:id — update list (title, start_date, end_date)
  router.patch("/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { title, start_date, end_date } = req.body;

    const sets = ["updated_at = NOW()"];
    const vals = [];
    let idx = 1;
    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ error: "title cannot be empty" });
      sets.push(`title = $${idx++}`);
      vals.push(title.trim());
    }
    if (start_date !== undefined) { sets.push(`start_date = $${idx++}`); vals.push(start_date || null); }
    if (end_date !== undefined)   { sets.push(`end_date = $${idx++}`);   vals.push(end_date || null); }
    vals.push(id);

    try {
      const { rows, rowCount } = await pool.query(
        `UPDATE todo_lists SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
        vals
      );
      if (rowCount === 0) return res.status(404).json({ error: "List not found" });
      const list = rows[0];
      broadcastToList(id, "list-updated", list);
      res.json(list);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update list" });
    }
  });

  // DELETE /api/todos/:id — delete list
  router.delete("/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
      const { rowCount } = await pool.query(
        "DELETE FROM todo_lists WHERE id = $1",
        [id]
      );
      if (rowCount === 0) return res.status(404).json({ error: "List not found" });
      io.emit("list-deleted", { id: parseInt(id) });
      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete list" });
    }
  });

  // GET /api/todos/:id/items — get items for a list
  router.get("/:id/items", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM todo_items WHERE list_id = $1 ORDER BY position ASC, created_at ASC",
        [req.params.id]
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch items" });
    }
  });

  // POST /api/todos/:id/items — add item to list
  router.post("/:id/items", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    if (!text || !text.trim())
      return res.status(400).json({ error: "text is required" });
    try {
      const { rows: posRows } = await pool.query(
        "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM todo_items WHERE list_id = $1",
        [id]
      );
      const position = posRows[0].next_pos;
      const { rows } = await pool.query(
        "INSERT INTO todo_items (list_id, text, position, added_by) VALUES ($1, $2, $3, $4) RETURNING *",
        [id, text.trim(), position, req.user.username]
      );
      const item = rows[0];
      // Bump list updated_at
      await pool.query(
        "UPDATE todo_lists SET updated_at = NOW() WHERE id = $1",
        [id]
      );
      broadcastToList(id, "item-added", item);
      res.status(201).json(item);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to add item" });
    }
  });

  // PATCH /api/todos/:id/items/:itemId — update item (text and/or completed)
  router.patch("/:id/items/:itemId", requireAuth, async (req, res) => {
    const { id, itemId } = req.params;
    const { text, completed } = req.body;

    const sets = [];
    const vals = [];
    let idx = 1;
    if (text !== undefined) { sets.push(`text = $${idx++}`); vals.push(text.trim()); }
    if (completed !== undefined) { sets.push(`completed = $${idx++}`); vals.push(completed); }
    if (sets.length === 0)
      return res.status(400).json({ error: "Nothing to update" });

    sets.push(`updated_at = NOW()`);
    vals.push(itemId);

    try {
      const { rows, rowCount } = await pool.query(
        `UPDATE todo_items SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
        vals
      );
      if (rowCount === 0) return res.status(404).json({ error: "Item not found" });
      const item = rows[0];
      await pool.query(
        "UPDATE todo_lists SET updated_at = NOW() WHERE id = $1",
        [id]
      );
      broadcastToList(id, "item-updated", item);
      res.json(item);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update item" });
    }
  });

  // GET /api/todos/uploads/:key — proxy S3 icon files (no-op in local mode)
  router.get("/uploads/:key", async (req, res) => {
    if (!USE_S3) return res.status(404).json({ error: "Not found" });
    const { GetObjectCommand } = require("@aws-sdk/client-s3");
    try {
      const data = await s3.send(
        new GetObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: req.params.key })
      );
      res.setHeader("Content-Type", data.ContentType);
      data.Body.pipe(res);
    } catch {
      res.status(404).json({ error: "Not found" });
    }
  });

  // POST /api/todos/:id/icon — upload list icon
  router.post("/:id/icon", requireAuth, (req, res) => {
    upload.single("icon")(req, res, async (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const { id } = req.params;
      const icon_url = USE_S3
        ? `/api/todos/uploads/${req.file.key}`
        : `/uploads/${req.file.filename}`;
      try {
        const { rows, rowCount } = await pool.query(
          "UPDATE todo_lists SET icon_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
          [icon_url, id]
        );
        if (rowCount === 0) return res.status(404).json({ error: "List not found" });
        broadcastToList(id, "list-updated", rows[0]);
        res.json({ icon_url });
      } catch (dbErr) {
        console.error(dbErr);
        res.status(500).json({ error: "Failed to save icon" });
      }
    });
  });

  // DELETE /api/todos/:id/items/:itemId — delete item
  router.delete("/:id/items/:itemId", requireAuth, async (req, res) => {
    const { id, itemId } = req.params;
    try {
      const { rowCount } = await pool.query(
        "DELETE FROM todo_items WHERE id = $1 AND list_id = $2",
        [itemId, id]
      );
      if (rowCount === 0) return res.status(404).json({ error: "Item not found" });
      await pool.query(
        "UPDATE todo_lists SET updated_at = NOW() WHERE id = $1",
        [id]
      );
      broadcastToList(id, "item-deleted", { id: parseInt(itemId) });
      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  return router;
};
