require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || "localhost",
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || "for_miles",
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD,
      }
);

const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id         SERIAL PRIMARY KEY,
      content    TEXT NOT NULL,
      author     TEXT NOT NULL DEFAULT 'Anonymous',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
  `);

  await pool.query(`
    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS image_url TEXT
  `);

  await pool.query(`
    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES messages(id) ON DELETE CASCADE
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS olipop_rankings (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      flavor     TEXT NOT NULL,
      position   INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, flavor),
      UNIQUE(user_id, position)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_board_visits (
      user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_thread_reads (
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
      read_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, message_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stamp_wishlist (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slug       TEXT NOT NULL,
      added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, slug)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stamp_collection (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slug       TEXT NOT NULL,
      added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, slug)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stamp_goals (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      completed  BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stamp_goal_filters (
      id           SERIAL PRIMARY KEY,
      goal_id      INTEGER NOT NULL REFERENCES stamp_goals(id) ON DELETE CASCADE,
      filter_type  TEXT NOT NULL,
      filter_value TEXT NOT NULL
    )
  `);
};

module.exports = { pool, initDb };
