import { NextResponse } from 'next/server';
import { dialect } from '@/lib/driver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Tells you what is wrong with the database configuration, in one page.
 *
 * Getting a connection string right involves several independent things — the variable
 * being set at all, the pooler host rather than the direct one, the port, a password with
 * its special characters escaped — and a normal failure tells you none of them. This
 * checks each in turn and names the one that is wrong.
 *
 * It never returns the password, only whether it is present and whether it looked escaped.
 */
export async function GET() {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const checks: { name: string; ok: boolean; detail: string }[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

  if (!raw) {
    add('variable is set', false, 'Neither DATABASE_URL nor POSTGRES_URL is set.');
    return NextResponse.json({ ok: false, checks }, { status: 503 });
  }
  add(
    'variable is set',
    true,
    process.env.DATABASE_URL ? 'DATABASE_URL' : 'POSTGRES_URL (from the Vercel integration)'
  );

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    add(
      'is a valid URL',
      false,
      'The value could not be parsed. An unescaped "@" or ":" in the password is the ' +
        'usual cause — every special character has to be percent-encoded, so "@" is "%40".'
    );
    return NextResponse.json({ ok: false, checks }, { status: 503 });
  }

  add('is a valid URL', true, `${url.protocol}//…@${url.hostname}:${url.port || '(none)'}`);
  add(
    'is postgres',
    url.protocol.startsWith('postgres'),
    url.protocol.startsWith('postgres')
      ? url.protocol
      : `Starts with "${url.protocol}". A Supabase API URL is not a connection string.`
  );

  const password = decodeURIComponent(url.password || '');
  add(
    'has a password',
    password.length > 0 && !password.includes('[') ,
    password.length === 0
      ? 'No password in the string.'
      : password.includes('[')
        ? 'The [YOUR-PASSWORD] placeholder is still there.'
        : `${password.length} characters`
  );

  const isPooler = url.hostname.includes('pooler.supabase.com');
  const isDirect = url.hostname.startsWith('db.');
  add(
    'uses the pooler',
    isPooler,
    isPooler
      ? url.hostname
      : isDirect
        ? 'This is the direct connection. It has no IPv4 address, and serverless functions ' +
          'cannot reach IPv6, so it can never connect from here. Use the transaction pooler.'
        : url.hostname
  );
  add(
    'port is 6543',
    url.port === '6543',
    url.port === '6543'
      ? '6543 (transaction pooler)'
      : `${url.port || 'none'} — the transaction pooler is 6543.`
  );

  // The only check that actually proves anything: open a connection.
  let connected = false;
  let detail = '';
  try {
    const { default: postgres } = await import('postgres');
    const sql = postgres(raw, { prepare: false, max: 1, connect_timeout: 10, idle_timeout: 1 });
    const rows = await sql`select current_database() as db`;
    detail = `connected to "${rows[0].db}"`;
    connected = true;
    await sql.end({ timeout: 2 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    detail = /password|authentication/i.test(message)
      ? 'The server rejected the password. Reset it in Supabase and update this variable.'
      : /timeout|ENOTFOUND|ECONNREFUSED|EAI_AGAIN/i.test(message)
        ? `Could not reach ${url.hostname}. If the host name is wrong, the Connect dialog ` +
          'in Supabase has the exact one.'
        : message.split('\n')[0].slice(0, 200);
  }
  add('connects', connected, detail);

  const ok = checks.every((c) => c.ok);
  return NextResponse.json(
    { ok, dialect: dialect(), checks, hint: ok ? 'Everything checks out.' : 'Fix the first ✗ above.' },
    { status: ok ? 200 : 503 }
  );
}
