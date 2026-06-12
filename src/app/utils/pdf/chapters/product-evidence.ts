import {
  SLATE_50,
  SLATE_200,
  SLATE_500,
  SLATE_700,
  SLATE_950,
  WHITE,
  addContentPage,
  bulletList,
  labelValue,
  paragraph,
  sectionTitle,
  setDisplayText,
  setText,
  type AutoTableFn,
  type PdfContext,
} from '../theme';
import { renderBarChart } from '../charts';
import type { ProductEvidenceSectionData } from '../sections';

/** Chapter 2: sensory dimension bar chart, key strengths/watch points, and decision rationale. */
export function renderProductEvidenceChapter(
  ctx: PdfContext,
  data: ProductEvidenceSectionData,
  autoTable: AutoTableFn,
  startY: number,
) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = sectionTitle(ctx, 'Sensory evidence', startY);
  y = paragraph(doc, data.intro, margin, y, contentWidth, { size: 9.5, lineHeight: 13 }) + 16;

  setDisplayText(doc, primary, 12, 'bold');
  doc.text('Decision dimensions', margin, y);
  setText(doc, SLATE_500, 7.5);
  doc.text('Score out of 100', margin + contentWidth, y, { align: 'right' });
  y += 18;
  y = renderBarChart(
    ctx,
    data.dimensionBars.map(dimension => ({ label: dimension.label, value: dimension.value })),
    margin,
    y,
    contentWidth,
  ) + 12;
  data.dimensionBars.forEach(dimension => {
    y = paragraph(doc, `${dimension.label}. ${dimension.interpretation}`, margin, y, contentWidth, {
      size: 8.5,
      lineHeight: 12,
      color: SLATE_500,
    }) + 2;
  });
  y += 10;

  setDisplayText(doc, SLATE_950, 12, 'bold');
  doc.text('Key strengths', margin, y);
  y = paragraph(doc, data.keyStrengths, margin, y + 19, contentWidth, { size: 9.5, lineHeight: 13 }) + 12;

  setDisplayText(doc, SLATE_950, 12, 'bold');
  doc.text('Formulation watch points', margin, y);
  y = data.watchPoints
    ? bulletList(doc, data.watchPoints, margin, y + 20, contentWidth, accent) + 5
    : paragraph(doc, data.watchPointsFallback, margin, y + 19, contentWidth, { size: 9.5, lineHeight: 13 }) + 12;

  setDisplayText(doc, SLATE_950, 12, 'bold');
  doc.text('Instrumental evidence', margin, y);
  y = paragraph(doc, data.instrumentalNote, margin, y + 19, contentWidth, { size: 9.5, lineHeight: 13 }) + 20;

  y = sectionTitle(ctx, 'Decision rationale', y);
  labelValue(ctx, data.decisionTiles[0][0], data.decisionTiles[0][1], margin, y, 112);
  labelValue(ctx, data.decisionTiles[1][0], data.decisionTiles[1][1], 160, y, 112);
  labelValue(ctx, data.decisionTiles[2][0], data.decisionTiles[2][1], 280, y, 132);
  labelValue(ctx, data.decisionTiles[3][0], data.decisionTiles[3][1], 420, y, 135);
  y += 72;
  y = paragraph(doc, data.decisionRecommendation, margin, y, contentWidth, {
    color: SLATE_950,
    size: 11,
    weight: 'bold',
    lineHeight: 15,
  }) + 15;

  if (data.gates.length > 0) {
    if (y > 690) {
      y = addContentPage(ctx);
      y = sectionTitle(ctx, 'Decision gates', y);
      y = paragraph(
        doc,
        'The saved gate results below show how the recommendation cleared the product decision criteria.',
        margin,
        y,
        contentWidth,
        { size: 9.5, lineHeight: 13 },
      ) + 14;
    }
    autoTable(doc, {
      startY: y,
      head: [['Decision gate', 'Result', 'What it means']],
      body: data.gates.map(gate => [gate.label, gate.status.toUpperCase(), gate.detail]),
      theme: 'plain',
      headStyles: { fillColor: primary, textColor: WHITE },
      alternateRowStyles: { fillColor: SLATE_50 },
      styles: { fontSize: 8.5, cellPadding: 6, textColor: SLATE_700, lineColor: SLATE_200, lineWidth: 0.5 },
      columnStyles: { 0: { cellWidth: 145 }, 1: { cellWidth: 65 } },
    });
  } else {
    paragraph(doc, 'Detailed hard-gate results are not stored in this report version. The recommendation remains tied to the saved decision record.', margin, y, contentWidth, { size: 9.5 });
  }
}
