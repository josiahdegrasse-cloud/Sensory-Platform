import {
  ROSE,
  REPORT_BLUE,
  REPORT_INK,
  REPORT_LEAF,
  REPORT_LINE,
  REPORT_MUTED,
  REPORT_ORANGE,
  REPORT_PAPER,
  REPORT_FOREST,
  REPORT_FOREST_SOFT,
  WHITE,
  imageFormat,
  lighten,
  paragraph,
  setDisplayText,
  setText,
  type PdfContext,
  type Rgb,
} from '../theme';
import type { ClientReportV2Data } from '../report-v2';

interface CoverImages {
  cover: string | null;
  logo: string | null;
  approvedCover: boolean;
  aiGenerated: boolean;
}

function pageFrame(ctx: PdfContext, page: number, title: string, purpose: string, section: string) {
  const { doc, width, height, margin, organizationName, productName } = ctx;
  doc.setFillColor(...REPORT_PAPER);
  doc.rect(0, 0, width, height, 'F');
  doc.setFillColor(...REPORT_FOREST);
  doc.rect(0, 0, width * 0.82, 5, 'F');
  doc.setFillColor(...REPORT_ORANGE);
  doc.rect(width * 0.82, 0, width * 0.18, 5, 'F');

  setText(doc, REPORT_FOREST, 6.8, 'bold');
  doc.text(`${organizationName.toUpperCase()}  /  COMMERCIALIZATION REPORT`, margin, 28);
  setText(doc, REPORT_MUTED, 6.8);
  doc.text(productName, width - margin, 28, { align: 'right' });
  doc.setDrawColor(...REPORT_LINE);
  doc.setLineWidth(0.5);
  doc.line(margin, 39, width - margin, 39);

  setText(doc, REPORT_ORANGE, 7.2, 'bold');
  doc.text(`${String(page).padStart(2, '0')}  /  ${section.toUpperCase()}`, margin, 66);
  setDisplayText(doc, REPORT_FOREST, 28, 'bold');
  doc.text(title, margin, 101);
  paragraph(doc, purpose, margin, 121, Math.min(420, ctx.contentWidth), {
    color: REPORT_MUTED,
    size: 9,
    lineHeight: 12,
  });
  doc.setDrawColor(...REPORT_ORANGE);
  doc.setLineWidth(2.6);
  doc.line(margin, 143, margin + 34, 143);
  doc.setDrawColor(...REPORT_LINE);
  doc.setLineWidth(0.7);
  doc.line(margin + 42, 143, width - margin, 143);
  return 163;
}

function panel(ctx: PdfContext, x: number, y: number, width: number, height: number, options?: {
  fill?: Rgb;
  border?: Rgb;
}) {
  ctx.doc.setFillColor(...(options?.fill ?? WHITE));
  ctx.doc.setDrawColor(...(options?.border ?? REPORT_LINE));
  ctx.doc.setLineWidth(0.6);
  ctx.doc.rect(x, y, width, height, 'FD');
}

function field(ctx: PdfContext, label: string, value: string, x: number, y: number, width: number, options?: {
  valueSize?: number;
  color?: Rgb;
  valueColor?: Rgb;
  maxLines?: number;
  display?: boolean;
}) {
  setText(ctx.doc, options?.color ?? REPORT_MUTED, 6.6, 'bold');
  ctx.doc.text(label.toUpperCase(), x, y);
  const size = options?.valueSize ?? 9.4;
  if (options?.display) setDisplayText(ctx.doc, options?.valueColor ?? REPORT_INK, size, 'bold');
  else setText(ctx.doc, options?.valueColor ?? REPORT_INK, size, 'bold');
  const lines = ctx.doc.splitTextToSize(value || 'Not available.', width) as string[];
  ctx.doc.text(lines.slice(0, options?.maxLines ?? 3), x, y + 15, { lineHeightFactor: 1.17 });
}

function decisionTone(decision: string): Rgb {
  if (decision.toUpperCase() === 'GO') return REPORT_LEAF;
  if (decision.toUpperCase() === 'STOP') return ROSE;
  return REPORT_ORANGE;
}

function statusTone(status: string): Rgb {
  if (/supported|ready|pass/i.test(status)) return REPORT_LEAF;
  if (/blocked|fail/i.test(status)) return ROSE;
  return REPORT_ORANGE;
}

function drawImageContained(ctx: PdfContext, image: string, x: number, y: number, width: number, height: number) {
  try {
    const properties = ctx.doc.getImageProperties(image);
    const ratio = Math.min(width / properties.width, height / properties.height);
    const renderWidth = properties.width * ratio;
    const renderHeight = properties.height * ratio;
    ctx.doc.addImage(
      image,
      imageFormat(image),
      x + (width - renderWidth) / 2,
      y + (height - renderHeight) / 2,
      renderWidth,
      renderHeight,
    );
  } catch {
    // Optional imagery should never block the evidence report.
  }
}

function metric(ctx: PdfContext, x: number, y: number, width: number, label: string, value: string, tone: Rgb = REPORT_FOREST) {
  ctx.doc.setDrawColor(...REPORT_LINE);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(x, y, x + width, y);
  setText(ctx.doc, REPORT_MUTED, 5.6, 'bold');
  ctx.doc.text(label.toUpperCase(), x, y + 16);
  setDisplayText(ctx.doc, tone, 16, 'bold');
  ctx.doc.text(value, x, y + 40);
}

function evidenceBar(ctx: PdfContext, x: number, y: number, width: number, value: number, threshold?: number, tone: Rgb = REPORT_BLUE) {
  const normalized = Math.max(0, Math.min(100, value));
  ctx.doc.setFillColor(...REPORT_LINE);
  ctx.doc.rect(x, y, width, 5, 'F');
  ctx.doc.setFillColor(...tone);
  ctx.doc.rect(x, y, width * normalized / 100, 5, 'F');
  if (threshold !== undefined) {
    ctx.doc.setDrawColor(...REPORT_FOREST);
    ctx.doc.setLineWidth(0.8);
    const thresholdX = x + width * Math.max(0, Math.min(100, threshold)) / 100;
    ctx.doc.line(thresholdX, y - 4, thresholdX, y + 9);
  }
}

function statusMark(ctx: PdfContext, x: number, y: number, label: string, tone: Rgb) {
  ctx.doc.setFillColor(...tone);
  ctx.doc.circle(x + 4, y - 3, 4, 'F');
  setText(ctx.doc, tone, 6.8, 'bold');
  ctx.doc.text(label.toUpperCase(), x + 15, y);
}

function bullet(ctx: PdfContext, text: string, x: number, y: number, width: number, color: Rgb = REPORT_BLUE) {
  ctx.doc.setFillColor(...color);
  ctx.doc.rect(x, y - 7, 5, 5, 'F');
  return paragraph(ctx.doc, text, x + 13, y, width - 13, { color: REPORT_INK, size: 8.1, lineHeight: 10.7 });
}

export function renderClientCoverPage(ctx: PdfContext, data: ClientReportV2Data, images: CoverImages) {
  const { doc, width, height, margin } = ctx;
  const { cover, basis } = data;
  doc.setFillColor(...REPORT_PAPER);
  doc.rect(0, 0, width, height, 'F');
  doc.setFillColor(...REPORT_ORANGE);
  doc.rect(0, 0, width, 6, 'F');

  setText(doc, REPORT_FOREST, 7, 'bold');
  doc.text('CLIENT PRODUCT DECISION REPORT', margin, 42);
  if (images.logo) drawImageContained(ctx, images.logo, width - margin - 92, 20, 92, 42);
  else {
    setText(doc, REPORT_MUTED, 6.8, 'bold');
    doc.text(cover.organizationName.toUpperCase(), width - margin, 42, { align: 'right' });
  }

  const imageX = 330;
  const imageY = 78;
  const imageWidth = width - imageX - margin;
  const imageHeight = 350;
  panel(ctx, imageX, imageY, imageWidth, imageHeight, { fill: WHITE, border: REPORT_LINE });
  if (images.cover) drawImageContained(ctx, images.cover, imageX + 8, imageY + 8, imageWidth - 16, imageHeight - 16);
  else {
    doc.setFillColor(...REPORT_FOREST_SOFT);
    doc.rect(imageX + 8, imageY + 8, imageWidth - 16, imageHeight - 16, 'F');
    setDisplayText(doc, REPORT_FOREST, 18, 'bold');
    doc.text('Product visual', imageX + imageWidth / 2, imageY + imageHeight / 2, { align: 'center' });
  }

  const textWidth = imageX - margin - 30;
  setText(doc, REPORT_ORANGE, 7, 'bold');
  doc.text(cover.category.toUpperCase(), margin, 94);
  setDisplayText(doc, REPORT_FOREST, 34, 'bold');
  const productLines = doc.splitTextToSize(cover.productName, textWidth) as string[];
  doc.text(productLines.slice(0, 3), margin, 136, { lineHeightFactor: 0.98 });
  const titleBottom = 136 + Math.min(productLines.length, 3) * 34;

  const tone = decisionTone(cover.decision);
  setText(doc, REPORT_MUTED, 6.8, 'bold');
  doc.text('COMMERCIALIZATION DECISION', margin, titleBottom + 25);
  setDisplayText(doc, tone, 42, 'bold');
  doc.text(cover.decision.toUpperCase(), margin, titleBottom + 69);
  paragraph(doc, cover.readinessStage, margin, titleBottom + 92, textWidth, {
    color: REPORT_INK,
    size: 11,
    weight: 'bold',
    lineHeight: 14,
  });

  setText(doc, REPORT_MUTED, 6.5, 'bold');
  doc.text(images.approvedCover ? 'APPROVED PRODUCT COVER' : 'DIRECTIONAL CONCEPT VISUAL', imageX, imageY + imageHeight + 20);
  const visualNote = images.approvedCover
    ? `${images.aiGenerated ? 'AI-generated' : 'Approved'} cover; product and claim permissions remain governed by the evidence record.`
    : 'Internal review visual. Final external cover approval remains pending.';
  paragraph(doc, visualNote, imageX, imageY + imageHeight + 37, imageWidth, { color: REPORT_MUTED, size: 6.6, lineHeight: 8.4 });

  const metaY = 455;
  doc.setDrawColor(...REPORT_LINE);
  doc.line(margin, metaY, margin + 118, metaY);
  doc.line(margin + 136, metaY, margin + 238, metaY);
  field(ctx, 'Prepared for', cover.organizationName, margin, metaY + 16, 118, {
    color: REPORT_MUTED,
    valueColor: REPORT_FOREST,
    valueSize: 9,
    maxLines: 2,
    display: true,
  });
  field(ctx, 'Report date', cover.generatedLabel, margin + 136, metaY + 16, 102, {
    color: REPORT_MUTED,
    valueColor: REPORT_FOREST,
    valueSize: 9,
    maxLines: 2,
    display: true,
  });
  field(ctx, 'Version / status', `Version ${cover.version} · ${cover.status}`, margin, metaY + 68, 220, {
    color: REPORT_MUTED,
    valueColor: REPORT_INK,
    valueSize: 8.5,
    maxLines: 2,
  });

  const bandY = 575;
  doc.setFillColor(...REPORT_FOREST);
  doc.rect(0, bandY, width, 178, 'F');
  setText(doc, REPORT_ORANGE, 6.8, 'bold');
  doc.text('DECISION AT A GLANCE', margin, bandY + 27);
  setDisplayText(doc, WHITE, 18, 'bold');
  const strength = doc.splitTextToSize(cover.coreStrength, 250) as string[];
  doc.text(strength.slice(0, 3), margin, bandY + 54, { lineHeightFactor: 1.08 });

  const evidenceX = 340;
  const evidenceWidth = (width - margin - evidenceX - 16) / 3;
  [
    ['ISSF', basis.issfScore],
    ['Decision margin', basis.decisionMargin.replace(' versus the GO threshold', '')],
    ['Evidence', basis.evidenceStrength],
  ].forEach(([label, value], index) => {
    const x = evidenceX + index * (evidenceWidth + 8);
    doc.setDrawColor(...lighten(REPORT_FOREST, 0.28));
    doc.line(x, bandY + 28, x, bandY + 138);
    setText(doc, lighten(REPORT_FOREST, 0.6), 5.4, 'bold');
    doc.text(label.toUpperCase(), x + 10, bandY + 48);
    setDisplayText(doc, WHITE, index === 1 ? 11.5 : 15, 'bold');
    doc.text(String(value), x + 10, bandY + 78);
  });
  setText(doc, lighten(REPORT_FOREST, 0.62), 7);
  doc.text('Premium product thinking, bounded by project evidence.', margin, bandY + 151);

  doc.setFillColor(...REPORT_PAPER);
  doc.rect(0, height - 42, width, 42, 'F');
}

export function renderExecutiveRecommendationPage(ctx: PdfContext, data: ClientReportV2Data) {
  let y = pageFrame(ctx, 2, 'Executive recommendation', 'The decision, why it is supportable, and what leadership should authorize next.', 'Decision');
  const { cover, executive, basis, plan } = data;
  const tone = decisionTone(cover.decision);

  panel(ctx, ctx.margin, y, ctx.contentWidth, 116, { fill: REPORT_FOREST, border: REPORT_FOREST });
  setText(ctx.doc, REPORT_ORANGE, 6.8, 'bold');
  ctx.doc.text('RECOMMENDATION', ctx.margin + 17, y + 24);
  setDisplayText(ctx.doc, WHITE, 18, 'bold');
  const decisionLines = ctx.doc.splitTextToSize(executive.decision, ctx.contentWidth - 152) as string[];
  ctx.doc.text(decisionLines.slice(0, 3), ctx.margin + 17, y + 51, { lineHeightFactor: 1.08 });
  setDisplayText(ctx.doc, tone, 34, 'bold');
  ctx.doc.text(cover.decision.toUpperCase(), ctx.margin + ctx.contentWidth - 24, y + 58, { align: 'right' });
  paragraph(ctx.doc, executive.commercialImplication, ctx.margin + 17, y + 88, ctx.contentWidth - 34, {
    color: lighten(REPORT_FOREST, 0.72), size: 8.2, lineHeight: 10.5,
  });
  y += 135;

  const gap = 14;
  const factWidth = (ctx.contentWidth - gap) / 2;
  const facts = [
    ['ISSF', basis.issfScore, REPORT_BLUE],
    ['GO threshold', basis.goThreshold, REPORT_FOREST],
    ['Decision margin / pts', basis.decisionMargin.replace(' points versus the GO threshold', ''), tone],
    ['Evidence strength', basis.evidenceStrength, REPORT_BLUE],
  ] as Array<[string, string, Rgb]>;
  facts.forEach(([label, value, color], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    metric(ctx, ctx.margin + column * (factWidth + gap), y + row * 52, factWidth, label, value, color);
  });
  y += 113;

  const half = (ctx.contentWidth - 12) / 2;
  panel(ctx, ctx.margin, y, half, 78, { fill: lighten(REPORT_LEAF, 0.91), border: lighten(REPORT_LEAF, 0.72) });
  statusMark(ctx, ctx.margin + 15, y + 21, 'Protect', REPORT_LEAF);
  paragraph(ctx.doc, cover.coreStrength, ctx.margin + 15, y + 44, half - 30, { color: REPORT_INK, size: 8.5, weight: 'bold', lineHeight: 10.7 });
  panel(ctx, ctx.margin + half + 12, y, half, 78, { fill: lighten(REPORT_ORANGE, 0.92), border: lighten(REPORT_ORANGE, 0.72) });
  statusMark(ctx, ctx.margin + half + 27, y + 21, 'Watch', REPORT_ORANGE);
  paragraph(ctx.doc, cover.mainWatchPoint, ctx.margin + half + 27, y + 44, half - 30, { color: REPORT_INK, size: 8.5, weight: 'bold', lineHeight: 10.7 });
  y += 99;

  setDisplayText(ctx.doc, REPORT_FOREST, 13, 'bold');
  ctx.doc.text('What this means by audience', ctx.margin, y);
  y += 16;
  const audienceRows = [
    ['Executive', basis.managementDecision],
    ['R&D', cover.nextAction],
    ['Marketing', 'Build the story around supported product strengths. Consumer preference, demand, price acceptance, packaging preference, and purchase intent remain validation work until approved.'],
  ];
  audienceRows.forEach(([audience, message], index) => {
    const rowY = y + index * 48;
    ctx.doc.setDrawColor(...REPORT_LINE);
    ctx.doc.line(ctx.margin, rowY + 42, ctx.margin + ctx.contentWidth, rowY + 42);
    setText(ctx.doc, index === 0 ? REPORT_FOREST : index === 1 ? REPORT_BLUE : REPORT_ORANGE, 6.7, 'bold');
    ctx.doc.text(audience.toUpperCase(), ctx.margin, rowY + 13);
    paragraph(ctx.doc, message, ctx.margin + 82, rowY + 12, ctx.contentWidth - 82, { color: REPORT_INK, size: 7.8, lineHeight: 9.8 });
  });
  y += 155;

  setDisplayText(ctx.doc, REPORT_FOREST, 13, 'bold');
  ctx.doc.text('Immediate priorities', ctx.margin, y);
  y += 19;
  plan.rows.slice(0, 3).forEach((row, index) => {
    const rowY = y + index * 30;
    setDisplayText(ctx.doc, REPORT_ORANGE, 12, 'bold');
    ctx.doc.text(String(index + 1).padStart(2, '0'), ctx.margin, rowY + 11);
    setText(ctx.doc, REPORT_INK, 8.2, 'bold');
    ctx.doc.text((ctx.doc.splitTextToSize(row.workstream, ctx.contentWidth - 42) as string[]).slice(0, 1), ctx.margin + 38, rowY + 10);
  });
}

export function renderProductPerformancePage(ctx: PdfContext, data: ClientReportV2Data) {
  let y = pageFrame(ctx, 3, 'Product performance', 'Sensory results, instrumental context, and literature-guided interpretation of the tested product.', 'Measured evidence');
  const { performance, scientific } = data;
  setDisplayText(ctx.doc, REPORT_FOREST, 13, 'bold');
  ctx.doc.text('Deterministic sensory decision factors', ctx.margin, y);
  setText(ctx.doc, REPORT_MUTED, 7);
  ctx.doc.text(`Readiness line ${performance.readinessThreshold}/100`, ctx.margin + ctx.contentWidth, y, { align: 'right' });
  y += 19;

  performance.metrics.filter(item => item.score !== null).slice(0, 4).forEach((item, index) => {
    const score = Math.max(0, Math.min(100, item.score ?? 0));
    const rowHeight = 74;
    ctx.doc.setFillColor(...(index % 2 ? WHITE : lighten(REPORT_BLUE, 0.965)));
    ctx.doc.rect(ctx.margin, y, ctx.contentWidth, rowHeight, 'F');
    ctx.doc.setDrawColor(...REPORT_LINE);
    ctx.doc.line(ctx.margin, y + rowHeight, ctx.margin + ctx.contentWidth, y + rowHeight);
    setText(ctx.doc, REPORT_INK, 9, 'bold');
    ctx.doc.text(item.label, ctx.margin + 12, y + 21);
    setDisplayText(ctx.doc, score >= performance.readinessThreshold ? REPORT_LEAF : REPORT_ORANGE, 17, 'bold');
    ctx.doc.text(item.value, ctx.margin + ctx.contentWidth - 12, y + 23, { align: 'right' });
    evidenceBar(ctx, ctx.margin + 12, y + 34, 165, score, performance.readinessThreshold, score >= performance.readinessThreshold ? REPORT_LEAF : REPORT_ORANGE);
    paragraph(ctx.doc, item.implication, ctx.margin + 198, y + 37, ctx.contentWidth - 210, { color: REPORT_INK, size: 7.7, lineHeight: 9.7 });
    setText(ctx.doc, REPORT_MUTED, 6.2);
    const basis = [item.evidence, item.benchmark, item.agreement].filter(Boolean).join(' · ');
    ctx.doc.text((ctx.doc.splitTextToSize(basis, 165) as string[]).slice(0, 2), ctx.margin + 12, y + 55, { lineHeightFactor: 1.12 });
    y += rowHeight;
  });

  y += 15;
  const half = (ctx.contentWidth - 14) / 2;
  panel(ctx, ctx.margin, y, half, 128, { fill: lighten(REPORT_BLUE, 0.93), border: lighten(REPORT_BLUE, 0.7) });
  statusMark(ctx, ctx.margin + 15, y + 22, 'Measured product parameters', REPORT_BLUE);
  field(
    ctx,
    '',
    scientific.parameterCount > 0
      ? `${scientific.parameterCount} parameter${scientific.parameterCount === 1 ? '' : 's'} attached · ${scientific.benchmarkedParameterCount} benchmarked`
      : scientific.instrumentalAvailable ? 'Technical evidence attached' : 'No project dataset attached',
    ctx.margin + 15,
    y + 39,
    half - 30,
    { valueSize: 8.7, maxLines: 2 },
  );
  let instrumentalY = y + 75;
  if (scientific.parameters.length) {
    scientific.parameters.slice(0, 3).forEach(parameter => {
      const value = `${parameter.value.toLocaleString(undefined, { maximumFractionDigits: 3 })}${parameter.unit ? ` ${parameter.unit}` : ''}`;
      const observations = parameter.observationCount > 0 ? ` · n=${parameter.observationCount}` : '';
      instrumentalY = bullet(
        ctx,
        `${parameter.label}: ${value}${observations} · ${parameter.status.replace(/_/g, ' ')}`,
        ctx.margin + 15,
        instrumentalY,
        half - 30,
        /below|above/.test(parameter.status) ? REPORT_ORANGE : REPORT_BLUE,
      ) + 2;
    });
    if (scientific.parameterCount > 3) {
      setText(ctx.doc, REPORT_MUTED, 6.2, 'bold');
      ctx.doc.text(`+${scientific.parameterCount - 3} additional parameter${scientific.parameterCount - 3 === 1 ? '' : 's'} retained in the evidence record`, ctx.margin + 15, y + 116);
    }
  } else if (scientific.findings.length) {
    scientific.findings.slice(0, 2).forEach(finding => {
      instrumentalY = bullet(ctx, `${finding.source}: ${finding.finding}`, ctx.margin + 15, instrumentalY, half - 30, statusTone(finding.decisionEffect)) + 3;
    });
  } else {
    paragraph(ctx.doc, scientific.instrumentalNote, ctx.margin + 15, instrumentalY, half - 30, { color: REPORT_INK, size: 7.7, lineHeight: 9.7 });
  }

  panel(ctx, ctx.margin + half + 14, y, half, 128, { fill: REPORT_FOREST_SOFT, border: lighten(REPORT_FOREST, 0.72) });
  statusMark(ctx, ctx.margin + half + 29, y + 22, 'Literature strengthens the next study', REPORT_FOREST);
  const guidance = scientific.guidance[0];
  field(ctx, '', guidance?.title ?? 'No approved guidance attached', ctx.margin + half + 29, y + 39, half - 30, { valueSize: 9.2, maxLines: 2 });
  paragraph(ctx.doc, guidance?.guidance ?? 'Attach approved literature before using external scientific context.', ctx.margin + half + 29, y + 79, half - 30, { color: REPORT_INK, size: 7.6, lineHeight: 9.6 });
  if (guidance?.citationIds.length) {
    setText(ctx.doc, REPORT_FOREST, 6.3, 'bold');
    ctx.doc.text(`Sources: ${guidance.citationIds.map(id => `[${id}]`).join(' ')}`, ctx.margin + half + 29, y + 114);
  }
  y += 143;

  panel(ctx, ctx.margin, y, ctx.contentWidth, 70, { fill: WHITE, border: REPORT_LINE });
  field(ctx, 'Study basis and definitions', performance.definitions, ctx.margin + 14, y + 19, ctx.contentWidth - 28, { color: REPORT_BLUE, valueSize: 7.4, maxLines: 4 });
}

export function renderConsumerConceptPage(ctx: PdfContext, data: ClientReportV2Data, conceptImage: string | null) {
  let y = pageFrame(ctx, 4, 'Consumer and concept response', 'The working proposition, observed response, evidence boundary, and commercial implication.', 'Human response');
  const { concept, consumer, commercialReadiness } = data;
  const imageWidth = 176;
  const copyWidth = ctx.contentWidth - imageWidth - 20;
  panel(ctx, ctx.margin, y, ctx.contentWidth, 192, { fill: REPORT_FOREST, border: REPORT_FOREST });
  setText(ctx.doc, REPORT_ORANGE, 6.7, 'bold');
  ctx.doc.text('WORKING PROPOSITION', ctx.margin + 18, y + 24);
  setDisplayText(ctx.doc, WHITE, 21, 'bold');
  ctx.doc.text((ctx.doc.splitTextToSize(concept.conceptName, copyWidth - 36) as string[]).slice(0, 2), ctx.margin + 18, y + 51, { lineHeightFactor: 1.06 });
  paragraph(ctx.doc, concept.positioning, ctx.margin + 18, y + 101, copyWidth - 36, { color: lighten(REPORT_FOREST, 0.72), size: 8.2, lineHeight: 10.5 });
  setText(ctx.doc, lighten(REPORT_FOREST, 0.58), 6.4, 'bold');
  ctx.doc.text('PRIORITY CONSUMER', ctx.margin + 18, y + 150);
  paragraph(ctx.doc, concept.targetConsumer, ctx.margin + 18, y + 168, copyWidth - 36, { color: WHITE, size: 8, weight: 'bold', lineHeight: 9.8 });
  const imageX = ctx.margin + copyWidth;
  ctx.doc.setFillColor(...WHITE);
  ctx.doc.rect(imageX, y + 12, imageWidth, 168, 'F');
  if (conceptImage) drawImageContained(ctx, conceptImage, imageX + 7, y + 19, imageWidth - 14, 154);
  else field(ctx, 'Concept visual', 'No approved visual attached', imageX + 14, y + 80, imageWidth - 28, { color: REPORT_MUTED, valueSize: 8.5, maxLines: 2 });
  y += 211;

  const metricWidth = (ctx.contentWidth - 24) / 3;
  [
    ['Responses', `n=${consumer.responseCount}`, REPORT_BLUE],
    ['Evidence strength', consumer.evidenceStrength, REPORT_FOREST],
    ['Purchase intent', consumer.purchaseIntent === null ? 'Not measured' : consumer.purchaseIntent.toFixed(1), REPORT_ORANGE],
  ].forEach(([label, value, color], index) => metric(ctx, ctx.margin + index * (metricWidth + 12), y, metricWidth, String(label), String(value), color as Rgb));
  y += 62;

  const chartWidth = (ctx.contentWidth - 14) / 2;
  panel(ctx, ctx.margin, y, chartWidth, 205, { fill: WHITE, border: REPORT_LINE });
  setDisplayText(ctx.doc, REPORT_FOREST, 13, 'bold');
  ctx.doc.text('Observed response', ctx.margin + 14, y + 24);
  let barY = y + 51;
  const descriptors = consumer.responseCount >= 5 ? consumer.descriptors.slice(0, 4) : [];
  if (descriptors.length) {
    descriptors.forEach(item => {
      setText(ctx.doc, REPORT_INK, 7.2, 'bold');
      ctx.doc.text(item.label, ctx.margin + 14, barY);
      setText(ctx.doc, REPORT_MUTED, 6.8);
      ctx.doc.text(`${item.percentage.toFixed(0)}% · ${item.count}`, ctx.margin + chartWidth - 14, barY, { align: 'right' });
      evidenceBar(ctx, ctx.margin + 14, barY + 8, chartWidth - 28, item.percentage, undefined, REPORT_BLUE);
      barY += 37;
    });
  } else {
    paragraph(ctx.doc, consumer.responseCount > 0 && consumer.responseCount < 5
      ? 'Individual responses are retained in the project record but are not presented as a consumer pattern.'
      : 'No descriptor selections are available for interpretation.', ctx.margin + 14, barY, chartWidth - 28, { color: REPORT_INK, size: 8 });
  }

  const rightX = ctx.margin + chartWidth + 14;
  panel(ctx, rightX, y, chartWidth, 205, { fill: lighten(REPORT_LEAF, 0.94), border: lighten(REPORT_LEAF, 0.72) });
  field(ctx, 'Product promise', concept.productPromise, rightX + 15, y + 24, chartWidth - 30, { color: REPORT_LEAF, valueSize: 9.2, maxLines: 3, display: true });
  field(ctx, 'Price hypothesis', concept.pricePoint, rightX + 15, y + 84, chartWidth - 30, { color: REPORT_ORANGE, valueSize: 8.3, maxLines: 3 });
  field(ctx, 'Commercial meaning', commercialReadiness.summary, rightX + 15, y + 145, chartWidth - 30, { color: REPORT_FOREST, valueSize: 7.5, maxLines: 5 });
  y += 222;

  panel(ctx, ctx.margin, y, ctx.contentWidth, 72, { fill: lighten(REPORT_ORANGE, 0.93), border: lighten(REPORT_ORANGE, 0.7) });
  field(ctx, 'Concept evidence boundary', `Concept test n=${consumer.responseCount}. ${consumer.boundary}`, ctx.margin + 15, y + 20, ctx.contentWidth - 30, { color: REPORT_ORANGE, valueSize: 8, maxLines: 4 });
}

export function renderPanelStudyProfilePage(ctx: PdfContext, data: ClientReportV2Data) {
  let y = pageFrame(ctx, 5, 'Panel and study profile', 'Who contributed, profile coverage, privacy rules, and the representativeness boundary.', 'Study population');
  const { panel: profile } = data;
  const coverageTone = profile.profileStatus === 'available'
    ? REPORT_LEAF
    : profile.profileStatus === 'partial'
      ? REPORT_ORANGE
      : ROSE;

  panel(ctx, ctx.margin, y, ctx.contentWidth, 94, { fill: REPORT_FOREST, border: REPORT_FOREST });
  const factWidth = (ctx.contentWidth - 36) / 3;
  [
    ['Sensory evidence', profile.sensoryPopulation],
    ['Concept evidence', profile.conceptPopulation],
    ['Profile coverage', profile.profileCoverage],
  ].forEach(([label, value], index) => {
    const x = ctx.margin + 16 + index * (factWidth + 10);
    setText(ctx.doc, index === 2 ? lighten(coverageTone, 0.5) : REPORT_ORANGE, 6.2, 'bold');
    ctx.doc.text(label.toUpperCase(), x, y + 25);
    setDisplayText(ctx.doc, WHITE, 12, 'bold');
    ctx.doc.text((ctx.doc.splitTextToSize(value, factWidth - 8) as string[]).slice(0, 3), x, y + 48, { lineHeightFactor: 1.08 });
  });
  y += 114;

  setDisplayText(ctx.doc, REPORT_FOREST, 14, 'bold');
  ctx.doc.text('Respondent demographic profile', ctx.margin, y);
  setText(ctx.doc, REPORT_MUTED, 6.8);
  ctx.doc.text('Percentages use known responses within each demographic field.', ctx.margin + ctx.contentWidth, y, { align: 'right' });
  y += 19;

  const dimensions = profile.dimensions.slice(0, 8);
  const columnGap = 14;
  const blockWidth = (ctx.contentWidth - columnGap) / 2;
  const blockHeight = 74;
  const palette = [REPORT_BLUE, REPORT_LEAF, REPORT_ORANGE, REPORT_FOREST];
  if (!dimensions.length) {
    panel(ctx, ctx.margin, y, ctx.contentWidth, 252, { fill: WHITE, border: REPORT_LINE });
    setDisplayText(ctx.doc, REPORT_FOREST, 18, 'bold');
    ctx.doc.text('Respondent profiles were not attached', ctx.margin + 18, y + 43);
    paragraph(ctx.doc, 'The report can describe the number of responses, but it cannot assess who participated or whether the panel aligns with the intended consumer. Attach completed respondent profiles and regenerate this report.', ctx.margin + 18, y + 75, ctx.contentWidth - 36, { color: REPORT_INK, size: 9.2, lineHeight: 13 });
    y += 270;
  } else {
    dimensions.forEach((dimension, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = ctx.margin + column * (blockWidth + columnGap);
      const blockY = y + row * (blockHeight + 10);
      panel(ctx, x, blockY, blockWidth, blockHeight, { fill: index % 4 < 2 ? WHITE : lighten(REPORT_BLUE, 0.965), border: REPORT_LINE });
      setText(ctx.doc, REPORT_FOREST, 7.1, 'bold');
      ctx.doc.text(dimension.label.toUpperCase(), x + 12, blockY + 18);
      setText(ctx.doc, REPORT_MUTED, 6.3);
      ctx.doc.text(`known n=${dimension.knownCount}`, x + blockWidth - 12, blockY + 18, { align: 'right' });
      const barX = x + 12;
      const barY = blockY + 29;
      const barWidth = blockWidth - 24;
      ctx.doc.setFillColor(...REPORT_LINE);
      ctx.doc.rect(barX, barY, barWidth, 7, 'F');
      let offset = 0;
      dimension.groups.slice(0, 4).forEach((group, groupIndex) => {
        const segmentWidth = dimension.knownCount ? barWidth * group.count / dimension.knownCount : 0;
        ctx.doc.setFillColor(...palette[groupIndex]);
        ctx.doc.rect(barX + offset, barY, segmentWidth, 7, 'F');
        offset += segmentWidth;
      });
      const labels = dimension.groups.slice(0, 2).map(group => `${group.label} ${group.count} (${group.percentage.toFixed(0)}%)`);
      if (dimension.suppressedCount > 0) labels.push(`${dimension.suppressedCount} suppressed`);
      paragraph(ctx.doc, labels.join(' · ') || 'Not captured or all cells suppressed.', x + 12, blockY + 52, blockWidth - 24, { color: REPORT_INK, size: 6.7, lineHeight: 8.4 });
    });
    y += Math.ceil(dimensions.length / 2) * (blockHeight + 10) + 4;
  }

  panel(ctx, ctx.margin, y, ctx.contentWidth, 91, { fill: lighten(REPORT_ORANGE, 0.94), border: lighten(REPORT_ORANGE, 0.72) });
  field(ctx, 'Representativeness boundary', profile.samplingBoundary, ctx.margin + 15, y + 21, ctx.contentWidth * 0.59, { color: REPORT_ORANGE, valueSize: 7.8, maxLines: 5 });
  field(ctx, 'Privacy and provenance', `${profile.disclosureRule} Source: ${profile.provenance}.`, ctx.margin + ctx.contentWidth * 0.64, y + 21, ctx.contentWidth * 0.32, { color: REPORT_BLUE, valueSize: 6.9, maxLines: 6 });
}

export function renderScientificLiteraturePage(ctx: PdfContext, data: ClientReportV2Data) {
  let y = pageFrame(ctx, 6, 'Scientific literature and evidence map', 'How approved literature informs interpretation, validation design, and evidence limits.', 'Scientific context');
  const { scientific } = data;

  const half = (ctx.contentWidth - 14) / 2;
  panel(ctx, ctx.margin, y, half, 92, { fill: lighten(REPORT_BLUE, 0.92), border: lighten(REPORT_BLUE, 0.68) });
  field(ctx, 'What literature contributes', 'Mechanistic context, category benchmarks, method choices, and stronger validation design.', ctx.margin + 15, y + 23, half - 30, { color: REPORT_BLUE, valueSize: 8.4, maxLines: 4, display: true });
  panel(ctx, ctx.margin + half + 14, y, half, 92, { fill: lighten(REPORT_ORANGE, 0.93), border: lighten(REPORT_ORANGE, 0.7) });
  field(ctx, 'What literature cannot prove', 'This product\'s performance, consumer preference, demand, price acceptance, or superiority.', ctx.margin + half + 29, y + 23, half - 30, { color: REPORT_ORANGE, valueSize: 8.4, maxLines: 4, display: true });
  y += 113;

  setDisplayText(ctx.doc, REPORT_FOREST, 14, 'bold');
  ctx.doc.text('Approved source register', ctx.margin, y);
  setText(ctx.doc, REPORT_MUTED, 6.8);
  ctx.doc.text(`${scientific.sources.length} source${scientific.sources.length === 1 ? '' : 's'} attached`, ctx.margin + ctx.contentWidth, y, { align: 'right' });
  y += 18;

  if (!scientific.sources.length) {
    panel(ctx, ctx.margin, y, ctx.contentWidth, 175, { fill: WHITE, border: REPORT_LINE });
    setDisplayText(ctx.doc, REPORT_FOREST, 18, 'bold');
    ctx.doc.text('No approved literature attached', ctx.margin + 17, y + 41);
    paragraph(ctx.doc, 'The product decision remains based on project evidence. Add reviewed literature only when it improves interpretation or study design; never use an external source as substitute proof for this product.', ctx.margin + 17, y + 75, ctx.contentWidth - 34, { color: REPORT_INK, size: 9, lineHeight: 12.5 });
    y += 194;
  } else {
    scientific.sources.slice(0, 5).forEach((source, index) => {
      const rowHeight = 58;
      ctx.doc.setFillColor(...(index % 2 ? WHITE : lighten(REPORT_BLUE, 0.965)));
      ctx.doc.rect(ctx.margin, y, ctx.contentWidth, rowHeight, 'F');
      ctx.doc.setDrawColor(...REPORT_LINE);
      ctx.doc.line(ctx.margin, y + rowHeight, ctx.margin + ctx.contentWidth, y + rowHeight);
      setDisplayText(ctx.doc, REPORT_BLUE, 11, 'bold');
      ctx.doc.text(`[${source.id}]`, ctx.margin + 10, y + 20);
      setText(ctx.doc, REPORT_INK, 7.8, 'bold');
      ctx.doc.text((ctx.doc.splitTextToSize(source.title, 265) as string[]).slice(0, 2), ctx.margin + 48, y + 18, { lineHeightFactor: 1.08 });
      setText(ctx.doc, REPORT_MUTED, 5.8);
      const authorYear = [
        source.authors === 'Not captured' ? null : source.authors,
        source.year === 'Not captured' ? null : `(${source.year})`,
      ].filter(Boolean).join(' ') || 'Author and year metadata not captured';
      ctx.doc.text(`${authorYear} · ${source.doi === 'Not captured' ? 'DOI not captured' : `DOI ${source.doi}`}`, ctx.margin + 48, y + 48);
      field(ctx, 'Study type', source.studyType, ctx.margin + 330, y + 17, 90, { color: REPORT_BLUE, valueSize: 6.5, maxLines: 2 });
      field(ctx, 'Evidence role', source.evidenceRole, ctx.margin + 426, y + 17, ctx.contentWidth - 438, { color: REPORT_LEAF, valueSize: 6.3, maxLines: 3 });
      y += rowHeight;
    });
  }
  y += 17;

  setDisplayText(ctx.doc, REPORT_FOREST, 14, 'bold');
  ctx.doc.text('How the literature changes the next study', ctx.margin, y);
  y += 18;
  const guidance = scientific.guidance.slice(0, 3);
  if (!guidance.length) {
    paragraph(ctx.doc, 'No report-safe literature guidance is attached. Project evidence and named validation gaps remain the sole basis for the action plan.', ctx.margin, y + 5, ctx.contentWidth, { color: REPORT_INK, size: 8.5, lineHeight: 11.5 });
  } else {
    guidance.forEach((item, index) => {
      const rowY = y + index * 58;
      setDisplayText(ctx.doc, REPORT_ORANGE, 13, 'bold');
      ctx.doc.text(String(index + 1).padStart(2, '0'), ctx.margin, rowY + 11);
      setText(ctx.doc, REPORT_INK, 8.2, 'bold');
      ctx.doc.text(item.title, ctx.margin + 40, rowY + 10);
      paragraph(ctx.doc, item.guidance, ctx.margin + 40, rowY + 28, ctx.contentWidth - 85, { color: REPORT_INK, size: 7.5, lineHeight: 9.4 });
      setText(ctx.doc, REPORT_BLUE, 6.4, 'bold');
      ctx.doc.text(item.citationIds.map(id => `[${id}]`).join(' '), ctx.margin + ctx.contentWidth, rowY + 10, { align: 'right' });
    });
  }
}

function actionLabel(index: number) {
  return ['PROTECT', 'IMPROVE', 'VALIDATE'][index] ?? `ACTION ${index + 1}`;
}

export function renderActionPlanPage(ctx: PdfContext, data: ClientReportV2Data) {
  let y = pageFrame(ctx, 7, 'Recommended action plan', 'Three controlled workstreams convert the product decision into release-ready evidence.', 'Execution');
  const { plan, risks } = data;
  const tones = [REPORT_LEAF, REPORT_ORANGE, REPORT_BLUE];
  const rowHeight = 150;
  plan.rows.slice(0, 3).forEach((row, index) => {
    const tone = tones[index];
    const centerX = ctx.margin + 24;
    if (index < 2) {
      ctx.doc.setDrawColor(...REPORT_LINE);
      ctx.doc.setLineWidth(1.2);
      ctx.doc.line(centerX, y + 28, centerX, y + rowHeight + 14);
    }
    ctx.doc.setFillColor(...tone);
    ctx.doc.circle(centerX, y + 24, 15, 'F');
    setDisplayText(ctx.doc, WHITE, 13, 'bold');
    ctx.doc.text(String(index + 1), centerX, y + 29, { align: 'center' });

    const contentX = ctx.margin + 54;
    setText(ctx.doc, tone, 6.8, 'bold');
    ctx.doc.text(actionLabel(index), contentX, y + 9);
    setDisplayText(ctx.doc, REPORT_FOREST, 14, 'bold');
    ctx.doc.text((ctx.doc.splitTextToSize(row.workstream, ctx.contentWidth - 70) as string[]).slice(0, 2), contentX, y + 31, { lineHeightFactor: 1.06 });
    ctx.doc.setDrawColor(...tone);
    ctx.doc.setLineWidth(1.6);
    ctx.doc.line(contentX, y + 59, ctx.margin + ctx.contentWidth, y + 59);

    const colWidth = (ctx.contentWidth - 76) / 3;
    field(ctx, 'Why / protocol', `${row.rationale} ${row.protocol}`, contentX, y + 78, colWidth, { valueSize: 7.3, maxLines: 6, color: tone });
    field(ctx, 'Passing evidence', `${row.completionEvidence} Pass: ${row.passingCriteria}`, contentX + colWidth + 12, y + 78, colWidth, { valueSize: 7.3, maxLines: 6, color: tone });
    field(ctx, 'Owner / gate', `Owner: ${row.owner}. Timing: ${row.timing}. Next gate: ${row.nextGate}.`, contentX + (colWidth + 12) * 2, y + 78, colWidth, { valueSize: 7.3, maxLines: 6, color: tone });
    y += rowHeight;
  });

  panel(ctx, ctx.margin, y + 6, ctx.contentWidth, 114, { fill: REPORT_FOREST, border: REPORT_FOREST });
  field(ctx, 'Next decision gate', plan.decisionGate, ctx.margin + 17, y + 30, ctx.contentWidth * 0.54, { color: REPORT_ORANGE, valueColor: WHITE, valueSize: 8.5, maxLines: 5, display: true });
  const leadRisk = risks.rows[0];
  field(ctx, 'Lead controlled risk', leadRisk ? `${leadRisk.risk} Control: ${leadRisk.mitigation}` : risks.claimsNote, ctx.margin + ctx.contentWidth * 0.6, y + 30, ctx.contentWidth * 0.36, { color: lighten(REPORT_FOREST, 0.58), valueColor: WHITE, valueSize: 7.5, maxLines: 6 });
}

export function renderEvidenceReleasePage(ctx: PdfContext, data: ClientReportV2Data) {
  let y = pageFrame(ctx, 8, 'Evidence and release record', 'Every material statement is bounded by its project evidence, limitations, approved literature, and release status.', 'Governance');
  const { claims, scientific, basis, appendix } = data;

  setDisplayText(ctx.doc, REPORT_FOREST, 13, 'bold');
  ctx.doc.text('Claim-to-evidence register', ctx.margin, y);
  y += 19;
  const claimWidth = 150;
  const evidenceWidth = 163;
  setText(ctx.doc, WHITE, 6.4, 'bold');
  ctx.doc.setFillColor(...REPORT_FOREST);
  ctx.doc.rect(ctx.margin, y, ctx.contentWidth, 25, 'F');
  ctx.doc.text('CLAIM / STATUS', ctx.margin + 10, y + 16);
  ctx.doc.text('EVIDENCE', ctx.margin + claimWidth + 12, y + 16);
  ctx.doc.text('PERMITTED WORDING / REQUIREMENT', ctx.margin + claimWidth + evidenceWidth + 18, y + 16);
  y += 25;

  claims.rows.slice(0, 5).forEach((row, index) => {
    const rowHeight = 61;
    ctx.doc.setFillColor(...(index % 2 ? WHITE : lighten(REPORT_FOREST, 0.965)));
    ctx.doc.rect(ctx.margin, y, ctx.contentWidth, rowHeight, 'F');
    ctx.doc.setDrawColor(...REPORT_LINE);
    ctx.doc.line(ctx.margin, y + rowHeight, ctx.margin + ctx.contentWidth, y + rowHeight);
    const evidenceId = `E${index + 1}`;
    setText(ctx.doc, statusTone(row.status), 6.5, 'bold');
    ctx.doc.text(`${evidenceId} / ${row.status.toUpperCase()}`, ctx.margin + 10, y + 14);
    setText(ctx.doc, REPORT_INK, 7.8, 'bold');
    ctx.doc.text((ctx.doc.splitTextToSize(row.claim, claimWidth - 15) as string[]).slice(0, 2), ctx.margin + 10, y + 31, { lineHeightFactor: 1.08 });
    setText(ctx.doc, REPORT_MUTED, 5.5, 'bold');
    ctx.doc.text(row.scope.toUpperCase(), ctx.margin + 10, y + 54);
    paragraph(ctx.doc, row.evidence, ctx.margin + claimWidth + 12, y + 16, evidenceWidth - 12, { color: REPORT_INK, size: 6.7, lineHeight: 8.2 });
    paragraph(ctx.doc, `${row.permittedWording} Requirement: ${row.requirement}`, ctx.margin + claimWidth + evidenceWidth + 18, y + 16, ctx.contentWidth - claimWidth - evidenceWidth - 28, { color: REPORT_INK, size: 6.5, lineHeight: 8.1 });
    y += rowHeight;
  });
  y += 17;

  const leftWidth = (ctx.contentWidth - 14) * 0.54;
  const rightWidth = ctx.contentWidth - leftWidth - 14;
  panel(ctx, ctx.margin, y, leftWidth, 145, { fill: lighten(REPORT_BLUE, 0.94), border: lighten(REPORT_BLUE, 0.72) });
  field(ctx, 'Approved literature guidance', scientific.sources.length ? 'References used for context and study design' : 'No approved references attached', ctx.margin + 14, y + 21, leftWidth - 28, { color: REPORT_BLUE, valueSize: 8.3, maxLines: 2, display: true });
  let referenceY = y + 60;
  scientific.sources.slice(0, 3).forEach(source => {
    const capturedAuthors = source.authors && source.authors !== 'Not captured' ? `${source.authors} ` : '';
    const capturedYear = source.year && source.year !== 'Not captured' ? `(${source.year}). ` : '';
    const capturedDoi = source.doi && source.doi !== 'Not captured' ? `. DOI ${source.doi}` : '. DOI not captured';
    const reference = `[${source.id}] ${capturedAuthors}${capturedYear}${source.title}${capturedDoi}`;
    referenceY = bullet(ctx, reference, ctx.margin + 14, referenceY, leftWidth - 28, REPORT_BLUE) + 5;
  });
  if (!scientific.sources.length) paragraph(ctx.doc, 'Literature cannot substitute for project-specific product or consumer evidence.', ctx.margin + 14, referenceY, leftWidth - 28, { color: REPORT_INK, size: 7.7 });

  const rightX = ctx.margin + leftWidth + 14;
  panel(ctx, rightX, y, rightWidth, 145, { fill: lighten(REPORT_ORANGE, 0.93), border: lighten(REPORT_ORANGE, 0.72) });
  field(ctx, 'Material limitations', basis.limitations.length ? basis.limitations.join(' ') : 'No material limitations recorded.', rightX + 14, y + 21, rightWidth - 28, { color: REPORT_ORANGE, valueSize: 7.2, maxLines: 7 });
  field(ctx, 'Evidence populations', basis.populations.map(item => `${item.label}: ${item.value} (${item.provenance}).`).join(' '), rightX + 14, y + 93, rightWidth - 28, { color: REPORT_ORANGE, valueSize: 6.4, maxLines: 5 });
  y += 160;

  panel(ctx, ctx.margin, y, ctx.contentWidth, 81, { fill: REPORT_FOREST, border: REPORT_FOREST });
  field(ctx, `Release decision / ${claims.reportStatus}`, claims.releaseDecision, ctx.margin + 15, y + 22, ctx.contentWidth - 30, { color: REPORT_ORANGE, valueColor: WHITE, valueSize: 8, maxLines: 4, display: true });
  setText(ctx.doc, lighten(REPORT_FOREST, 0.62), 6.4);
  ctx.doc.text(`Evidence register version ${data.cover.version} · ${appendix.approvalNote}`, ctx.margin + 15, y + 67);
}
