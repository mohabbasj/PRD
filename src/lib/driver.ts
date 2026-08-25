/**
 * The one place that knows which database is underneath.
 *
 * The brief asked for SQLite in a local file, and that is still what you get on your own
 * machine. Serverless hosting has no persistent disk, so a deployment points at Postgres
 * instead. Both speak the same handful of statements, so the seam is small: two drivers
 * behind one interface, and callers write plain SQL with `?` placeholders either way.
 */

export interface Driver {
  /** Rows from a SELECT. */
  all<T>(sql: string, args?: unknown[]): Promise<T[]>;
  /** Number of rows an INSERT, UPDATE or DELETE touched. */
  run(sql: string, args?: unknown[]): Promise<number>;
}

/** Postgres numbers its placeholders; SQLite does not. Rewrite `?` to `$1`, `$2`, … */
function toNumberedPlaceholders(sql: string): string {
  let n = 0;
  return sql.replace(/\?/g, () => `$${(n += 1)}`);
}

async function postgresDriver(connectionString: string): Promise<Driver> {
  const { default: postgres } = await import('postgres');
  const sql = postgres(connectionString, {
    // Supabase's transaction pooler, the one to use from serverless, cannot hold
    // prepared statements across checkouts.
    prepare: false,
    // A serverless invocation handles one request; a large pool would just idle.
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
  });

  return {
    async all<T>(text: string, args: unknown[] = []): Promise<T[]> {
      return sql.unsafe(toNumberedPlaceholders(text), args as never[]) as unknown as Promise<T[]>;
    },
    async run(text: string, args: unknown[] = []): Promise<number> {
      const result = await sql.unsafe(toNumberedPlaceholders(text), args as never[]);
      return result.count ?? 0;
    },
  };
}

async function sqliteDriver(url: string): Promise<Driver> {
  const { createClient } = await import('@libsql/client');
  const client = createClient({ url });

  return {
    async all<T>(sql: string, args: unknown[] = []): Promise<T[]> {
      const result = await client.execute({ sql, args: args as never[] });
      return result.rows as unknown as T[];
    },
    async run(sql: string, args: unknown[] = []): Promise<number> {
      const result = await client.execute({ sql, args: args as never[] });
      return result.rowsAffected;
    },
  };
}

export type Dialect = 'postgres' | 'sqlite';

export function dialect(): Dialect {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL ? 'postgres' : 'sqlite';
}

export async function openDriver(sqliteUrl: string): Promise<Driver> {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  return connectionString ? postgresDriver(connectionString) : sqliteDriver(sqliteUrl);
}
