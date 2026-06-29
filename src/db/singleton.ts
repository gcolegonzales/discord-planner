/**
 * Application-wide database singleton.
 *
 * The single Database instance is created lazily on first access and reused
 * for the lifetime of the process.  All command/button handlers import
 * `getDb()` instead of opening their own connections.
 *
 * In tests, prefer opening an in-memory database directly via `openDatabase`
 * and passing it explicitly — do not rely on this singleton.
 */

import Database from 'better-sqlite3';
import { openDatabase } from './connection';
import { loadConfig } from '../config';

let _db: Database.Database | null = null;

/**
 * Return (and lazily initialise) the application database.
 * Reads `DATABASE_PATH` from config on first call.
 */
export function getDb(): Database.Database {
  if (_db === null) {
    const config = loadConfig();
    _db = openDatabase(config.databasePath);
  }
  return _db;
}
