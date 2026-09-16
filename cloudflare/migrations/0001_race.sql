CREATE TABLE IF NOT EXISTS users (key TEXT PRIMARY KEY, id TEXT NOT NULL UNIQUE, nickname TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, user TEXT NOT NULL, nickname TEXT NOT NULL, game TEXT NOT NULL, mode TEXT NOT NULL, elapsed INTEGER NOT NULL, at INTEGER NOT NULL, seeds TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS records_rank ON records(game,mode,elapsed,at,id);
CREATE INDEX IF NOT EXISTS records_history ON records(user,game,mode,at DESC);
