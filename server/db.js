require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "for_miles",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
});

const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id        SERIAL PRIMARY KEY,
      content   TEXT        NOT NULL,
      author    TEXT        NOT NULL DEFAULT 'Anonymous',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

module.exports = { pool, initDb };
