import {
  SLATE_50,
  SLATE_200,
  SLATE_700,
  WHITE,
  bulletList,
  sectionTitle,
  setText,
  type AutoTableFn,
  type PdfContext,
  type PdfDocument,
} from '../theme';
import type { RisksNextStepsSectionData } from '../sections';

/** Chapter 4: risk register, recommended next steps, and appendix metadata table. */
export function renderRisksNextStepsChapter(
  ctx: PdfContext,
  data: RisksNextStepsSectionData,
  autoTable: AutoTableFn,
  startY: number,
) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = sectionTitle(ctx, 'Commercial risks', startY);
  setText(doc, SLATE_700, 9);
  doc.text('The following issues should be resolved or clearly qualified before external distribution.', margin, y);
  y += 17;
  autoTable(doc, {
    startY: y,
    head: [['Risk', 'Why it matters', 'Recommended mitigation']],
    body: data.risks.map(risk => [risk.risk, risk.why, risk.mitigation]),
    theme: 'plain',
    headStyles: { fillColor: primary, textColor: WHITE },
    alternateRowStyles: { fillColor: SLATE_50 },
    styles: { fontSize: 8.5, cellPadding: 7, textColor: SLATE_700, lineColor: SLATE_200, lineWidth: 0.4 },
    columnStyles: { 0: { cellWidth: 105 }, 1: { cellWidth: 190 } },
  });
  y = ((doc as PdfDocument & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 180) + 28;

  y = sectionTitle(ctx, 'Recommended next steps', y);
  y = bulletList(doc, data.nextSteps, margin, y, contentWidth, accent) + 10;

  y = sectionTitle(ctx, 'Source record', y);
  autoTable(doc, {
    startY: y,
    body: data.appendixRows,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 5, textColor: SLATE_700, lineColor: SLATE_200, lineWidth: 0.4 },
    alternateRowStyles: { fillColor: SLATE_50 },
    columnStyles: { 0: { cellWidth: 125, fontStyle: 'bold' } },
  });
}
