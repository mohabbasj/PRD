/**
 * Storage.
 *
 * The brief asked for SQLite in a local file, and that is still what you get running on
 * your own machine. Serverless hosting has no persistent disk, so the same code talks to
 * a hosted libSQL database (Turso) when one is configured — same SQL, same schema, one
 * client library. Set TURSO_DATABASE_URL to switch; leave it unset and nothing changes.
 */
import { createClient, type Client } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import { checkSummary } from './validation';
import { computeCompletion } from './completion';
import { emptyContent, normalizeContent, type PrdContent, type PrdRecord, type PrdSummary } from './types';
import { markPersisted } from './persist';
import type { Status } from './schema';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS prd (
    id           TEXT PRIMARY KEY,
    feature_name TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'Draft',
    content      TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    updated_at   TEXT
  );
`;

let ready: Promise<Client> | null = null;

function localFileUrl(): string {
  const file = process.env.PRD_DB_PATH
    ? path.resolve(process.env.PRD_DB_PATH)
    : path.join(process.cwd(), 'data', 'prd.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return `file:${file}`;
}

async function connect(): Promise<Client> {
  if (ready) return ready;
  ready = (async () => {
    const remote = process.env.TURSO_DATABASE_URL;
    const client = remote
      ? createClient({ url: remote, authToken: process.env.TURSO_AUTH_TOKEN })
      : createClient({ url: localFileUrl() });

    await client.execute(SCHEMA);
    // Indexes are separate statements; execute() takes one at a time.
    await client.execute(`CREATE INDEX IF NOT EXISTS prd_updated_at ON prd (updated_at DESC)`);
    await client.execute(`CREATE INDEX IF NOT EXISTS prd_status ON prd (status)`);
    return client;
  })();
  // A failed connection must not be cached, or every later request inherits the failure.
  ready.catch(() => {
    ready = null;
  });
  return ready;
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

export async function listPrds(): Promise<PrdSummary[]> {
  const db = await connect();
  // Newest first. A duplicate has no updated_at yet, so fall back to created_at
  // rather than letting fresh copies sink to the bottom of the list.
  const result = await db.execute(
    `SELECT * FROM prd ORDER BY COALESCE(updated_at, created_at) DESC`
  );
  return (result.rows as unknown as Row[]).map((row) => {
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

export async function getPrd(id: string): Promise<PrdRecord | null> {
  const db = await connect();
  const result = await db.execute({ sql: `SELECT * FROM prd WHERE id = ?`, args: [id] });
  const row = (result.rows as unknown as Row[])[0];
  return row ? hydrate(row) : null;
}

export async function createPrd(): Promise<PrdRecord> {
  const db = await connect();
  const id = newId();
  const content = emptyContent();
  await db.execute({
    sql: `INSERT INTO prd (id, feature_name, status, content, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, NULL)`,
    args: [id, '', content.header.status, JSON.stringify(content), new Date().toISOString()],
  });
  return (await getPrd(id))!;
}

export async function savePrd(id: string, raw: unknown): Promise<PrdRecord | null> {
  const db = await connect();
  const existing = await getPrd(id);
  if (!existing) return null;
  const content = markPersisted(normalizeContent(raw));
  await db.execute({
    sql: `UPDATE prd SET feature_name = ?, status = ?, content = ?, updated_at = ? WHERE id = ?`,
    args: [
      content.header.feature_name,
      content.header.status,
      JSON.stringify(content),
      new Date().toISOString(),
      id,
    ],
  });
  return getPrd(id);
}

export async function duplicatePrd(id: string): Promise<PrdRecord | null> {
  const db = await connect();
  const source = await getPrd(id);
  if (!source) return null;
  const content: PrdContent = {
    ...source.content,
    header: {
      ...source.content.header,
      feature_name: `${source.content.header.feature_name || 'Untitled PRD'} (copy)`,
      status: 'Draft' as Status,
    },
  };
  const copyId = newId();
  await db.execute({
    // updated_at stays NULL: the copy has not been edited yet.
    sql: `INSERT INTO prd (id, feature_name, status, content, created_at, updated_at)
          VALUES (?, ?, 'Draft', ?, ?, NULL)`,
    args: [copyId, content.header.feature_name, JSON.stringify(content), new Date().toISOString()],
  });
  return getPrd(copyId);
}

export async function deletePrd(id: string): Promise<boolean> {
  const db = await connect();
  const result = await db.execute({ sql: `DELETE FROM prd WHERE id = ?`, args: [id] });
  return result.rowsAffected > 0;
}
