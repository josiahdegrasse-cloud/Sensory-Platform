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
  lighten,
  paragraph,
  setDisplayText,
  setText,
  type PdfContext,
  type Rgb,
} from '../theme';
import type {
  CommercialInsightsData,
  DecisionSnapshotData,
  ExecutiveReadoutData,
  PerformanceDashboardData,
} from '../sections';

function pageHeading(ctx: PdfContext, eyebrow: string, title: string, purpose: string) {
  const { doc, width, margin, contentWidth, primary, accent } = ctx;
  const pageNumber = eyebrow.match(/Page\s+(\d+)/i)?.[1]?.padStart(2, '0');
  if (pageNumber) {
    setDisplayText(doc, lighten(accent, 0.84), 46, 'bold');
    doc.text(pageNumber, width - margin, 92, { align: 'right' });
  }
  setText(doc, accent, 8, 'bold');
  doc.text(eyebrow.toUpperCase(), margin, 68);
  setDisplayText(doc, primary, 24, 'bold');
  doc.text(title, margin, 99);
  const bottom = paragraph(doc, purpose, margin, 122, Math.min(contentWidth, 430), {
    color: SLATE_500,
    size: 9,
    lineHeight: 13,
  });
  doc.setDrawColor(...accent);
  doc.setLineWidth(3);
  doc.line(margin, bottom + 8, margin + 58, bottom + 8);
  doc.setDrawColor(...SLATE_200);
  doc.setLineWidth(0.6);
  doc.line(margin + 66, bottom + 8, width - margin, bottom + 8);
  return bottom + 30;
}

function badgeColor(decision: string): Rgb {
  if (decision === 'GO' || decision === 'APPROVED') return GREEN;
  if (decision === 'STOP') return [190, 18, 60];
  return AMBER; // CONDITIONAL, REVIEW, TWEAK
}

function snapshotCard(ctx: PdfContext, label: string, value: string, x: number, y: number, width: number, height: number) {
  const { doc, accent } = ctx;
  doc.setFillColor(...SLATE_50);
  doc.setDrawColor(...SLATE_200);
  doc.roundedRect(x, y, width, height, 8, 8, 'FD');
  doc.setFillColor(...accent);
  doc.roundedRect(x + 13, y + 13, 6, 28, 3, 3, 'F');
  setText(doc, SLATE_500, 7.5, 'bold');
  doc.text(label.toUpperCase(), x + 30, y + 21);
  paragraph(doc, value, x + 30, y + 40, width - 44, {
    color: SLATE_950,
    size: 9.5,
    weight: 'bold',
    lineHeight: 13,
  });
}

export function renderDecisionSnapshotPage(
  ctx: PdfContext,
  data: DecisionSnapshotData,
  images: { packaging: string | null; logo: string | null },
) {
  const { doc, width, height, margin, primary, accent } = ctx;
  doc.setFillColor(...SLATE_50);
  doc.rect(0, 0, width, height, 'F');
  doc.setFillColor(...primary);
  doc.rect(0, 0, width, 176, 'F');
  doc.setFillColor(...accent);
  doc.rect(0, 176, width, 7, 'F');
  doc.setDrawColor(...lighten(accent, 0.55));
  doc.setLineWidth(0.7);
  doc.line(margin, 116, width - margin - 126, 116);

  if (images.logo) {
    const logoSize = 48;
    const logoX = margin;
    const logoY = 27;
    doc.saveGraphicsState();
    doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, null);
    doc.clip();
    doc.discardPath();
    doc.addImage(images.logo, imageFormat(images.logo), logoX, logoY, logoSize, logoSize, undefined, 'FAST');
    doc.restoreGraphicsState();
  } else {
    setText(doc, WHITE, 8.5, 'bold');
    doc.text(data.organizationName, margin, 49);
  }
  setText(doc, lighten(primary, 0.72), 8, 'bold');
  doc.text(data.category.toUpperCase(), margin, 102);
  setDisplayText(doc, WHITE, 28, 'bold');
  const productLines = doc.splitTextToSize(data.productName, width - margin * 2 - 130) as string[];
  doc.text(productLines.slice(0, 2), margin, 137, { lineHeightFactor: 1 });

  // A conditional GO renders amber so the cover badge never overstates confidence.
  const badge = data.conditional ? AMBER : badgeColor(data.decision);
  doc.setFillColor(...badge);
  doc.roundedRect(width - margin - 94, 40, 94, 42, 21, 21, 'F');
  setText(doc, WHITE, 14, 'bold');
  doc.text(data.decision, width - margin - 47, 66, { align: 'center' });
  setText(doc, lighten(primary, 0.72), 7, 'bold');
  doc.text('COMMERCIAL DECISION', width - margin - 47, 94, { align: 'center' });

  setText(doc, accent, 8, 'bold');
  doc.text('DECISION SNAPSHOT', margin, 219);
  setDisplayText(doc, lighten(accent, 0.86), 58, 'bold');
  doc.text('01', width - margin, 260, { align: 'right' });
  const imageX = width - margin - 190;
  const leftWidth = imageX - margin - 22;
  let titleSize = 22;
  setDisplayText(doc, SLATE_950, titleSize, 'bold');
  let reportTitleLines = doc.splitTextToSize(data.reportTitle, leftWidth) as string[];
  while (reportTitleLines.length > 2 && titleSize > 14) {
    titleSize -= 1;
    setDisplayText(doc, SLATE_950, titleSize, 'bold');
    reportTitleLines = doc.splitTextToSize(data.reportTitle, leftWidth) as string[];
  }
  doc.text(reportTitleLines.slice(0, 2), margin, 250, { lineHeightFactor: 1.05 });

  if (images.packaging) {
    doc.addImage(images.packaging, imageFormat(images.packaging), imageX, 207, 190, 190, undefined, 'FAST');
    setText(doc, SLATE_500, 6.8, 'bold');
    doc.text('DIRECTIONAL CONCEPT VISUAL', imageX, 412);
  } else {
    doc.setFillColor(...SLATE_200);
    doc.roundedRect(imageX, 207, 190, 190, 10, 10, 'F');
    setText(doc, SLATE_500, 9, 'bold');
    doc.text('CONCEPT VISUAL', imageX + 95, 295, { align: 'center' });
    setText(doc, SLATE_500, 8);
    doc.text('Not attached', imageX + 95, 313, { align: 'center' });
  }

  setText(doc, SLATE_500, 7.5, 'bold');
  doc.text('READINESS STAGE', margin, 289);
  const readinessBottom = paragraph(doc, data.readinessStage, margin, 311, leftWidth, {
    color: SLATE_950,
    size: 13,
    weight: 'bold',
    lineHeight: 17,
  });
  // Stage subheading: makes "this is not launch approval" explicit on the cover.
  if (data.decisionSubheading) {
    paragraph(doc, data.decisionSubheading, margin, readinessBottom + 8, leftWidth, {
      color: SLATE_500,
      size: 8.5,
      lineHeight: 12,
    });
  }

  const cardWidth = (width - margin * 2 - 14) / 2;
  snapshotCard(ctx, 'Core strength', data.coreStrength, margin, 445, cardWidth, 108);
  snapshotCard(ctx, 'Main watch point', data.mainWatchPoint, margin + cardWidth + 14, 445, cardWidth, 108);
  snapshotCard(ctx, 'Recommended next action', data.nextAction, margin, 569, width - margin * 2, 112);

  doc.setDrawColor(...SLATE_200);
  doc.line(margin, 712, width - margin, 712);
  setText(doc, SLATE_500, 7.5);
  doc.text(`${data.workspaceName} · ${data.generatedLabel}`, margin, 733);
  doc.text(`Version ${data.version} · ${data.status}`, width - margin, 733, { align: 'right' });
}

export function renderExecutiveReadoutPage(ctx: PdfContext, data: ExecutiveReadoutData) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = pageHeading(
    ctx,
    'Page 2 · Commercial readout',
    'Executive Summary / Commercial Readout',
    'A decision memo for product, R&D, design, and commercial leaders.',
  );
  const blocks = [
    ['Decision', data.decision],
    ['Rationale', data.rationale],
    ['Executive recommendation', data.commercialImplication],
    ['Next move', data.nextMove],
  ];
  blocks.forEach(([label, value], index) => {
    const isDecision = index === 0;
    const blockHeight = isDecision ? 112 : 132;
    const pillWidth = label.length > 16 ? 152 : 96;
    doc.setFillColor(...(isDecision ? lighten(accent, 0.9) : WHITE));
    doc.setDrawColor(...(isDecision ? accent : SLATE_200));
    doc.roundedRect(margin, y, contentWidth, blockHeight, 10, 10, 'FD');
    doc.setFillColor(...(isDecision ? accent : primary));
    doc.roundedRect(margin + 15, y + 17, pillWidth, 24, 12, 12, 'F');
    setText(doc, WHITE, 8, 'bold');
    doc.text(label.toUpperCase(), margin + 15 + pillWidth / 2, y + 33, { align: 'center' });
    paragraph(doc, value, margin + 18, y + 64, contentWidth - 36, {
      color: SLATE_950,
      size: isDecision ? 13 : 10.5,
      weight: isDecision ? 'bold' : 'normal',
      lineHeight: isDecision ? 18 : 15,
    });
    y += blockHeight + 14;
  });
}

export function renderPerformanceDashboardPage(ctx: PdfContext, data: PerformanceDashboardData) {
  const { doc, margin, contentWidth, accent } = ctx;
  let y = pageHeading(ctx, 'Page 3 · Evidence', 'Product Performance Dashboard', data.intro);
  const gap = 12;
  const cardWidth = (contentWidth - gap) / 2;
  const cardHeight = 184;
  data.metrics.forEach((metric, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + column * (cardWidth + gap);
    const cardY = y + row * (cardHeight + gap);
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...SLATE_200);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 9, 9, 'FD');
    setText(doc, SLATE_500, 7.2, 'bold');
    doc.text(metric.label.toUpperCase(), x + 15, cardY + 22);
    setDisplayText(doc, SLATE_950, 21, 'bold');
    doc.text(metric.value, x + 15, cardY + 49);
    if (metric.score !== null) {
      const trackWidth = cardWidth - 30;
      doc.setFillColor(...SLATE_200);
      doc.roundedRect(x + 15, cardY + 62, trackWidth, 7, 3.5, 3.5, 'F');
      doc.setFillColor(...accent);
      doc.roundedRect(x + 15, cardY + 62, Math.max(7, trackWidth * metric.score / 100), 7, 3.5, 3.5, 'F');
    }
    setText(doc, SLATE_500, 6.8, 'bold');
    doc.text('EVIDENCE', x + 15, cardY + 82);
    paragraph(doc, metric.evidence, x + 15, cardY + 96, cardWidth - 30, {
      color: SLATE_700,
      size: 7.7,
      lineHeight: 10,
    });
    setText(doc, SLATE_500, 6.8, 'bold');
    doc.text('SCORE EXPLANATION', x + 15, cardY + 122);
    paragraph(doc, metric.explanation ?? 'See the method page for the score transform.', x + 15, cardY + 136, cardWidth - 30, {
      color: SLATE_700,
      size: 6.4,
      lineHeight: 8,
    });
    setText(doc, accent, 6.8, 'bold');
    doc.text('COMMERCIAL IMPLICATION', x + 15, cardY + 158);
    paragraph(doc, metric.implication, x + 15, cardY + 172, cardWidth - 30, {
      color: SLATE_950,
      size: 6.6,
      weight: 'bold',
      lineHeight: 8,
    });
  });
  const rows = Math.ceil(data.metrics.length / 2);
  y += rows * (cardHeight + gap) + 4;
  doc.setFillColor(...SLATE_50);
  doc.roundedRect(margin, y, contentWidth, 62, 8, 8, 'F');
  setText(doc, SLATE_500, 7, 'bold');
  doc.text('EVIDENCE BOUNDARY', margin + 14, y + 19);
  paragraph(doc, data.evidenceNote, margin + 14, y + 36, contentWidth - 28, {
    color: SLATE_700,
    size: 8,
    lineHeight: 11,
  });

  // Glossary: the score numbers are meaningless to a reader who doesn't know what
  // ISSF or "model confidence" mean. Define them where the scores appear.
  y += 74;
  const defLines = doc.splitTextToSize(data.definitions, contentWidth - 28) as string[];
  doc.setFillColor(...SLATE_50);
  doc.roundedRect(margin, y, contentWidth, 28 + defLines.length * 10, 8, 8, 'F');
  setText(doc, accent, 7, 'bold');
  doc.text('HOW TO READ THESE SCORES', margin + 14, y + 18);
  paragraph(doc, data.definitions, margin + 14, y + 32, contentWidth - 28, {
    color: SLATE_700,
    size: 7.6,
    lineHeight: 10,
  });
}

export function renderCommercialInsightsPage(ctx: PdfContext, data: CommercialInsightsData) {
  const { doc, margin, contentWidth, accent } = ctx;
  let y = pageHeading(ctx, 'Page 5 · Interpretation', 'Key Commercial Insights', data.intro);
  const cardHeight = data.insights.length > 4 ? 111 : 132;
  data.insights.forEach((insight, index) => {
    doc.setFillColor(...(index % 2 === 0 ? SLATE_50 : WHITE));
    doc.setDrawColor(...SLATE_200);
    doc.roundedRect(margin, y, contentWidth, cardHeight, 9, 9, 'FD');
    doc.setFillColor(...accent);
    doc.roundedRect(margin + 14, y + 14, 26, 26, 13, 13, 'F');
    setText(doc, WHITE, 9, 'bold');
    doc.text(String(index + 1), margin + 27, y + 31, { align: 'center' });
    setDisplayText(doc, SLATE_950, 11.5, 'bold');
    doc.text(insight.title, margin + 50, y + 31);

    const columnWidth = (contentWidth - 62) / 3;
    const labels = [
      ['WHAT THE EVIDENCE SUGGESTS', insight.evidence],
      ['WHY IT MATTERS COMMERCIALLY', insight.commercialMeaning],
      ['RECOMMENDED ACTION', insight.action],
    ];
    labels.forEach(([label, value], column) => {
      const x = margin + 16 + column * (columnWidth + 15);
      setText(doc, column === 2 ? accent : SLATE_500, 6.4, 'bold');
      doc.text(label, x, y + 57);
      paragraph(doc, value, x, y + 72, columnWidth, {
        color: SLATE_700,
        size: 7.5,
        weight: column === 2 ? 'bold' : 'normal',
        lineHeight: 9.5,
      });
    });
    y += cardHeight + 10;
  });
}
