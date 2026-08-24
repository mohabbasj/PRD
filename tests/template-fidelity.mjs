/**
 * Checks the app against docs/PRD_Template_v2.docx, which is the visual and structural
 * source of truth. Every block subtitle, section heading, sub-heading, table column header
 * and hint in that file must appear verbatim somewhere in src/.
 *
 * This is the test that stops the app drifting from the template. If you change a heading
 * or shorten a hint, this fails — which is the point.
 *
 *   npm run test:template
 */
import fs from 'node:fs';
import path from 'node:path';
import { readZipEntry } from './unzip.mjs';

const TEMPLATE = path.join(process.cwd(), 'docs', 'PRD_Template_v2.docx');

/**
 * Deliberate departures from the template, each with the reason it is allowed.
 * Anything not listed here has to match.
 */
const ALLOWED = [
  ['Release Note (Arabic)', 'The document is written in English; the section is "Release Note".'],
  ['اكتب هنا بالعربية', 'The Arabic writing prompt goes with the Arabic release note.'],
];

const xml = readZipEntry(fs.readFileSync(TEMPLATE), 'word/document.xml').toString('utf8');

/** Pulls the text and first-run formatting out of every paragraph, without a DOM. */
function paragraphs(source) {
  return [...source.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => {
    const block = m[0];
    const text = [...block.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((t) => t[1])
      .join('')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
    const runProps = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(block)?.[0] ?? '';
    return {
      text,
      bold: /<w:b\/>|<w:b /.test(runProps),
      italic: /<w:i\/>|<w:i /.test(runProps),
      size: /<w:sz w:val="(\d+)"/.exec(runProps)?.[1] ?? null,
    };
  });
}

/** Template type scale, in half-points: 21 section, 17 sub-head and column header, 16 hint. */
function collect(all) {
  const groups = {
    'block subtitle': [],
    'section heading': [],
    'sub-heading or column header': [],
    hint: [],
  };
  for (const p of all) {
    if (!p.text) continue;
    if (p.italic && p.size === '16') groups.hint.push(p.text);
    else if (p.italic && p.size === '17') groups['block subtitle'].push(p.text);
    else if (p.bold && p.size === '21') groups['section heading'].push(p.text);
    else if (p.bold && p.size === '17') groups['sub-heading or column header'].push(p.text);
  }
  return groups;
}

function sourceText() {
  const roots = ['src'];
  let combined = '';
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) combined += fs.readFileSync(full, 'utf8');
    }
  };
  roots.forEach(walk);
  return combined;
}

const src = sourceText();
const excused = new Map(ALLOWED);
const groups = collect(paragraphs(xml));

let checked = 0;
const missing = [];
const waived = [];

for (const [kind, items] of Object.entries(groups)) {
  for (const item of new Set(items)) {
    checked += 1;
    if (excused.has(item)) {
      waived.push([kind, item, excused.get(item)]);
      continue;
    }
    // The TS source may escape an apostrophe inside a single-quoted string.
    const present = src.includes(item) || src.includes(item.replace(/'/g, "\\'"));
    if (!present) missing.push([kind, item]);
  }
}

for (const [kind, item, why] of waived) {
  console.log(`  – ${kind}: ${JSON.stringify(item)}\n      waived — ${why}`);
}
for (const [kind, item] of missing) {
  console.log(`  ✗ ${kind} not found in src/: ${JSON.stringify(item)}`);
}

const verified = checked - missing.length - waived.length;
console.log(
  `\n${verified} of ${checked} template strings found verbatim in src/` +
    (waived.length ? `, ${waived.length} waived` : '') +
    (missing.length ? `, ${missing.length} MISSING` : '')
);
process.exit(missing.length === 0 ? 0 : 1);
