import { BLOCKS, HEADER_FIELDS, type Field } from './schema';
import type { FieldValue, FunctionalRequirement, PrdContent, Story, TableRow } from './types';

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** A table row counts as filled only if some cell has content — empty seeded rows do not. */
export function rowHasContent(row: TableRow, ignore: string[] = []): boolean {
  return Object.entries(row).some(
    ([k, v]) => !k.startsWith('_') && !ignore.includes(k) && typeof v === 'string' && v.trim() !== ''
  );
}

export function storyHasContent(s: Story): boolean {
  return (
    !!str(s.as_a) ||
    !!str(s.i_want) ||
    !!str(s.so_that) ||
    !!str(s.notes) ||
    s.acceptance.some((a) => str(a.given) || str(a.when) || str(a.then))
  );
}

export function frHasContent(f: FunctionalRequirement): boolean {
  return !!str(f.requirement) || !!str(f.complete_when);
}

/** One unit per field: a whole table or card list is filled once any row has content. */
function fieldFilled(field: Field, values: Record<string, FieldValue>): boolean {
  switch (field.type) {
    case 'text':
    case 'longtext':
    case 'url':
      return str(values[field.key]) !== '';
    case 'table': {
      const rows = (values[field.key] as TableRow[]) ?? [];
      return rows.some((r) => rowHasContent(r));
    }
    case 'stories': {
      const stories = (values[field.key] as Story[]) ?? [];
      return stories.some(storyHasContent);
    }
    case 'frs': {
      const frs = (values[field.key] as FunctionalRequirement[]) ?? [];
      return frs.some(frHasContent);
    }
    case 'kv':
      return false; // Container only; its entries are counted individually.
  }
}

function countField(
  field: Field,
  values: Record<string, FieldValue>
): { total: number; filled: number } {
  if (field.type === 'kv') {
    let filled = 0;
    for (const entry of field.entries) {
      const v = values[entry.key];
      if (entry.type === 'multicheck') {
        if (Array.isArray(v) && v.length > 0) filled += 1;
      } else if (str(v) !== '') {
        filled += 1;
      }
    }
    return { total: field.entries.length, filled };
  }
  return { total: 1, filled: fieldFilled(field, values) ? 1 : 0 };
}

export interface Completion {
  overall: number;
  byBlock: Record<string, number>;
}

export function computeCompletion(content: PrdContent): Completion {
  const byBlock: Record<string, number> = {};
  let overallTotal = 0;
  let overallFilled = 0;

  for (const block of BLOCKS) {
    let total = 0;
    let filled = 0;
    for (const node of block.nodes) {
      if (node.kind !== 'field') continue;
      const c = countField(node.field, content.values);
      total += c.total;
      filled += c.filled;
    }
    byBlock[block.id] = total === 0 ? 0 : Math.round((filled / total) * 100);
    overallTotal += total;
    overallFilled += filled;
  }

  // The header carries no block of its own, so it counts toward the overall figure only.
  for (const h of HEADER_FIELDS) {
    overallTotal += 1;
    if (str(content.header[h.key as keyof typeof content.header]) !== '') overallFilled += 1;
  }

  return {
    overall: overallTotal === 0 ? 0 : Math.round((overallFilled / overallTotal) * 100),
    byBlock,
  };
}
