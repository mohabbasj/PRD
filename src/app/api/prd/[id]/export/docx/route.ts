import { getPrd } from '@/lib/db';
import { buildDocx } from '@/lib/docx';
import { exportBasename } from '@/lib/render';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getPrd(id);
  if (!record) return new Response('Not found', { status: 404 });

  const buffer = await buildDocx(record);
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${exportBasename(record)}.docx"`,
      'Content-Length': String(buffer.length),
    },
  });
}
