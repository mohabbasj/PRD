import { NextResponse } from 'next/server';
import { deletePrd, getPrd, savePrd } from '@/lib/db';
import { checkSummary } from '@/lib/validation';
import { computeCompletion } from '@/lib/completion';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getPrd(id);
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const record = await savePrd(id, body?.content);
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    updated_at: record.updated_at,
    completion: computeCompletion(record.content),
    checklist: checkSummary(record.content),
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ ok: await deletePrd(id) });
}
