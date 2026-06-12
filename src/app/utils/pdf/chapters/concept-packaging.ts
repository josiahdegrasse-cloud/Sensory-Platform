import {
  AMBER,
  GREEN,
  SLATE_500,
  SLATE_700,
  SLATE_950,
  bulletList,
  imageFormat,
  paragraph,
  sectionTitle,
  setDisplayText,
  setText,
  type PdfContext,
  type Rgb,
} from '../theme';
import type { ConceptPackagingSectionData } from '../sections';

/** Chapter 3: concept/packaging direction and the final commercialization recommendation. */
export function renderConceptPackagingChapter(
  ctx: PdfContext,
  data: ConceptPackagingSectionData,
  packaging: string | null,
  startY: number,
) {
  const { doc, width, margin, contentWidth, accent } = ctx;
  const strengthColor: Rgb = data.strengthTone === 'established' ? GREEN : data.strengthTone === 'limited' ? AMBER : accent;

  let y = sectionTitle(ctx, 'Concept and packaging direction', startY);
  const copyWidth = packaging ? 300 : contentWidth;
  setDisplayText(doc, SLATE_950, 18, 'bold');
  doc.text(data.conceptName, margin, y);
  y = paragraph(doc, data.conceptDescription, margin, y + 25, copyWidth, { color: SLATE_700, size: 10, lineHeight: 14 }) + 18;

  const factRows: Array<[string, string]> = [
    ['Positioning', data.positioning],
    ['Target consumer', data.targetConsumer],
    ['Price point', data.pricePoint],
  ];
  factRows.forEach(([label, value]) => {
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, margin + copyWidth, y);
    setText(doc, SLATE_500, 7.5, 'bold');
    doc.text(label, margin, y + 16);
    y = paragraph(doc, value, margin + 92, y + 16, copyWidth - 92, { color: SLATE_950, size: 9.5, lineHeight: 13 }) + 8;
  });

  if (packaging) {
    doc.addImage(packaging, imageFormat(packaging), width - 205, startY, 165, 165, undefined, 'FAST');
    setText(doc, SLATE_500, 8, 'bold');
    doc.text('SELECTED DIRECTION', width - 205, startY + 182);
    if (data.packagingProvenance) {
      setText(doc, SLATE_500, 7, 'normal');
      doc.text(data.packagingProvenance, width - 205, startY + 195);
    }
    if (data.packagingDisclaimer) {
      paragraph(doc, data.packagingDisclaimer, width - 205, startY + 210, 165, { color: SLATE_500, size: 6.5, lineHeight: 8.5 });
    }
  }

  y = Math.max(y, packaging ? startY + (data.packagingDisclaimer || data.packagingProvenance ? 270 : 220) : y);
  doc.setDrawColor(...strengthColor);
  doc.setLineWidth(1.4);
  doc.line(margin, y, margin + contentWidth, y);
  setText(doc, strengthColor, 9, 'bold');
  doc.text(data.evidenceStrengthLabel, margin, y + 22);
  y = paragraph(doc, data.evidenceStrengthNote, margin, y + 44, contentWidth, { size: 9.5, lineHeight: 13 }) + 24;

  y = sectionTitle(ctx, 'Commercial recommendation', y);
  bulletList(doc, data.recommendationItems, margin, y, contentWidth, accent);
}
