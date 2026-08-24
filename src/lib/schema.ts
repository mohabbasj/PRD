/**
 * The PRD schema, transcribed from PRD_Template_v2.docx.
 *
 * Headings, sub-headings and hint text are verbatim from the DOCX — the template
 * is the source of truth, so the editor, the print route and both exports all walk
 * this one structure and stay in step.
 *
 * Values are stored flat: `content.values[key]`. A `kv` field is a layout container
 * only; each of its entries owns a top-level key. That keeps completion counting and
 * the validation rules a simple map lookup rather than a tree walk.
 */

export type EnumOption = string;

export type ColumnType = 'text' | 'longtext' | 'date' | 'enum' | 'metricref';

export interface Column {
  key: string;
  label: string;
  type: ColumnType;
  /** Relative width; converted to DXA against the template's 10440 content width. */
  w: number;
  options?: EnumOption[];
}

/** A per-row switch that writes fixed text into one column instead of adding a column. */
export interface RowFlag {
  key: string;
  label: string;
  /** Column whose exported text this flag stands in for. */
  fillsColumn: string;
  text: string;
}

export interface TableField {
  type: 'table';
  key: string;
  columns: Column[];
  /** Pre-populated first-column values. Editable and deletable like any other row. */
  seed?: string[];
  /** Exactly one row, no add or delete (the primary metric). */
  singleRow?: boolean;
  /** Hide the delete control once a row has been persisted (the decisions log). */
  noDelete?: boolean;
  noDeleteNote?: string;
  rowFlag?: RowFlag;
  /** Blank rows drawn in an otherwise-empty export, so the file works as a template. */
  blankRows?: number;
}

export interface KvEntry {
  key: string;
  label: string;
  type: 'text' | 'longtext' | 'url' | 'yesno' | 'multicheck';
  options?: EnumOption[];
}

export type Field =
  | { type: 'text'; key: string }
  | { type: 'longtext'; key: string; lines: number }
  | { type: 'url'; key: string }
  | { type: 'kv'; key: string; entries: KvEntry[] }
  | { type: 'stories'; key: string }
  | { type: 'frs'; key: string }
  | TableField;

export type Node =
  | { kind: 'section'; title: string; hint?: string }
  | { kind: 'sub'; title: string; hint?: string }
  | { kind: 'field'; field: Field };

export interface Block {
  id: string;
  num: string;
  name: string;
  subtitle: string;
  nodes: Node[];
}

const METRIC_COLS: Column[] = [
  { key: 'metric', label: 'Metric', type: 'text', w: 3 },
  { key: 'baseline', label: 'Baseline', type: 'text', w: 2 },
  { key: 'target', label: 'Target', type: 'text', w: 2 },
];

export const STATUS_OPTIONS = [
  'Draft',
  'In Review',
  'Approved',
  'In Development',
  'Shipped',
] as const;

export type Status = (typeof STATUS_OPTIONS)[number];

export const LEVELS = ['Low', 'Medium', 'High'];
export const READY_STATUS = ['Not started', 'In progress', 'Ready'];
export const UI_STATES = ['default', 'empty', 'loading', 'error', 'completed', 'RTL'];

export const HEADER_FIELDS: { key: string; label: string }[] = [
  { key: 'product_manager', label: 'Product Manager' },
  { key: 'engineering_lead', label: 'Engineering Lead' },
  { key: 'design_lead', label: 'Design Lead' },
  { key: 'target_release', label: 'Target Release' },
];

export const BLOCKS: Block[] = [
  {
    id: 'context',
    num: '01',
    name: 'CONTEXT',
    subtitle: 'Why are we doing this at all',
    nodes: [
      {
        kind: 'section',
        title: 'Summary',
        hint: 'Three sentences. What we are building, for whom, what changes as a result. Write this last.',
      },
      { kind: 'field', field: { type: 'longtext', key: 'summary', lines: 3 } },
      { kind: 'section', title: 'Stakeholders' },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'stakeholders',
          columns: [
            { key: 'stakeholder', label: 'Stakeholder', type: 'text', w: 2 },
            { key: 'needs', label: 'What they need from this', type: 'text', w: 4 },
            { key: 'representative', label: 'Representative', type: 'text', w: 2 },
          ],
          seed: ['Merchants', 'Support', 'Sales / Account management', 'Platform / Partner team'],
        },
      },
      { kind: 'section', title: 'Problem Statement' },
      { kind: 'sub', title: 'Current state' },
      { kind: 'field', field: { type: 'longtext', key: 'current_state', lines: 2 } },
      {
        kind: 'sub',
        title: 'Evidence',
        hint: 'Number, source, sample size, date range. If none, write "unvalidated" and how you will validate it.',
      },
      { kind: 'field', field: { type: 'longtext', key: 'evidence', lines: 2 } },
      { kind: 'sub', title: 'Affected population' },
      { kind: 'field', field: { type: 'longtext', key: 'affected_population', lines: 1 } },
      { kind: 'sub', title: 'Cost of inaction' },
      { kind: 'field', field: { type: 'longtext', key: 'cost_of_inaction', lines: 1 } },
      {
        kind: 'section',
        title: 'Requirement Inputs',
        hint: 'Where each requirement came from. One row per source. A requirement with no row here is an assumption, not a requirement, and belongs in the Assumptions table.',
      },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'requirement_inputs',
          columns: [
            { key: 'source', label: 'Source (person / team / system)', type: 'text', w: 1 },
            { key: 'method', label: 'Method and date', type: 'text', w: 1 },
            { key: 'learned', label: 'What we learned', type: 'text', w: 1 },
            { key: 'landed', label: 'Where it landed (FR / Story / rejected)', type: 'text', w: 1 },
          ],
          blankRows: 4,
        },
      },
      { kind: 'sub', title: 'Inputs still outstanding' },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'outstanding_inputs',
          columns: [
            { key: 'what', label: 'What we still need', type: 'text', w: 1 },
            { key: 'who', label: 'Who we need it from', type: 'text', w: 1 },
            { key: 'needed_by', label: 'Needed by', type: 'date', w: 1 },
          ],
          blankRows: 2,
        },
      },
    ],
  },
  {
    id: 'direction',
    num: '02',
    name: 'DIRECTION',
    subtitle: 'What we are building and what counts as winning',
    nodes: [
      { kind: 'section', title: 'Success Metrics' },
      { kind: 'sub', title: 'Primary metric (exactly one)' },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'primary_metric',
          singleRow: true,
          columns: [
            ...METRIC_COLS,
            { key: 'window', label: 'Measurement window', type: 'text', w: 3 },
          ],
        },
      },
      { kind: 'sub', title: 'Supporting metrics' },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'supporting_metrics',
          columns: [
            ...METRIC_COLS,
            { key: 'explains', label: 'What it explains', type: 'text', w: 3 },
          ],
          blankRows: 2,
        },
      },
      {
        kind: 'sub',
        title: 'Counter-metric',
        hint: 'What this feature could damage while hitting its target.',
      },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'counter_metrics',
          columns: [
            { key: 'metric', label: 'Metric', type: 'text', w: 1 },
            { key: 'guardrail', label: 'Guardrail', type: 'text', w: 1 },
            { key: 'why', label: 'Why it could move', type: 'text', w: 1 },
          ],
          blankRows: 1,
        },
      },
      { kind: 'sub', title: 'Non-goals' },
      { kind: 'field', field: { type: 'longtext', key: 'non_goals', lines: 2 } },
      {
        kind: 'section',
        title: 'Assumptions',
        hint: 'Anything the solution depends on that is not yet proven. If it turns out false, the plan changes.',
      },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'assumptions',
          columns: [
            { key: 'assumption', label: 'Assumption', type: 'text', w: 1 },
            { key: 'breaks', label: 'If it is wrong, what breaks', type: 'text', w: 1 },
            { key: 'validate', label: 'How and when we validate it', type: 'text', w: 1 },
          ],
          rowFlag: {
            key: 'accepted',
            label: 'Accepted without validation',
            fillsColumn: 'validate',
            text: 'Accepted without validation.',
          },
          blankRows: 3,
        },
      },
      { kind: 'section', title: 'Competitor Analysis' },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'competitors',
          columns: [
            { key: 'who', label: 'Who', type: 'text', w: 1 },
            { key: 'how', label: 'How they solve it', type: 'text', w: 1 },
            { key: 'take', label: 'What we take', type: 'text', w: 1 },
            { key: 'differently', label: 'What we do differently', type: 'text', w: 1 },
          ],
          blankRows: 3,
        },
      },
      {
        kind: 'section',
        title: 'Proposed Solution',
        hint: 'Five to eight lines. Describe the capability, not the interface.',
      },
      { kind: 'field', field: { type: 'longtext', key: 'proposed_solution', lines: 4 } },
      { kind: 'sub', title: 'Alternatives considered' },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'alternatives',
          columns: [
            { key: 'alternative', label: 'Alternative', type: 'text', w: 1 },
            { key: 'why_rejected', label: 'Why rejected', type: 'text', w: 1 },
          ],
          blankRows: 2,
        },
      },
      { kind: 'section', title: 'Scope' },
      { kind: 'sub', title: 'In scope (core capability first)' },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'in_scope',
          columns: [
            { key: 'item', label: 'Item', type: 'text', w: 1 },
            { key: 'goal', label: 'Goal', type: 'text', w: 1 },
          ],
          blankRows: 3,
        },
      },
      { kind: 'sub', title: 'Out of scope' },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'out_of_scope',
          columns: [
            { key: 'item', label: 'Item', type: 'text', w: 1 },
            { key: 'reason', label: 'Reason', type: 'text', w: 1 },
            { key: 'destination', label: 'Destination', type: 'text', w: 1 },
          ],
          blankRows: 2,
        },
      },
    ],
  },
  {
    id: 'specification',
    num: '03',
    name: 'SPECIFICATION',
    subtitle: 'Exactly how it behaves. This is the contract with engineering.',
    nodes: [
      { kind: 'section', title: 'User Stories' },
      { kind: 'field', field: { type: 'stories', key: 'user_stories' } },
      {
        kind: 'section',
        title: 'Functional Requirements',
        hint: 'One testable behavior per requirement. Use "must". Every FR needs the exact state transition that marks it complete.',
      },
      { kind: 'field', field: { type: 'frs', key: 'functional_requirements' } },
      { kind: 'sub', title: 'Visibility and eligibility' },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'visibility',
          columns: [
            { key: 'audience', label: 'Audience', type: 'text', w: 1 },
            { key: 'sees', label: 'What they see', type: 'text', w: 1 },
            { key: 'backfill', label: 'Backfill at launch', type: 'text', w: 1 },
          ],
          seed: ['New users', 'Existing users', 'Excluded segment'],
        },
      },
      { kind: 'section', title: 'Edge Cases and Error States' },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'edge_cases',
          columns: [
            { key: 'case', label: 'Case', type: 'text', w: 1 },
            { key: 'behavior', label: 'Expected behavior', type: 'text', w: 1 },
          ],
          seed: [
            'Save or write fails',
            'Two users of the same account act at once',
            'User reverses the action after completing it',
            'Upstream dependency unavailable',
            'Slow or offline network',
          ],
        },
      },
      { kind: 'section', title: 'UX / UI Design' },
      {
        kind: 'field',
        field: {
          type: 'kv',
          key: 'ux',
          entries: [
            { key: 'figma_link', label: 'Figma link', type: 'url' },
            { key: 'states_covered', label: 'States covered', type: 'multicheck', options: UI_STATES },
          ],
        },
      },
      { kind: 'section', title: 'Technical Notes' },
      {
        kind: 'field',
        field: {
          type: 'kv',
          key: 'technical_notes',
          entries: [
            { key: 'tech_architecture', label: 'Architecture', type: 'longtext' },
            { key: 'tech_data_model', label: 'Data model, where state lives', type: 'longtext' },
            { key: 'tech_performance', label: 'Performance budget (p95)', type: 'longtext' },
            { key: 'tech_accessibility', label: 'Accessibility', type: 'longtext' },
            { key: 'tech_localization', label: 'Localization and RTL', type: 'longtext' },
            { key: 'tech_permissions', label: 'Permissions and scopes', type: 'longtext' },
            { key: 'tech_browser', label: 'Browser and device support', type: 'longtext' },
            { key: 'tech_privacy', label: 'Data privacy, retention, deletion', type: 'longtext' },
            { key: 'tech_audit', label: 'Audit trail, who changed what', type: 'longtext' },
          ],
        },
      },
      { kind: 'sub', title: 'Dependencies' },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'dependencies',
          columns: [
            { key: 'dependency', label: 'Dependency', type: 'text', w: 1 },
            { key: 'owner', label: 'Owner', type: 'text', w: 1 },
            { key: 'needed_by', label: 'Needed by', type: 'date', w: 1 },
          ],
          blankRows: 2,
        },
      },
    ],
  },
  {
    id: 'execution',
    num: '04',
    name: 'EXECUTION',
    subtitle: 'How it ships and how we know it worked',
    nodes: [
      {
        kind: 'section',
        title: 'Tracking Plan',
        hint: 'Specified before development. Every metric in Block 02 needs a row here, or delete the metric.',
      },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'tracking_plan',
          columns: [
            { key: 'event', label: 'Event name', type: 'text', w: 1 },
            { key: 'properties', label: 'Properties', type: 'text', w: 1 },
            { key: 'feeds', label: 'Feeds which metric', type: 'metricref', w: 1 },
          ],
          blankRows: 3,
        },
      },
      {
        kind: 'field',
        field: {
          type: 'kv',
          key: 'dashboard',
          entries: [
            { key: 'dashboard_owner', label: 'Dashboard owner', type: 'text' },
            {
              key: 'dashboard_live_before_rollout',
              label: 'Live before rollout begins',
              type: 'yesno',
            },
          ],
        },
      },
      { kind: 'section', title: 'Risks' },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'risks',
          columns: [
            { key: 'risk', label: 'Risk', type: 'text', w: 3 },
            { key: 'likelihood', label: 'Likelihood', type: 'enum', w: 1, options: LEVELS },
            { key: 'impact', label: 'Impact', type: 'enum', w: 1, options: LEVELS },
            { key: 'mitigation', label: 'Mitigation', type: 'text', w: 3 },
          ],
          blankRows: 2,
        },
      },
      { kind: 'section', title: 'Rollout Plan' },
      {
        kind: 'field',
        field: {
          type: 'kv',
          key: 'rollout',
          entries: [
            { key: 'rollout_flag', label: 'Feature flag', type: 'text' },
            { key: 'rollout_phase_1', label: 'Phase 1, internal sandbox', type: 'longtext' },
            { key: 'rollout_phase_2', label: 'Phase 2, beta (% and duration)', type: 'longtext' },
            { key: 'rollout_gate', label: 'Gate to proceed to full rollout', type: 'longtext' },
            {
              key: 'rollout_phase_3',
              label: 'Phase 3, full rollout and backfill',
              type: 'longtext',
            },
            { key: 'rollout_kill_criteria', label: 'Kill criteria', type: 'longtext' },
            { key: 'rollout_rollback', label: 'Rollback behavior', type: 'longtext' },
          ],
        },
      },
      {
        kind: 'section',
        title: 'Launch Readiness',
        hint: 'The feature is not shipped when the code is merged. It is shipped when the people who answer for it are ready.',
      },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'launch_readiness',
          columns: [
            { key: 'area', label: 'Area', type: 'text', w: 3 },
            { key: 'owner', label: 'Owner', type: 'text', w: 2 },
            { key: 'ready_by', label: 'Ready by', type: 'date', w: 2 },
            { key: 'status', label: 'Status', type: 'enum', w: 2, options: READY_STATUS },
          ],
          seed: [
            'Support briefed / macros updated',
            'Help centre article (AR and EN)',
            'Sales and account management briefed',
            'In-product announcement or changelog',
          ],
        },
      },
      {
        kind: 'section',
        title: 'Milestones',
        hint: 'Dates that other teams plan against. Change them in writing, not in a meeting.',
      },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'milestones',
          columns: [
            { key: 'milestone', label: 'Milestone', type: 'text', w: 3 },
            { key: 'date', label: 'Date', type: 'date', w: 1 },
            { key: 'owner', label: 'Owner', type: 'text', w: 2 },
          ],
          seed: [
            'Spec frozen, handed to engineering',
            'Development complete',
            'QA sign-off',
            'Beta starts',
            'Full rollout',
            'Post-launch metric review',
          ],
        },
      },
      { kind: 'section', title: 'Release Note' },
      { kind: 'field', field: { type: 'longtext', key: 'release_note', lines: 3 } },
      { kind: 'section', title: 'Open Questions and Decisions' },
      { kind: 'sub', title: 'Open' },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'open_questions',
          columns: [
            { key: 'question', label: 'Question', type: 'text', w: 3 },
            { key: 'owner', label: 'Owner', type: 'text', w: 2 },
            { key: 'due', label: 'Due', type: 'date', w: 2 },
          ],
          blankRows: 2,
        },
      },
      { kind: 'sub', title: 'Decided (do not delete rows)' },
      {
        kind: 'field',
        field: {
          type: 'table',
          key: 'decisions',
          columns: [
            { key: 'decision', label: 'Decision', type: 'text', w: 4 },
            { key: 'date', label: 'Date', type: 'date', w: 1 },
            { key: 'reason', label: 'Reason', type: 'text', w: 3 },
          ],
          noDelete: true,
          noDeleteNote:
            'A decision that was made and later reversed is still a decision. The record of why it was taken stays, so nobody relitigates it from memory.',
          blankRows: 2,
        },
      },
      { kind: 'section', title: 'References' },
      { kind: 'field', field: { type: 'longtext', key: 'references', lines: 2 } },
      { kind: 'section', title: 'Notes' },
      { kind: 'field', field: { type: 'longtext', key: 'notes', lines: 3 } },
    ],
  },
  {
    id: 'checklist',
    num: '05',
    name: 'PRE-REVIEW CHECKLIST',
    subtitle: 'Any unchecked box means this is not ready for engineering',
    nodes: [],
  },
];

export const BLOCK_IDS = BLOCKS.map((b) => b.id);

/** Every field in document order, with the block it belongs to. */
export function allFields(): { blockId: string; field: Field }[] {
  const out: { blockId: string; field: Field }[] = [];
  for (const b of BLOCKS) {
    for (const n of b.nodes) {
      if (n.kind === 'field') out.push({ blockId: b.id, field: n.field });
    }
  }
  return out;
}

export function getBlock(id: string): Block | undefined {
  return BLOCKS.find((b) => b.id === id);
}

/** Convert relative column weights to DXA against the template's 10440 content width. */
export function columnWidths(columns: Column[], total = 10440): number[] {
  const sum = columns.reduce((a, c) => a + c.w, 0);
  const widths = columns.map((c) => Math.floor((total * c.w) / sum));
  widths[widths.length - 1] += total - widths.reduce((a, w) => a + w, 0);
  return widths;
}
