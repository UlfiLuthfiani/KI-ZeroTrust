const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'db', 'sistem_nilai.db'));
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nama TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('mahasiswa','dosen','admin')),
  nim TEXT
);
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  device_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kelas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  dosen_id INTEGER NOT NULL REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS nilai (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kelas_id INTEGER NOT NULL REFERENCES kelas(id),
  mahasiswa_id INTEGER NOT NULL REFERENCES users(id),
  nilai REAL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','final'))
);
CREATE TABLE IF NOT EXISTS transkrip (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nim TEXT NOT NULL,
  kelas_id INTEGER NOT NULL,
  nama_kelas TEXT NOT NULL,
  nilai REAL NOT NULL,
  UNIQUE (nim, kelas_id)
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS service_clients (
  client_id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  waktu TEXT NOT NULL,
  subjek TEXT,
  endpoint TEXT,
  device TEXT,
  hasil TEXT,
  alasan TEXT
);
`);

module.exports = db;