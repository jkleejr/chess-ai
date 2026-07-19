import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema'

let db: Database.Database | null = null

export function openDb(): Database.Database {
  if (db) return db
  const dbPath = process.env.CHESS_AI_DB_PATH ?? join(app.getPath('userData'), 'chess-ai.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}

function runMigrations(database: Database.Database): void {
  const current = database.pragma('user_version', { simple: true }) as number
  if (current < SCHEMA_VERSION) {
    database.exec(SCHEMA_SQL)
    database.pragma(`user_version = ${SCHEMA_VERSION}`)
  }
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized — call openDb() after app ready')
  return db
}

export function closeDb(): void {
  db?.close()
  db = null
}
