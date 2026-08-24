'use client';

import type { Block, Field, KvEntry } from '@/lib/schema';
import type { FieldValue, FunctionalRequirement, Story, TableRow } from '@/lib/types';
import TableField from './fields/TableField';
import StoriesField from './fields/StoriesField';
import FrsField from './fields/FrsField';
import {
  LongTextInput,
  MultiCheck,
  TextInput,
  UrlInput,
  YesNo,
} from './fields/primitives';

export function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-2 mt-8 first:mt-0">
      <h2 className="border-b border-rule pb-1 text-section font-bold">{title}</h2>
      {hint && <p className="mt-1.5 text-hint italic text-hint">{hint}</p>}
    </div>
  );
}

export function SubHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-1.5 mt-5">
      <h3 className="text-sub font-bold text-subhead">{title}</h3>
      {hint && <p className="mt-1 text-hint italic text-hint">{hint}</p>}
    </div>
  );
}

function KvRow({
  entry,
  value,
  onChange,
}: {
  entry: KvEntry;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
}) {
  const text = typeof value === 'string' ? value : '';
  return (
    <tr id={`field-${entry.key}`} className="scroll-mt-32">
      <th className="w-1/3 border border-rule bg-labelfill px-2 py-1.5 text-left align-top text-sub font-normal text-label">
        {entry.label}
      </th>
      <td className="border border-rule px-1 py-0.5 align-top">
        {entry.type === 'longtext' ? (
          <LongTextInput value={text} onChange={onChange} lines={1} aria-label={entry.label} />
        ) : entry.type === 'url' ? (
          <UrlInput value={text} onChange={onChange} />
        ) : entry.type === 'yesno' ? (
          <YesNo value={text} onChange={onChange} />
        ) : entry.type === 'multicheck' ? (
          <MultiCheck
            value={Array.isArray(value) ? (value as string[]) : []}
            onChange={onChange}
            options={entry.options ?? []}
          />
        ) : (
          <TextInput value={text} onChange={onChange} bordered={false} aria-label={entry.label} />
        )}
      </td>
    </tr>
  );
}

export default function BlockView({
  block,
  values,
  setValue,
  metricOptions,
}: {
  block: Block;
  values: Record<string, FieldValue>;
  setValue: (key: string, value: FieldValue) => void;
  metricOptions: string[];
}) {
  // The nearest heading above a field is its accessible name.
  const labelFor = (index: number): string => {
    for (let i = index - 1; i >= 0; i -= 1) {
      const n = block.nodes[i];
      if (n.kind === 'section' || n.kind === 'sub') return n.title;
    }
    return block.name;
  };

  const renderField = (field: Field, label: string) => {
    switch (field.type) {
      case 'text':
        return (
          <TextInput
            value={(values[field.key] as string) ?? ''}
            onChange={(v) => setValue(field.key, v)}
          />
        );
      case 'url':
        return (
          <UrlInput
            value={(values[field.key] as string) ?? ''}
            onChange={(v) => setValue(field.key, v)}
          />
        );
      case 'longtext':
        return (
          <LongTextInput
            aria-label={label}
            value={(values[field.key] as string) ?? ''}
            onChange={(v) => setValue(field.key, v)}
            lines={field.lines}
          />
        );
      case 'table':
        return (
          <TableField
            field={field}
            rows={(values[field.key] as TableRow[]) ?? []}
            onChange={(rows) => setValue(field.key, rows)}
            metricOptions={metricOptions}
          />
        );
      case 'stories':
        return (
          <StoriesField
            stories={(values[field.key] as Story[]) ?? []}
            onChange={(s) => setValue(field.key, s)}
          />
        );
      case 'frs':
        return (
          <FrsField
            frs={(values[field.key] as FunctionalRequirement[]) ?? []}
            onChange={(f) => setValue(field.key, f)}
          />
        );
      case 'kv':
        return (
          <table className="w-full table-fixed border-collapse">
            <tbody>
              {field.entries.map((entry) => (
                <KvRow
                  key={entry.key}
                  entry={entry}
                  value={values[entry.key] ?? ''}
                  onChange={(v) => setValue(entry.key, v)}
                />
              ))}
            </tbody>
          </table>
        );
    }
  };

  return (
    <div>
      <div className="border-t-2 border-ink pt-3">
        <h1 className="text-block">
          <span className="text-blocknum">{block.num}&nbsp;&nbsp;&nbsp;</span>
          <span className="font-bold">{block.name}</span>
        </h1>
        <p className="mt-0.5 text-sub italic text-hint">{block.subtitle}</p>
      </div>

      {block.nodes.map((node, i) => {
        if (node.kind === 'section') {
          return <SectionHeading key={i} title={node.title} hint={node.hint} />;
        }
        if (node.kind === 'sub') {
          return <SubHeading key={i} title={node.title} hint={node.hint} />;
        }
        return (
          <div key={i} id={`field-${node.field.key}`} className="scroll-mt-32 rounded">
            {renderField(node.field, labelFor(i))}
          </div>
        );
      })}
    </div>
  );
}
