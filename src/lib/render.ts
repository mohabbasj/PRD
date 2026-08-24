/**
 * Turns a stored PRD into a flat list of render nodes laid out like the template.
 *
 * The print route and the DOCX builder both consume this, so the PDF and the Word file
 * cannot drift apart — a change to the document's shape happens once, here.
 */
import {
  BLOCKS,
  columnWidths,
  type Block,
  type Field,
  type KvEntry,
  type TableField,
} from './schema';
import { CHECK_GROUPS, runChecks } from './validation';
import { rowHasContent, frHasContent, storyHasContent } from './completion';
import type {
  FunctionalRequirement,
  PrdContent,
  PrdRecord,
  Story,
  TableRow,
} from './types';

export interface DocColumn {
  label: string;
  /** Width in DXA against the template's 10440 content width. */
  width: number;
}

export type DocNode =
  | { t: 'title'; text: string; feature: string }
  | { t: 'kvtable'; rows: { label: string; value: string }[] }
  | { t: 'block'; num: string; name: string; subtitle: string }
  | { t: 'section'; title: string; hint?: string }
  | { t: 'sub'; title: string; hint?: string }
  | { t: 'lines'; key: string; rows: string[] }
  | { t: 'table'; key: string; columns: DocColumn[]; rows: string[][] }
  | { t: 'storyHeading'; text: string }
  | { t: 'acHint' }
  | { t: 'frHeading'; text: string }
  | { t: 'label'; text: string }
  | { t: 'checkGroup'; title: string }
  | { t: 'check'; ok: boolean; label: string };

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ISO dates print as "24 Aug 2026"; anything else passes through untouched. */
export function formatDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return value;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** Splits a textarea value into paragraphs. Never emit "\n" downstream. */
export function paragraphs(value: string): string[] {
  const out = value.replace(/\r\n/g, '\n').split('\n');
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return out;
}

/**
 * A free-text field as ruled lines. Content prints as written; an empty field prints the
 * template's blank rules instead, so an untouched document still works as a printable form.
 */
function linesNode(key: string, text: string, minLines: number): DocNode {
  const rows = paragraphs(text);
  return { t: 'lines', key, rows: rows.length ? rows : Array.from({ length: minLines }, () => '') };
}

function cellText(row: TableRow, colKey: string, colType: string, field: TableField): string {
  const raw = str(row[colKey]);
  const flag = field.rowFlag;
  if (flag && flag.fillsColumn === colKey && row[flag.key] === true) {
    return raw ? `${raw} ${flag.text}` : flag.text;
  }
  return colType === 'date' ? formatDate(raw) : raw;
}

function tableNode(field: TableField, values: Record<string, unknown>): DocNode {
  const widths = columnWidths(field.columns);
  const columns: DocColumn[] = field.columns.map((c, i) => ({ label: c.label, width: widths[i] }));
  const stored = (values[field.key] as TableRow[]) ?? [];

  // Only rows the author has actually filled in reach the export; the stock blank rows
  // a section opens with would otherwise print as gaps in a finished document.
  const flagKey = field.rowFlag?.key;
  const live = stored.filter((r) => rowHasContent(r, flagKey ? [flagKey] : []));
  const rows = live.map((row) => field.columns.map((c) => cellText(row, c.key, c.type, field)));

  // An untouched section still prints its empty rows, so the file doubles as a blank template.
  if (rows.length === 0) {
    const blanks = field.singleRow ? 1 : (field.blankRows ?? field.seed?.length ?? 1);
    for (let i = 0; i < blanks; i += 1) rows.push(field.columns.map(() => ''));
  }
  return { t: 'table', key: field.key, columns, rows };
}

function kvValue(entry: KvEntry, values: Record<string, unknown>): string {
  const raw = values[entry.key];
  if (entry.type === 'multicheck') {
    const picked = Array.isArray(raw) ? (raw as string[]) : [];
    // Nothing ticked prints the full menu, exactly as the blank template does.
    return picked.length ? picked.join(' / ') : (entry.options ?? []).join(' / ');
  }
  const text = str(raw);
  if (entry.type === 'yesno') return text || 'yes / no';
  return text;
}

function storyNodes(stories: Story[]): DocNode[] {
  const live = stories.filter(storyHasContent);
  const source: (Story | null)[] = live.length ? live : [null, null];
  const out: DocNode[] = [];
  source.forEach((story, i) => {
    const sentence = story
      ? `As a ${story.as_a || '[user]'}, I want ${story.i_want || '[capability]'} so that ${
          story.so_that || '[outcome]'
        }.`
      : 'As a [user], I want [capability] so that [outcome].';
    out.push({ t: 'storyHeading', text: `Story ${i + 1}.  ${sentence}` });
    out.push(linesNode(`story_notes_${i}`, story?.notes ?? '', 1));
    out.push({ t: 'acHint' });
    const acRows = (story?.acceptance ?? [])
      .filter((a) => str(a.given) || str(a.when) || str(a.then))
      .map((a) => [str(a.given), str(a.when), str(a.then)]);
    if (acRows.length === 0) acRows.push(['', '', ''], ['', '', '']);
    const widths = columnWidths([
      { key: 'g', label: 'Given', type: 'text', w: 1 },
      { key: 'w', label: 'When', type: 'text', w: 1 },
      { key: 't', label: 'Then', type: 'text', w: 1 },
    ]);
    out.push({
      t: 'table',
      key: `story_ac_${i}`,
      columns: ['Given', 'When', 'Then'].map((label, ci) => ({ label, width: widths[ci] })),
      rows: acRows,
    });
  });
  return out;
}

function frNodes(frs: FunctionalRequirement[]): DocNode[] {
  const live = frs.filter(frHasContent);
  const source: (FunctionalRequirement | null)[] = live.length ? live : [null, null, null];
  const out: DocNode[] = [];
  source.forEach((fr, i) => {
    out.push({ t: 'frHeading', text: `FR-${i + 1}` });
    out.push(linesNode(`fr_req_${i}`, fr?.requirement ?? '', 1));
    out.push({ t: 'label', text: 'Complete when' });
    out.push(linesNode(`fr_done_${i}`, fr?.complete_when ?? '', 1));
  });
  return out;
}

function fieldNodes(field: Field, content: PrdContent): DocNode[] {
  const values = content.values as Record<string, unknown>;
  switch (field.type) {
    case 'text':
    case 'url':
      return [linesNode(field.key, str(values[field.key]), 1)];
    case 'longtext':
      return [linesNode(field.key, str(values[field.key]), field.lines)];
    case 'table':
      return [tableNode(field, values)];
    case 'kv':
      return [
        {
          t: 'kvtable',
          rows: field.entries.map((e) => ({ label: e.label, value: kvValue(e, values) })),
        },
      ];
    case 'stories':
      return storyNodes((values[field.key] as Story[]) ?? []);
    case 'frs':
      return frNodes((values[field.key] as FunctionalRequirement[]) ?? []);
  }
}

function blockNodes(block: Block, content: PrdContent): DocNode[] {
  const out: DocNode[] = [
    { t: 'block', num: block.num, name: block.name, subtitle: block.subtitle },
  ];
  for (const node of block.nodes) {
    if (node.kind === 'section') out.push({ t: 'section', title: node.title, hint: node.hint });
    else if (node.kind === 'sub') out.push({ t: 'sub', title: node.title, hint: node.hint });
    else out.push(...fieldNodes(node.field, content));
  }
  return out;
}

export function renderDocument(record: PrdRecord): DocNode[] {
  const { content } = record;
  const out: DocNode[] = [
    {
      t: 'title',
      text: 'Product Requirements Document',
      feature: content.header.feature_name || '[Feature Name]',
    },
    {
      t: 'kvtable',
      rows: [
        { label: 'Product Manager', value: content.header.product_manager },
        { label: 'Engineering Lead', value: content.header.engineering_lead },
        { label: 'Design Lead', value: content.header.design_lead },
        { label: 'Target Release', value: content.header.target_release },
        { label: 'Status', value: content.header.status },
        {
          label: 'Last Updated',
          value: record.updated_at ? formatDate(record.updated_at.slice(0, 10)) : '',
        },
      ],
    },
  ];

  for (const block of BLOCKS) {
    if (block.id === 'checklist') continue;
    out.push(...blockNodes(block, content));
  }

  // Block 05 is generated from the validation engine rather than from stored fields.
  const last = BLOCKS[BLOCKS.length - 1];
  out.push({ t: 'block', num: last.num, name: last.name, subtitle: last.subtitle });
  const results = runChecks(content);
  for (const group of CHECK_GROUPS) {
    const items = results.filter((r) => r.group === group);
    if (items.length === 0) continue;
    out.push({ t: 'checkGroup', title: group });
    for (const item of items) out.push({ t: 'check', ok: item.ok, label: item.label });
  }
  return out;
}

/** PRD-{feature-name}-{YYYY-MM-DD} */
export function exportBasename(record: PrdRecord): string {
  const slug =
    record.content.header.feature_name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'untitled';
  const date = new Date().toISOString().slice(0, 10);
  return `PRD-${slug}-${date}`;
}
