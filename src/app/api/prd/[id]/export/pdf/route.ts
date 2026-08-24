import { getPrd } from '@/lib/db';
import { renderPdf } from '@/lib/pdf';
import { authConfig, createSession } from '@/lib/auth';
import { exportBasename } from '@/lib/render';
import { publicOrigin } from '@/lib/http';

// Launching Chromium on a cold start can take a while; the platform default is too tight.
export const maxDuration = 60;
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getPrd(id);
  if (!record) return new Response('Not found', { status: 404 });

  // The headless browser fetches the print route over HTTP like any other client, so when
  // login is enabled it needs credentials of its own: a signed token good for one minute.
  const printUrl = new URL(`/prd/${id}/print`, publicOrigin(req));
  const config = authConfig();
  if (config) printUrl.searchParams.set('t', await createSession(config.secret, 60));

  try {
    const buffer = await renderPdf(printUrl.toString());
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
