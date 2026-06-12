import {
  AMBER,
  GREEN,
  SLATE_50,
  SLATE_500,
  SLATE_950,
  bulletList,
  imageFormat,
  paragraph,
  sectionTitle,
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

  let y = sectionTitle(ctx, 'Marketing Concept & Packaging Direction', startY);
  const copyWidth = packaging ? 310 : contentWidth;
  setText(doc, SLATE_950, 15, 'bold');
  doc.text(data.conceptName, margin, y);
  y = paragraph(doc, data.conceptDescription, margin, y + 22, copyWidth, { size: 10, lineHeight: 14 }) + 12;
  y = paragraph(doc, `Positioning: ${data.positioning}`, margin, y, copyWidth, { size: 9.5, lineHeight: 13 }) + 8;
  y = paragraph(doc, `Target consumer: ${data.targetConsumer}`, margin, y, copyWidth, { size: 9.5, lineHeight: 13 }) + 8;
  y = paragraph(doc, `Price point: ${data.pricePoint}`, margin, y, copyWidth, { size: 9.5, lineHeight: 13 }) + 8;

  if (packaging) {
    doc.setFillColor(...SLATE_50);
    doc.roundedRect(width - 205, 76, 165, 205, 8, 8, 'F');
    doc.addImage(packaging, imageFormat(packaging), width - 192, 89, 139, 139, undefined, 'FAST');
    setText(doc, SLATE_500, 8, 'bold');
    doc.text('SELECTED DIRECTION', width - 122, 251, { align: 'center' });
  }

  y = Math.max(y, packaging ? 305 : 220);
  doc.setFillColor(...SLATE_50);
  doc.roundedRect(margin, y, contentWidth, 82, 8, 8, 'F');
  setText(doc, strengthColor, 9, 'bold');
  doc.text(data.evidenceStrengthLabel, margin + 14, y + 22);
  paragraph(doc, data.evidenceStrengthNote, margin + 14, y + 43, contentWidth - 28, { size: 9.5, lineHeight: 13 });
  y += 108;

  y = sectionTitle(ctx, 'Final Commercialization Recommendation', y);
  bulletList(doc, data.recommendationItems, margin, y, contentWidth, accent);
}
