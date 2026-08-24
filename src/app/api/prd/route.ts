import { NextResponse } from 'next/server';
import { createPrd, listPrds } from '@/lib/db';

export async function GET() {
  return NextResponse.json(listPrds());
}

export async function POST() {
  return NextResponse.json(createPrd(), { status: 201 });
}
