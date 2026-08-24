# PRD Editor

A local web app for writing Product Requirements Documents. It turns
`PRD_Template_v2.docx` into a form, saves your PRDs to a SQLite file on this machine, and
exports each one back out as PDF and Word in the template's own layout.

No accounts, no cloud, no network calls. One user, one file.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

The database is created on first use at `data/prd.db`. Delete that file to start over.

```bash
npm run build && npm run start   # production build
npm test                         # everything below, in order
```

| Command | What it checks |
| --- | --- |
| `npm run typecheck` | Strict TypeScript, no emit. |
| `npm run test:template` | Every heading, column header and hint in `docs/PRD_Template_v2.docx` appears verbatim in `src/`. This is the test that stops the app drifting from the template — shorten a hint and it fails. |
| `npm run test:e2e` | 45 browser checks against a production build. |

`test:e2e` starts the server on its own port with its own throwaway database, so it never
touches the PRDs you have written. It covers the acceptance criteria directly: fill a PRD
in, reload, and find it intact; watch the checklist flag a missing kill criterion and a
metric with no tracking event; click Export PDF and Export Word and confirm real files
land with the right names.

`npm install` downloads a Chromium build for Puppeteer. If that step is blocked, the app
still runs and the Word export still works — only the PDF export needs it.

## Screens

| Route | What it is |
| --- | --- |
| `/` | Every saved PRD: name, status, PM, last updated, completion, checklist marker. Filter by name and status; open, duplicate, export, delete. |
| `/prd/[id]` | The editor. Block navigation with per-block completion, sticky header, autosave. |
| `/prd/[id]/print` | The document with no app chrome. Puppeteer renders the PDF from this, and it is worth a look on its own. |

## How it is put together

The template is the source of truth. `src/lib/schema.ts` transcribes it — every heading,
sub-heading and hint, verbatim — into a declarative structure, and everything else walks
that one structure:

```
schema.ts ──┬── BlockView.tsx      the editor form
            ├── completion.ts      per-block and overall percentages
            ├── validation.ts      the 18 pre-review checks
            └── render.ts ──┬── PrintDocument.tsx   HTML for the print route and the PDF
                            └── docx.ts             the Word file
```

Because both exporters consume the same `render.ts` model, the PDF and the Word file
cannot drift apart. Adding a field means editing `schema.ts` and nothing else.

### Storage

One `prd` row per document. The whole document lives in a `content` JSON column, with
`id`, `feature_name`, `status`, `created_at` and `updated_at` as real columns for listing
and sorting. Schema changes stay cheap: `normalizeContent` fills in whatever an older
stored document is missing, so a new field appears in existing PRDs without a migration.

### Exports

**PDF** — Puppeteer renders `/prd/[id]/print` to A4 with the template's margins (900 twips
top and bottom, 720 each side). The browser is reused between exports rather than
relaunched.

**DOCX** — built with the `docx` package from the template's own measurements. Four things
matter for a file that survives Word and Google Docs alike, and all four are enforced:
every table sets `columnWidths` *and* a DXA `width` on each cell; shading is
`ShadingType.CLEAR`; no run ever contains a newline; header rows repeat across pages.

Both exports name the file `PRD-{feature-name}-{YYYY-MM-DD}`. An empty section still prints
its headings and blank rows, so an untouched PRD exports as a usable blank form.

### The pre-review checklist

Eighteen items, grouped by block as the template groups them. Fifteen are computed from
the document; three are ticked by hand. An unsatisfied computed check says what is missing
and links to the field, so `Rollout has a kill criterion` reads
*"The rollout plan has no kill criteria. Go to it"*.

The tracking plan's "Feeds which metric" column is a dropdown built from the metric names
in Block 02, which is what lets the app tell you a metric has no matching event. Renaming a
metric does not silently drop the tracking row that pointed at it — the old value is kept
and flagged instead.

### Notes on behavior

- **Autosave** runs 800ms after you stop typing. `Cmd/Ctrl+S` saves immediately. A failed
  save retries once, and closing the tab with an edit in flight warns you first.
- **Completion** counts one unit per field. A whole table counts as filled once any row has
  content, so the stock blank rows do not inflate the number.
- **Duplicate** appends " (copy)", resets status to Draft and clears the last-updated stamp.
  Copies still sort to the top of the list, by creation time.
- **The decisions log is append-only** — but only from the moment a row is saved with
  content in it, so a blank row can still be tidied away and a mistyped one can be removed
  before it sticks.
- **Deleting a table row** asks for confirmation only when the row has something in it.
- Inside a table, `Tab` on the last cell of the last row adds a row and moves into it.

## The template

`docs/PRD_Template_v2.docx` is kept in the repo as the reference the app is measured
against. `npm run test:template` reads it directly, so it is not decoration — changing the
template and re-running the suite tells you exactly what the app no longer matches.

Two deliberate departures from it, both because the document is written in English: the
"Release Note (Arabic)" section is "Release Note", and its Arabic writing prompt is gone.
The RTL and localization checklist item and the "Help centre article (AR and EN)" launch
row stay — those describe what the product must support, not what language this document
is in. The test file lists both waivers with their reasons.

## Not built

Out of scope by request, and left that way: authentication, multi-user, comments, version
history, cloud sync, AI generation, Jira/Linear integration.

Worth considering later, in rough order of value:

1. **Export the whole list**, or a filtered subset, as one PDF for a review meeting.
2. **A diff between two saves** — not full version history, just "what changed since I sent
   this to engineering", which is the question the decisions log is really answering.
3. **Import an existing `.docx`** written from the same template, so older PRDs can be
   brought in rather than retyped.
4. **Per-field comments**, if this ever stops being single-user. It is the first thing that
   breaks when a second person reads the document.
5. **A "what is missing" export** — the checklist failures alone, as a one-page handout.
