import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });

// 项目更名迁移：旧版数据库文件改用新名（连同 WAL/SHM 附属文件）
const dbPath = path.join(config.dataDir, 'clipnote.db');
const legacyDbPath = path.join(config.dataDir, 'clipvault.db');
if (!fs.existsSync(dbPath) && fs.existsSync(legacyDbPath)) {
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(legacyDbPath + suffix)) {
      fs.renameSync(legacyDbPath + suffix, dbPath + suffix);
    }
  }
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS clipboards (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    uuid        TEXT    NOT NULL UNIQUE,
    pinned      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS clipboard_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    clipboard_id INTEGER NOT NULL REFERENCES clipboards(id) ON DELETE CASCADE,
    content      TEXT    NOT NULL,
    content_hash TEXT    NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_items_clipboard_time ON clipboard_items(clipboard_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_items_hash ON clipboard_items(clipboard_id, content_hash);
`);

const clipboardColumns = (
  db.pragma('table_info(clipboards)') as { name: string }[]
).map((col) => col.name);
if (!clipboardColumns.includes('uuid')) {
  db.exec('ALTER TABLE clipboards ADD COLUMN uuid TEXT');
  const missing = db.prepare('SELECT id FROM clipboards WHERE uuid IS NULL').all() as {
    id: number;
  }[];
  const backfill = db.prepare('UPDATE clipboards SET uuid = ? WHERE id = ?');
  for (const row of missing) {
    backfill.run(randomUUID(), row.id);
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_clipboards_uuid ON clipboards(uuid)');
}

if (!clipboardColumns.includes('pinned')) {
  db.exec('ALTER TABLE clipboards ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0');
}

const itemColumns = (
  db.pragma('table_info(clipboard_items)') as { name: string }[]
).map((col) => col.name);

if (!itemColumns.includes('device')) {
  db.exec('ALTER TABLE clipboard_items ADD COLUMN device TEXT');
}

if (!itemColumns.includes('device_type')) {
  db.exec('ALTER TABLE clipboard_items ADD COLUMN device_type TEXT');
}

const existingPluginColumns = (
  db.pragma('table_info(plugins)') as { name: string }[]
).map((col) => col.name);
if (existingPluginColumns.length > 0 && !existingPluginColumns.includes('slug')) {
  db.exec('ALTER TABLE plugins RENAME TO plugins_legacy');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS plugins (
    slug        TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    author      TEXT    NOT NULL,
    version     TEXT    NOT NULL,
    description TEXT    NOT NULL,
    github_url  TEXT,
    code        TEXT    NOT NULL,
    enabled     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
`);

const legacyPluginColumns = (
  db.pragma('table_info(plugins_legacy)') as { name: string }[]
).map((col) => col.name);

if (legacyPluginColumns.length > 0) {
  const legacyRows = db
    .prepare(
      'SELECT name, author, version, description, code, enabled, created_at FROM plugins_legacy',
    )
    .all() as {
    name: string;
    author: string;
    version: string;
    description: string;
    code: string;
    enabled: number;
    created_at: string;
  }[];
  const insert = db.prepare(
    `INSERT INTO plugins (slug, name, author, version, description, github_url, code, enabled, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
  );
  const used = new Set<string>();
  for (const row of legacyRows) {
    let base = row.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
    if (!base) base = 'plugin';
    let slug = base;
    let n = 2;
    while (used.has(slug)) slug = `${base}-${n++}`;
    used.add(slug);
    insert.run(
      slug,
      row.name,
      row.author,
      row.version,
      row.description,
      row.code,
      row.enabled,
      row.created_at,
    );
  }
  db.exec('DROP TABLE plugins_legacy');
}

if (!itemColumns.includes('original_content')) {
  db.exec('ALTER TABLE clipboard_items ADD COLUMN original_content TEXT');
}

// 历史遗留：早期版本加过 plugin_id 列（外键指向 plugins）。重命名迁移会让该外键
// 指向已删除的 plugins_legacy，导致条目插入报 SQLITE_ERROR，需重建表移除该列。
const currentItemColumns = (
  db.pragma('table_info(clipboard_items)') as { name: string }[]
).map((col) => col.name);
if (currentItemColumns.includes('plugin_id')) {
  db.exec(`
    CREATE TABLE clipboard_items_rebuilt (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      clipboard_id INTEGER NOT NULL REFERENCES clipboards(id) ON DELETE CASCADE,
      content      TEXT    NOT NULL,
      content_hash TEXT    NOT NULL,
      original_content TEXT,
      device       TEXT,
      device_type  TEXT,
      created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    INSERT INTO clipboard_items_rebuilt
      (id, clipboard_id, content, content_hash, original_content, device, device_type, created_at)
      SELECT id, clipboard_id, content, content_hash, original_content, device, device_type, created_at
      FROM clipboard_items;
    DROP TABLE clipboard_items;
    ALTER TABLE clipboard_items_rebuilt RENAME TO clipboard_items;
    CREATE INDEX IF NOT EXISTS idx_items_clipboard_time ON clipboard_items(clipboard_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_items_hash ON clipboard_items(clipboard_id, content_hash);
  `);
}

export default db;
