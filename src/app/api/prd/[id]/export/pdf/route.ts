import { getPrd } from '@/lib/db';
import { renderPdf } from '@/lib/pdf';
import { printHtml } from '@/lib/print-html';
import { exportBasename } from '@/lib/render';

// Launching Chromium on a cold start can take a while; the platform default is too tight.
export const maxDuration = 60;
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getPrd(id);
  if (!record) return new Response('Not found', { status: 404 });

  try {
    const buffer = await renderPdf(await printHtml(record));
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${exportBasename(record)}.pdf"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error) {
    console.error('PDF export failed', error);
    return new Response('PDF export failed. See the server log for details.', { status: 500 });
  }
}
