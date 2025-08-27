import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'sle.sqlite');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  business_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  state TEXT NOT NULL,
  industry TEXT NOT NULL,
  deposits_band TEXT NOT NULL,
  time_in_biz TEXT NOT NULL,
  tcp_consent INTEGER NOT NULL DEFAULT 0,
  partner_id TEXT,
  upload_token TEXT,
  upload_token_expires_at INTEGER,
  docs_received_at INTEGER
);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`);

export default db;
