import { notFound } from 'next/navigation';
import { getPrd } from '@/lib/db';
import PrintDocument, { PRINT_CSS } from '@/components/PrintDocument';

export const dynamic = 'force-dynamic';

/**
 * The un-chromed rendering Puppeteer turns into the PDF. No nav, no buttons. It carries its
 * own stylesheet, whose rules are specific enough to override the app's Tailwind base, so
 * the printed page is governed by the template's measurements and nothing else.
 */
export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getPrd(id);
  if (!record) notFound();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <PrintDocument record={record} />
    </>
  );
}
