import PrintDocument, { PRINT_CSS } from '@/components/PrintDocument';
import type { PrdRecord } from './types';

/**
 * The print view as a self-contained HTML string.
 *
 * The PDF export used to point a headless browser at /prd/[id]/print over HTTP, which
 * meant that request had to survive everything sitting in front of the app: this app's
 * own login, whatever the host puts in the way, and getting the public origin right from
 * inside a function. Vercel's deployment protection intercepted it and the export
 * returned a PDF of Vercel's login page.
 *
 * Rendering the same component to a string and handing it straight to the browser removes
 * the round trip, and with it every one of those failure modes. The route still exists to
 * look at; it just is not what the exporter reads.
 */
export async function printHtml(record: PrdRecord): Promise<string> {
  // Imported here rather than at the top: Next refuses a static import of react-dom/server
  // from a module that might otherwise be reached from the client graph.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const body = renderToStaticMarkup(PrintDocument({ record }));
  const title = record.content.header.feature_name || 'PRD';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(
    title
  )}</title><style>${PRINT_CSS}</style></head><body>${body}</body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
