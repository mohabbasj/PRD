import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPrd } from '@/lib/db';
import Editor from '@/components/Editor';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const record = getPrd(id);
  return { title: record?.feature_name ? `${record.feature_name} — PRD` : 'PRD Editor' };
}

export default async function PrdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = getPrd(id);
  if (!record) notFound();
  return <Editor record={record} />;
}
