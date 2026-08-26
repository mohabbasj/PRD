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
| `npm run test:e2e` | 46 browser checks against a production build. |
| `npm run test:auth` | 15 checks on the login gate, including that the PDF export still works through it. |

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

## Deploying

The app was built to run on your own machine, and that is still its best home: one file,
no accounts, nothing to pay for. Hosting it changes two things that cannot be configured
away, so both are handled in code rather than pretended about.

**There is no persistent disk on serverless platforms.** A SQLite file written during one
request is gone by the next. So the storage layer sits behind a small seam (`src/lib/driver.ts`):
a local SQLite file when `DATABASE_URL` is unset, Postgres when it is set. Two drivers, the
same SQL with `?` placeholders, one table. The local experience is unchanged.

**A public URL means anyone with the link can read, edit and delete every PRD.** Set
`PRD_PASSWORD` and every route requires a session. Leave it unset locally and there is no
login, exactly as the brief asked. A deployment with no password set refuses to serve at
all rather than quietly exposing itself.

### The short way

```bash
bash scripts/deploy.sh
```

It installs the Vercel CLI if you do not have it, signs you in, creates the project,
sets every environment variable, and deploys. The one thing it asks for is the database
connection string, because that is the only value it cannot work out on its own.

### Vercel, by hand

1. **Database** — at [supabase.com](https://supabase.com), create a project. Then
   **Connect** → **App Frameworks**, and copy the **Transaction pooler** string (port
   6543). That is the one built for serverless; the direct connection on 5432 will run out
   of connections. The app creates its own table on first request — no migration to run.
2. **Import the repo** into Vercel. It is a stock Next.js app; the defaults are right.
3. **Environment variables** — set these for Production and Preview:

   | Variable | Value |
   | --- | --- |
   | `PRD_PASSWORD` | your password — required, or the app refuses to serve |
   | `PRD_USERNAME` | `admin`, or whatever you prefer |
   | `PRD_SESSION_SECRET` | 32 random bytes, hex |
   | `DATABASE_URL` | the transaction pooler string from step 1 |
   | `PUPPETEER_SKIP_DOWNLOAD` | `1` — stops the build pulling a 170MB browser it will not use |

4. **Deploy.**

`vercel.json` gives the PDF route 1769MB — Chromium needs considerably more than the
default, and the symptom of too little is a function that dies mid-render with nothing
useful in the log.

The PDF route runs on the Node runtime with a 60 second ceiling and launches
`@sparticuz/chromium`, a Chromium build stripped down to fit inside a function. A cold
start spends a second or two unpacking it; warm requests reuse the browser. This is the
one part of the app that is meaningfully more fragile hosted than local — if Vercel ever
changes its function limits, the Word export keeps working regardless, since it needs no
browser at all.

Both suites run against Postgres too, which is how the driver seam is verified rather than
assumed:

```bash
DATABASE_URL=postgres://…  npm run test:e2e
DATABASE_URL=postgres://…  npm run test:auth
```

### When the database will not connect

Sign in and open `/api/health`. It checks the connection string one property at a time —
set at all, parses, is Postgres rather than a Supabase API URL, carries a real password
rather than the `[YOUR-PASSWORD]` placeholder, points at the pooler rather than the direct
host, uses port 6543 — and then actually opens a connection. It names the first thing that
is wrong instead of leaving you to guess, and never returns the password.

The direct connection (`db.<ref>.supabase.co:5432`) resolves to IPv6 only, and serverless
functions have no IPv6 route to it. It cannot work from Vercel however correct the
password is; the transaction pooler is not a preference here.

### Somewhere with a disk

On Railway, Render, Fly or any VPS, none of the above applies. Mount a volume, point
`PRD_DB_PATH` at it, set `PRD_PASSWORD`, and run `npm run build && npm run start`. The
SQLite file and the real Chromium both work as they do on your laptop.

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
