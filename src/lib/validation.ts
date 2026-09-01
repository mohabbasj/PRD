import type { FunctionalRequirement, PrdContent, TableRow } from './types';
import { rowHasContent } from './completion';

export type CheckKind = 'auto' | 'manual';

export interface CheckResult {
  id: string;
  label: string;
  kind: CheckKind;
  blockId: string;
  /** Group label as printed in the template. */
  group: string;
  ok: boolean;
  /** One line saying what is missing. Present only when unsatisfied. */
  reason?: string;
  /** Field to scroll to when the reason is clicked. */
  target?: { blockId: string; fieldKey: string };
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function rows(content: PrdContent, key: string): TableRow[] {
  const v = content.values[key];
  return Array.isArray(v) ? (v as TableRow[]) : [];
}

/** Rows the author has actually touched, paired with their 1-based position. */
function liveRows(content: PrdContent, key: string): { row: TableRow; n: number }[] {
  return rows(content, key)
    .map((row, i) => ({ row, n: i + 1 }))
    .filter(({ row }) => rowHasContent(row));
}

function list(ns: number[]): string {
  if (ns.length === 1) return `row ${ns[0]}`;
  return `rows ${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`;
}

interface Rule {
  id: string;
  label: string;
  kind: CheckKind;
  blockId: string;
  group: string;
  fieldKey?: string;
  /** Returns undefined when satisfied, or the one-line reason when not. */
  run?: (c: PrdContent) => string | undefined;
}

const RULES: Rule[] = [
  // ---- BLOCK 01 - CONTEXT ----
  {
    id: 'problem_number_source',
    label: 'Problem statement contains a number with a source',
    kind: 'manual',
    blockId: 'context',
    group: 'BLOCK 01 - CONTEXT',
    fieldKey: 'evidence',
  },
  {
    id: 'stakeholder_reps',
    label: 'Every stakeholder has a named representative',
    kind: 'auto',
    blockId: 'context',
    group: 'BLOCK 01 - CONTEXT',
    fieldKey: 'stakeholders',
    run: (c) => {
      const live = liveRows(c, 'stakeholders');
      if (live.length === 0) return 'No stakeholders listed yet.';
      const missing = live.filter(({ row }) => !str(row.representative)).map(({ n }) => n);
      return missing.length ? `No representative named in ${list(missing)}.` : undefined;
    },
  },
  // ---- BLOCK 02 - DIRECTION ----
  {
    id: 'primary_metric_complete',
    label: 'One primary metric with a baseline and a measurement window',
    kind: 'auto',
    blockId: 'direction',
    group: 'BLOCK 02 - DIRECTION',
    fieldKey: 'primary_metric',
    run: (c) => {
      const row = rows(c, 'primary_metric')[0];
      if (!row || !str(row.metric)) return 'No primary metric named.';
      const gaps: string[] = [];
      if (!str(row.baseline)) gaps.push('a baseline');
      if (!str(row.window)) gaps.push('a measurement window');
      return gaps.length ? `The primary metric has no ${gaps.join(' and no ')}.` : undefined;
    },
  },
  {
    id: 'counter_metric',
    label: 'At least one counter-metric',
    kind: 'auto',
    blockId: 'direction',
    group: 'BLOCK 02 - DIRECTION',
    fieldKey: 'counter_metrics',
    run: (c) =>
      rows(c, 'counter_metrics').some((r) => str(r.metric))
        ? undefined
        : 'No counter-metric named.',
  },
  {
    id: 'two_alternatives',
    label: 'At least two alternatives rejected in writing',
    kind: 'auto',
    blockId: 'direction',
    group: 'BLOCK 02 - DIRECTION',
    fieldKey: 'alternatives',
    run: (c) => {
      const n = rows(c, 'alternatives').filter(
        (r) => str(r.alternative) && str(r.why_rejected)
      ).length;
      return n >= 2
        ? undefined
        : `${n} of 2 alternatives have both an alternative and a reason for rejecting it.`;
    },
  },
  {
    id: 'out_of_scope_complete',
    label: 'Every out-of-scope item has a reason and a destination',
    kind: 'auto',
    blockId: 'direction',
    group: 'BLOCK 02 - DIRECTION',
    fieldKey: 'out_of_scope',
    run: (c) => {
      const missing = liveRows(c, 'out_of_scope')
        .filter(({ row }) => !str(row.reason) || !str(row.destination))
        .map(({ n }) => n);
      return missing.length ? `Missing a reason or a destination in ${list(missing)}.` : undefined;
    },
  },
  {
    id: 'assumption_validation',
    label: 'Every assumption has a validation method or is accepted in writing',
    kind: 'auto',
    blockId: 'direction',
    group: 'BLOCK 02 - DIRECTION',
    fieldKey: 'assumptions',
    run: (c) => {
      const missing = rows(c, 'assumptions')
        .map((row, i) => ({ row, n: i + 1 }))
        .filter(({ row }) => str(row.assumption))
        .filter(({ row }) => !str(row.validate) && row.accepted !== true)
        .map(({ n }) => n);
      return missing.length
        ? `No validation method, and not marked accepted, in ${list(missing)}.`
        : undefined;
    },
  },

  // ---- BLOCK 03 - SPECIFICATION ----
  {
    id: 'fr_complete_when',
    label: 'Every FR has a completion definition',
    kind: 'auto',
    blockId: 'specification',
    group: 'BLOCK 03 - SPECIFICATION',
    fieldKey: 'functional_requirements',
    run: (c) => {
      const frs = (c.values.functional_requirements as FunctionalRequirement[]) ?? [];
      const live = frs.map((fr, i) => ({ fr, n: i + 1 })).filter(({ fr }) => str(fr.requirement));
      if (live.length === 0) return 'No functional requirements written yet.';
      const missing = live.filter(({ fr }) => !str(fr.complete_when)).map(({ n }) => n);
      return missing.length
        ? `No "complete when" for ${missing.map((n) => `FR-${n}`).join(', ')}.`
        : undefined;
    },
  },
  {
    id: 'visibility_coverage',
    label: 'Visibility rules cover new, existing, and excluded users',
    kind: 'auto',
    blockId: 'specification',
    group: 'BLOCK 03 - SPECIFICATION',
    fieldKey: 'visibility',
    run: (c) => {
      const live = rows(c, 'visibility');
      const wanted: [string, RegExp][] = [
        ['new users', /\bnew\b/i],
        ['existing users', /\bexisting\b/i],
        ['the excluded segment', /exclud/i],
      ];
      const missing = wanted
        .filter(([, re]) => !live.some((r) => re.test(str(r.audience)) && str(r.sees)))
        .map(([name]) => name);
      return missing.length ? `Nothing specified for ${missing.join(', ')}.` : undefined;
    },
  },
  {
    id: 'error_behavior',
    label: 'Error behavior defined for every persisted state',
    kind: 'manual',
    blockId: 'specification',
    group: 'BLOCK 03 - SPECIFICATION',
    fieldKey: 'edge_cases',
  },
  {
    id: 'rtl_localization',
    label: 'RTL and localization specified',
    kind: 'manual',
    blockId: 'specification',
    group: 'BLOCK 03 - SPECIFICATION',
    fieldKey: 'tech_localization',
  },

  // ---- BLOCK 04 - EXECUTION ----
  {
    id: 'metric_has_event',
    label: 'Every metric has a matching event in the tracking plan',
    kind: 'auto',
    blockId: 'execution',
    group: 'BLOCK 04 - EXECUTION',
    fieldKey: 'tracking_plan',
    run: (c) => {
      const named = metricNames(c);
      if (named.length === 0) return undefined;
      const covered = new Set(
        rows(c, 'tracking_plan')
          .filter((r) => str(r.event))
          .map((r) => str(r.feeds))
      );
      const missing = named.filter((m) => !covered.has(m));
      return missing.length
        ? `No tracking event feeds ${missing.map((m) => `"${m}"`).join(', ')}.`
        : undefined;
    },
  },
  {
    id: 'kill_criterion',
    label: 'Rollout has a kill criterion',
    kind: 'auto',
    blockId: 'execution',
    group: 'BLOCK 04 - EXECUTION',
    fieldKey: 'rollout_kill_criteria',
    run: (c) =>
      str(c.values.rollout_kill_criteria)
        ? undefined
        : 'The rollout plan has no kill criteria.',
  },
  {
    id: 'open_question_owner',
    label: 'No open question is unowned',
    kind: 'auto',
    blockId: 'execution',
    group: 'BLOCK 04 - EXECUTION',
    fieldKey: 'open_questions',
    run: (c) => {
      const missing = rows(c, 'open_questions')
        .map((row, i) => ({ row, n: i + 1 }))
        .filter(({ row }) => str(row.question) && !str(row.owner))
        .map(({ n }) => n);
      return missing.length ? `No owner on ${list(missing)}.` : undefined;
    },
  },
  {
    id: 'support_owners',
    label: 'Support and help-centre owners named with a ready-by date',
    kind: 'auto',
    blockId: 'execution',
    group: 'BLOCK 04 - EXECUTION',
    fieldKey: 'launch_readiness',
    run: (c) => {
      const all = rows(c, 'launch_readiness');
      const wanted: [string, RegExp][] = [
        ['Support', /support/i],
        ['Help centre', /help/i],
      ];
      const missing = wanted
        .filter(
          ([, re]) =>
            !all.some((r) => re.test(str(r.area)) && str(r.owner) && str(r.ready_by))
        )
        .map(([name]) => name);
      return missing.length
        ? `${missing.join(' and ')} still ${missing.length > 1 ? 'need' : 'needs'} an owner and a ready-by date.`
        : undefined;
    },
  },
  {
    id: 'milestone_date_owner',
    label: 'Every milestone has a date and an owner',
    kind: 'auto',
    blockId: 'execution',
    group: 'BLOCK 04 - EXECUTION',
    fieldKey: 'milestones',
    run: (c) => {
      const live = liveRows(c, 'milestones');
      if (live.length === 0) return 'No milestones recorded yet.';
      const missing = live
        .filter(({ row }) => !str(row.date) || !str(row.owner))
        .map(({ n }) => n);
      return missing.length ? `Missing a date or an owner in ${list(missing)}.` : undefined;
    },
  },
];

/**
 * Every metric named in Block 02 — primary, supporting and counter. This is the list the
 * tracking plan's "Feeds which metric" dropdown offers, and the list its check enforces.
 */
export function metricNames(content: PrdContent): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    const s = str(v);
    if (s && !out.includes(s)) out.push(s);
  };
  for (const key of ['primary_metric', 'supporting_metrics', 'counter_metrics']) {
    for (const row of rows(content, key)) push(row.metric);
  }
  return out;
}

export function runChecks(content: PrdContent): CheckResult[] {
  return RULES.map((rule) => {
    const target = rule.fieldKey
      ? { blockId: rule.blockId, fieldKey: rule.fieldKey }
      : undefined;
    if (rule.kind === 'manual') {
      return {
        id: rule.id,
        label: rule.label,
        kind: rule.kind,
        blockId: rule.blockId,
        group: rule.group,
        ok: content.manualChecks[rule.id] === true,
        reason: content.manualChecks[rule.id] === true ? undefined : 'Not ticked yet.',
        target,
      };
    }
    const reason = rule.run?.(content);
    return {
      id: rule.id,
      label: rule.label,
      kind: rule.kind,
      blockId: rule.blockId,
      group: rule.group,
      ok: reason === undefined,
      reason,
      target,
    };
  });
}

export function checkSummary(content: PrdContent): { passed: number; total: number } {
  const results = runChecks(content);
  return { passed: results.filter((r) => r.ok).length, total: results.length };
}

export const CHECK_GROUPS = [
  'BLOCK 01 - CONTEXT',
  'BLOCK 02 - DIRECTION',
  'BLOCK 03 - SPECIFICATION',
  'BLOCK 04 - EXECUTION',
];
