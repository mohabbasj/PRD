'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

const inputBase =
  'w-full bg-transparent px-2 py-1 text-[12px] outline-none placeholder:text-hint';

export function TextInput({
  value,
  onChange,
  placeholder,
  onKeyDown,
  bordered = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  bordered?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`${inputBase} ${bordered ? 'rounded border border-rule focus:border-ink' : ''}`}
    />
  );
}

export function DateInput({
  value,
  onChange,
  onKeyDown,
  bordered = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  bordered?: boolean;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`${inputBase} ${bordered ? 'rounded border border-rule focus:border-ink' : ''}`}
    />
  );
}

export function UrlInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const valid = value.trim() === '' || isUrl(value);
  return (
    <div>
      <input
        type="url"
        value={value}
        placeholder="https://figma.com/file/…"
        onChange={(e) => onChange(e.target.value)}
        className={`${inputBase} rounded border ${valid ? 'border-rule focus:border-ink' : 'border-red-400'}`}
      />
      {!valid && (
        <p className="mt-1 px-2 text-hint text-red-600">That is not a valid URL.</p>
      )}
      {valid && value.trim() !== '' && (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block px-2 text-hint text-muted underline"
        >
          Open link
        </a>
      )}
    </div>
  );
}

export function isUrl(v: string): boolean {
  try {
    const u = new URL(v.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function SelectInput({
  value,
  onChange,
  options,
  placeholder = '—',
  onKeyDown,
  bordered = true,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLSelectElement>) => void;
  bordered?: boolean;
}) {
  // A value that no longer exists in options is kept and flagged rather than dropped,
  // so renaming a metric never silently wipes the tracking plan row that referenced it.
  const stale = value !== '' && !options.includes(value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`${inputBase} ${bordered ? 'rounded border border-rule focus:border-ink' : ''} ${
        stale ? 'text-red-600' : ''
      }`}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      {stale && <option value={value}>{value} (no longer a metric)</option>}
    </select>
  );
}

/** Multi-line field drawn as ruled writing lines, matching the template's dotted blocks. */
export function LongTextInput({
  value,
  onChange,
  lines = 2,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  lines?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const minHeight = lines * 28;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [value, minHeight]);

  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={lines}
      style={{ minHeight }}
      className="doc-lines w-full resize-none overflow-hidden bg-transparent px-1 text-[12px] outline-none placeholder:text-hint focus:bg-neutral-50/60"
    />
  );
}

export function YesNo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 px-1 py-0.5">
      {['yes', 'no'].map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(value === option ? '' : option)}
          className={`rounded border px-3 py-0.5 text-[11px] capitalize ${
            value === option
              ? 'border-ink bg-ink text-white'
              : 'border-rule text-muted hover:border-ink'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function MultiCheck({
  value,
  onChange,
  options,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: string[];
}) {
  const toggle = (option: string) =>
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 py-1">
      {options.map((option) => (
        <label key={option} className="flex cursor-pointer items-center gap-1.5 text-[12px]">
          <input
            type="checkbox"
            checked={value.includes(option)}
            onChange={() => toggle(option)}
            className="h-3.5 w-3.5 accent-ink"
          />
          {option}
        </label>
      ))}
    </div>
  );
}

/** Keeps the browser from restoring scroll when a field is focused programmatically. */
export function useScrollTarget(active: string | null, onDone: () => void) {
  useEffect(() => {
    if (!active) return;
    const el = document.getElementById(`field-${active}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-400');
      const t = setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400'), 1800);
      return () => clearTimeout(t);
    }
    onDone();
  }, [active, onDone]);
}
