import puppeteer, { type Browser } from 'puppeteer';

/**
 * One browser, reused across exports. Launching Chromium costs about a second, which is
 * the whole of a small PDF's runtime. Kept on globalThis so the dev server's module
 * reloading cannot orphan an instance.
 */
const cache = globalThis as unknown as { __prdBrowser?: Promise<Browser> };

async function getBrowser(): Promise<Browser> {
  const existing = await cache.__prdBrowser?.catch(() => undefined);
  if (existing?.connected) return existing;
  cache.__prdBrowser = puppeteer.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  return cache.__prdBrowser;
}

/**
 * Renders the print route to A4 with the template's margins: 900 twips top and bottom,
 * 720 each side. The print stylesheet drops the page's own padding under print media, so
 * these margins are the only ones applied.
 */
export async function renderPdf(printUrl: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const response = await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 30_000 });
    if (!response || !response.ok()) {
      throw new Error(`Print view returned ${response?.status() ?? 'no response'}`);
    }
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0.625in', right: '0.5in', bottom: '0.625in', left: '0.5in' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
