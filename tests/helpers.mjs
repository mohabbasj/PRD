import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Asks the OS for a port nobody is using. */
export function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on('error', reject);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/**
 * Starts the production server against a throwaway database, so a test run never
 * touches the PRDs you have actually written.
 */
export async function startServer() {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-e2e-'));
  const dbPath = path.join(dir, 'test.db');

  const child = spawn('npx', ['next', 'start', '--port', String(port)], {
    env: { ...process.env, PORT: String(port), PRD_DB_PATH: dbPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (Date.now() > deadline) {
      child.kill('SIGKILL');
      throw new Error(`Server did not start within 60s.\n${log}`);
    }
    try {
      const res = await fetch(base + '/', { signal: AbortSignal.timeout(2000) });
      if (res.ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  return {
    base,
    log: () => log,
    async stop() {
      child.kill('SIGKILL');
      await new Promise((r) => setTimeout(r, 300));
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function reporter() {
  const results = [];
  return {
    check(name, condition, detail) {
      results.push({ name, ok: !!condition, detail });
      return !!condition;
    },
    fail(name, detail) {
      results.push({ name, ok: false, detail });
    },
    finish() {
      const failed = results.filter((r) => !r.ok);
      for (const r of results) {
        console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.ok || !r.detail ? '' : ` — ${r.detail}`}`);
      }
      console.log(
        `\n${results.length - failed.length}/${results.length} checks passed` +
          (failed.length ? `, ${failed.length} failed` : '')
      );
      return failed.length === 0;
    },
  };
}

/**
 * React ignores a value assigned directly to a DOM node, so tests set it through the
 * native setter and dispatch the input event the way a keystroke would.
 */
export const SET_VALUE = `(el, value) => {
  const proto = el instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}`;
