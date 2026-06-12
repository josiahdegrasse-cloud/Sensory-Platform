import {
  SLATE_50,
  SLATE_500,
  SLATE_700,
  SLATE_950,
  WHITE,
  bulletList,
  labelValue,
  paragraph,
  sectionTitle,
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
  let y = sectionTitle(ctx, 'Sensory & Instrumental Evidence', startY);
  y = paragraph(doc, data.intro, margin, y, contentWidth, { size: 9.5, lineHeight: 13 }) + 16;

  y = renderBarChart(
    ctx,
    data.dimensionBars.map(dimension => ({ label: dimension.label, value: dimension.value })),
    margin,
    y,
    contentWidth,
  ) + 8;
  data.dimensionBars.forEach(dimension => {
    y = paragraph(doc, `${dimension.label}: ${dimension.interpretation}`, margin, y, contentWidth, {
      size: 8.5,
      lineHeight: 12,
      color: SLATE_500,
    }) + 2;
  });
  y += 10;

  setText(doc, SLATE_950, 11, 'bold');
  doc.text('Key strengths', margin, y);
  y = paragraph(doc, data.keyStrengths, margin, y + 19, contentWidth, { size: 9.5, lineHeight: 13 }) + 12;

  setText(doc, SLATE_950, 11, 'bold');
  doc.text('Formulation watch points', margin, y);
  y = data.watchPoints
    ? bulletList(doc, data.watchPoints, margin, y + 20, contentWidth, accent) + 5
    : paragraph(doc, data.watchPointsFallback, margin, y + 19, contentWidth, { size: 9.5, lineHeight: 13 }) + 12;

  setText(doc, SLATE_950, 11, 'bold');
  doc.text('Instrumental evidence', margin, y);
  y = paragraph(doc, data.instrumentalNote, margin, y + 19, contentWidth, { size: 9.5, lineHeight: 13 }) + 20;

  y = sectionTitle(ctx, 'Decision Rationale', y);
  labelValue(doc, data.decisionTiles[0][0], data.decisionTiles[0][1], margin, y, 112);
  labelValue(doc, data.decisionTiles[1][0], data.decisionTiles[1][1], 160, y, 112);
  labelValue(doc, data.decisionTiles[2][0], data.decisionTiles[2][1], 280, y, 132);
  labelValue(doc, data.decisionTiles[3][0], data.decisionTiles[3][1], 420, y, 135);
  y += 74;
  y = paragraph(doc, data.decisionRecommendation, margin, y, contentWidth, {
    color: SLATE_950,
    size: 11,
    weight: 'bold',
    lineHeight: 15,
  }) + 15;

  if (data.gates.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Decision gate', 'Result', 'What it means']],
      body: data.gates.map(gate => [gate.label, gate.status.toUpperCase(), gate.detail]),
      headStyles: { fillColor: primary, textColor: WHITE },
      alternateRowStyles: { fillColor: SLATE_50 },
      styles: { fontSize: 8.5, cellPadding: 6, textColor: SLATE_700 },
      columnStyles: { 0: { cellWidth: 145 }, 1: { cellWidth: 65 } },
    });
  } else {
    paragraph(doc, 'Detailed hard-gate results are not stored in this report version. The recommendation remains tied to the saved decision record.', margin, y, contentWidth, { size: 9.5 });
  }
}
