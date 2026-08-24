import { getPrd } from '@/lib/db';
import { renderPdf } from '@/lib/pdf';
import { exportBasename } from '@/lib/render';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = getPrd(id);
  if (!record) return new Response('Not found', { status: 404 });

  // Puppeteer runs on this machine, so it fetches the print route from this same server.
  const printUrl = new URL(`/prd/${id}/print`, new URL(req.url).origin).toString();

  try {
    const buffer = await renderPdf(printUrl);
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
