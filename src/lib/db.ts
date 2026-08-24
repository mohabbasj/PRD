import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { checkSummary } from './validation';
import { computeCompletion } from './completion';
import { emptyContent, normalizeContent, type PrdContent, type PrdRecord, type PrdSummary } from './types';
import { markPersisted } from './persist';
import type { Status } from './schema';

const DB_PATH = path.join(process.cwd(), 'data', 'prd.db');

let db: Database.Database | null = null;

function connect(): Database.Database {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS prd (
      id           TEXT PRIMARY KEY,
      feature_name TEXT NOT NULL DEFAULT '',
      status       TEXT NOT NULL DEFAULT 'Draft',
      content      TEXT NOT NULL,
      created_at   TEXT NOT NULL,
      updated_at   TEXT
    );
    CREATE INDEX IF NOT EXISTS prd_updated_at ON prd (updated_at DESC);
    CREATE INDEX IF NOT EXISTS prd_status ON prd (status);
  `);
  return db;
}

interface Row {
  id: string;
  feature_name: string;
  status: string;
  content: string;
  created_at: string;
  updated_at: string | null;
}

function hydrate(row: Row): PrdRecord {
  const content = normalizeContent(JSON.parse(row.content));
  return {
    id: row.id,
    feature_name: row.feature_name,
    status: content.header.status,
    content,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function newId(): string {
  return `prd_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function listPrds(): PrdSummary[] {
  const rows = connect()
    .prepare(
      // Newest first. A duplicate has no updated_at yet, so fall back to created_at
      // rather than letting fresh copies sink to the bottom of the list.
      `SELECT * FROM prd ORDER BY COALESCE(updated_at, created_at) DESC`
    )
    .all() as Row[];
  return rows.map((row) => {
    const rec = hydrate(row);
    return {
      id: rec.id,
      feature_name: rec.feature_name,
      status: rec.status,
      product_manager: rec.content.header.product_manager,
      created_at: rec.created_at,
      updated_at: rec.updated_at,
      completion: computeCompletion(rec.content).overall,
      checklist: checkSummary(rec.content),
    };
  });
}

export function getPrd(id: string): PrdRecord | null {
  const row = connect().prepare(`SELECT * FROM prd WHERE id = ?`).get(id) as Row | undefined;
  return row ? hydrate(row) : null;
}

export function createPrd(): PrdRecord {
  const id = newId();
  const content = emptyContent();
  connect()
    .prepare(
      `INSERT INTO prd (id, feature_name, status, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL)`
    )
    .run(id, '', content.header.status, JSON.stringify(content), new Date().toISOString());
  return getPrd(id)!;
}

export function savePrd(id: string, raw: unknown): PrdRecord | null {
  const existing = getPrd(id);
  if (!existing) return null;
  const content = markPersisted(normalizeContent(raw));
  connect()
    .prepare(
      `UPDATE prd SET feature_name = ?, status = ?, content = ?, updated_at = ? WHERE id = ?`
    )
    .run(
      content.header.feature_name,
      content.header.status,
      JSON.stringify(content),
      new Date().toISOString(),
      id
    );
  return getPrd(id);
}

export function duplicatePrd(id: string): PrdRecord | null {
  const source = getPrd(id);
  if (!source) return null;
  const content: PrdContent = {
    ...source.content,
    header: {
      ...source.content.header,
      feature_name: `${source.content.header.feature_name || 'Untitled PRD'} (copy)`,
      status: 'Draft' as Status,
    },
  };
  const newRecordId = newId();
  connect()
    .prepare(
      // updated_at stays NULL: the copy has not been edited yet.
      `INSERT INTO prd (id, feature_name, status, content, created_at, updated_at)
       VALUES (?, ?, 'Draft', ?, ?, NULL)`
    )
    .run(newRecordId, content.header.feature_name, JSON.stringify(content), new Date().toISOString());
  return getPrd(newRecordId);
}

export function deletePrd(id: string): boolean {
  return connect().prepare(`DELETE FROM prd WHERE id = ?`).run(id).changes > 0;
}
