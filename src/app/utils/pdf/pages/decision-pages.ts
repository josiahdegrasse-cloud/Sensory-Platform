import {
  AMBER,
  GREEN,
  NFI_AQUA_SOFT,
  NFI_CORAL_DARK,
  NFI_INK,
  NFI_LINE,
  NFI_MUTED,
  NFI_SURFACE,
  SLATE_50,
  SLATE_200,
  SLATE_500,
  SLATE_700,
  SLATE_950,
  WHITE,
  fittedParagraph,
  imageFormat,
  lighten,
  paragraph,
  nfiViewBand,
  reportPageHeading,
  setDisplayText,
  setText,
  type PdfContext,
  type Rgb,
} from '../theme';
import { renderThresholdBarChart } from '../charts';
import type {
  CommercialInsightsData,
  DecisionSnapshotData,
  ExecutiveReadoutData,
  PerformanceDashboardData,
} from '../sections';

function badgeColor(decision: string): Rgb {
  if (decision === 'GO' || decision === 'APPROVED') return GREEN;
  if (decision === 'STOP') return [190, 18, 60];
  return AMBER; // CONDITIONAL, REVIEW, TWEAK
}

export function renderDecisionSnapshotPage(
  ctx: PdfContext,
  data: DecisionSnapshotData,
  images: {
    cover: string | null;
    logo: string | null;
    approvedCover: boolean;
    aiGenerated: boolean;
  },
) {
  const { doc, width, height, margin, contentWidth, primary, accent, template } = ctx;
  const branded = template === 'editorial-sage';
  // The B-style decision memo keeps its restrained editorial body while the
  // C-style cover is driven by the active client's real brand tokens.
  const coral = accent;
  const coverField = primary;
  const aqua = accent;
  const aquaDark = accent;
  const ink = branded ? NFI_INK : SLATE_950;
  const muted = branded ? NFI_MUTED : SLATE_500;
  const surface = branded ? NFI_SURFACE : SLATE_50;
  const line = branded ? NFI_LINE : SLATE_200;

  doc.setFillColor(...surface);
  doc.rect(0, 0, width, height, 'F');
  doc.setFillColor(...coverField);
  doc.rect(0, 0, width, 300, 'F');
  doc.setFillColor(...aqua);
  doc.rect(0, 300, width, 7, 'F');

  if (images.logo) {
    const logoSize = 44;
    const logoX = margin;
    const logoY = 26;
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

  if (images.logo) {
    setText(doc, WHITE, 8.5, 'bold');
    doc.text(data.organizationName, margin + 56, 52);
  }

  const imageWidth = 174;
  const imageHeight = 261;
  const imageX = width - margin - imageWidth;
  const imageY = 24;
  const titleWidth = imageX - margin - 28;
  setText(doc, lighten(coverField, 0.72), 8, 'bold');
  doc.text(data.category.toUpperCase(), margin, 94);
  setDisplayText(doc, WHITE, 27, 'bold');
  const productLines = doc.splitTextToSize(data.productName, titleWidth) as string[];
  doc.text(productLines.slice(0, 2), margin, 126, { lineHeightFactor: 1.02 });
  setText(doc, WHITE, 8, 'bold');
  doc.text('COMMERCIAL DECISION REPORT', margin, 192);

  if (images.cover) {
    doc.addImage(images.cover, imageFormat(images.cover), imageX, imageY, imageWidth, imageHeight, undefined, 'FAST');
    setText(doc, WHITE, 6.6, 'bold');
    doc.text(
      images.approvedCover
        ? images.aiGenerated ? 'APPROVED DIRECTIONAL PRODUCT VISUAL' : 'APPROVED PRODUCT PHOTOGRAPH'
        : 'DIRECTIONAL CONCEPT VISUAL',
      imageX,
      294,
    );
  } else {
    doc.setFillColor(...lighten(aqua, 0.86));
    doc.rect(imageX, imageY, imageWidth, imageHeight, 'F');
    setText(doc, aquaDark, 8, 'bold');
    doc.text('PRODUCT VISUAL NOT ATTACHED', imageX + imageWidth / 2, imageY + imageHeight / 2, { align: 'center' });
  }

  // A conditional GO renders amber so the cover badge never overstates confidence.
  const badge = data.conditional ? AMBER : badgeColor(data.decision);
  doc.setFillColor(...badge);
  doc.roundedRect(margin, 226, 78, 34, 17, 17, 'F');
  setText(doc, WHITE, 12, 'bold');
  doc.text(data.decision, margin + 39, 248, { align: 'center' });
  setText(doc, WHITE, 7, 'bold');
  doc.text('SENSORY DECISION', margin + 91, 246);

  setText(doc, aquaDark, 7.5, 'bold');
  doc.text('DECISION SNAPSHOT', margin, 332);
  setDisplayText(doc, lighten(coral, 0.9), 52, 'bold');
  doc.text('01', width - margin, 364, { align: 'right' });
  let titleSize = 22;
  setDisplayText(doc, ink, titleSize, 'bold');
  let reportTitleLines = doc.splitTextToSize(data.reportTitle, contentWidth - 60) as string[];
  while (reportTitleLines.length > 2 && titleSize > 14) {
    titleSize -= 1;
    setDisplayText(doc, ink, titleSize, 'bold');
    reportTitleLines = doc.splitTextToSize(data.reportTitle, contentWidth - 60) as string[];
  }
  doc.text(reportTitleLines.slice(0, 2), margin, 363, { lineHeightFactor: 1.05 });

  setText(doc, muted, 7, 'bold');
  doc.text('READINESS STAGE', margin, 401);
  const readinessBottom = paragraph(doc, data.readinessStage, margin, 421, contentWidth, {
    color: ink,
    size: 12.5,
    weight: 'bold',
    lineHeight: 15,
  });

  const viewY = Math.max(462, readinessBottom + 13);
  nfiViewBand(ctx, viewY, 'What the decision means', data.decisionSubheading, 58);

  const metricGap = 10;
  const metricWidth = (contentWidth - metricGap * 2) / 3;
  const metricY = viewY + 76;
  doc.setDrawColor(...line);
  doc.setLineWidth(0.7);
  doc.line(margin, metricY, width - margin, metricY);
  doc.line(margin, metricY + 58, width - margin, metricY + 58);
  [
    ['ISSF score', data.issfScore],
    ['Evidence strength', data.modelConfidence],
    ['Concept evidence', data.conceptEvidence],
  ].forEach(([label, value], index) => {
    const x = margin + index * (metricWidth + metricGap);
    if (index > 0) doc.line(x - metricGap / 2, metricY + 9, x - metricGap / 2, metricY + 49);
    setText(doc, muted, 6.8, 'bold');
    doc.text(label.toUpperCase(), x, metricY + 18);
    setDisplayText(doc, ink, index === 2 ? 13 : 18, 'bold');
    doc.text(value, x, metricY + 43);
  });

  const evidenceY = metricY + 78;
  const halfWidth = (contentWidth - 28) / 2;
  setText(doc, aquaDark, 6.8, 'bold');
  doc.text('CORE STRENGTH', margin, evidenceY);
  fittedParagraph(doc, data.coreStrength, margin, evidenceY + 20, halfWidth, 43, {
    color: ink,
    size: 8.5,
    minSize: 5.8,
    weight: 'bold',
    lineHeight: 11,
  });
  doc.setDrawColor(...line);
  doc.line(margin + halfWidth + 14, evidenceY - 7, margin + halfWidth + 14, evidenceY + 54);
  const watchX = margin + halfWidth + 28;
  setText(doc, NFI_CORAL_DARK, 6.8, 'bold');
  doc.text('MAIN WATCH POINT', watchX, evidenceY);
  fittedParagraph(doc, data.mainWatchPoint, watchX, evidenceY + 20, halfWidth, 43, {
    color: ink,
    size: 8.5,
    minSize: 5.8,
    weight: 'bold',
    lineHeight: 11,
  });

  const actionY = evidenceY + 72;
  nfiViewBand(ctx, actionY, 'Recommended next action', data.nextAction, 70);

  setText(doc, muted, 7.2);
  doc.text(`${data.workspaceName} · ${data.generatedLabel}`, margin, 782);
  doc.text(`Version ${data.version} · ${data.status}`, width - margin, 782, { align: 'right' });
}

export function renderExecutiveReadoutPage(ctx: PdfContext, data: ExecutiveReadoutData) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = reportPageHeading(
    ctx,
    2,
    'Commercial readout',
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
  let y = reportPageHeading(ctx, 3, 'Sensory diagnostic', 'Sensory performance against the readiness line', 'Measured sensory performance, study basis, benchmark context, and the implications to protect through scale-up.');
  const sensoryMetrics = data.metrics.filter(metric => metric.score !== null).slice(0, 4);
  const passingMetrics = sensoryMetrics.filter(metric => (metric.score ?? 0) >= data.readinessThreshold).length;
  setDisplayText(doc, SLATE_950, 13, 'bold');
  doc.text('Dimension performance', margin, y);
  y = renderThresholdBarChart(
    ctx,
    sensoryMetrics.map(metric => ({
      label: metric.label,
      value: metric.score ?? 0,
      valueLabel: `${metric.value} (${(metric.score ?? 0) >= data.readinessThreshold ? '+' : ''}${((metric.score ?? 0) - data.readinessThreshold).toFixed(0)} vs line)`,
    })),
    data.readinessThreshold,
    margin,
    y + 18,
    contentWidth,
  ) + 6;

  const gap = 12;
  const cardWidth = (contentWidth - gap) / 2;
  const cardHeight = 108;
  const conceptMetric = data.metrics.find(metric => metric.score === null);
  sensoryMetrics.forEach((metric, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + column * (cardWidth + gap);
    const cardY = y + row * (cardHeight + gap);
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...SLATE_200);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 9, 9, 'FD');
    setText(doc, SLATE_500, 7.8, 'bold');
    doc.text(metric.label.toUpperCase(), x + 15, cardY + 22);
    fittedParagraph(doc, metric.evidence, x + 15, cardY + 39, cardWidth - 30, 14, {
      color: SLATE_700,
      size: 8,
      minSize: 7.2,
      lineHeight: 9.8,
    });
    const evidenceDetail = metric.benchmark ?? `Readiness line ${data.readinessThreshold}/100`;
    if (evidenceDetail) {
      fittedParagraph(doc, evidenceDetail, x + 15, cardY + 58, cardWidth - 30, 12, {
        color: SLATE_500,
        size: 7.4,
        minSize: 6.8,
        lineHeight: 8.8,
      });
    }
    fittedParagraph(doc, metric.implication, x + 15, cardY + (evidenceDetail ? 77 : 61), cardWidth - 30, evidenceDetail ? 23 : 39, {
      color: SLATE_950,
      size: 8,
      minSize: 7.2,
      weight: 'bold',
      lineHeight: 9.6,
    });
  });
  const rows = Math.ceil(sensoryMetrics.length / 2);
  y += rows * (cardHeight + gap) + 4;
  const summaryGap = 12;
  const summaryWidth = (contentWidth - summaryGap) / 2;
  doc.setFillColor(...(ctx.template === 'editorial-sage' ? NFI_AQUA_SOFT : lighten(accent, 0.9)));
  doc.roundedRect(margin, y, summaryWidth, 92, 8, 8, 'F');
  setText(doc, ctx.template === 'editorial-sage' ? NFI_CORAL_DARK : accent, 7, 'bold');
  doc.text('NFI VIEW · WHAT THE EVIDENCE SUPPORTS', margin + 14, y + 19);
  const supportSummary = passingMetrics === sensoryMetrics.length
    ? 'The product cleared the internal sensory screen. Acceptance, texture, descriptor fit, and emotional response support launch preparation and pilot-scale confirmation.'
    : `${passingMetrics} of ${sensoryMetrics.length} sensory dimensions clear the readiness line. Continue product work, but correct and retest every below-line dimension before relying on the sensory result.`;
  fittedParagraph(doc, supportSummary, margin + 14, y + 38, summaryWidth - 28, 45, {
    color: SLATE_950,
    size: 8,
    minSize: 5.6,
    weight: 'bold',
    lineHeight: 11,
  });

  const boundaryX = margin + summaryWidth + summaryGap;
  doc.setFillColor(...SLATE_50);
  doc.roundedRect(boundaryX, y, summaryWidth, 92, 8, 8, 'F');
  setText(doc, SLATE_500, 7, 'bold');
  doc.text('WHAT IS NOT YET PROVEN', boundaryX + 14, y + 19);
  const conceptText = conceptMetric
    ? `Concept response is n=${conceptMetric.evidence.match(/\d+/)?.[0] ?? '0'}. Do not treat purchase intent, price feedback, packaging preference, or concept descriptors as representative market evidence.`
    : data.evidenceNote;
  fittedParagraph(doc, conceptText, boundaryX + 14, y + 38, summaryWidth - 28, 45, {
    color: SLATE_700,
    size: 8,
    minSize: 5.6,
    lineHeight: 11,
  });
  paragraph(doc, data.definitions, margin, y + 116, contentWidth, {
    color: SLATE_500,
    size: 8,
    lineHeight: 10,
  });
}

export function renderCommercialInsightsPage(ctx: PdfContext, data: CommercialInsightsData) {
  const { doc, margin, contentWidth, accent } = ctx;
  let y = reportPageHeading(ctx, 5, 'Interpretation', 'Key Commercial Insights', data.intro);
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
