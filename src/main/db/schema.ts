// Schema is embedded as a string so it ships inside the bundled main process
// (no need to copy .sql assets through electron-vite).

export const SCHEMA_VERSION = 1

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY,
  chesscom_uuid TEXT UNIQUE NOT NULL,
  url TEXT,
  pgn TEXT NOT NULL,
  time_class TEXT,
  time_control TEXT,
  rated INTEGER NOT NULL DEFAULT 1,
  end_time INTEGER NOT NULL,
  white_username TEXT NOT NULL,
  black_username TEXT NOT NULL,
  white_rating INTEGER,
  black_rating INTEGER,
  user_color TEXT NOT NULL,
  result TEXT NOT NULL,
  termination TEXT,
  eco_code TEXT,
  opening_name TEXT,
  analysis_status TEXT NOT NULL DEFAULT 'pending',
  analysis_depth INTEGER,
  accuracy_white REAL,
  accuracy_black REAL,
  analyzed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_games_end_time ON games(end_time DESC);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(analysis_status);
CREATE INDEX IF NOT EXISTS idx_games_eco ON games(eco_code);

CREATE TABLE IF NOT EXISTS moves (
  id INTEGER PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  ply INTEGER NOT NULL,
  san TEXT NOT NULL,
  uci TEXT NOT NULL,
  fen_before TEXT NOT NULL,
  fen_after TEXT NOT NULL,
  is_user_move INTEGER NOT NULL,
  eval_cp INTEGER,
  eval_mate INTEGER,
  best_move_uci TEXT,
  best_move_san TEXT,
  cp_loss INTEGER,
  win_prob_before REAL,
  win_prob_after REAL,
  move_accuracy REAL,
  classification TEXT,
  clock_seconds REAL,
  UNIQUE(game_id, ply)
);

CREATE TABLE IF NOT EXISTS insights (
  id INTEGER PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  ply INTEGER,
  content TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_read_tokens INTEGER,
  cost_usd REAL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_insights_unique
  ON insights(game_id, type, IFNULL(ply, -1));

CREATE TABLE IF NOT EXISTS player_profile (
  id INTEGER PRIMARY KEY,
  version INTEGER NOT NULL,
  profile_json TEXT NOT NULL,
  games_analyzed INTEGER NOT NULL,
  source_insight_id INTEGER REFERENCES insights(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS sync_state (
  archive_url TEXT PRIMARY KEY,
  etag TEXT,
  last_synced_at INTEGER,
  is_complete INTEGER NOT NULL DEFAULT 0
);
`
