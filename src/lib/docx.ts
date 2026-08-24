/**
 * Builds the Word export from the shared document model.
 *
 * Measurements are the template's own, in the units Word uses: page and column widths in
 * DXA (twentieths of a point), font sizes in half-points, border weights in eighths of a
 * point. Three rules matter for files that survive a round trip through Google Docs:
 * every table sets `columnWidths` *and* a DXA `width` on each cell, shading is CLEAR
 * rather than SOLID, and no run ever contains a newline — paragraphs are separate elements.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IBorderOptions,
  type ISpacingProperties,
} from 'docx';
import type { DocNode } from './render';
import { renderDocument } from './render';
import type { PrdRecord } from './types';

const CONTENT_WIDTH = 10440;

const INK = '1A1A1A';
const SUBHEAD = '333333';
const LABEL = '444444';
const MUTED = '666666';
const HINT = '888888';
const BLOCKNUM = 'AAAAAA';
const DOTTED = 'BBBBBB';
const RULE = 'CCCCCC';
const HEAD_FILL = 'F0F0F0';
const LABEL_FILL = 'FAFAFA';

const CELL_MARGINS = { top: 90, left: 110, bottom: 90, right: 110 };

const thin = (color: string): IBorderOptions => ({ style: BorderStyle.SINGLE, size: 4, color });
const none: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: 'auto' };

const gridBorders = {
  top: thin(RULE),
  bottom: thin(RULE),
  left: thin(RULE),
  right: thin(RULE),
  insideHorizontal: thin(RULE),
  insideVertical: thin(RULE),
};

/** The template's free-text block: no frame, just a dotted rule under each line. */
const ruledBorders = {
  top: none,
  bottom: none,
  left: none,
  right: none,
  insideHorizontal: { style: BorderStyle.DOTTED, size: 4, color: DOTTED },
  insideVertical: none,
};

function text(
  value: string,
  opts: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}
): TextRun {
  return new TextRun({
    text: value,
    bold: opts.bold,
    italics: opts.italics,
    size: opts.size,
    color: opts.color,
  });
}

function para(
  runs: TextRun[],
  opts: { spacing?: ISpacingProperties; border?: { top?: IBorderOptions; bottom?: IBorderOptions } } = {}
): Paragraph {
  return new Paragraph({ children: runs, spacing: opts.spacing, border: opts.border });
}

function cell(
  children: Paragraph[],
  width: number,
  opts: { fill?: string; margins?: typeof CELL_MARGINS } = {}
): TableCell {
  return new TableCell({
    children,
    width: { size: width, type: WidthType.DXA },
    margins: opts.margins ?? CELL_MARGINS,
    shading: opts.fill
      ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill }
      : undefined,
  });
}

function gridTable(
  columns: { label: string; width: number }[],
  rows: string[][],
  withHeader: boolean
): Table {
  const widths = columns.map((c) => c.width);
  const children: TableRow[] = [];

  if (withHeader) {
    children.push(
      new TableRow({
        tableHeader: true, // Repeats the header when a table breaks across pages.
        height: { value: 300, rule: 'atLeast' },
        children: columns.map((c, i) =>
          cell([para([text(c.label, { bold: true, size: 17, color: '000000' })])], widths[i], {
            fill: HEAD_FILL,
          })
        ),
      })
    );
  }

  for (const row of rows) {
    children.push(
      new TableRow({
        children: row.map((value, i) => cell([para([text(value, { size: 19 })])], widths[i])),
      })
    );
  }

  return new Table({
    columnWidths: widths,
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    borders: gridBorders,
    rows: children,
  });
}

function kvTable(rows: { label: string; value: string }[]): Table {
  const widths = [3480, 6960];
  return new Table({
    columnWidths: widths,
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    borders: gridBorders,
    rows: rows.map(
      (row) =>
        new TableRow({
          height: { value: 480, rule: 'atLeast' },
          children: [
            cell([para([text(row.label, { size: 17, color: LABEL })])], widths[0], {
              fill: LABEL_FILL,
            }),
            cell([para([text(row.value, { size: 19 })])], widths[1]),
          ],
        })
    ),
  });
}

function ruledTable(rows: string[]): Table {
  return new Table({
    columnWidths: [CONTENT_WIDTH],
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    borders: ruledBorders,
    rows: rows.map(
      (value) =>
        new TableRow({
          height: { value: 300, rule: 'atLeast' },
          children: [
            cell([para([text(value, { size: 19 })])], CONTENT_WIDTH, {
              margins: { top: 40, left: 20, bottom: 40, right: 20 },
            }),
          ],
        })
    ),
  });
}

/** Word needs an empty paragraph between consecutive tables or they merge into one. */
const SPACER = new Paragraph({ children: [], spacing: { after: 60 } });

function nodeToElements(node: DocNode): (Paragraph | Table)[] {
  switch (node.t) {
    case 'title':
      return [
        para([text(node.text, { bold: true, size: 44 })], {
          border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: INK, space: 8 } },
          spacing: { after: 60 },
        }),
        para([text(node.feature, { size: 19, color: HINT })], { spacing: { after: 200 } }),
      ];
    case 'kvtable':
      return [kvTable(node.rows), SPACER];
    case 'block':
      return [
        para(
          [
            text(`${node.num}   `, { size: 26, color: BLOCKNUM }),
            text(node.name, { bold: true, size: 26 }),
          ],
          {
            border: { top: { style: BorderStyle.SINGLE, size: 12, color: INK, space: 10 } },
            spacing: { before: 360, after: 20 },
          }
        ),
        para([text(node.subtitle, { italics: true, size: 17, color: HINT })], {
          spacing: { after: 220 },
        }),
      ];
    case 'section': {
      const out: Paragraph[] = [
        para([text(node.title, { bold: true, size: 21 })], {
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 4 } },
          spacing: { before: 280, after: 100 },
        }),
      ];
      if (node.hint) out.push(hintParagraph(node.hint));
      return out;
    }
    case 'sub': {
      const out: Paragraph[] = [
        para([text(node.title, { bold: true, size: 17, color: SUBHEAD })], {
          spacing: { before: 200, after: 60 },
        }),
      ];
      if (node.hint) out.push(hintParagraph(node.hint));
      return out;
    }
    case 'lines':
      return [ruledTable(node.rows), SPACER];
    case 'table':
      return [gridTable(node.columns, node.rows, true), SPACER];
    case 'storyHeading':
    case 'frHeading':
      return [para([text(node.text, { bold: true, size: 19 })], { spacing: { before: 200, after: 60 } })];
    case 'acHint':
      return [hintParagraph('Acceptance criteria: Given [state], when [action], then [result].')];
    case 'label':
      return [para([text(node.text, { size: 17, color: MUTED })], { spacing: { before: 60, after: 40 } })];
    case 'checkGroup':
      return [
        para([text(node.title, { bold: true, size: 16, color: LABEL })], {
          spacing: { before: 240, after: 60 },
        }),
      ];
    case 'check':
      return [
        para([text(`${node.ok ? '☑' : '☐'}   ${node.label}`, { size: 19 })], {
          spacing: { after: 40 },
        }),
      ];
  }
}

function hintParagraph(value: string): Paragraph {
  return para([text(value, { italics: true, size: 16, color: HINT })], { spacing: { after: 80 } });
}

export async function buildDocx(record: PrdRecord): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];
  for (const node of renderDocument(record)) children.push(...nodeToElements(node));

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 19, color: INK },
          paragraph: { alignment: AlignmentType.LEFT },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 900, right: 720, bottom: 900, left: 720 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
