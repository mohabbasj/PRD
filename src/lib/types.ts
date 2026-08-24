import { BLOCKS, HEADER_FIELDS, STATUS_OPTIONS, type Field, type Status } from './schema';

export interface AcceptanceCriterion {
  _id: string;
  given: string;
  when: string;
  then: string;
}

export interface Story {
  _id: string;
  as_a: string;
  i_want: string;
  so_that: string;
  notes: string;
  acceptance: AcceptanceCriterion[];
}

export interface FunctionalRequirement {
  _id: string;
  requirement: string;
  complete_when: string;
}

export interface TableRow {
  _id: string;
  /** True until the row has survived a save. */
  _new?: boolean;
  /** Set on append-only rows saved with content in them; they lose their delete control. */
  _locked?: boolean;
  /** Assumptions only: accepted without validation. */
  accepted?: boolean;
  [column: string]: string | boolean | undefined;
}

export type FieldValue = string | string[] | TableRow[] | Story[] | FunctionalRequirement[];

export interface PrdHeader {
  feature_name: string;
  product_manager: string;
  engineering_lead: string;
  design_lead: string;
  target_release: string;
  status: Status;
}

export interface PrdContent {
  version: 1;
  header: PrdHeader;
  values: Record<string, FieldValue>;
  /** Keyed by checklist item id; only the manual items are stored. */
  manualChecks: Record<string, boolean>;
}

export interface PrdRecord {
  id: string;
  feature_name: string;
  status: Status;
  content: PrdContent;
  created_at: string;
  updated_at: string | null;
}

export interface PrdSummary {
  id: string;
  feature_name: string;
  status: Status;
  product_manager: string;
  created_at: string;
  updated_at: string | null;
  completion: number;
  checklist: { passed: number; total: number };
}

let counter = 0;

/**
 * Row identity, used as a React key and to address a row for edits. The server seeds a new
 * document's rows and the browser adds the rest, so the two must not be able to mint the
 * same id: a counter alone would collide across processes, hence the random suffix.
 */
export function rowId(): string {
  counter += 1;
  return `r${Date.now().toString(36)}-${counter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function emptyRow(columns: { key: string }[], first?: string): TableRow {
  const row: TableRow = { _id: rowId(), _new: true };
  for (const c of columns) row[c.key] = '';
  if (first && columns.length) row[columns[0].key] = first;
  return row;
}

export function emptyStory(): Story {
  return { _id: rowId(), as_a: '', i_want: '', so_that: '', notes: '', acceptance: [emptyAc()] };
}

export function emptyAc(): AcceptanceCriterion {
  return { _id: rowId(), given: '', when: '', then: '' };
}

export function emptyFr(): FunctionalRequirement {
  return { _id: rowId(), requirement: '', complete_when: '' };
}

function defaultValue(field: Field): FieldValue {
  switch (field.type) {
    case 'text':
    case 'longtext':
    case 'url':
      return '';
    case 'kv': {
      // kv entries own top-level keys; the container itself holds nothing.
      return '';
    }
    case 'stories':
      return [emptyStory()];
    case 'frs':
      return [emptyFr()];
    case 'table': {
      if (field.singleRow) return [emptyRow(field.columns)];
      if (field.seed) return field.seed.map((s) => emptyRow(field.columns, s));
      // Open with the same blank rows the paper template shows, so there is
      // somewhere to type straight away. Empty rows never count as filled.
      return Array.from({ length: field.blankRows ?? 1 }, () => emptyRow(field.columns));
    }
  }
}

export function emptyContent(): PrdContent {
  const values: Record<string, FieldValue> = {};
  for (const block of BLOCKS) {
    for (const node of block.nodes) {
      if (node.kind !== 'field') continue;
      const field = node.field;
      if (field.type === 'kv') {
        for (const entry of field.entries) {
          values[entry.key] = entry.type === 'multicheck' ? [] : '';
        }
      } else {
        values[field.key] = defaultValue(field);
      }
    }
  }
  return {
    version: 1,
    header: {
      feature_name: '',
      product_manager: '',
      engineering_lead: '',
      design_lead: '',
      target_release: '',
      status: STATUS_OPTIONS[0],
    },
    values,
    manualChecks: {},
  };
}

/** Fill in anything a stored document is missing, so schema additions stay cheap. */
export function normalizeContent(raw: unknown): PrdContent {
  const base = emptyContent();
  if (!raw || typeof raw !== 'object') return base;
  const input = raw as Partial<PrdContent>;
  const header = { ...base.header, ...(input.header ?? {}) };
  if (!STATUS_OPTIONS.includes(header.status)) header.status = STATUS_OPTIONS[0];
  const values = { ...base.values, ...(input.values ?? {}) };
  return {
    version: 1,
    header,
    values,
    manualChecks: { ...(input.manualChecks ?? {}) },
  };
}

export const HEADER_KEYS = HEADER_FIELDS.map((f) => f.key);
