import {
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
  type AutoTableFn,
  type PdfContext,
  type PdfDocument,
} from '../theme';
import type {
  AppendixData,
  CommercializationPlanData,
  ConceptPackagingData,
  RisksData,
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
  const bottom = paragraph(doc, purpose, margin, 122, Math.min(contentWidth, 440), {
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

function factRow(ctx: PdfContext, label: string, value: string, x: number, y: number, width: number) {
  const { doc, accent } = ctx;
  doc.setDrawColor(...SLATE_200);
  doc.line(x, y, x + width, y);
  setText(doc, accent, 7, 'bold');
  doc.text(label.toUpperCase(), x, y + 17);
  return paragraph(doc, value, x + 104, y + 17, width - 104, {
    color: SLATE_950,
    size: 8.8,
    weight: 'bold',
    lineHeight: 12,
  }) + 8;
}

export function renderConceptPackagingPage(
  ctx: PdfContext,
  data: ConceptPackagingData,
  packaging: string | null,
) {
  const { doc, width, margin, contentWidth, accent } = ctx;
  let y = pageHeading(
    ctx,
    'Page 5 · Market expression',
    'Concept and Packaging Direction',
    'How the product should be positioned, expressed, and refined before external use.',
  );
  const visualWidth = 184;
  const copyWidth = contentWidth - visualWidth - 20;
  setDisplayText(doc, SLATE_950, 16, 'bold');
  doc.text(data.conceptName, margin, y + 8);
  y = paragraph(doc, data.conceptDescription, margin, y + 31, copyWidth, {
    color: SLATE_700,
    size: 9,
    lineHeight: 13,
  }) + 15;
  y = factRow(ctx, 'Positioning', data.positioning, margin, y, copyWidth);
  y = factRow(ctx, 'Target consumer', data.targetConsumer, margin, y, copyWidth);
  y = factRow(ctx, 'Price point', data.pricePoint, margin, y, copyWidth);

  const visualX = width - margin - visualWidth;
  const visualY = 173;
  if (packaging) {
    doc.addImage(packaging, imageFormat(packaging), visualX, visualY, visualWidth, visualWidth, undefined, 'FAST');
  } else {
    doc.setFillColor(...SLATE_200);
    doc.roundedRect(visualX, visualY, visualWidth, visualWidth, 9, 9, 'F');
    setText(doc, SLATE_500, 8, 'bold');
    doc.text('NO CONCEPT VISUAL ATTACHED', visualX + visualWidth / 2, visualY + visualWidth / 2, { align: 'center' });
  }
  setText(doc, SLATE_500, 6.6, 'bold');
  doc.text('DIRECTIONAL CONCEPT VISUAL', visualX, visualY + visualWidth + 15);
  if (data.packagingProvenance) {
    setText(doc, SLATE_500, 6.5);
    doc.text(data.packagingProvenance, visualX, visualY + visualWidth + 28);
  }
  if (data.packagingDisclaimer) {
    paragraph(doc, data.packagingDisclaimer, visualX, visualY + visualWidth + 42, visualWidth, {
      color: SLATE_500,
      size: 6.5,
      lineHeight: 8.5,
    });
  }

  y = Math.max(y + 10, 415);
  const blocks = [
    ['PACKAGING DIRECTION', data.packagingDirection],
    ['CORE MESSAGE', data.coreMessage],
    ['WHY THIS SUPPORTS THE PRODUCT', data.strategicFit],
  ];
  blocks.forEach(([label, value]) => {
    doc.setFillColor(...SLATE_50);
    doc.roundedRect(margin, y, contentWidth, 72, 8, 8, 'F');
    setText(doc, accent, 6.8, 'bold');
    doc.text(label, margin + 14, y + 19);
    paragraph(doc, value, margin + 14, y + 37, contentWidth - 28, {
      color: SLATE_950,
      size: 8.5,
      lineHeight: 11.5,
    });
    y += 82;
  });

  setText(doc, SLATE_950, 9, 'bold');
  doc.text('REFINE BEFORE EXTERNAL USE', margin, y + 4);
  data.refinements.forEach((item, index) => {
    const itemX = margin + (index % 2) * (contentWidth / 2);
    const itemY = y + 25 + Math.floor(index / 2) * 31;
    doc.setFillColor(...accent);
    doc.circle(itemX + 4, itemY - 3, 3, 'F');
    paragraph(doc, item, itemX + 13, itemY, contentWidth / 2 - 24, {
      color: SLATE_700,
      size: 7.7,
      lineHeight: 10,
    });
  });
}

export function renderCommercializationPlanPage(
  ctx: PdfContext,
  data: CommercializationPlanData,
  autoTable: AutoTableFn,
) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = pageHeading(ctx, 'Page 6 · Execution', 'Commercialization Plan', data.intro);
  autoTable(doc, {
    startY: y,
    head: [['Workstream', 'Current read', 'Required action', 'Status / owner']],
    body: data.rows.map(row => [row.workstream, row.currentRead, row.requiredAction, row.statusOwner]),
    theme: 'plain',
    margin: { left: margin, right: margin },
    headStyles: { fillColor: primary, textColor: WHITE, fontStyle: 'bold', fontSize: 7.2 },
    bodyStyles: { textColor: SLATE_700, fontSize: 7.1, cellPadding: 5, valign: 'top' },
    alternateRowStyles: { fillColor: SLATE_50 },
    styles: { lineColor: SLATE_200, lineWidth: 0.35, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold', textColor: SLATE_950 },
      1: { cellWidth: 125 },
      2: { cellWidth: 220 },
      3: { cellWidth: contentWidth - 425, textColor: accent, fontStyle: 'bold' },
    },
  });
  y = ((doc as PdfDocument & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 680) + 18;
  doc.setFillColor(...accent);
  doc.roundedRect(margin, y, contentWidth, 62, 8, 8, 'F');
  setText(doc, WHITE, 7, 'bold');
  doc.text('NEXT DECISION GATE', margin + 15, y + 20);
  paragraph(doc, data.decisionGate, margin + 15, y + 39, contentWidth - 30, {
    color: WHITE,
    size: 9,
    weight: 'bold',
    lineHeight: 12,
  });
}

export function renderRisksPage(ctx: PdfContext, data: RisksData, autoTable: AutoTableFn) {
  const { doc, margin, primary } = ctx;
  const y = pageHeading(ctx, 'Page 7 · Control', 'Risks and Watch Points', data.intro);
  autoTable(doc, {
    startY: y,
    head: [['Risk', 'Commercial impact', 'Mitigation', 'Next decision gate']],
    body: data.rows.map(row => [
      `${row.category}\n${row.risk}`,
      row.impact,
      row.mitigation,
      row.nextGate,
    ]),
    theme: 'plain',
    margin: { left: margin, right: margin },
    headStyles: { fillColor: primary, textColor: WHITE, fontStyle: 'bold', fontSize: 7.2 },
    bodyStyles: { textColor: SLATE_700, fontSize: 7.2, cellPadding: 6, valign: 'top' },
    alternateRowStyles: { fillColor: SLATE_50 },
    styles: { lineColor: SLATE_200, lineWidth: 0.35, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 130, fontStyle: 'bold', textColor: SLATE_950 },
      1: { cellWidth: 145 },
      2: { cellWidth: 165 },
      3: { cellWidth: ctx.contentWidth - 440, fontStyle: 'bold' },
    },
  });
}

export function renderAppendixPage(ctx: PdfContext, data: AppendixData, autoTable: AutoTableFn) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = pageHeading(ctx, 'Page 8 · Traceability', 'Appendix / Source Record', data.intro);
  autoTable(doc, {
    startY: y,
    body: data.rows,
    theme: 'plain',
    margin: { left: margin, right: margin },
    bodyStyles: { textColor: SLATE_700, fontSize: 8.2, cellPadding: 7, valign: 'top' },
    alternateRowStyles: { fillColor: SLATE_50 },
    styles: { lineColor: SLATE_200, lineWidth: 0.4, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 130, fontStyle: 'bold', textColor: primary },
      1: { cellWidth: contentWidth - 130 },
    },
  });
  y = ((doc as PdfDocument & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 600) + 28;
  doc.setFillColor(...primary);
  doc.roundedRect(margin, y, contentWidth, 92, 9, 9, 'F');
  setText(doc, accent, 7, 'bold');
  doc.text('APPROVAL AND DISTRIBUTION', margin + 16, y + 22);
  paragraph(doc, data.approvalNote, margin + 16, y + 45, contentWidth - 32, {
    color: WHITE,
    size: 10,
    weight: 'bold',
    lineHeight: 14,
  });
}
