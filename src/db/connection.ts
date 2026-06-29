import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Open (or create) a better-sqlite3 database at the given path.
 * - Creates the parent directory if it doesn't exist.
 * - Enables WAL mode and foreign key enforcement.
 * - Applies the schema idempotently.
 *
 * Pass ':memory:' (or any temp path) for tests.
 */
export function openDatabase(dbPath: string): Database.Database {
  // Create parent directory for file-based DBs
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  applySchema(db);

  return db;
}

function applySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id          TEXT PRIMARY KEY NOT NULL,
      guild_id    TEXT NOT NULL,
      channel_id  TEXT NOT NULL,
      message_id  TEXT,
      title       TEXT NOT NULL,
      start_date  TEXT NOT NULL,
      end_date    TEXT NOT NULL,
      timezone    TEXT NOT NULL,
      creator_id  TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS participants (
      event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL,
      accepted_at TEXT NOT NULL,
      PRIMARY KEY (event_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS busy_entries (
      id          TEXT PRIMARY KEY NOT NULL,
      event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL,
      kind        TEXT NOT NULL CHECK(kind IN ('date', 'date_range', 'time_range')),
      start_date  TEXT NOT NULL,
      end_date    TEXT NOT NULL,
      start_time  TEXT,
      end_time    TEXT,
      created_at  TEXT NOT NULL
    );
  `);
}
