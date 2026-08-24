'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BLOCKS, HEADER_FIELDS, STATUS_OPTIONS, type Status } from '@/lib/schema';
import { computeCompletion } from '@/lib/completion';
import { metricNames, runChecks } from '@/lib/validation';
import { formatDate } from '@/lib/render';
import type { FieldValue, PrdContent, PrdRecord } from '@/lib/types';
import { markPersisted } from '@/lib/persist';
import BlockView from './BlockView';
import ChecklistView from './ChecklistView';
import SignOut from './SignOut';

type SaveState = 'saved' | 'saving' | 'dirty' | 'error';

const AUTOSAVE_MS = 800;
const RETRY_MS = 3000;

export default function Editor({
  record,
  authEnabled,
}: {
  record: PrdRecord;
  authEnabled: boolean;
}) {
  const [content, setContent] = useState<PrdContent>(record.content);
  const [activeBlock, setActiveBlock] = useState(BLOCKS[0].id);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [updatedAt, setUpdatedAt] = useState<string | null>(record.updated_at);
  const [jumpTo, setJumpTo] = useState<string | null>(null);

  const latest = useRef(content);
  latest.current = content;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set when a content change came from us rather than the author, so it need not resave. */
  const suppressAutosave = useRef(false);

  const save = useCallback(async (isRetry = false) => {
    setSaveState('saving');
    const snapshot = latest.current;
    try {
      const res = await fetch(`/api/prd/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: snapshot }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      const body = (await res.json()) as { updated_at: string | null };
      setUpdatedAt(body.updated_at);
      // Only settle to "saved" if nothing was typed while the request was in flight.
      if (latest.current === snapshot) {
        setContent((c) => {
          if (c !== snapshot) return c;
          const stripped = markPersisted(c);
          if (stripped !== c) suppressAutosave.current = true;
          return stripped;
        });
        setSaveState('saved');
      }
    } catch (error) {
      console.error(error);
      setSaveState('error');
      // One retry covers the usual cause, a dev server restarting mid-keystroke.
      if (!isRetry) {
        retryTimer.current = setTimeout(() => void save(true), RETRY_MS);
      }
    }
  }, [record.id]);

  // Debounced autosave.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (suppressAutosave.current) {
      suppressAutosave.current = false;
      return;
    }
    setSaveState('dirty');
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [content, save]);

  /** Flushes any pending edit. Exports read from the database, not from this component. */
  const saveNow = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await save();
  }, [save]);

  // The 800ms debounce leaves a small window where a close would lose the last keystroke.
  useEffect(() => {
    if (saveState === 'saved') return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  // Cmd/Ctrl+S saves straight away rather than waiting out the debounce.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  // Scroll to a field the checklist pointed at, once its block has rendered.
  useEffect(() => {
    if (!jumpTo) return;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(`field-${jumpTo}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.classList.add('ring-2', 'ring-amber-400');
      setTimeout(() => el?.classList.remove('ring-2', 'ring-amber-400'), 1800);
      setJumpTo(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [jumpTo, activeBlock]);

  const setValue = useCallback((key: string, value: FieldValue) => {
    setContent((c) => ({ ...c, values: { ...c.values, [key]: value } }));
  }, []);

  const setHeader = useCallback((key: string, value: string) => {
    setContent((c) => ({ ...c, header: { ...c.header, [key]: value } }));
  }, []);

  const completion = useMemo(() => computeCompletion(content), [content]);
  const checks = useMemo(() => runChecks(content), [content]);
  const metrics = useMemo(() => metricNames(content), [content]);
  const checksPassed = checks.filter((c) => c.ok).length;

  const block = BLOCKS.find((b) => b.id === activeBlock)!;

  const jump = (blockId: string, fieldKey: string) => {
    setActiveBlock(blockId);
    setJumpTo(fieldKey);
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-rule bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-2.5">
          <Link href="/" className="shrink-0 text-[11px] text-muted hover:text-ink hover:underline">
            ← All PRDs
          </Link>
          <input
            value={content.header.feature_name}
            onChange={(e) => setHeader('feature_name', e.target.value)}
            aria-label="Feature name"
            placeholder="Feature name"
            className="min-w-0 flex-1 bg-transparent text-[15px] font-bold outline-none placeholder:font-normal placeholder:text-hint"
          />
          <select
            value={content.header.status}
            aria-label="Status"
            onChange={(e) => setHeader('status', e.target.value as Status)}
            className="shrink-0 rounded border border-rule px-2 py-1 text-[11px]"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <SaveIndicator state={saveState} />
          <div className="flex shrink-0 gap-1.5">
            <a
              href={`/prd/${record.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-rule px-2.5 py-1 text-[11px] hover:border-ink"
            >
              Print view
            </a>
            <ExportButton
              href={`/api/prd/${record.id}/export/pdf`}
              label="Export PDF"
              fallbackName="PRD.pdf"
              onBeforeDownload={saveNow}
            />
            <ExportButton
              href={`/api/prd/${record.id}/export/docx`}
              label="Export Word"
              fallbackName="PRD.docx"
              onBeforeDownload={saveNow}
            />
            {authEnabled && <SignOut />}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-6">
        <nav className="sticky top-[52px] h-fit w-56 shrink-0 self-start">
          <div className="mb-3 rounded border border-rule px-3 py-2">
            <div className="flex items-baseline justify-between">
              <span className="text-hint text-muted">Overall</span>
              <span className="text-[13px] font-bold tabular-nums">{completion.overall}%</span>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-neutral-200">
              <div
                className="h-1 rounded-full bg-ink transition-all"
                style={{ width: `${completion.overall}%` }}
              />
            </div>
          </div>

          <ul>
            {BLOCKS.map((b) => {
              const isChecklist = b.id === 'checklist';
              const active = b.id === activeBlock;
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setActiveBlock(b.id)}
                    className={`w-full border-l-2 px-3 py-2 text-left transition-colors ${
                      active
                        ? 'border-ink bg-neutral-50'
                        : 'border-transparent hover:border-rule hover:bg-neutral-50/60'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] text-blocknum">{b.num}</span>
                      <span className="text-hint tabular-nums text-muted">
                        {isChecklist
                          ? `${checksPassed}/${checks.length}`
                          : `${completion.byBlock[b.id]}%`}
                      </span>
                    </div>
                    <div className={`text-[12px] ${active ? 'font-bold' : ''}`}>{b.name}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 pb-32">
          {activeBlock === BLOCKS[0].id && (
            <section className="mb-8">
              <table className="w-full table-fixed border-collapse">
                <tbody>
                  {HEADER_FIELDS.map((f) => (
                    <tr key={f.key}>
                      <th className="w-1/3 border border-rule bg-labelfill px-2 py-1.5 text-left text-sub font-normal text-label">
                        {f.label}
                      </th>
                      <td className="border border-rule px-1 py-0.5">
                        <input
                          aria-label={f.label}
                          value={
                            (content.header[f.key as keyof typeof content.header] as string) ?? ''
                          }
                          onChange={(e) => setHeader(f.key, e.target.value)}
                          className="w-full bg-transparent px-1 py-0.5 text-[12px] outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <th className="border border-rule bg-labelfill px-2 py-1.5 text-left text-sub font-normal text-label">
                      Last Updated
                    </th>
                    <td className="border border-rule px-2 py-1.5 text-[12px] text-muted">
                      {updatedAt ? (
                        formatDate(updatedAt.slice(0, 10))
                      ) : (
                        <span className="text-hint">Set automatically on save</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}

          {activeBlock === 'checklist' ? (
            <ChecklistView
              results={checks}
              onToggleManual={(id, checked) =>
                setContent((c) => ({
                  ...c,
                  manualChecks: { ...c.manualChecks, [id]: checked },
                }))
              }
              onJump={jump}
            />
          ) : (
            <BlockView
              block={block}
              values={content.values}
              setValue={setValue}
              metricOptions={metrics}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const label: Record<SaveState, string> = {
    saved: 'Saved',
    saving: 'Saving…',
    dirty: 'Unsaved',
    error: 'Save failed',
  };
  const tone: Record<SaveState, string> = {
    saved: 'text-emerald-700',
    saving: 'text-muted',
    dirty: 'text-amber-700',
    error: 'text-red-700',
  };
  return (
    <span className={`shrink-0 whitespace-nowrap text-[11px] ${tone[state]}`} aria-live="polite">
      {label[state]}
    </span>
  );
}

/** Reads the server's filename, falling back to something sensible if the header is odd. */
function filenameFrom(disposition: string | null, fallback: string): string {
  const match = disposition && /filename="([^"]+)"/.exec(disposition);
  return match ? match[1] : fallback;
}

/**
 * Saves first, then fetches the file and hands it to the browser as a blob.
 *
 * Two reasons not to just point the window at the export URL: navigating would trip the
 * unsaved-changes guard on the way out, and it gives no feedback while Puppeteer spends a
 * second or two rendering. This way the button stays busy for the whole wait and a failure
 * can be reported rather than dumping the user on an error page.
 */
function ExportButton({
  href,
  label,
  fallbackName,
  onBeforeDownload,
}: {
  href: string;
  label: string;
  fallbackName: string;
  onBeforeDownload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = async () => {
    setBusy(true);
    setFailed(false);
    let objectUrl: string | null = null;
    try {
      await onBeforeDownload();
      const res = await fetch(href);
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filenameFrom(res.headers.get('content-disposition'), fallbackName);
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error(error);
      setFailed(true);
    } finally {
      // Revoking immediately can cancel the download in some browsers; give it a moment.
      const created = objectUrl;
      if (created) setTimeout(() => URL.revokeObjectURL(created), 30_000);
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={run}
      title={failed ? 'Export failed. See the server log.' : undefined}
      className={`rounded border px-2.5 py-1 text-[11px] disabled:opacity-50 ${
        failed ? 'border-red-400 text-red-700' : 'border-rule hover:border-ink'
      }`}
    >
      {busy ? 'Preparing…' : failed ? `${label} failed` : label}
    </button>
  );
}
