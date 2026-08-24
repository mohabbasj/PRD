'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { STATUS_OPTIONS, type Status } from '@/lib/schema';
import type { PrdSummary } from '@/lib/types';
import { createPrdAction, deletePrdAction, duplicatePrdAction } from '@/app/actions';

type Row = PrdSummary & { updated_label: string };

function StatusPill({ status }: { status: Status }) {
  const tone: Record<Status, string> = {
    Draft: 'bg-neutral-100 text-neutral-600',
    'In Review': 'bg-amber-50 text-amber-700',
    Approved: 'bg-emerald-50 text-emerald-700',
    'In Development': 'bg-blue-50 text-blue-700',
    Shipped: 'bg-violet-50 text-violet-700',
  };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[11px] ${tone[status]}`}>{status}</span>
  );
}

function CompletionBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-16 rounded-full bg-neutral-200">
        <div className="h-1 rounded-full bg-ink" style={{ width: `${value}%` }} />
      </div>
      <span className="tabular-nums text-[11px] text-muted">{value}%</span>
    </div>
  );
}

function ChecklistMark({ passed, total }: { passed: number; total: number }) {
  const ok = passed === total;
  return (
    <span
      title={`${passed} of ${total} pre-review checks pass`}
      className={`inline-flex items-center gap-1 text-[11px] ${ok ? 'text-emerald-700' : 'text-amber-700'}`}
    >
      <span className="text-[13px] leading-none">{ok ? '☑' : '☐'}</span>
      <span className="tabular-nums">
        {passed}/{total}
      </span>
    </span>
  );
}

export default function PrdList({ prds }: { prds: Row[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | Status>('All');
  const [confirming, setConfirming] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prds.filter(
      (p) =>
        (status === 'All' || p.status === status) &&
        (q === '' || (p.feature_name || 'Untitled PRD').toLowerCase().includes(q))
    );
  }, [prds, query, status]);

  return (
    <main className="mx-auto max-w-5xl px-8 py-12">
      <header className="mb-8 flex items-end justify-between border-b-[3px] border-ink pb-3">
        <div>
          <h1 className="text-[22pt] font-bold leading-tight">Product Requirements Documents</h1>
          <p className="mt-1 text-hint text-hint">
            {prds.length} saved {prds.length === 1 ? 'document' : 'documents'}
          </p>
        </div>
        <form action={createPrdAction}>
          <button
            type="submit"
            className="rounded bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:bg-black"
          >
            New PRD
          </button>
        </form>
      </header>

      {prds.length > 0 && (
        <div className="mb-4 flex gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by feature name"
            className="w-64 rounded border border-rule px-3 py-1.5 text-[12px] placeholder:text-hint"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'All' | Status)}
            className="rounded border border-rule px-3 py-1.5 text-[12px]"
          >
            <option value="All">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {prds.length === 0 ? (
        <div className="rounded border border-dashed border-rule px-8 py-16 text-center">
          <p className="text-[13px] font-semibold">No PRDs yet</p>
          <p className="mx-auto mt-2 max-w-sm text-hint text-hint">
            Start one and it saves as you type. Nothing leaves this machine — everything lives in{' '}
            <code className="font-mono">data/prd.db</code>.
          </p>
          <form action={createPrdAction} className="mt-5">
            <button
              type="submit"
              className="rounded bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:bg-black"
            >
              New PRD
            </button>
          </form>
        </div>
      ) : visible.length === 0 ? (
        <p className="px-1 py-10 text-center text-hint text-hint">
          No PRD matches that filter.
        </p>
      ) : (
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-headfill text-left text-[11px] font-bold">
              <th className="border border-rule px-2 py-1.5">Feature</th>
              <th className="border border-rule px-2 py-1.5">Status</th>
              <th className="border border-rule px-2 py-1.5">Product manager</th>
              <th className="border border-rule px-2 py-1.5">Last updated</th>
              <th className="border border-rule px-2 py-1.5">Complete</th>
              <th className="border border-rule px-2 py-1.5">Checks</th>
              <th className="border border-rule px-2 py-1.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id} className="align-middle">
                <td className="border border-rule px-2 py-1.5">
                  <Link href={`/prd/${p.id}`} className="font-semibold hover:underline">
                    {p.feature_name || <span className="text-hint">Untitled PRD</span>}
                  </Link>
                </td>
                <td className="border border-rule px-2 py-1.5">
                  <StatusPill status={p.status} />
                </td>
                <td className="border border-rule px-2 py-1.5">
                  {p.product_manager || <span className="text-hint">—</span>}
                </td>
                <td className="border border-rule px-2 py-1.5 whitespace-nowrap text-muted">
                  {p.updated_label}
                </td>
                <td className="border border-rule px-2 py-1.5">
                  <CompletionBar value={p.completion} />
                </td>
                <td className="border border-rule px-2 py-1.5">
                  <ChecklistMark passed={p.checklist.passed} total={p.checklist.total} />
                </td>
                <td className="border border-rule px-2 py-1.5">
                  <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                    <Link href={`/prd/${p.id}`} className="text-[11px] hover:underline">
                      Open
                    </Link>
                    <form action={duplicatePrdAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="text-[11px] hover:underline">
                        Duplicate
                      </button>
                    </form>
                    <span
                      className="cursor-not-allowed text-[11px] text-hint"
                      title="Built in the export stage"
                    >
                      PDF
                    </span>
                    <span
                      className="cursor-not-allowed text-[11px] text-hint"
                      title="Built in the export stage"
                    >
                      Word
                    </span>
                    {confirming === p.id ? (
                      <form action={deletePrdAction} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" className="text-[11px] font-semibold text-red-700">
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          className="text-[11px] text-hint hover:underline"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirming(p.id)}
                        className="text-[11px] text-red-700 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
