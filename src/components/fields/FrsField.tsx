'use client';

import { emptyFr, type FunctionalRequirement } from '@/lib/types';
import { frHasContent } from '@/lib/completion';
import { LongTextInput } from './primitives';

export default function FrsField({
  frs,
  onChange,
}: {
  frs: FunctionalRequirement[];
  onChange: (f: FunctionalRequirement[]) => void;
}) {
  const patch = (id: string, changes: Partial<FunctionalRequirement>) =>
    onChange(frs.map((f) => (f._id === id ? { ...f, ...changes } : f)));

  const remove = (fr: FunctionalRequirement) => {
    if (frHasContent(fr) && !window.confirm('This requirement has content. Delete it?')) return;
    onChange(frs.filter((f) => f._id !== fr._id));
  };

  const move = (index: number, delta: number) => {
    const next = [...frs];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div>
      {frs.map((fr, i) => (
        // IDs come from position, so reordering or deleting renumbers the rest.
        <div key={fr._id} className="mb-4 rounded border border-rule">
          <div className="flex items-center justify-between border-b border-rule bg-labelfill px-3 py-1.5">
            <span className="text-[12px] font-bold">FR-{i + 1}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                title="Move up"
                className="px-1 text-[11px] text-hint hover:text-ink disabled:opacity-25"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === frs.length - 1}
                title="Move down"
                className="px-1 text-[11px] text-hint hover:text-ink disabled:opacity-25"
              >
                ↓
              </button>
              {frs.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(fr)}
                  className="ml-1 text-[11px] text-hint hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <div className="px-3 py-3">
            <LongTextInput
              aria-label={`FR-${i + 1}, requirement`}
              value={fr.requirement}
              onChange={(v) => patch(fr._id, { requirement: v })}
              lines={1}
              placeholder="The system must…"
            />
            <p className="mt-3 text-sub text-muted">Complete when</p>
            <LongTextInput
              aria-label={`FR-${i + 1}, complete when`}
              value={fr.complete_when}
              onChange={(v) => patch(fr._id, { complete_when: v })}
              lines={1}
              placeholder="The exact state transition that marks this done"
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...frs, emptyFr()])}
        className="text-[11px] text-muted hover:text-ink hover:underline"
      >
        + Add requirement
      </button>
    </div>
  );
}
