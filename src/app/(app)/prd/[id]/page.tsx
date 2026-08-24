import { notFound } from 'next/navigation';
import { getPrd } from '@/lib/db';
import Editor from '@/components/Editor';

export const dynamic = 'force-dynamic';

export default async function PrdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = getPrd(id);
  if (!record) notFound();
  return <Editor record={record} />;
}
