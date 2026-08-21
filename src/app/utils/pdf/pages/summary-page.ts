import { formatDecisionDimension, getDecisionQualifier, getEvidenceStrength } from '../../../lib/commercialization-report';
import { renderBarChart } from '../charts';
import {
  AMBER,
  GREEN,
  ROSE,
  SLATE_50,
  SLATE_200,
  SLATE_500,
  SLATE_700,
  SLATE_950,
  WHITE,
  lighten,
  paragraph,
  setDisplayText,
  setText,
  type AutoTableFn,
  type PdfContext,
  type Rgb,
} from '../theme';
import {
  buildCommercializationPlan,
  buildRisks,
  type CommercializationReportPdfInput,
} from '../sections';

export interface FinalSummaryData {
  decision: string;
  conditional: boolean;
  caveatLine: string;
  decisionStatement: string;
  issfScore: number;
  confidence: number;
  evidenceStrength: string;
  responseCount: number;
  dimensions: Array<{ label: string; value: number }>;
  coreStrength: string;
  watchPoint: string;
  nextAction: string;
  priorities: Array<{
    priority: string;
    action: string;
    owner: string;
    gate: string;
  }>;
}

function topDimension(input: CommercializationReportPdfInput) {
  return Object.entries(input.snapshot.decision.dimensions)
    .sort(([, left], [, right]) => Number(right) - Number(left))[0];
}

function weakestDimension(input: CommercializationReportPdfInput) {
  return Object.entries(input.snapshot.decision.dimensions)
    .sort(([, left], [, right]) => Number(left) - Number(right))[0];
}

function decisionColor(decision: string): Rgb {
  if (decision === 'GO') return GREEN;
  if (decision === 'STOP') return ROSE;
  return AMBER;
}

export function buildFinalSummary(input: CommercializationReportPdfInput): FinalSummaryData {
  const { snapshot } = input;
  const [strengthKey, strengthScore] = topDimension(input);
  const [watchKey, watchScore] = weakestDimension(input);
  const plan = buildCommercializationPlan(input);
  const risks = buildRisks(input);
  const riskOwners = ['R&D', 'Design', 'Legal'];

  const qualifier = getDecisionQualifier(snapshot);

  return {
    decision: snapshot.decision.outcome,
    conditional: qualifier.conditional,
    caveatLine: qualifier.caveatLine,
    decisionStatement: snapshot.narrative.launchRecommendation,
    issfScore: snapshot.decision.issfScore,
    confidence: snapshot.decision.confidence,
    evidenceStrength: getEvidenceStrength(snapshot.evidence.responseCount, snapshot.evidence.provenance),
    responseCount: snapshot.evidence.responseCount,
    dimensions: Object.entries(snapshot.decision.dimensions).map(([key, value]) => ({
      label: formatDecisionDimension(key as keyof typeof snapshot.decision.dimensions),
      value: Number(value),
    })),
    coreStrength: `${formatDecisionDimension(strengthKey as keyof typeof snapshot.decision.dimensions)} leads at ${Number(strengthScore).toFixed(0)}/100.`,
    watchPoint: `${formatDecisionDimension(watchKey as keyof typeof snapshot.decision.dimensions)} is lowest at ${Number(watchScore).toFixed(0)}/100. ${risks.rows[0]?.mitigation ?? ''}`.trim(),
    nextAction: plan.decisionGate,
    priorities: risks.rows.slice(0, 3).map((row, index) => ({
      priority: row.category,
      action: row.mitigation,
      owner: riskOwners[index] ?? 'Project lead',
      gate: row.nextGate,
    })),
  };
}

function summaryHeading(ctx: PdfContext) {
  const { doc, width, margin, contentWidth, primary, accent } = ctx;
  setDisplayText(doc, lighten(accent, 0.84), 46, 'bold');
  doc.text('09', width - margin, 92, { align: 'right' });
  setText(doc, accent, 8, 'bold');
  doc.text('FINAL PAGE · DECISION DASHBOARD', margin, 68);
  setDisplayText(doc, primary, 24, 'bold');
  doc.text('Report at a Glance', margin, 99);
  const bottom = paragraph(
    doc,
    'The decision, supporting evidence, main watch point, and immediate work required before the next gate.',
    margin,
    122,
    Math.min(contentWidth, 440),
    { color: SLATE_500, size: 9, lineHeight: 13 },
  );
  doc.setDrawColor(...accent);
  doc.setLineWidth(3);
  doc.line(margin, bottom + 8, margin + 58, bottom + 8);
  doc.setDrawColor(...SLATE_200);
  doc.setLineWidth(0.6);
  doc.line(margin + 66, bottom + 8, width - margin, bottom + 8);
  return bottom + 30;
}

export function renderFinalSummaryPage(
  ctx: PdfContext,
  data: FinalSummaryData,
  autoTable: AutoTableFn,
) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = summaryHeading(ctx);
  // A conditional GO renders amber, not green — the badge must not signal more
  // confidence than the evidence supports.
  const decision = data.conditional ? AMBER : decisionColor(data.decision);

  doc.setFillColor(...primary);
  doc.roundedRect(margin, y, contentWidth, 92, 10, 10, 'F');
  doc.setFillColor(...decision);
  doc.roundedRect(margin + 16, y + 17, 72, 30, 15, 15, 'F');
  setText(doc, WHITE, 12, 'bold');
  doc.text(data.decision, margin + 52, y + 37, { align: 'center' });
  setText(doc, lighten(primary, 0.72), 7, 'bold');
  doc.text('COMMERCIAL DECISION', margin + 104, y + 25);
  paragraph(doc, data.decisionStatement, margin + 104, y + 43, contentWidth - 122, {
    color: WHITE,
    size: 11,
    weight: 'bold',
    lineHeight: 15,
  });
  y += 108;

  // Conditional caveat sits directly beneath the banner, in amber, so it can't be
  // missed the way a buried watch point can.
  if (data.caveatLine) {
    setText(doc, AMBER, 8, 'bold');
    const caveatBottom = paragraph(doc, data.caveatLine, margin, y, contentWidth, {
      color: AMBER,
      size: 8,
      weight: 'bold',
      lineHeight: 11,
    });
    y = caveatBottom + 12;
  }

  const metricWidth = (contentWidth - 20) / 3;
  [
    ['ISSF score', data.issfScore.toFixed(1)],
    ['Evidence strength', `${data.confidence.toFixed(0)}/100`],
    ['Concept evidence', `${data.evidenceStrength} · n=${data.responseCount}`],
  ].forEach(([label, value], index) => {
    const x = margin + index * (metricWidth + 10);
    doc.setFillColor(...SLATE_50);
    doc.setDrawColor(...SLATE_200);
    doc.roundedRect(x, y, metricWidth, 58, 8, 8, 'FD');
    setText(doc, SLATE_500, 6.8, 'bold');
    doc.text(label.toUpperCase(), x + 12, y + 18);
    setDisplayText(doc, SLATE_950, index === 2 ? 13 : 18, 'bold');
    doc.text(value, x + 12, y + 42);
  });
  y += 82;

  setDisplayText(doc, SLATE_950, 13, 'bold');
  doc.text('Evidence snapshot', margin, y);
  y = renderBarChart(
    ctx,
    data.dimensions.map(dimension => ({
      label: dimension.label,
      value: dimension.value,
      valueLabel: `${dimension.value.toFixed(0)}/100`,
    })),
    margin,
    y + 18,
    contentWidth,
  ) + 5;

  const halfWidth = (contentWidth - 12) / 2;
  [
    ['CORE STRENGTH', data.coreStrength],
    ['MAIN WATCH POINT', data.watchPoint],
  ].forEach(([label, value], index) => {
    const x = margin + index * (halfWidth + 12);
    doc.setFillColor(...SLATE_50);
    doc.setDrawColor(...SLATE_200);
    doc.roundedRect(x, y, halfWidth, 70, 8, 8, 'FD');
    setText(doc, index === 0 ? accent : AMBER, 6.8, 'bold');
    doc.text(label, x + 12, y + 18);
    paragraph(doc, value, x + 12, y + 36, halfWidth - 24, {
      color: SLATE_700,
      size: 8,
      weight: 'bold',
      lineHeight: 11,
    });
  });
  y += 86;

  setDisplayText(doc, SLATE_950, 13, 'bold');
  doc.text('Immediate priorities', margin, y);
  autoTable(doc, {
    startY: y + 12,
    head: [['Priority / risk', 'Required action', 'Owner', 'Gate']],
    body: data.priorities.map(priority => [
      priority.priority,
      priority.action,
      priority.owner,
      priority.gate,
    ]),
    theme: 'plain',
    margin: { left: margin, right: margin },
    headStyles: { fillColor: primary, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
    bodyStyles: { textColor: SLATE_700, fontSize: 7.1, cellPadding: 5, valign: 'top' },
    alternateRowStyles: { fillColor: SLATE_50 },
    styles: { lineColor: SLATE_200, lineWidth: 0.35, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 88, fontStyle: 'bold', textColor: SLATE_950 },
      1: { cellWidth: 250 },
      2: { cellWidth: 80, fontStyle: 'bold', textColor: accent },
      3: { cellWidth: contentWidth - 418, fontStyle: 'bold' },
    },
  });

  doc.setFillColor(...accent);
  doc.roundedRect(margin, 716, contentWidth, 66, 8, 8, 'F');
  setText(doc, WHITE, 7, 'bold');
  doc.text('NEXT GATE', margin + 14, 736);
  paragraph(doc, data.nextAction, margin + 14, 755, contentWidth - 28, {
    color: WHITE,
    size: 8.7,
    weight: 'bold',
    lineHeight: 12,
  });
}
