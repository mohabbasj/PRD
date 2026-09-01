/**
 * End-to-end suite. Starts the production server against a throwaway database, drives it
 * with a real browser, and checks the things the app promises: nothing is lost across a
 * reload, the checklist catches what it says it catches, and both exports come back as
 * files you could actually open.
 *
 *   npm run build && npm run test:e2e
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { reporter, SET_VALUE, startServer } from './helpers.mjs';

const t = reporter();
const server = await startServer();
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000 });
page.on('pageerror', (e) => t.fail('no uncaught page errors', e.message));
// The editor warns before unload while an edit is in flight, and confirms row deletes.
page.on('dialog', (d) => d.accept());

const B = server.base;
const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const text = () => page.evaluate(() => document.body.innerText);
const waitSaved = () =>
  page.waitForFunction(() => document.body.innerText.includes('Saved'), { timeout: 15000 });

const goBlock = async (name) => {
  await page.evaluate((n) => {
    [...document.querySelectorAll('nav button')].find((b) => b.textContent.includes(n)).click();
  }, name);
  await settle(150);
};

const setField = (fieldKey, index, value) =>
  page.evaluate(
    (key, i, v, setter) => {
      const el = document.getElementById('field-' + key);
      const input = el.querySelectorAll('tbody input, textarea, input')[i];
      eval(`(${setter})`)(input, v);
    },
    fieldKey,
    index,
    value,
    SET_VALUE
  );

try {
  // ---------------------------------------------------------------- empty state
  const failedRequests = [];
  page.on('response', (r) => {
    if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
  });

  await page.goto(B + '/', { waitUntil: 'networkidle0' });
  t.check('empty state invites a first PRD', (await text()).includes('No PRDs yet'));

  await page.click('button[type=submit]');
  await page.waitForSelector('input[placeholder="Feature name"]', { timeout: 20000 });
  t.check('New PRD opens the editor', /\/prd\/prd_/.test(page.url()));
  const editorUrl = page.url();
  const id = editorUrl.split('/prd/')[1];

  // ---------------------------------------------------------------- header
  await page.type('input[placeholder="Feature name"]', 'Instant Payouts');
  await page.evaluate((setter) => {
    const rows = [...document.querySelectorAll('main table tr')];
    const set = (label, value) => {
      const row = rows.find((r) => r.querySelector('th')?.textContent.trim() === label);
      eval(`(${setter})`)(row.querySelector('input'), value);
    };
    set('Product Manager', 'Dana Reeve');
    set('Engineering Lead', 'Sam Ortiz');
  }, SET_VALUE);

  // ---------------------------------------------------------------- metrics
  await goBlock('DIRECTION');
  await setField('primary_metric', 0, 'Payout completion rate');
  await setField('primary_metric', 1, '62%');
  await setField('primary_metric', 3, '30 days');
  await setField('counter_metrics', 0, 'Support ticket volume');
  await waitSaved();

  // ------------------------------------------------- the two acceptance failures
  await goBlock('CHECKLIST');
  const checklist = await text();
  t.check(
    'flags a rollout with no kill criterion',
    /Rollout has a kill criterion[\s\S]{0,140}no kill criteria/.test(checklist)
  );
  t.check(
    'flags a metric with no tracking event',
    checklist.includes('No tracking event feeds "Payout completion rate", "Support ticket volume"')
  );
  t.check('banner counts what is outstanding', /\d+ of 16 items are outstanding/.test(checklist));

  // ------------------------------------------------- click through and fix it
  await page.evaluate(() => {
    const li = [...document.querySelectorAll('li')].find((l) =>
      l.textContent.includes('Rollout has a kill criterion')
    );
    li.querySelector('button').click();
  });
  await page.waitForFunction(() => !!document.getElementById('field-rollout_kill_criteria'));
  t.check('an unsatisfied check links to the offending field', true);

  await page.evaluate((setter) => {
    const ta = document.getElementById('field-rollout_kill_criteria').querySelector('textarea');
    eval(`(${setter})`)(ta, 'Payout failure rate above 2% for one hour.');
  }, SET_VALUE);

  await goBlock('CHECKLIST');
  t.check(
    'the kill-criterion check clears once filled',
    !(await text()).includes('The rollout plan has no kill criteria')
  );

  await page.evaluate(() => {
    const li = [...document.querySelectorAll('li')].find((l) =>
      l.textContent.includes('RTL and localization specified')
    );
    li.querySelector('input[type=checkbox]').click();
  });
  await waitSaved();

  // ---------------------------------------------------------------- persistence
  await settle(400);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('input[placeholder="Feature name"]');
  t.check(
    'the feature name survives a reload',
    (await page.$eval('input[placeholder="Feature name"]', (e) => e.value)) === 'Instant Payouts'
  );
  const pm = await page.evaluate(() => {
    const row = [...document.querySelectorAll('main table tr')].find(
      (r) => r.querySelector('th')?.textContent.trim() === 'Product Manager'
    );
    return row?.querySelector('input')?.value;
  });
  t.check('the product manager survives a reload', pm === 'Dana Reeve');

  await goBlock('DIRECTION');
  const metric = await page.evaluate(
    () => document.getElementById('field-primary_metric').querySelectorAll('tbody input')[0].value
  );
  t.check('the primary metric survives a reload', metric === 'Payout completion rate');

  await goBlock('CHECKLIST');
  const manual = await page.evaluate(() => {
    const li = [...document.querySelectorAll('li')].find((l) =>
      l.textContent.includes('RTL and localization specified')
    );
    return li.querySelector('input[type=checkbox]').checked;
  });
  t.check('a manual tick survives a reload', manual);

  // ------------------------------------------- Block 02 feeds the tracking plan
  await goBlock('EXECUTION');
  await page.waitForFunction(() => !!document.getElementById('field-tracking_plan'));
  const options = await page.evaluate(() =>
    [...document.getElementById('field-tracking_plan').querySelector('tbody select').options].map(
      (o) => o.textContent
    )
  );
  t.check(
    'the tracking dropdown lists the metrics from Block 02',
    options.includes('Payout completion rate') && options.includes('Support ticket volume')
  );

  // ---------------------------------------------------- append-only decisions log
  await page.evaluate((setter) => {
    const input = document.getElementById('field-decisions').querySelector('tbody input');
    eval(`(${setter})`)(input, 'Ship without the batch endpoint');
  }, SET_VALUE);
  const deletableBeforeSave = await page.evaluate(() =>
    [
      ...document.getElementById('field-decisions').querySelector('tbody tr').querySelectorAll('button'),
    ].some((b) => b.textContent.includes('✕'))
  );
  t.check('a decision not yet saved can still be removed', deletableBeforeSave);
  await waitSaved();
  await settle(300);
  const lockedAfterSave = await page.evaluate(
    () =>
      ![
        ...document
          .getElementById('field-decisions')
          .querySelector('tbody tr')
          .querySelectorAll('button'),
      ].some((b) => b.textContent.includes('✕'))
  );
  t.check('a saved decision loses its delete control', lockedAfterSave);
  const blankStillDeletable = await page.evaluate(() => {
    const rows = document.getElementById('field-decisions').querySelectorAll('tbody tr');
    return [...rows[rows.length - 1].querySelectorAll('button')].some((b) =>
      b.textContent.includes('✕')
    );
  });
  t.check('a blank decision row stays deletable', blankStillDeletable);

  // ---------------------------------------------------------------- table keyboard
  await goBlock('CONTEXT');
  await page.waitForFunction(() => !!document.getElementById('field-stakeholders'));
  const before = await page.$$eval('#field-stakeholders tbody tr', (r) => r.length);
  await page.evaluate(() => {
    const rows = document.querySelectorAll('#field-stakeholders tbody tr');
    rows[rows.length - 1].querySelectorAll('input')[2].focus();
  });
  await page.keyboard.press('Tab');
  await settle();
  const after = await page.$$eval('#field-stakeholders tbody tr', (r) => r.length);
  t.check('Tab on the last cell adds a row', after === before + 1);
  t.check(
    'focus moves into the new row',
    await page.evaluate(() => {
      const rows = document.querySelectorAll('#field-stakeholders tbody tr');
      return rows[rows.length - 1].contains(document.activeElement);
    })
  );

  // ---------------------------------------------------------------- Ctrl+S
  await goBlock('EXECUTION');
  await page.evaluate((setter) => {
    eval(`(${setter})`)(document.getElementById('field-notes').querySelector('textarea'), 'Checked with legal.');
  }, SET_VALUE);
  await page.waitForFunction(() => document.body.innerText.includes('Unsaved'), { timeout: 5000 });
  await page.keyboard.down('Control');
  await page.keyboard.press('s');
  await page.keyboard.up('Control');
  await waitSaved();
  t.check('Ctrl+S saves without waiting for the debounce', true);

  // ---------------------------------------------------------------- exports
  for (const [kind, type, magic] of [
    ['pdf', 'application/pdf', '%PDF'],
    [
      'docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'PK',
    ],
  ]) {
    const res = await fetch(`${B}/api/prd/${id}/export/${kind}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const disposition = res.headers.get('content-disposition') ?? '';
    t.check(`${kind} export returns 200`, res.status === 200, `got ${res.status}`);
    t.check(`${kind} export sets the right content type`, res.headers.get('content-type') === type);
    t.check(
      `${kind} export is named PRD-{feature}-{date}.${kind}`,
      new RegExp(`filename="PRD-instant-payouts-\\d{4}-\\d{2}-\\d{2}\\.${kind}"`).test(disposition),
      disposition
    );
    t.check(
      `${kind} export is a real ${kind} file`,
      buf.length > 5000 && buf.subarray(0, magic.length).toString() === magic,
      `${buf.length} bytes`
    );
  }

  // An untouched PRD must still export as a usable blank form.
  const blank = await (await fetch(`${B}/api/prd`, { method: 'POST' })).json();
  const blankPdf = Buffer.from(
    await (await fetch(`${B}/api/prd/${blank.id}/export/pdf`)).arrayBuffer()
  );
  t.check(
    'an empty PRD still exports as a printable blank template',
    blankPdf.length > 20000 && blankPdf.subarray(0, 4).toString() === '%PDF',
    `${blankPdf.length} bytes`
  );

  // -------------------------------------------- the buttons, not just the endpoints
  const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-dl-'));
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloads,
    eventsEnabled: true,
  });
  await page.goto(editorUrl, { waitUntil: 'networkidle0' });
  await page.waitForSelector('input[placeholder="Feature name"]');

  for (const [label, extension] of [
    ['Export PDF', 'pdf'],
    ['Export Word', 'docx'],
  ]) {
    await page.evaluate((l) => {
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === l).click();
    }, label);
    let landed = null;
    for (let i = 0; i < 60 && !landed; i += 1) {
      await settle(500);
      landed = fs
        .readdirSync(downloads)
        .find((f) => f.endsWith(`.${extension}`) && !f.endsWith('.crdownload'));
    }
    t.check(
      `the "${label}" button downloads a file`,
      !!landed && fs.statSync(path.join(downloads, landed)).size > 5000,
      landed ? `${landed}` : `nothing appeared in ${downloads}`
    );
    t.check(
      `the "${label}" button names the file from the template`,
      !!landed && /^PRD-instant-payouts-\d{4}-\d{2}-\d{2}\./.test(landed),
      landed ?? 'no file'
    );
  }
  fs.rmSync(downloads, { recursive: true, force: true });

  // ---------------------------------------------------------------- print route
  await page.goto(`${B}/prd/${id}/print`, { waitUntil: 'networkidle0' });
  const printed = await text();
  t.check('the print view carries no app chrome', !printed.includes('Export PDF'));
  t.check(
    'the print view uses the template wording verbatim',
    printed.includes('Any unchecked box means this is not ready for engineering') &&
      printed.includes('Every FR needs the exact state transition that marks it complete')
  );
  const tablesAreTables = await page.evaluate(
    () =>
      [...document.querySelectorAll('table')].every(
        (el) => getComputedStyle(el).display === 'table'
      )
  );
  t.check('print tables render as tables, not as CSS grids', tablesAreTables);

  // ---------------------------------------------------------------- list screen
  await page.goto(B + '/', { waitUntil: 'networkidle0' });
  const listed = await text();
  t.check('the list shows the saved PRD', listed.includes('Instant Payouts'));
  t.check('the list shows a checklist marker', /\d+\/16/.test(listed));

  const rowsBefore = await page.$$eval('tbody tr', (r) => r.length);
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('tbody tr')].find((r) =>
      r.textContent.includes('Instant Payouts')
    );
    [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Duplicate').click();
  });
  await settle(1500);
  await page.reload({ waitUntil: 'networkidle0' });
  const afterCopy = await text();
  t.check(
    'duplicate adds a copy',
    (await page.$$eval('tbody tr', (r) => r.length)) === rowsBefore + 1
  );
  t.check('the copy is named "(copy)"', afterCopy.includes('Instant Payouts (copy)'));
  t.check('the copy resets to Draft', /Instant Payouts \(copy\)[\s\S]{0,80}Draft/.test(afterCopy));
  const copyRow = await page.evaluate(() => {
    const row = [...document.querySelectorAll('tbody tr')].find((r) =>
      r.textContent.includes('(copy)')
    );
    return { updated: row.children[3].textContent.trim(), first: row === document.querySelector('tbody tr') };
  });
  t.check('the copy has no last-updated stamp', copyRow.updated === '—');
  t.check('the copy still sorts to the top', copyRow.first);

  await page.type('input[placeholder="Filter by feature name"]', 'copy');
  await settle(200);
  t.check('the name filter narrows the list', (await page.$$eval('tbody tr', (r) => r.length)) === 1);
  await page.click('input[placeholder="Filter by feature name"]', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.select('select', 'Shipped');
  await settle(200);
  t.check('the status filter narrows the list', (await text()).includes('No PRD matches that filter'));
  await page.select('select', 'All');
  await settle(200);

  const preDelete = await page.$$eval('tbody tr', (r) => r.length);
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('tbody tr')].find((r) =>
      r.textContent.includes('(copy)')
    );
    [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Delete').click();
  });
  await settle(200);
  t.check(
    'delete asks for confirmation first',
    await page.evaluate(() =>
      [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Confirm')
    )
  );
  await page.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Confirm').click()
  );
  await settle(1500);
  await page.reload({ waitUntil: 'networkidle0' });
  t.check('delete removes the record', (await page.$$eval('tbody tr', (r) => r.length)) === preDelete - 1);
  t.check(
    'no request in the whole run came back 4xx or 5xx',
    failedRequests.length === 0,
    failedRequests.join('; ')
  );
} catch (error) {
  t.fail('suite ran to completion', error.message);
} finally {
  await browser.close();
  await server.stop();
}

process.exit(t.finish() ? 0 : 1);
