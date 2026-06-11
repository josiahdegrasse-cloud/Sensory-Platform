import {
  formatDecisionDimension,
  getEvidenceStrength,
  getEvidenceStrengthNote,
  type CommercializationReportSnapshot,
} from '../lib/commercialization-report';

type PdfDocument = import('jspdf').jsPDF;
type Rgb = [number, number, number];

const SLATE_950: Rgb = [15, 23, 42];
const SLATE_700: Rgb = [51, 65, 85];
const SLATE_500: Rgb = [100, 116, 139];
const SLATE_200: Rgb = [226, 232, 240];
const SLATE_50: Rgb = [248, 250, 252];
const WHITE: Rgb = [255, 255, 255];
const GREEN: Rgb = [5, 150, 105];
const AMBER: Rgb = [180, 83, 9];

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bv(\d+)\.0\b/gi, 'v$1')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Builds a clean, descriptive PDF filename, e.g.
 * `new-food-innovation-coconut-cheddar-v3-commercialization-report-go-2026-06-11.pdf`.
 * Falls back to "food-platform" when no client/organization name is available.
 */
export function buildCommercializationReportFilename(input: {
  clientName?: string | null;
  productName: string;
  decision?: string | null;
  generatedAt: string | Date;
  version?: number;
}) {
  const generatedAt = input.generatedAt instanceof Date ? input.generatedAt : new Date(input.generatedAt);
  const date = Number.isNaN(generatedAt.getTime())
    ? new Date().toISOString().slice(0, 10)
    : generatedAt.toISOString().slice(0, 10);
  const client = slugify(input.clientName || '') || 'food-platform';
  const product = slugify(input.productName) || 'product';
  const parts = [client, product, 'commercialization-report'];
  if (input.decision) parts.push(slugify(input.decision));
  parts.push(date);
  if (input.version && input.version > 1) parts.push(`r${input.version}`);
  return `${parts.join('-')}.pdf`;
}

async function imageDataUrl(url: string) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imageFormat(dataUrl: string) {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
}

function hexToRgb(hex?: string | null): Rgb | null {
  if (!hex) return null;
  const normalized = hex.trim().replace(/^#/, '');
  const full = normalized.length === 3
    ? normalized.split('').map(character => character + character).join('')
    : normalized;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function setText(doc: PdfDocument, color: Rgb, size: number, weight: 'normal' | 'bold' = 'normal') {
  doc.setTextColor(...color);
  doc.setFont('helvetica', weight);
  doc.setFontSize(size);
}

function paragraph(doc: PdfDocument, text: string, x: number, y: number, maxWidth: number, options?: {
  color?: Rgb;
  size?: number;
  weight?: 'normal' | 'bold';
  lineHeight?: number;
}) {
  const size = options?.size ?? 10;
  const lineHeight = options?.lineHeight ?? size * 1.35;
  setText(doc, options?.color ?? SLATE_700, size, options?.weight);
  const lines = doc.splitTextToSize(text || 'Not available.', maxWidth) as string[];
  doc.text(lines, x, y, { lineHeightFactor: lineHeight / size });
  return y + lines.length * lineHeight;
}

function sectionTitle(doc: PdfDocument, title: string, y: number, accent: Rgb) {
  doc.setFillColor(...accent);
  doc.roundedRect(40, y - 13, 5, 22, 2, 2, 'F');
  setText(doc, SLATE_950, 16, 'bold');
  doc.text(title, 56, y + 3);
  return y + 24;
}

function labelValue(doc: PdfDocument, label: string, value: string, x: number, y: number, width: number) {
  doc.setFillColor(...SLATE_50);
  doc.setDrawColor(...SLATE_200);
  doc.roundedRect(x, y, width, 54, 6, 6, 'FD');
  setText(doc, SLATE_500, 7.5, 'bold');
  doc.text(label.toUpperCase(), x + 10, y + 16);
  setText(doc, SLATE_950, 12, 'bold');
  const lines = doc.splitTextToSize(value, width - 20) as string[];
  doc.text(lines.slice(0, 2), x + 10, y + 35);
}

function bulletList(doc: PdfDocument, items: string[], x: number, y: number, maxWidth: number, accent: Rgb) {
  let nextY = y;
  items.filter(Boolean).forEach(item => {
    doc.setFillColor(...accent);
    doc.circle(x + 3, nextY - 3, 2.2, 'F');
    nextY = paragraph(doc, item, x + 13, nextY, maxWidth - 13, { size: 9.5, lineHeight: 13 }) + 7;
  });
  return nextY;
}

function pageHeader(doc: PdfDocument, organizationName: string, productName: string, accent: Rgb) {
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(...accent);
  doc.rect(0, 0, width, 5, 'F');
  setText(doc, SLATE_500, 8, 'bold');
  doc.text(organizationName, 40, 25);
  setText(doc, SLATE_500, 8);
  doc.text(productName, width - 40, 25, { align: 'right' });
}

function addContentPage(doc: PdfDocument, organizationName: string, productName: string, accent: Rgb) {
  doc.addPage();
  pageHeader(doc, organizationName, productName, accent);
  return 58;
}

function evidenceRisks(snapshot: CommercializationReportSnapshot) {
  const count = snapshot.evidence.responseCount;
  const risks = [
    count < 30 ? {
      risk: count === 0 ? 'No concept validation' : 'Limited concept panel',
      why: getEvidenceStrengthNote(count),
      mitigation: 'Collect a broader, appropriately targeted response set before making representative consumer claims.',
    } : null,
    snapshot.evidence.purchaseIntent !== null && count < 30 ? {
      risk: 'Purchase intent may be overstated',
      why: `The ${snapshot.evidence.purchaseIntent.toFixed(1)} purchase-intent result is based on only ${count} response${count === 1 ? '' : 's'}.`,
      mitigation: 'Present the result as directional and repeat the measure with a larger panel.',
    } : null,
    !snapshot.concept.packagingImageUrl ? {
      risk: 'Packaging direction is incomplete',
      why: 'No selected packaging visual is stored with this report.',
      mitigation: 'Select and approve a packaging direction before buyer-facing distribution.',
    } : null,
    {
      risk: 'Claims require review',
      why: 'Sensory and concept findings do not independently substantiate broad health, nutrition, or market claims.',
      mitigation: 'Complete legal and commercial review for every external-facing claim.',
    },
  ];
  return risks.filter((risk): risk is NonNullable<typeof risk> => Boolean(risk));
}

export interface CommercializationReportPdfInput {
  snapshot: CommercializationReportSnapshot;
  organizationName: string;
  workspaceName: string;
  reportFooter?: string;
  version: number;
  status: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
}

export async function buildCommercializationReportPdf(input: CommercializationReportPdfInput) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = width - margin * 2;
  const primary = hexToRgb(input.primaryColor) ?? SLATE_950;
  const accent = hexToRgb(input.accentColor) ?? [37, 99, 235];
  const generatedDate = new Date(input.snapshot.generatedAt);
  const generatedLabel = Number.isNaN(generatedDate.getTime())
    ? 'Date not available'
    : generatedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const strength = getEvidenceStrength(input.snapshot.evidence.responseCount);
  const strengthColor = strength === 'Established' ? GREEN : strength === 'Limited' ? AMBER : accent;
  const [packaging, logo] = await Promise.all([
    imageDataUrl(input.snapshot.concept.packagingImageUrl),
    imageDataUrl(input.logoUrl ?? ''),
  ]);

  // Cover
  doc.setFillColor(...primary);
  doc.rect(0, 0, width, 270, 'F');
  doc.setFillColor(...accent);
  doc.rect(0, 270, width, 8, 'F');
  let titleX = margin;
  if (logo) {
    doc.addImage(logo, imageFormat(logo), margin, 38, 48, 48, undefined, 'FAST');
    titleX = 104;
  }
  setText(doc, WHITE, 11, 'bold');
  doc.text(input.organizationName || 'Food Platform', titleX, 54);
  setText(doc, WHITE, 30, 'bold');
  doc.text('Commercialization', margin, 132);
  doc.text('Report', margin, 166);
  setText(doc, WHITE, 17);
  doc.text(input.snapshot.product.sampleName, margin, 205);
  setText(doc, [203, 213, 225], 10);
  doc.text(`${input.snapshot.product.foodType} | ${input.workspaceName}`, margin, 231);

  doc.setFillColor(...GREEN);
  doc.roundedRect(margin, 309, 68, 30, 6, 6, 'F');
  setText(doc, WHITE, 12, 'bold');
  doc.text(input.snapshot.decision.outcome, margin + 34, 329, { align: 'center' });
  doc.setFillColor(...strengthColor);
  doc.roundedRect(118, 309, 126, 30, 6, 6, 'F');
  setText(doc, WHITE, 10, 'bold');
  doc.text(`${strength} evidence`, 181, 329, { align: 'center' });

  setText(doc, SLATE_500, 8, 'bold');
  doc.text('RECOMMENDED PATH', margin, 384);
  paragraph(doc, input.snapshot.narrative.launchRecommendation, margin, 411, packaging ? 300 : contentWidth, {
    color: SLATE_950,
    size: 14,
    weight: 'bold',
    lineHeight: 19,
  });
  if (packaging) {
    doc.setFillColor(...SLATE_50);
    doc.roundedRect(width - 202, 307, 162, 196, 8, 8, 'F');
    doc.addImage(packaging, imageFormat(packaging), width - 190, 319, 138, 138, undefined, 'FAST');
    setText(doc, SLATE_500, 7.5, 'bold');
    doc.text('SELECTED PACKAGING DIRECTION', width - 121, 478, { align: 'center' });
  }
  doc.setDrawColor(...SLATE_200);
  doc.line(margin, 535, width - margin, 535);
  const coverTileWidth = (contentWidth - 24) / 4;
  labelValue(doc, 'Generated', generatedLabel, margin, 558, coverTileWidth);
  labelValue(doc, 'Report status', input.status.toUpperCase(), margin + coverTileWidth + 8, 558, coverTileWidth);
  labelValue(doc, 'Report version', String(input.version), margin + (coverTileWidth + 8) * 2, 558, coverTileWidth);
  labelValue(doc, 'Decision record', 'Saved and traceable', margin + (coverTileWidth + 8) * 3, 558, coverTileWidth);
  doc.setFillColor(...SLATE_50);
  doc.roundedRect(margin, 640, contentWidth, 92, 8, 8, 'F');
  setText(doc, strengthColor, 9, 'bold');
  doc.text('EVIDENCE STRENGTH NOTE', margin + 14, 663);
  paragraph(doc, getEvidenceStrengthNote(input.snapshot.evidence.responseCount), margin + 14, 685, contentWidth - 28, {
    color: SLATE_700,
    size: 10,
    lineHeight: 14,
  });

  // Executive summary and trust
  let y = addContentPage(doc, input.organizationName, input.snapshot.product.sampleName, accent);
  y = sectionTitle(doc, 'Executive Summary', y, accent);
  y = paragraph(doc, input.snapshot.narrative.executiveSummary, margin, y, contentWidth, {
    color: SLATE_950,
    size: 12,
    lineHeight: 17,
  }) + 18;
  const summaryBullets = [
    `Product tested: ${input.snapshot.product.sampleName} in the ${input.snapshot.product.foodType} category.`,
    `Evidence collected: saved sensory decision evidence and ${input.snapshot.evidence.responseCount} concept response${input.snapshot.evidence.responseCount === 1 ? '' : 's'}.`,
    `Decision result: ${input.snapshot.decision.outcome}, with an ISSF score of ${input.snapshot.decision.issfScore.toFixed(1)}.`,
    `Current concept direction: ${input.snapshot.concept.name}${input.snapshot.concept.targetMarket ? ` for ${input.snapshot.concept.targetMarket}` : ''}.`,
    `Recommended next step: ${input.snapshot.evidence.responseCount < 30 ? 'continue buyer preparation while collecting broader concept validation.' : 'advance buyer review with claims and packaging approval.'}`,
  ];
  y = bulletList(doc, summaryBullets, margin, y, contentWidth, accent) + 8;
  y = sectionTitle(doc, 'Product Snapshot', y, accent);
  const tileWidth = (contentWidth - 16) / 3;
  [
    ['Product', input.snapshot.product.sampleName],
    ['Category', input.snapshot.product.foodType],
    ['Decision', input.snapshot.decision.outcome],
    ['ISSF score', input.snapshot.decision.issfScore.toFixed(1)],
    ['Concept responses', String(input.snapshot.evidence.responseCount)],
    ['Evidence strength', strength],
  ].forEach(([label, value], index) => {
    labelValue(doc, label, value, margin + (index % 3) * (tileWidth + 8), y + Math.floor(index / 3) * 62, tileWidth);
  });
  y += 142;
  y = sectionTitle(doc, 'Evidence Strength & Data Provenance', y, accent);
  autoTable(doc, {
    startY: y,
    head: [['Evidence source', 'Status', 'Client-facing interpretation']],
    body: [
      ['Sensory decision evidence', 'Saved decision record', 'Deterministic ISSF dimensions and recommendation are tied to the saved product decision.'],
      ['Concept panel data', input.snapshot.evidence.responseCount > 0 ? `Live responses (n=${input.snapshot.evidence.responseCount})` : 'Not available', getEvidenceStrengthNote(input.snapshot.evidence.responseCount)],
      ['Instrumental data', 'Not itemized in snapshot', 'Do not imply specific machine findings unless they are linked and shown in the source project.'],
      ['Reference/demo data', 'Not identified in snapshot', 'Any reference data must be labeled before client distribution.'],
      ['Generated narrative', 'Generated draft', 'Narrative explains saved evidence; it does not determine the GO decision.'],
      ['Administrative approval', input.status === 'approved' ? 'Approved' : 'Not approved', input.status === 'approved' ? 'This report version has been approved.' : 'Treat this report as a working draft or review copy.'],
    ],
    headStyles: { fillColor: primary, textColor: WHITE },
    bodyStyles: { textColor: SLATE_700 },
    alternateRowStyles: { fillColor: SLATE_50 },
    styles: { fontSize: 8, cellPadding: 5, lineColor: SLATE_200, lineWidth: 0.4 },
    columnStyles: { 0: { cellWidth: 105 }, 1: { cellWidth: 100 } },
  });

  // Product evidence and decision rationale
  y = addContentPage(doc, input.organizationName, input.snapshot.product.sampleName, accent);
  y = sectionTitle(doc, 'Sensory & Instrumental Evidence', y, accent);
  paragraph(doc, 'The saved decision record summarizes sensory performance across four client-facing dimensions. Scores describe the tested product evidence; they are not consumer market-share estimates.', margin, y, contentWidth, { size: 9.5, lineHeight: 13 });
  y += 46;
  autoTable(doc, {
    startY: y,
    head: [['Evidence dimension', 'Score', 'Plain-English interpretation']],
    body: Object.entries(input.snapshot.decision.dimensions).map(([dimension, score]) => [
      formatDecisionDimension(dimension as keyof typeof input.snapshot.decision.dimensions),
      Number(score).toFixed(0),
      Number(score) >= 75 ? 'Current evidence indicates a relative strength.' : Number(score) >= 60 ? 'Current evidence is acceptable, with room to strengthen.' : 'This area should be reviewed before broader commercialization claims.',
    ]),
    headStyles: { fillColor: primary, textColor: WHITE },
    alternateRowStyles: { fillColor: SLATE_50 },
    styles: { fontSize: 9, cellPadding: 7, textColor: SLATE_700, lineColor: SLATE_200, lineWidth: 0.4 },
    columnStyles: { 0: { cellWidth: 205 }, 1: { cellWidth: 55, halign: 'center' } },
  });
  y = ((doc as PdfDocument & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 150) + 24;
  setText(doc, SLATE_950, 11, 'bold');
  doc.text('Key strengths', margin, y);
  y = paragraph(doc, input.snapshot.narrative.whyLiked, margin, y + 19, contentWidth, { size: 9.5, lineHeight: 13 }) + 12;
  setText(doc, SLATE_950, 11, 'bold');
  doc.text('Formulation watch points', margin, y);
  y = input.snapshot.decision.prescriptions.length > 0
    ? bulletList(
        doc,
        input.snapshot.decision.prescriptions.slice(0, 3).map(item => `${item.target}: ${item.action}`),
        margin,
        y + 20,
        contentWidth,
        accent,
      ) + 5
    : paragraph(doc, 'No specific formulation watch points are stored in this report version. Review the source decision record before final handoff.', margin, y + 19, contentWidth, { size: 9.5, lineHeight: 13 }) + 12;
  setText(doc, SLATE_950, 11, 'bold');
  doc.text('Instrumental evidence', margin, y);
  y = paragraph(doc, 'Specific instrumental or machine measurements are not itemized in this saved report snapshot. Review the linked project data before stating instrumental alignment or making measurement-specific claims.', margin, y + 19, contentWidth, { size: 9.5, lineHeight: 13 }) + 20;
  y = sectionTitle(doc, 'Decision Rationale', y, accent);
  labelValue(doc, 'Decision', input.snapshot.decision.outcome, margin, y, 112);
  labelValue(doc, 'ISSF score', input.snapshot.decision.issfScore.toFixed(1), 160, y, 112);
  labelValue(doc, 'Model confidence', `${input.snapshot.decision.confidence.toFixed(0)}%`, 280, y, 132);
  labelValue(doc, 'Evidence strength', strength, 420, y, 135);
  y += 74;
  y = paragraph(doc, input.snapshot.decision.recommendation, margin, y, contentWidth, { color: SLATE_950, size: 11, weight: 'bold', lineHeight: 15 }) + 15;
  const gates = input.snapshot.decision.gates ?? [];
  if (gates.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Decision gate', 'Result', 'What it means']],
      body: gates.map(gate => [gate.label, gate.status.toUpperCase(), gate.detail]),
      headStyles: { fillColor: primary, textColor: WHITE },
      alternateRowStyles: { fillColor: SLATE_50 },
      styles: { fontSize: 8.5, cellPadding: 6, textColor: SLATE_700 },
      columnStyles: { 0: { cellWidth: 145 }, 1: { cellWidth: 65 } },
    });
  } else {
    paragraph(doc, 'Detailed hard-gate results are not stored in this report version. The recommendation remains tied to the saved decision record.', margin, y, contentWidth, { size: 9.5 });
  }

  // Concept and commercialization recommendation
  y = addContentPage(doc, input.organizationName, input.snapshot.product.sampleName, accent);
  y = sectionTitle(doc, 'Marketing Concept & Packaging Direction', y, accent);
  const copyWidth = packaging ? 310 : contentWidth;
  setText(doc, SLATE_950, 15, 'bold');
  doc.text(input.snapshot.concept.name || 'Concept direction not named', margin, y);
  y = paragraph(doc, input.snapshot.concept.description || 'No concept description is stored.', margin, y + 22, copyWidth, { size: 10, lineHeight: 14 }) + 12;
  y = paragraph(doc, `Positioning: ${input.snapshot.concept.keyBenefits || 'Not specified.'}`, margin, y, copyWidth, { size: 9.5, lineHeight: 13 }) + 8;
  y = paragraph(doc, `Target consumer: ${input.snapshot.concept.targetMarket || 'Not specified.'}`, margin, y, copyWidth, { size: 9.5, lineHeight: 13 }) + 8;
  y = paragraph(doc, `Price point: ${input.snapshot.concept.pricePoint || 'Not specified.'}`, margin, y, copyWidth, { size: 9.5, lineHeight: 13 }) + 8;
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
  doc.text(`${strength.toUpperCase()} CONCEPT EVIDENCE`, margin + 14, y + 22);
  paragraph(doc, getEvidenceStrengthNote(input.snapshot.evidence.responseCount), margin + 14, y + 43, contentWidth - 28, { size: 9.5, lineHeight: 13 });
  y += 108;
  y = sectionTitle(doc, 'Final Commercialization Recommendation', y, accent);
  const recommendationItems = [
    `Recommended path: ${input.snapshot.narrative.launchRecommendation}`,
    `Positioning: ${input.snapshot.concept.keyBenefits || input.snapshot.concept.description || 'Use the current tested concept direction.'}`,
    'Messaging: Lead with the tested product experience. Use lifestyle, nutrition, or health cues only when separately substantiated.',
    `Target consumer: ${input.snapshot.concept.targetMarket || 'Define and validate the priority buyer and consumer audience.'}`,
    `Packaging direction: ${input.snapshot.narrative.packagingRationale}`,
    `Evidence limitation: ${getEvidenceStrengthNote(input.snapshot.evidence.responseCount)}`,
  ];
  bulletList(doc, recommendationItems, margin, y, contentWidth, accent);

  // Risks and appendix
  y = addContentPage(doc, input.organizationName, input.snapshot.product.sampleName, accent);
  y = sectionTitle(doc, 'Risks & Watch-Outs', y, accent);
  autoTable(doc, {
    startY: y,
    head: [['Risk', 'Why it matters', 'Recommended mitigation']],
    body: evidenceRisks(input.snapshot).map(risk => [risk.risk, risk.why, risk.mitigation]),
    headStyles: { fillColor: primary, textColor: WHITE },
    alternateRowStyles: { fillColor: SLATE_50 },
    styles: { fontSize: 8.5, cellPadding: 7, textColor: SLATE_700, lineColor: SLATE_200, lineWidth: 0.4 },
    columnStyles: { 0: { cellWidth: 105 }, 1: { cellWidth: 190 } },
  });
  y = ((doc as PdfDocument & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 180) + 28;
  y = sectionTitle(doc, 'Recommended Next Steps', y, accent);
  y = bulletList(doc, [
    input.snapshot.evidence.responseCount < 30 ? 'Collect a larger, appropriately targeted concept response set.' : 'Confirm the panel design and segment results before making representative claims.',
    'Refine and approve packaging around the strongest validated concept direction.',
    'Prepare a buyer-facing product story led by taste and product experience.',
    'Review all claims, packaging copy, and supporting evidence for legal and commercial approval.',
    'Keep the saved decision record and source project data with the final approved report.',
  ], margin, y, contentWidth, accent) + 10;
  y = sectionTitle(doc, 'Appendix & Metadata', y, accent);
  autoTable(doc, {
    startY: y,
    body: [
      ['Decision record ID', input.snapshot.decision.recordId],
      ['Decision fingerprint', input.snapshot.decision.fingerprint],
      ['Decision method', input.snapshot.decision.methodVersion],
      ['Report version', String(input.version)],
      ['Report status', input.status],
      ['Export timestamp', new Date().toISOString()],
      ['Concept response count', String(input.snapshot.evidence.responseCount)],
      ['Source data note', 'Technical identifiers are retained here for traceability and are intentionally excluded from the main recommendation.'],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 5, textColor: SLATE_700, lineColor: SLATE_200, lineWidth: 0.4 },
    columnStyles: { 0: { cellWidth: 125, fontStyle: 'bold', fillColor: SLATE_50 } },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    setText(doc, SLATE_500, 7.5);
    doc.text(input.reportFooter || 'Confidential commercialization report', margin, height - 22);
    doc.text(`${input.organizationName} | Page ${page} of ${pageCount}`, width - margin, height - 22, { align: 'right' });
  }

  const filename = buildCommercializationReportFilename({
    clientName: input.organizationName,
    productName: input.snapshot.product.sampleName,
    decision: input.snapshot.decision.outcome,
    generatedAt: input.snapshot.generatedAt,
    version: input.version,
  });
  return { doc, filename };
}

export async function downloadCommercializationReportPdf(input: CommercializationReportPdfInput) {
  const { doc, filename } = await buildCommercializationReportPdf(input);
  doc.save(filename);
}
