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
  reportPageHeading,
  setDisplayText,
  setText,
  type AutoTableFn,
  type PdfContext,
  type PdfDocument,
} from '../theme';
import type {
  AppendixData,
  ClaimsMatrixData,
  CommercializationPlanData,
  ConceptPackagingData,
  ConsumerEvidenceData,
  MethodEvidenceData,
  RisksData,
} from '../sections';

export function renderConceptPackagingPage(
  ctx: PdfContext,
  data: ConceptPackagingData,
  packaging: string | null,
  consumer: ConsumerEvidenceData,
) {
  const { doc, width, margin, contentWidth, accent } = ctx;
  let y = reportPageHeading(
    ctx,
    6,
    'Commercial proposition',
    'Commercial Proposition',
    'The product proposition, its evidence basis, and the commercial assumptions that still require validation.',
  );
  const visualWidth = 210;
  const copyWidth = contentWidth - visualWidth - 24;
  setDisplayText(doc, SLATE_950, 16, 'bold');
  doc.text(data.conceptName, margin, y + 8);
  y += 28;
  const leftFacts = [
    ['POSITIONING', data.positioning],
    ['PRIORITY CONSUMER', data.targetConsumer],
    ['NEED AND OCCASION', `${data.consumerNeed} ${data.usageOccasion}`],
    ['PROMISE AND PRICE HYPOTHESIS', `${data.productPromise} ${data.pricePoint}`],
  ];
  leftFacts.forEach(([label, value]) => {
    setText(doc, accent, 7, 'bold');
    doc.text(label, margin, y);
    y = paragraph(doc, value, margin, y + 16, copyWidth, {
      color: SLATE_950,
      size: 8.5,
      lineHeight: 11.5,
    }) + 13;
  });

  const visualX = width - margin - visualWidth;
  const visualY = 176;
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

  y = Math.max(y + 8, visualY + visualWidth + 60);
  doc.setFillColor(...lighten(accent, 0.91));
  doc.roundedRect(margin, y, contentWidth, 58, 8, 8, 'F');
  setText(doc, accent, 6.8, 'bold');
  doc.text('CONCEPT EVIDENCE BOUNDARY', margin + 14, y + 19);
  paragraph(
    doc,
    consumer.responseCount < 5
      ? `Concept test n=${consumer.responseCount}. The observed response is retained in the project record but is not interpreted as preference, demand, price acceptance, purchase intent, or packaging validation.`
      : `Concept test n=${consumer.responseCount}. ${consumer.boundary}`,
    margin + 14,
    y + 36,
    contentWidth - 28,
    { color: SLATE_950, size: 7.5, weight: 'bold', lineHeight: 9.5 },
  );
  y += 68;
  const validationBoundary = data.validationQuestions.length
    ? data.validationQuestions.slice(0, 3).join(' ')
    : 'Confirm proposition clarity, lead usage occasion, and price acceptance with the target consumer.';
  const blocks = [
    ['WHY THIS DIRECTION', `${data.reasonsToBelieve.map(item => `- ${item}`).join('\n') || 'The sensory GO result supports continued concept development.'}\nDifferentiation: ${data.differentiation}`],
    ['COMMERCIAL CHOICES TO VALIDATE', `${data.competitiveFrame} ${data.packagingDirection} ${validationBoundary}`],
  ];
  blocks.forEach(([label, value]) => {
    const lines = doc.splitTextToSize(value, contentWidth - 28) as string[];
    const blockHeight = Math.max(64, 38 + lines.length * 10.5);
    doc.setFillColor(...SLATE_50);
    doc.roundedRect(margin, y, contentWidth, blockHeight, 8, 8, 'F');
    setText(doc, accent, 6.8, 'bold');
    doc.text(label, margin + 14, y + 19);
    paragraph(doc, value, margin + 14, y + 34, contentWidth - 28, {
      color: SLATE_950,
      size: 8,
      lineHeight: 10.5,
    });
    y += blockHeight + 8;
  });
}

export function renderMethodEvidencePage(ctx: PdfContext, data: MethodEvidenceData, autoTable: AutoTableFn) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = reportPageHeading(ctx, 6, 'Technical appendix', 'Technical Appendix / Method and Confidence', `Method ${data.methodLabel}. The calculation below makes the decision reproducible without interrupting the client narrative.`);
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
) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = reportPageHeading(ctx, 7, 'Validation roadmap', 'Three workstreams convert product GO into launch readiness', data.intro);
  data.rows.slice(0, 3).forEach((row, index) => {
    const cardHeight = 164;
    doc.setFillColor(...(index % 2 === 0 ? SLATE_50 : WHITE));
    doc.setDrawColor(...SLATE_200);
    doc.roundedRect(margin, y, contentWidth, cardHeight, 8, 8, 'FD');
    doc.setFillColor(...accent);
    doc.circle(margin + 24, y + 25, 13, 'F');
    setText(doc, WHITE, 9, 'bold');
    doc.text(String(index + 1), margin + 24, y + 28, { align: 'center' });
    let workstreamSize = 12.5;
    setDisplayText(doc, primary, workstreamSize, 'bold');
    while (doc.getTextWidth(row.workstream) > contentWidth - 58 && workstreamSize > 8.5) {
      workstreamSize -= 0.5;
      setDisplayText(doc, primary, workstreamSize, 'bold');
    }
    doc.text(row.workstream, margin + 46, y + 28);

    const colGap = 14;
    const colWidth = (contentWidth - 32 - colGap * 2) / 3;
    [
      ['WHY THIS WORK', row.rationale],
      ['PROTOCOL', `${row.protocol} Evidence: ${row.completionEvidence}`],
      ['PASS / NEXT GATE', `${row.passingCriteria} ${row.sampleSizeRationale} Next gate: ${row.nextGate}.`],
    ].forEach(([label, value], column) => {
      const x = margin + 16 + column * (colWidth + colGap);
      setText(doc, column === 1 ? accent : SLATE_500, 6.7, 'bold');
      doc.text(label, x, y + 52);
      paragraph(doc, value, x, y + 68, colWidth, {
        color: SLATE_700,
        size: 6.6,
        weight: column === 1 ? 'bold' : 'normal',
        lineHeight: 8.4,
      });
    });
    setText(doc, SLATE_500, 6.5, 'bold');
    doc.text(`Owner: ${row.owner}`, margin + 16, y + 128);
    doc.text(`Timing: ${row.timing}`, margin + contentWidth * 0.38, y + 128);
    doc.text(`Budget: ${row.budget}`, margin + contentWidth * 0.7, y + 128);
    setText(doc, AMBER, 6.2, 'bold');
    doc.text('IF NOT MET', margin + 16, y + 146);
    paragraph(doc, row.failureDecision, margin + 70, y + 146, contentWidth - 86, { color: SLATE_700, size: 6.1, lineHeight: 7.4 });
    y += cardHeight + 8;
  });

  doc.setFillColor(...accent);
  doc.roundedRect(margin, y, contentWidth, 58, 8, 8, 'F');
  setText(doc, WHITE, 7, 'bold');
  doc.text('NFI VIEW · NEXT DECISION GATE', margin + 15, y + 20);
  paragraph(doc, data.decisionGate, margin + 15, y + 39, contentWidth - 30, {
    color: WHITE,
    size: 9,
    weight: 'bold',
    lineHeight: 12,
  });
}

export function renderClaimsMatrixPage(ctx: PdfContext, data: ClaimsMatrixData) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = reportPageHeading(ctx, 8, 'Claims governance', 'Two claims are supported; four remain unavailable for release', data.intro);

  data.rows.forEach(row => {
    const statusTone = row.status === 'Supported' ? GREEN : row.status === 'Directional' ? [180, 83, 9] as [number, number, number] : [190, 18, 60] as [number, number, number];
    const rowHeight = 78;
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...SLATE_200);
    doc.roundedRect(margin, y, contentWidth, rowHeight, 7, 7, 'FD');
    doc.setFillColor(...statusTone);
    doc.roundedRect(margin + 12, y + 12, 64, 19, 9.5, 9.5, 'F');
    setText(doc, WHITE, 6.2, 'bold');
    doc.text(row.status.toUpperCase(), margin + 44, y + 25, { align: 'center' });
    setText(doc, SLATE_950, 8.2, 'bold');
    doc.text(row.claim, margin + 88, y + 25);
    setText(doc, SLATE_500, 5.7, 'bold');
    doc.text(row.scope.toUpperCase(), margin + contentWidth - 14, y + 25, { align: 'right' });

    const gap = 14;
    const columnWidth = (contentWidth - 28 - gap * 2) / 3;
    [
      ['EVIDENCE', row.evidence],
      ['PERMITTED WORDING', row.permittedWording],
      ['REQUIREMENT', row.requirement],
    ].forEach(([label, value], index) => {
      const x = margin + 14 + index * (columnWidth + gap);
      setText(doc, index === 2 ? statusTone : SLATE_500, 6.1, 'bold');
      doc.text(label, x, y + 44);
      paragraph(doc, value, x, y + 57, columnWidth, { color: SLATE_700, size: 6.3, lineHeight: 7.8 });
    });
    y += rowHeight + 7;
  });

  doc.setFillColor(...primary);
  doc.roundedRect(margin, y + 4, contentWidth, 68, 8, 8, 'F');
  setText(doc, accent, 6.8, 'bold');
  doc.text(`NFI RELEASE VIEW · REPORT STATUS · ${data.reportStatus.toUpperCase()}`, margin + 15, y + 25);
  paragraph(doc, data.releaseDecision, margin + 15, y + 44, contentWidth - 30, {
    color: WHITE,
    size: 9,
    weight: 'bold',
    lineHeight: 12,
  });
}

export function renderRisksPage(ctx: PdfContext, data: RisksData, autoTable: AutoTableFn) {
  const { doc, margin, contentWidth, accent, primary } = ctx;
  const y = reportPageHeading(ctx, 5, 'Release control', 'Release Conditions', 'What can be stated now, what remains prohibited, and what must be completed before external release.');
  autoTable(doc, {
    startY: y,
    head: [['Risk', 'Commercial impact', 'Mitigation', 'Next decision gate']],
    body: data.rows.slice(0, 3).map(row => [
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

  const tableBottom = (doc as PdfDocument & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  const boxY = tableBottom + 18;
  const gap = 10;
  const boxWidth = (contentWidth - gap * 2) / 3;
  [
    ['WHAT CAN BE SAID NOW', data.permittedNow, accent],
    ['NOT PERMITTED YET', data.notPermitted, [180, 83, 9] as [number, number, number]],
    ['RELEASE REQUIRES', data.releaseConditions, primary],
  ].forEach(([label, items, tone], index) => {
    const x = margin + index * (boxWidth + gap);
    doc.setFillColor(...SLATE_50);
    doc.setDrawColor(...SLATE_200);
    doc.roundedRect(x, boxY, boxWidth, 154, 8, 8, 'FD');
    setText(doc, tone as [number, number, number], 6.7, 'bold');
    doc.text(label as string, x + 12, boxY + 20);
    paragraph(doc, (items as string[]).slice(0, 4).map(item => `- ${item}`).join('\n'), x + 12, boxY + 40, boxWidth - 24, {
      color: SLATE_700,
      size: 7.1,
      lineHeight: 9.5,
    });
  });
}

export function renderAppendixPage(ctx: PdfContext, data: AppendixData, autoTable: AutoTableFn) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = reportPageHeading(ctx, 7, 'Technical appendix', 'Technical Appendix / Source Record', data.intro);
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

  if (data.references.length > 0) {
    setText(doc, primary, 8, 'bold');
    doc.text('REFERENCES', margin, y);
    y += 10;
    autoTable(doc, {
      startY: y,
      head: [['ID', 'Title', 'Verified excerpt']],
      body: data.references.map(item => [item.id, item.title, item.excerpt]),
      theme: 'plain',
      margin: { left: margin, right: margin },
      headStyles: { textColor: SLATE_500, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { textColor: SLATE_700, fontSize: 7.6, cellPadding: 6, valign: 'top' },
      alternateRowStyles: { fillColor: SLATE_50 },
      styles: { lineColor: SLATE_200, lineWidth: 0.4, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: 'bold', textColor: primary },
        1: { cellWidth: 150 },
        2: { cellWidth: contentWidth - 178 },
      },
    });
    y = ((doc as PdfDocument & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 24;
  }

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
