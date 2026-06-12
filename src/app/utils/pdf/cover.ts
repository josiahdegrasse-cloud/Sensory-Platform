import {
  AMBER,
  BODY_SAGE,
  CHARCOAL,
  CREAM,
  CREAM_LINE,
  GREEN,
  SAGE_DARK,
  SLATE_50,
  SLATE_200,
  SLATE_500,
  SLATE_700,
  SLATE_950,
  WHITE,
  imageFormat,
  paragraph,
  setDisplayText,
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
  if (ctx.template === 'editorial-sage') {
    renderEditorialCoverPage(ctx, data, images);
    return;
  }
  const { doc, width, height, margin, primary, accent } = ctx;
  const strengthColor: Rgb = data.strengthTone === 'established' ? GREEN : data.strengthTone === 'limited' ? AMBER : accent;

  doc.setFillColor(...SLATE_50);
  doc.rect(0, 0, width, height, 'F');
  doc.setFillColor(...primary);
  doc.rect(0, 0, 176, height, 'F');
  doc.setFillColor(...accent);
  doc.rect(176, 0, 8, height, 'F');

  let brandY = 54;
  if (images.logo) {
    doc.addImage(images.logo, imageFormat(images.logo), 42, 38, 94, 54, undefined, 'FAST');
    brandY = 115;
  }
  setText(doc, WHITE, 9, 'bold');
  doc.text(data.organizationName, 42, brandY);
  setText(doc, WHITE, 7.5);
  doc.text('COMMERCIALIZATION REPORT', 42, brandY + 22);

  setText(doc, [219, 228, 226], 8);
  doc.text(data.generatedLabel, 42, height - 73);
  doc.text(`Version ${data.version} · ${data.status}`, 42, height - 56);
  doc.text(data.workspaceName, 42, height - 39);

  const contentX = 218;
  const contentRight = width - margin;
  setText(doc, primary, 9, 'bold');
  doc.text(data.foodType, contentX, 74);
  setDisplayText(doc, primary, 32, 'bold');
  const titleLines = doc.splitTextToSize(data.sampleName, contentRight - contentX) as string[];
  doc.text(titleLines.slice(0, 3), contentX, 117, { lineHeightFactor: 0.98 });
  const titleBottom = 117 + Math.min(titleLines.length, 3) * 31;
  setDisplayText(doc, SLATE_700, 18, 'normal');
  doc.text('Commercialization report', contentX, titleBottom + 15);

  doc.setDrawColor(...accent);
  doc.setLineWidth(3);
  doc.line(contentX, titleBottom + 36, contentX + 76, titleBottom + 36);

  if (images.packaging) {
    doc.addImage(images.packaging, imageFormat(images.packaging), contentX, titleBottom + 70, contentRight - contentX, 208, undefined, 'FAST');
    setText(doc, SLATE_500, 7, 'bold');
    doc.text('SELECTED CONCEPT DIRECTION', contentX, titleBottom + 292);
  }

  const decisionY = images.packaging ? titleBottom + 332 : titleBottom + 94;
  setText(doc, strengthColor, 9, 'bold');
  doc.text(`${data.decisionOutcome} · ${data.strengthLabel}`, contentX, decisionY);
  setDisplayText(doc, SLATE_950, 17, 'bold');
  const recommendationBottom = paragraph(doc, data.recommendedPath, contentX, decisionY + 31, contentRight - contentX, {
    color: SLATE_950,
    size: 13,
    weight: 'bold',
    lineHeight: 18,
  });
  doc.setDrawColor(...SLATE_200);
  doc.setLineWidth(0.7);
  doc.line(contentX, recommendationBottom + 13, contentRight, recommendationBottom + 13);
  paragraph(doc, data.evidenceStrengthNote, contentX, recommendationBottom + 35, contentRight - contentX, {
    color: SLATE_700,
    size: 8.5,
    lineHeight: 12,
  });
}

/**
 * Masthead-style cover: cream background, logo top-left, large publication
 * title, sage accent rule, hero packaging image, and a decision/recommendation
 * block — modeled on New Food Innovation's branded report cover.
 */
function renderEditorialCoverPage(ctx: PdfContext, data: CoverSectionData, images: CoverImages) {
  const { doc, width, height, margin, accent } = ctx;
  const contentRight = width - margin;
  const strengthColor: Rgb = data.strengthTone === 'established' ? GREEN : data.strengthTone === 'limited' ? AMBER : accent;

  doc.setFillColor(...CREAM);
  doc.rect(0, 0, width, height, 'F');

  if (images.logo) {
    doc.addImage(images.logo, imageFormat(images.logo), margin, margin, 84, 48, undefined, 'FAST');
  }
  setText(doc, SAGE_DARK, 9, 'bold');
  doc.text('COMMERCIALIZATION REPORT', contentRight, margin + 18, { align: 'right' });
  setText(doc, BODY_SAGE, 8.5);
  doc.text(data.foodType, contentRight, margin + 34, { align: 'right' });

  const titleY = margin + 110;
  setDisplayText(doc, CHARCOAL, 32, 'bold');
  const titleLines = doc.splitTextToSize(data.sampleName, width - margin * 2) as string[];
  doc.text(titleLines.slice(0, 2), margin, titleY, { lineHeightFactor: 1.05 });
  const titleBottom = titleY + Math.min(titleLines.length, 2) * 36;

  setDisplayText(doc, BODY_SAGE, 14, 'normal');
  doc.text('Commercialization report', margin, titleBottom + 14);

  doc.setDrawColor(...accent);
  doc.setLineWidth(3);
  doc.line(margin, titleBottom + 32, margin + 76, titleBottom + 32);

  let blockBottom = titleBottom + 32;
  if (images.packaging) {
    const imageHeight = 220;
    doc.addImage(images.packaging, imageFormat(images.packaging), margin, titleBottom + 50, width - margin * 2, imageHeight, undefined, 'FAST');
    setText(doc, BODY_SAGE, 7, 'bold');
    doc.text('SELECTED CONCEPT DIRECTION', margin, titleBottom + 50 + imageHeight + 16);
    blockBottom = titleBottom + 50 + imageHeight + 16;
  }

  const decisionY = blockBottom + 28;
  setText(doc, strengthColor, 9, 'bold');
  doc.text(`${data.decisionOutcome} · ${data.strengthLabel}`, margin, decisionY);
  const recommendationBottom = paragraph(doc, data.recommendedPath, margin, decisionY + 24, width - margin * 2, {
    color: CHARCOAL,
    size: 12.5,
    weight: 'bold',
    lineHeight: 17,
  });

  doc.setDrawColor(...CREAM_LINE);
  doc.setLineWidth(0.7);
  doc.line(margin, recommendationBottom + 12, contentRight, recommendationBottom + 12);
  paragraph(doc, data.evidenceStrengthNote, margin, recommendationBottom + 32, width - margin * 2, {
    color: BODY_SAGE,
    size: 8.5,
    lineHeight: 12,
  });

  setText(doc, BODY_SAGE, 8);
  doc.text(`${data.organizationName} · ${data.workspaceName}`, margin, height - 30);
  doc.text(`${data.generatedLabel} · Version ${data.version} · ${data.status}`, contentRight, height - 30, { align: 'right' });
}
