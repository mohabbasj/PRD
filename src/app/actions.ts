'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createPrd, deletePrd, duplicatePrd } from '@/lib/db';

export async function createPrdAction() {
  const record = createPrd();
  redirect(`/prd/${record.id}`);
}

export async function duplicatePrdAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  duplicatePrd(id);
  revalidatePath('/');
}

export async function deletePrdAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  deletePrd(id);
  revalidatePath('/');
}
