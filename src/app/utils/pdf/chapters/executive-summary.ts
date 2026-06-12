import {
  SLATE_50,
  SLATE_200,
  SLATE_500,
  SLATE_700,
  SLATE_950,
  WHITE,
  bulletList,
  labelValue,
  paragraph,
  sectionTitle,
  setDisplayText,
  setText,
  type AutoTableFn,
  type PdfContext,
} from '../theme';
import type { ExecutiveSummarySectionData } from '../sections';

/** Chapter 1: recommendation-led summary, product facts, and evidence provenance. */
export function renderExecutiveSummaryChapter(
  ctx: PdfContext,
  data: ExecutiveSummarySectionData,
  autoTable: AutoTableFn,
  startY: number,
) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = sectionTitle(ctx, 'The decision in brief', startY);
  y = paragraph(doc, data.executiveSummary, margin, y, contentWidth, {
    color: SLATE_950,
    size: 12.5,
    lineHeight: 18,
  }) + 22;

  setDisplayText(doc, primary, 12, 'bold');
  doc.text('What matters now', margin, y);
  y = bulletList(doc, data.highlights.slice(0, 3), margin, y + 23, contentWidth, accent) + 12;

  y = sectionTitle(ctx, 'Product and evidence snapshot', y);
  const tileWidth = (contentWidth - 16) / 3;
  data.snapshotTiles.forEach(([label, value], index) => {
    labelValue(doc, label, value, margin + (index % 3) * (tileWidth + 8), y + Math.floor(index / 3) * 62, tileWidth);
  });
  y += 137;

  y = sectionTitle(ctx, 'What this recommendation is based on', y);
  setText(doc, SLATE_500, 8.5);
  doc.text('Source status and the interpretation permitted in a client-facing report.', margin, y);
  y += 14;
  autoTable(doc, {
    startY: y,
    head: [['Evidence source', 'Current status', 'How to read it']],
    body: data.provenanceRows,
    theme: 'plain',
    headStyles: { fillColor: primary, textColor: WHITE, fontStyle: 'bold' },
    bodyStyles: { textColor: SLATE_700 },
    alternateRowStyles: { fillColor: SLATE_50 },
    styles: { fontSize: 8, cellPadding: 6, lineColor: SLATE_200, lineWidth: 0.5 },
    columnStyles: { 0: { cellWidth: 105 }, 1: { cellWidth: 100 } },
  });
}
