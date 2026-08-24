'use client';

import { useCallback } from 'react';
import type { Column, TableField as TableFieldSpec } from '@/lib/schema';
import { columnWidths } from '@/lib/schema';
import { emptyRow, type TableRow } from '@/lib/types';
import { rowHasContent } from '@/lib/completion';
import { DateInput, SelectInput, TextInput } from './primitives';

function cellId(rowId: string, colKey: string) {
  return `cell-${rowId}-${colKey}`;
}

export default function TableField({
  field,
  rows,
  onChange,
  metricOptions,
}: {
  field: TableFieldSpec;
  rows: TableRow[];
  onChange: (rows: TableRow[]) => void;
  metricOptions: string[];
}) {
  const widths = columnWidths(field.columns);
  const total = widths.reduce((a, w) => a + w, 0);

  const setCell = (rowId: string, key: string, value: string | boolean) =>
    onChange(rows.map((r) => (r._id === rowId ? { ...r, [key]: value } : r)));

  const addRow = useCallback(
    (focusIt = false) => {
      const row = emptyRow(field.columns);
      onChange([...rows, row]);
      if (focusIt) {
        requestAnimationFrame(() =>
          document.getElementById(cellId(row._id, field.columns[0].key))?.focus()
        );
      }
    },
    [field.columns, onChange, rows]
  );

  const removeRow = (row: TableRow) => {
    // Confirm only when there is something to lose.
    if (rowHasContent(row) && !window.confirm('This row has content. Delete it?')) return;
    onChange(rows.filter((r) => r._id !== row._id));
  };

  const move = (index: number, delta: number) => {
    const next = [...rows];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const canDelete = (row: TableRow) => {
    if (field.singleRow) return false;
    // The decisions log is append-only from the moment a row is saved with content in it.
    // A blank row, or one typed into but not yet saved, is still fair game.
    if (field.noDelete) return row._locked !== true;
    return true;
  };

  const lastCol = field.columns[field.columns.length - 1].key;

  const handleKeyDown = (rowIndex: number, colKey: string) => (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || e.shiftKey) return;
    if (field.singleRow) return;
    if (rowIndex !== rows.length - 1 || colKey !== lastCol) return;
    e.preventDefault();
    addRow(true);
  };

  const renderCell = (row: TableRow, rowIndex: number, col: Column) => {
    const value = typeof row[col.key] === 'string' ? (row[col.key] as string) : '';
    const set = (v: string) => setCell(row._id, col.key, v);
    const onKeyDown = handleKeyDown(rowIndex, col.key);
    const shared = {
      value,
      onChange: set,
      onKeyDown,
      bordered: false as const,
      'aria-label': `${col.label}, row ${rowIndex + 1}`,
    };
    return (
      <div id={cellId(row._id, col.key)} tabIndex={-1}>
        {col.type === 'date' ? (
          <DateInput {...shared} />
        ) : col.type === 'enum' ? (
          <SelectInput {...shared} options={col.options ?? []} />
        ) : col.type === 'metricref' ? (
          <SelectInput {...shared} options={metricOptions} placeholder="— pick a metric —" />
        ) : (
          <TextInput {...shared} />
        )}
      </div>
    );
  };

  return (
    <div>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          {widths.map((w, i) => (
            <col key={i} style={{ width: `${(w / total) * 100}%` }} />
          ))}
          {!field.singleRow && <col style={{ width: '76px' }} />}
        </colgroup>
        <thead>
          <tr className="bg-headfill">
            {field.columns.map((col) => (
              <th
                key={col.key}
                className="border border-rule px-2 py-1 text-left text-[11px] font-bold"
              >
                {col.label}
              </th>
            ))}
            {!field.singleRow && <th className="border border-rule px-1 py-1" />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={field.columns.length + 1}
                className="border border-rule px-2 py-3 text-center text-hint text-hint"
              >
                No rows yet.
              </td>
            </tr>
          )}
          {rows.map((row, rowIndex) => (
            <tr key={row._id}>
              {field.columns.map((col) => (
                <td key={col.key} className="border border-rule align-top">
                  {renderCell(row, rowIndex, col)}
                  {field.rowFlag?.fillsColumn === col.key && (
                    <label className="flex cursor-pointer items-center gap-1.5 px-2 pb-1 text-hint text-muted">
                      <input
                        type="checkbox"
                        checked={row.accepted === true}
                        onChange={(e) => setCell(row._id, field.rowFlag!.key, e.target.checked)}
                        className="h-3 w-3 accent-ink"
                      />
                      {field.rowFlag.label}
                    </label>
                  )}
                </td>
              ))}
              {!field.singleRow && (
                <td className="border border-rule px-1 py-1 align-top">
                  <div className="flex items-center justify-end gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(rowIndex, -1)}
                      disabled={rowIndex === 0}
                      title="Move up"
                      className="px-1 text-[11px] text-hint hover:text-ink disabled:opacity-25"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(rowIndex, 1)}
                      disabled={rowIndex === rows.length - 1}
                      title="Move down"
                      className="px-1 text-[11px] text-hint hover:text-ink disabled:opacity-25"
                    >
                      ↓
                    </button>
                    {canDelete(row) ? (
                      <button
                        type="button"
                        onClick={() => removeRow(row)}
                        title="Delete row"
                        className="px-1 text-[11px] text-hint hover:text-red-700"
                      >
                        ✕
                      </button>
                    ) : (
                      <span className="px-1 text-[11px] text-transparent select-none">✕</span>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-1.5 flex items-baseline justify-between gap-4">
        {!field.singleRow ? (
          <button
            type="button"
            onClick={() => addRow(true)}
            className="text-[11px] text-muted hover:text-ink hover:underline"
          >
            + Add row
          </button>
        ) : (
          <span />
        )}
        {field.noDelete && field.noDeleteNote && (
          <p className="text-right text-hint italic text-hint">{field.noDeleteNote}</p>
        )}
      </div>
    </div>
  );
}
