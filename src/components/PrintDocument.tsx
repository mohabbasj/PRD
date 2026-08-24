import type { DocNode } from '@/lib/render';
import { renderDocument } from '@/lib/render';
import type { PrdRecord } from '@/lib/types';

/**
 * Print stylesheet. Every measurement is the template's own: A4 with 0.625in top and
 * bottom margins and 0.5in sides, Calibri at 9.5pt, and Word border weights converted
 * from eighths of a point (sz18 = 2.25pt, sz12 = 1.5pt, sz4 = 0.5pt).
 */
export const PRINT_CSS = `
  @page { size: A4; margin: 0.625in 0.5in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Calibri, Carlito, "Segoe UI", system-ui, sans-serif;
    font-size: 9.5pt;
    line-height: 1.45;
    color: #1A1A1A;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .prd-doc { max-width: 7.27in; margin: 0 auto; padding: 0.625in 0.5in; }
  @media print { .prd-doc { max-width: none; margin: 0; padding: 0; } }

  h1.prd-title {
    font-size: 22pt; font-weight: bold; margin: 0 0 4pt;
    border-bottom: 2.25pt solid #1A1A1A; padding-bottom: 4pt; line-height: 1.15;
  }
  .prd-feature { color: #888888; margin: 0 0 10pt; }

  .prd-block { border-top: 1.5pt solid #1A1A1A; margin-top: 20pt; padding-top: 9pt; }
  .prd-block .prd-num { color: #AAAAAA; font-size: 13pt; }
  .prd-block .prd-name { font-weight: bold; font-size: 13pt; }
  .prd-blocksub { font-style: italic; font-size: 8.5pt; color: #888888; margin: 1pt 0 11pt; }

  h2.prd-section {
    font-size: 10.5pt; font-weight: bold; margin: 14pt 0 5pt;
    border-bottom: 0.5pt solid #CCCCCC; padding-bottom: 2pt;
  }
  h3.prd-sub { font-size: 8.5pt; font-weight: bold; color: #333333; margin: 10pt 0 3pt; }
  .prd-hint { font-style: italic; font-size: 8pt; color: #888888; margin: 3pt 0 5pt; }
  .prd-label { font-size: 8.5pt; color: #666666; margin: 5pt 0 2pt; }
  .prd-storyhead, .prd-frhead { font-weight: bold; margin: 12pt 0 3pt; }

  table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 2pt 0 4pt; }
  table.prd-tbl th, table.prd-tbl td {
    border: 0.5pt solid #CCCCCC; padding: 4.5pt 5.5pt; vertical-align: top;
    word-wrap: break-word; overflow-wrap: break-word;
  }
  table.prd-tbl thead th {
    background: #F0F0F0; font-weight: bold; font-size: 8.5pt; text-align: left;
  }
  table.prd-kv th {
    background: #FAFAFA; color: #444444; font-weight: normal; font-size: 8.5pt;
    text-align: left; width: 33.3%;
  }
  thead { display: table-header-group; }
  tr, .prd-lines, .prd-keep { break-inside: avoid; page-break-inside: avoid; }

  .prd-lines { margin: 3pt 0 7pt; }
  .prd-lines .prd-ln { border-bottom: 0.5pt dotted #BBBBBB; min-height: 15pt; padding: 2pt 1pt 1pt; }

  .prd-checkgroup {
    font-size: 8pt; font-weight: bold; color: #444444; letter-spacing: 0.02em;
    margin: 12pt 0 4pt;
  }
  .prd-check { margin: 2.5pt 0; }
  .prd-check .prd-box { display: inline-block; width: 14pt; }
`;

function Lines({ node }: { node: Extract<DocNode, { t: 'lines' }> }) {
  return (
    <div className="prd-lines">
      {node.rows.map((text, i) => (
        <div className="prd-ln" key={i}>
          {text || ' '}
        </div>
      ))}
    </div>
  );
}

function GridTable({ node }: { node: Extract<DocNode, { t: 'table' }> }) {
  const total = node.columns.reduce((a, c) => a + c.width, 0);
  return (
    <table className="prd-tbl">
      <colgroup>
        {node.columns.map((c, i) => (
          <col key={i} style={{ width: `${(c.width / total) * 100}%` }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {node.columns.map((c, i) => (
            <th key={i}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {node.rows.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => (
              <td key={ci}>{cell || ' '}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Node({ node }: { node: DocNode }) {
  switch (node.t) {
    case 'title':
      return (
        <>
          <h1 className="prd-title">{node.text}</h1>
          <p className="prd-feature">{node.feature}</p>
        </>
      );
    case 'kvtable':
      return (
        <table className="prd-tbl prd-kv">
          <tbody>
            {node.rows.map((row, i) => (
              <tr key={i}>
                <th>{row.label}</th>
                <td>{row.value || ' '}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'block':
      return (
        <div className="prd-keep">
          <div className="prd-block">
            <span className="prd-num">{node.num}&nbsp;&nbsp;&nbsp;</span>
            <span className="prd-name">{node.name}</span>
          </div>
          <p className="prd-blocksub">{node.subtitle}</p>
        </div>
      );
    case 'section':
      return (
        <div className="prd-keep">
          <h2 className="prd-section">{node.title}</h2>
          {node.hint && <p className="prd-hint">{node.hint}</p>}
        </div>
      );
    case 'sub':
      return (
        <div className="prd-keep">
          <h3 className="prd-sub">{node.title}</h3>
          {node.hint && <p className="prd-hint">{node.hint}</p>}
        </div>
      );
    case 'lines':
      return <Lines node={node} />;
    case 'table':
      return <GridTable node={node} />;
    case 'storyHeading':
      return <p className="prd-storyhead">{node.text}</p>;
    case 'frHeading':
      return <p className="prd-frhead">{node.text}</p>;
    case 'acHint':
      return <p className="prd-hint">Acceptance criteria: Given [state], when [action], then [result].</p>;
    case 'label':
      return <p className="prd-label">{node.text}</p>;
    case 'checkGroup':
      return <p className="prd-checkgroup">{node.title}</p>;
    case 'check':
      return (
        <p className="prd-check">
          <span className="prd-box">{node.ok ? '☑' : '☐'}</span>
          {node.label}
        </p>
      );
  }
}

export default function PrintDocument({ record }: { record: PrdRecord }) {
  const nodes = renderDocument(record);
  return (
    <div className="prd-doc">
      {nodes.map((node, i) => (
        <Node key={i} node={node} />
      ))}
    </div>
  );
}
