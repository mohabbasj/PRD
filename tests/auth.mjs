/**
 * The login gate, which only exists for hosted deployments.
 *
 * The interesting case is the PDF export: it drives a headless browser that fetches the
 * print route over HTTP from the outside, carrying none of the browser's cookies. If that
 * path is wrong the export hangs or renders a login screen into the PDF, so it is checked
 * here rather than assumed.
 *
 *   npm run build && npm run test:auth
 */
import puppeteer from 'puppeteer';
import { reporter, startServer } from './helpers.mjs';

const USER = 'tester';
const PASS = 'correct-horse-battery-staple';

const t = reporter();
const server = await startServer({
  PRD_USERNAME: USER,
  PRD_PASSWORD: PASS,
  PRD_SESSION_SECRET: 'test-secret-not-the-password',
});
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 900 });
page.on('dialog', (d) => d.accept());

const B = server.base;
const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));

const signIn = async (username, password) => {
  // Start from signed-out every time, so /login does not bounce us straight back.
  const existing = await page.cookies();
  if (existing.length) await page.deleteCookie(...existing);
  await page.goto(B + '/login', { waitUntil: 'networkidle0' });
  await page.type('#username', username);
  await page.type('#password', password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('button[type=submit]'),
  ]);
};

try {
  // ------------------------------------------------------------- locked by default
  await page.goto(B + '/', { waitUntil: 'networkidle0' });
  t.check('an anonymous visitor lands on the login screen', page.url().includes('/login'));

  const anonList = await fetch(`${B}/api/prd`);
  t.check('the API refuses an anonymous request', anonList.status === 401, `got ${anonList.status}`);

  const anonPrint = await fetch(`${B}/prd/anything/print`, { redirect: 'manual' });
  t.check(
    'the print route refuses an anonymous request',
    anonPrint.status === 307 || anonPrint.status === 302,
    `got ${anonPrint.status}`
  );

  // ------------------------------------------------------------- wrong credentials
  await signIn(USER, 'not-the-password');
  t.check('a wrong password is rejected', page.url().includes('/login'));
  t.check(
    'the rejection says so on screen',
    (await page.evaluate(() => document.body.innerText)).includes('did not match')
  );

  // ------------------------------------------------------------- correct credentials
  await signIn(USER, PASS);
  t.check('the right credentials get in', new URL(page.url()).pathname === '/');
  t.check(
    'the app renders once signed in',
    (await page.evaluate(() => document.body.innerText)).includes('Product Requirements Documents')
  );

  // ------------------------------------------------------------- it remembers you
  await page.goto(B + '/', { waitUntil: 'networkidle0' });
  t.check('the session survives a fresh navigation', new URL(page.url()).pathname === '/');

  // ------------------------------------------------------------- deep link comes back
  await page.deleteCookie(...(await page.cookies()));
  await page.goto(B + '/api/prd', { waitUntil: 'networkidle0' });
  await page.goto(B + '/login?next=%2Fapi%2Fprd', { waitUntil: 'networkidle0' });
  await page.type('#username', USER);
  await page.type('#password', PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('button[type=submit]'),
  ]);
  t.check('signing in returns you to where you were headed', page.url().endsWith('/api/prd'));

  // ------------------------------------------------------------- the exports still work
  await signIn(USER, PASS);
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'New PRD').click();
  });
  await page.waitForSelector('input[placeholder="Feature name"]', { timeout: 20000 });
  await page.type('input[placeholder="Feature name"]', 'Locked Down');
  await page.waitForFunction(() => document.body.innerText.includes('Saved'), { timeout: 15000 });
  await settle(400);
  const id = page.url().split('/prd/')[1];

  const cookies = await page.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

  for (const [kind, magic] of [
    ['pdf', '%PDF'],
    ['docx', 'PK'],
  ]) {
    const res = await fetch(`${B}/api/prd/${id}/export/${kind}`, {
      headers: { cookie: cookieHeader },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    t.check(
      `the ${kind} export works for a signed-in user`,
      res.status === 200 && buf.length > 5000 && buf.subarray(0, magic.length).toString() === magic,
      `status ${res.status}, ${buf.length} bytes`
    );
  }

  // The PDF is rendered by a browser that has no cookie; if its token path were broken it
  // would quietly render the login page instead, so check the document is really in there.
  const pdf = Buffer.from(
    await (
      await fetch(`${B}/api/prd/${id}/export/pdf`, { headers: { cookie: cookieHeader } })
    ).arrayBuffer()
  );
  t.check(
    'the PDF contains the document, not the login screen',
    pdf.length > 100_000,
    `${pdf.length} bytes — a login page would render far smaller`
  );

  const anonExport = await fetch(`${B}/api/prd/${id}/export/pdf`);
  t.check(
    'an anonymous export is refused',
    anonExport.status === 401,
    `got ${anonExport.status}`
  );

  // ------------------------------------------------------------- signing out
  await page.goto(B + '/', { waitUntil: 'networkidle0' });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.evaluate(() => {
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Sign out').click();
    }),
  ]);
  t.check('signing out returns to the login screen', page.url().includes('/login'));
  await page.goto(B + '/', { waitUntil: 'networkidle0' });
  t.check('the session is really gone', page.url().includes('/login'));
} catch (error) {
  t.fail('suite ran to completion', error.stack ?? error.message);
} finally {
  await browser.close();
  await server.stop();
}

process.exit(t.finish() ? 0 : 1);
