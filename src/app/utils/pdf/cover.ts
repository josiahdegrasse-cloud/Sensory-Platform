import {
  AMBER,
  GREEN,
  SLATE_50,
  SLATE_200,
  SLATE_500,
  SLATE_700,
  SLATE_950,
  WHITE,
  imageFormat,
  labelValue,
  paragraph,
  setText,
  type PdfContext,
  type Rgb,
} from './theme';
import type { CoverSectionData } from './sections';

export interface CoverImages {
  packaging: string | null;
  logo: string | null;
}

/** Renders the title/decision/recommendation cover page (page 1, no header). */
export function renderCoverPage(ctx: PdfContext, data: CoverSectionData, images: CoverImages) {
  const { doc, width, margin, contentWidth, primary, accent } = ctx;
  const strengthColor: Rgb = data.strengthTone === 'established' ? GREEN : data.strengthTone === 'limited' ? AMBER : accent;

  doc.setFillColor(...primary);
  doc.rect(0, 0, width, 270, 'F');
  doc.setFillColor(...accent);
  doc.rect(0, 270, width, 8, 'F');

  let titleX = margin;
  if (images.logo) {
    doc.addImage(images.logo, imageFormat(images.logo), margin, 38, 48, 48, undefined, 'FAST');
    titleX = 104;
  }
  setText(doc, WHITE, 11, 'bold');
  doc.text(data.organizationName, titleX, 54);
  setText(doc, WHITE, 30, 'bold');
  doc.text('Commercialization', margin, 132);
  doc.text('Report', margin, 166);
  setText(doc, WHITE, 17);
  doc.text(data.sampleName, margin, 205);
  setText(doc, [203, 213, 225], 10);
  doc.text(`${data.foodType} | ${data.workspaceName}`, margin, 231);

  doc.setFillColor(...GREEN);
  doc.roundedRect(margin, 309, 68, 30, 6, 6, 'F');
  setText(doc, WHITE, 12, 'bold');
  doc.text(data.decisionOutcome, margin + 34, 329, { align: 'center' });
  doc.setFillColor(...strengthColor);
  doc.roundedRect(118, 309, 126, 30, 6, 6, 'F');
  setText(doc, WHITE, 10, 'bold');
  doc.text(data.strengthLabel, 181, 329, { align: 'center' });

  setText(doc, SLATE_500, 8, 'bold');
  doc.text('RECOMMENDED PATH', margin, 384);
  paragraph(doc, data.recommendedPath, margin, 411, images.packaging ? 300 : contentWidth, {
    color: SLATE_950,
    size: 14,
    weight: 'bold',
    lineHeight: 19,
  });
  if (images.packaging) {
    doc.setFillColor(...SLATE_50);
    doc.roundedRect(width - 202, 307, 162, 196, 8, 8, 'F');
    doc.addImage(images.packaging, imageFormat(images.packaging), width - 190, 319, 138, 138, undefined, 'FAST');
    setText(doc, SLATE_500, 7.5, 'bold');
    doc.text('SELECTED PACKAGING DIRECTION', width - 121, 478, { align: 'center' });
  }

  doc.setDrawColor(...SLATE_200);
  doc.line(margin, 535, width - margin, 535);
  const coverTileWidth = (contentWidth - 24) / 4;
  labelValue(doc, 'Generated', data.generatedLabel, margin, 558, coverTileWidth);
  labelValue(doc, 'Report status', data.status.toUpperCase(), margin + coverTileWidth + 8, 558, coverTileWidth);
  labelValue(doc, 'Report version', String(data.version), margin + (coverTileWidth + 8) * 2, 558, coverTileWidth);
  labelValue(doc, 'Decision record', 'Saved and traceable', margin + (coverTileWidth + 8) * 3, 558, coverTileWidth);

  doc.setFillColor(...SLATE_50);
  doc.roundedRect(margin, 640, contentWidth, 92, 8, 8, 'F');
  setText(doc, strengthColor, 9, 'bold');
  doc.text('EVIDENCE STRENGTH NOTE', margin + 14, 663);
  paragraph(doc, data.evidenceStrengthNote, margin + 14, 685, contentWidth - 28, {
    color: SLATE_700,
    size: 10,
    lineHeight: 14,
  });
}
