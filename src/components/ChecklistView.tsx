'use client';

import { CHECK_GROUPS, type CheckResult } from '@/lib/validation';

export default function ChecklistView({
  results,
  onToggleManual,
  onJump,
}: {
  results: CheckResult[];
  onToggleManual: (id: string, checked: boolean) => void;
  onJump: (blockId: string, fieldKey: string) => void;
}) {
  const outstanding = results.filter((r) => !r.ok);
  const green = outstanding.length === 0;

  return (
    <div>
      <div className="border-t-2 border-ink pt-3">
        <h1 className="text-block">
          <span className="text-blocknum">05&nbsp;&nbsp;&nbsp;</span>
          <span className="font-bold">PRE-REVIEW CHECKLIST</span>
        </h1>
        <p className="mt-0.5 text-sub italic text-hint">
          Any unchecked box means this is not ready for engineering
        </p>
      </div>

      <div
        className={`mt-5 rounded border px-4 py-3 ${
          green ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'
        }`}
      >
        <p className={`text-[13px] font-bold ${green ? 'text-emerald-800' : 'text-amber-900'}`}>
          {green
            ? `All ${results.length} checks pass.`
            : `${outstanding.length} of ${results.length} ${
                outstanding.length === 1 ? 'item is' : 'items are'
              } outstanding.`}
        </p>
        <p className={`mt-0.5 text-hint ${green ? 'text-emerald-700' : 'text-amber-800'}`}>
          Any unchecked box means this is not ready for engineering.
        </p>
      </div>

      {CHECK_GROUPS.map((group) => {
        const items = results.filter((r) => r.group === group);
        if (items.length === 0) return null;
        return (
          <section key={group} className="mt-6">
            <h2 className="text-hint font-bold tracking-wide text-label">{group}</h2>
            <ul className="mt-1.5">
              {items.map((item) => (
                <li key={item.id} className="border-b border-neutral-100 py-1.5 last:border-0">
                  <div className="flex items-start gap-2">
                    {item.kind === 'manual' ? (
                      <input
                        type="checkbox"
                        checked={item.ok}
                        onChange={(e) => onToggleManual(item.id, e.target.checked)}
                        className="mt-[3px] h-3.5 w-3.5 shrink-0 accent-ink"
                        aria-label={item.label}
                      />
                    ) : (
                      <span
                        className={`mt-[-1px] shrink-0 text-[14px] leading-tight ${
                          item.ok ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        <span aria-hidden>{item.ok ? '☑' : '☐'}</span>
                        <span className="sr-only">
                          {item.ok ? 'Satisfied: ' : 'Not satisfied: '}
                        </span>
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className={`text-[12px] ${item.ok ? '' : 'font-medium'}`}>
                        {item.label}
                        {item.kind === 'manual' && (
                          <span className="ml-2 rounded bg-neutral-100 px-1.5 py-px text-[10px] text-muted">
                            manual
                          </span>
                        )}
                      </p>
                      {!item.ok && item.reason && (
                        <p className="mt-0.5 text-hint text-amber-800">
                          {item.reason}{' '}
                          {item.target && (
                            <button
                              type="button"
                              onClick={() => onJump(item.target!.blockId, item.target!.fieldKey)}
                              className="underline hover:text-ink"
                            >
                              Go to it
                            </button>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
