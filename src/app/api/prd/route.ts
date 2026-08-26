import { NextResponse } from 'next/server';
import { createPrd, listPrds } from '@/lib/db';
import { storageError } from '@/lib/http';

export async function GET() {
  try {
    return NextResponse.json(await listPrds());
  } catch (error) {
    return storageError(error);
  }
}

export async function POST() {
  try {
    return NextResponse.json(await createPrd(), { status: 201 });
  } catch (error) {
    return storageError(error);
  }
}
