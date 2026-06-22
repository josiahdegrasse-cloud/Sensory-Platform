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
  MethodEvidenceData,
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
    size: 7.6,
    weight: 'bold',
    lineHeight: 10,
  }) + 4;
}

export function renderConceptPackagingPage(
  ctx: PdfContext,
  data: ConceptPackagingData,
  packaging: string | null,
) {
  const { doc, width, margin, contentWidth, accent } = ctx;
  let y = pageHeading(
    ctx,
    'Page 6 · Market expression',
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
  y = factRow(ctx, 'Positioning hypothesis', data.positioning, margin, y, copyWidth);
  y = factRow(ctx, 'Target segment', data.targetConsumer, margin, y, copyWidth);
  y = factRow(ctx, 'Consumer need', data.consumerNeed, margin, y, copyWidth);
  y = factRow(ctx, 'Usage occasion', data.usageOccasion, margin, y, copyWidth);
  y = factRow(ctx, 'Product promise', data.productPromise, margin, y, copyWidth);
  y = factRow(ctx, 'Price hypothesis', data.pricePoint, margin, y, copyWidth);

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

  y = Math.max(y + 10, 430);
  const blocks = [
    ['REASONS TO BELIEVE', data.reasonsToBelieve.join(' • ') || 'No supported reasons to believe are documented.'],
    ['PACKAGING HYPOTHESIS', data.packagingDirection],
    ['VALIDATION AND CLAIMS BOUNDARY', `${data.validationQuestions.slice(0, 3).join(' • ')} Prohibited without evidence: ${data.prohibitedClaims.join(', ')}.`],
  ];
  blocks.forEach(([label, value]) => {
    doc.setFillColor(...SLATE_50);
    doc.roundedRect(margin, y, contentWidth, 52, 8, 8, 'F');
    setText(doc, accent, 6.8, 'bold');
    doc.text(label, margin + 14, y + 19);
    paragraph(doc, value, margin + 14, y + 34, contentWidth - 28, {
      color: SLATE_950,
      size: 7.4,
      lineHeight: 9.5,
    });
    y += 58;
  });

}

export function renderMethodEvidencePage(ctx: PdfContext, data: MethodEvidenceData, autoTable: AutoTableFn) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = pageHeading(ctx, 'Page 4 · Method', 'Method and Evidence Integration', `Method ${data.methodLabel}. The calculation below makes the decision reproducible.`);
  autoTable(doc, {
    startY: y,
    head: [['Dimension', 'Score', 'Weight', 'Contribution']],
    body: data.rows,
    theme: 'plain',
    margin: { left: margin, right: margin },
    headStyles: { fillColor: primary, textColor: WHITE, fontStyle: 'bold', fontSize: 7.2 },
    bodyStyles: { textColor: SLATE_700, fontSize: 7.4, cellPadding: 5 },
    alternateRowStyles: { fillColor: SLATE_50 },
    columnStyles: { 0: { cellWidth: 220, fontStyle: 'bold' }, 1: { cellWidth: 80 }, 2: { cellWidth: 80 }, 3: { cellWidth: contentWidth - 380 } },
  });
  y = ((doc as PdfDocument & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 14;
  const issfText = `${data.issfFormula}. ${data.gateLogic}`;
  setText(doc, SLATE_700, 7.5);
  const issfLines = doc.splitTextToSize(issfText, contentWidth - 28) as string[];
  const issfBoxHeight = 35 + issfLines.length * 10 + 10;
  doc.setFillColor(...SLATE_50);
  doc.roundedRect(margin, y, contentWidth, issfBoxHeight, 8, 8, 'F');
  setText(doc, accent, 7, 'bold');
  doc.text('ISSF REPRODUCTION AND CRITICAL-GATE LOGIC', margin + 14, y + 18);
  paragraph(doc, issfText, margin + 14, y + 35, contentWidth - 28, { color: SLATE_700, size: 7.5, lineHeight: 10 });
  y += issfBoxHeight + 12;
  autoTable(doc, {
    startY: y,
    head: [['Model-confidence input', 'Score × weight', 'Contribution']],
    body: data.confidenceRows,
    theme: 'plain',
    margin: { left: margin, right: margin },
    headStyles: { fillColor: primary, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
    bodyStyles: { textColor: SLATE_700, fontSize: 7, cellPadding: 4 },
    alternateRowStyles: { fillColor: SLATE_50 },
  });
  y = ((doc as PdfDocument & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 14;
  paragraph(doc, data.instrumentalNote, margin, y, contentWidth, { color: SLATE_700, size: 8, lineHeight: 11 });
  y += 34;
  autoTable(doc, {
    startY: y,
    head: [['Source', 'Finding', 'Benchmark', 'Decision effect']],
    body: data.instrumentalRows.length ? data.instrumentalRows : [['Not available', data.instrumentalNote, 'Not available', 'Limits decision']],
    theme: 'plain',
    margin: { left: margin, right: margin },
    headStyles: { fillColor: primary, textColor: WHITE, fontStyle: 'bold', fontSize: 6.8 },
    bodyStyles: { textColor: SLATE_700, fontSize: 6.8, cellPadding: 4, valign: 'top' },
    alternateRowStyles: { fillColor: SLATE_50 },
    columnStyles: { 0: { cellWidth: 105 }, 1: { cellWidth: 190 }, 2: { cellWidth: 130 }, 3: { cellWidth: contentWidth - 425, fontStyle: 'bold' } },
  });
}

export function renderCommercializationPlanPage(
  ctx: PdfContext,
  data: CommercializationPlanData,
  autoTable: AutoTableFn,
) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = pageHeading(ctx, 'Page 7 · Execution', 'Commercialization Plan', data.intro);
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
  const { doc, margin, contentWidth, accent, primary } = ctx;
  const y = pageHeading(ctx, 'Page 8 · Control', 'Risks and Watch Points', data.intro);
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

  // Claims & limitations callout below the table (sourced from the report
  // narrative, which is otherwise never rendered in the PDF).
  if (data.claimsNote) {
    const tableBottom = (doc as PdfDocument & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
    const boxY = tableBottom + 20;
    doc.setFillColor(...SLATE_50);
    doc.setDrawColor(...SLATE_200);
    const textWidth = contentWidth - 32;
    const lines = doc.splitTextToSize(data.claimsNote, textWidth) as string[];
    const boxHeight = 40 + lines.length * 12;
    doc.roundedRect(margin, boxY, contentWidth, boxHeight, 8, 8, 'FD');
    setText(doc, accent, 7, 'bold');
    doc.text('CLAIMS AND LIMITATIONS', margin + 16, boxY + 20);
    paragraph(doc, data.claimsNote, margin + 16, boxY + 34, textWidth, {
      color: SLATE_700,
      size: 8.5,
      lineHeight: 12,
    });
  }
}

export function renderAppendixPage(ctx: PdfContext, data: AppendixData, autoTable: AutoTableFn) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = pageHeading(ctx, 'Page 9 · Traceability', 'Appendix / Source Record', data.intro);
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
