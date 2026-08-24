import type { FieldValue, PrdContent, TableRow } from './types';
import { rowHasContent } from './completion';

/**
 * What a save does to the document besides storing it.
 *
 * `_new` is a client-only marker, dropped once a row reaches the database. `_locked` is
 * set on append-only rows that have been saved *with content* — a decision, once recorded,
 * stays recorded. A blank row is never locked, so the stock empty rows can still be tidied
 * away and a row typed into by mistake can still be removed before it is saved.
 *
 * Returns the original object when nothing changed, so the client can call this after every
 * save without the new reference re-dirtying the document and looping autosave.
 */
export function markPersisted(content: PrdContent): PrdContent {
  let changed = false;
  const values: Record<string, FieldValue> = { ...content.values };

  for (const [key, value] of Object.entries(values)) {
    if (!Array.isArray(value)) continue;
    const lockRows = key === 'decisions';
    let touched = false;
    const next = (value as unknown[]).map((item) => {
      if (!item || typeof item !== 'object') return item;
      const row = item as TableRow;
      const shouldLock = lockRows && rowHasContent(row) && row._locked !== true;
      if (!('_new' in row) && !shouldLock) return item;
      touched = true;
      const copy: Record<string, unknown> = { ...row };
      delete copy._new;
      if (shouldLock) copy._locked = true;
      return copy;
    });
    if (touched) {
      changed = true;
      values[key] = next as FieldValue;
    }
  }

  return changed ? { ...content, values } : content;
}
