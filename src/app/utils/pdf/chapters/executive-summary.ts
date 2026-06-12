import {
  SLATE_50,
  SLATE_200,
  SLATE_700,
  SLATE_950,
  WHITE,
  bulletList,
  labelValue,
  paragraph,
  sectionTitle,
  type AutoTableFn,
  type PdfContext,
} from '../theme';
import type { ExecutiveSummarySectionData } from '../sections';

/** Chapter 1: executive summary, product snapshot tiles, and evidence provenance table. */
export function renderExecutiveSummaryChapter(
  ctx: PdfContext,
  data: ExecutiveSummarySectionData,
  autoTable: AutoTableFn,
  startY: number,
) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = sectionTitle(ctx, 'Executive Summary', startY);
  y = paragraph(doc, data.executiveSummary, margin, y, contentWidth, {
    color: SLATE_950,
    size: 12,
    lineHeight: 17,
  }) + 18;
  y = bulletList(doc, data.highlights, margin, y, contentWidth, accent) + 8;

  y = sectionTitle(ctx, 'Product Snapshot', y);
  const tileWidth = (contentWidth - 16) / 3;
  data.snapshotTiles.forEach(([label, value], index) => {
    labelValue(doc, label, value, margin + (index % 3) * (tileWidth + 8), y + Math.floor(index / 3) * 62, tileWidth);
  });
  y += 142;

  y = sectionTitle(ctx, 'Evidence Strength & Data Provenance', y);
  autoTable(doc, {
    startY: y,
    head: [['Evidence source', 'Status', 'Client-facing interpretation']],
    body: data.provenanceRows,
    headStyles: { fillColor: primary, textColor: WHITE },
    bodyStyles: { textColor: SLATE_700 },
    alternateRowStyles: { fillColor: SLATE_50 },
    styles: { fontSize: 8, cellPadding: 5, lineColor: SLATE_200, lineWidth: 0.4 },
    columnStyles: { 0: { cellWidth: 105 }, 1: { cellWidth: 100 } },
  });
}
