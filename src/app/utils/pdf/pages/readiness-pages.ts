import {
  AMBER,
  GREEN,
  NFI_AQUA,
  NFI_AQUA_DARK,
  SLATE_50,
  SLATE_200,
  SLATE_500,
  SLATE_700,
  SLATE_950,
  WHITE,
  imageFormat,
  nfiViewBand,
  paragraph,
  reportPageHeading,
  setDisplayText,
  setText,
  type PdfContext,
  type Rgb,
} from '../theme';
import type { CommercialReadinessData, ConceptPackagingData, ConsumerEvidenceData, ProductReadinessData, ReadinessRow, ReadinessStatus } from '../sections';

function statusColor(status: ReadinessStatus): Rgb {
  if (status === 'Ready') return GREEN;
  if (status === 'Requires validation') return [194, 120, 3];
  if (status === 'In progress') return NFI_AQUA_DARK;
  if (status === 'Evidence gap') return SLATE_700;
  return AMBER;
}

function renderRows(ctx: PdfContext, rows: ReadinessRow[], startY: number) {
  const { doc, margin, contentWidth } = ctx;
  const rowHeight = rows.length > 6 ? 70 : 77;
  let y = startY;
  rows.forEach((row, index) => {
    const tone = statusColor(row.status);
    doc.setFillColor(...(index % 2 === 0 ? SLATE_50 : WHITE));
    doc.setDrawColor(...SLATE_200);
    doc.roundedRect(margin, y, contentWidth, rowHeight, 6, 6, 'FD');

    setText(doc, SLATE_950, 8.2, 'bold');
    doc.text(row.area, margin + 13, y + 20);
    const pillWidth = Math.max(48, doc.getTextWidth(row.status.toUpperCase()) + 18);
    doc.setFillColor(...tone);
    doc.roundedRect(margin + contentWidth - pillWidth - 12, y + 9, pillWidth, 18, 9, 9, 'F');
    setText(doc, WHITE, 5.8, 'bold');
    doc.text(row.status.toUpperCase(), margin + contentWidth - 12 - pillWidth / 2, y + 21, { align: 'center' });

    const gap = 13;
    const columnWidth = (contentWidth - 26 - gap * 2) / 3;
    [
      ['CURRENT EVIDENCE', row.currentEvidence],
      ['DECISION IMPACT', row.decisionImpact],
      ['REQUIRED NEXT EVIDENCE', row.requiredEvidence],
    ].forEach(([label, value], column) => {
      const x = margin + 13 + column * (columnWidth + gap);
      setText(doc, column === 2 ? tone : SLATE_500, 5.8, 'bold');
      doc.text(label, x, y + 39);
      paragraph(doc, value, x, y + 52, columnWidth, { color: SLATE_700, size: 6.65, lineHeight: 8.1 });
    });
    y += rowHeight + 7;
  });
  return y;
}

function renderSummary(ctx: PdfContext, y: number, label: string, summary: string, height = 62) {
  nfiViewBand(ctx, y, label, summary, height);
}

export function renderProductReadinessPage(ctx: PdfContext, data: ProductReadinessData) {
  const y = reportPageHeading(ctx, 5, 'Product readiness', 'Product readiness: sensory GO, production release pending', data.intro);
  const bottom = renderRows(ctx, data.rows, y);
  renderSummary(ctx, bottom + 2, 'PRODUCT READINESS CONCLUSION', data.summary);
}

export function renderCommercialStrategyPage(
  ctx: PdfContext,
  concept: ConceptPackagingData,
  consumer: ConsumerEvidenceData,
  readiness: CommercialReadinessData,
  packaging: string | null,
) {
  const { doc, margin, contentWidth, width, accent } = ctx;
  let y = reportPageHeading(
    ctx,
    6,
    'Commercial case',
    'The proposition is defined; market proof and economics remain open',
    'The working consumer proposition is clear enough to test, while the evidence required for pricing, demand, channel, and investment decisions remains incomplete.',
  );

  const imageSize = 158;
  const imageX = width - margin - imageSize;
  const copyWidth = contentWidth - imageSize - 22;
  setText(doc, ctx.template === 'editorial-sage' ? NFI_AQUA_DARK : accent, 6.4, 'bold');
  doc.text('WORKING PROPOSITION', margin, y);
  setDisplayText(doc, SLATE_950, 14, 'bold');
  doc.text(concept.conceptName, margin, y + 22);
  paragraph(doc, concept.positioning, margin, y + 42, copyWidth, { color: SLATE_700, size: 7.4, lineHeight: 9.2 });
  [
    ['PRIORITY CONSUMER', concept.targetConsumer],
    ['PROMISE', concept.productPromise],
    ['PRICE HYPOTHESIS', concept.pricePoint],
  ].forEach(([label, value], index) => {
    const factY = y + 86 + index * 36;
    setText(doc, SLATE_500, 5.8, 'bold');
    doc.text(label, margin, factY);
    paragraph(doc, value, margin, factY + 12, copyWidth, { color: SLATE_950, size: 6.8, lineHeight: 8.2 });
  });

  if (packaging) {
    doc.addImage(packaging, imageFormat(packaging), imageX, y, imageSize, imageSize, undefined, 'FAST');
    doc.setDrawColor(...(ctx.template === 'editorial-sage' ? NFI_AQUA : SLATE_200));
    doc.setLineWidth(1);
    doc.rect(imageX, y, imageSize, imageSize);
  } else {
    doc.setFillColor(...SLATE_200);
    doc.roundedRect(imageX, y, imageSize, imageSize, 6, 6, 'F');
    setText(doc, SLATE_500, 7, 'bold');
    doc.text('DIRECTIONAL VISUAL NOT ATTACHED', imageX + imageSize / 2, y + imageSize / 2, { align: 'center' });
  }
  setText(doc, SLATE_500, 5.8, 'bold');
  doc.text(`DIRECTIONAL CONCEPT VISUAL · CONCEPT EVIDENCE BOUNDARY N=${consumer.responseCount}`, imageX, y + imageSize + 14);

  y += 178;
  const counts = readiness.rows.reduce<Record<ReadinessStatus, number>>((totals, row) => {
    totals[row.status] += 1;
    return totals;
  }, { Ready: 0, 'In progress': 0, Pending: 0, 'Evidence gap': 0, 'Requires validation': 0 });
  const chartItems = (Object.entries(counts) as Array<[ReadinessStatus, number]>).filter(([, count]) => count > 0);
  const activeCount = counts['In progress'] + counts.Pending;
  const gapCount = counts['Evidence gap'] + counts['Requires validation'];
  setText(doc, SLATE_500, 5.8, 'bold');
  doc.text('COMMERCIAL EVIDENCE COVERAGE', margin, y);
  setText(doc, SLATE_700, 6.2, 'bold');
  doc.text(`${counts.Ready} ready · ${activeCount} active · ${gapCount} evidence gap${gapCount === 1 ? '' : 's'}`, margin + contentWidth, y, { align: 'right' });
  y += 10;
  const chartWidth = contentWidth;
  let cursor = margin;
  chartItems.forEach(([status, count]) => {
    const segmentWidth = chartWidth * count / readiness.rows.length;
    doc.setFillColor(...statusColor(status));
    doc.rect(cursor, y, segmentWidth, 12, 'F');
    cursor += segmentWidth;
  });
  let legendX = margin;
  chartItems.forEach(([status, count]) => {
    doc.setFillColor(...statusColor(status));
    doc.circle(legendX + 3, y + 27, 2.5, 'F');
    setText(doc, SLATE_700, 6.2);
    const label = `${status} ${count}`;
    doc.text(label, legendX + 10, y + 29);
    legendX += doc.getTextWidth(label) + 28;
  });
  y += 45;

  setText(doc, SLATE_500, 5.8, 'bold');
  doc.text('CURRENT EVIDENCE', margin + 145, y - 3);
  doc.text('REQUIRED NEXT EVIDENCE', margin + 310, y - 3);

  readiness.rows.forEach((row, index) => {
    const rowY = y + index * 42;
    doc.setFillColor(...(index % 2 === 0 ? SLATE_50 : WHITE));
    doc.setDrawColor(...SLATE_200);
    doc.roundedRect(margin, rowY, contentWidth, 37, 5, 5, 'FD');
    doc.setFillColor(...statusColor(row.status));
    doc.circle(margin + 12, rowY + 14, 3, 'F');
    setText(doc, SLATE_950, 7, 'bold');
    doc.text(row.area, margin + 22, rowY + 15);
    setText(doc, statusColor(row.status), 5.8, 'bold');
    doc.text(row.status.toUpperCase(), margin + 22, rowY + 29);
    paragraph(doc, row.currentEvidence, margin + 145, rowY + 14, 150, { color: SLATE_700, size: 6.2, lineHeight: 7.5 });
    paragraph(doc, row.requiredEvidence, margin + 310, rowY + 14, contentWidth - 324, { color: SLATE_700, size: 6.2, lineHeight: 7.5 });
  });
  y += readiness.rows.length * 42 + 3;
  renderSummary(ctx, y, 'COMMERCIAL CONCLUSION', readiness.summary, 52);
}
