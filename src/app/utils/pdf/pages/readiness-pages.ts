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
  fittedParagraph,
  imageFormat,
  nfiViewBand,
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
  const rowHeight = rows.length > 6 ? 82 : 96;
  let y = startY;
  rows.forEach((row, index) => {
    const tone = statusColor(row.status);
    doc.setFillColor(...(index % 2 === 0 ? SLATE_50 : WHITE));
    doc.setDrawColor(...SLATE_200);
    doc.roundedRect(margin, y, contentWidth, rowHeight, 6, 6, 'FD');

    setText(doc, SLATE_950, 9, 'bold');
    doc.text(row.area, margin + 15, y + 22);
    const pillWidth = Math.max(48, doc.getTextWidth(row.status.toUpperCase()) + 18);
    doc.setFillColor(...tone);
    doc.roundedRect(margin + contentWidth - pillWidth - 12, y + 9, pillWidth, 18, 9, 9, 'F');
    setText(doc, WHITE, 6.8, 'bold');
    doc.text(row.status.toUpperCase(), margin + contentWidth - 12 - pillWidth / 2, y + 21, { align: 'center' });

    const titleWidth = 142;
    const gap = 16;
    const columnWidth = (contentWidth - titleWidth - gap * 2 - 30) / 2;
    [
      ['CURRENT EVIDENCE', row.currentEvidence],
      ['REQUIRED NEXT EVIDENCE', row.requiredEvidence],
    ].forEach(([label, value], column) => {
      const x = margin + 15 + titleWidth + gap + column * (columnWidth + gap);
      setText(doc, column === 1 ? tone : SLATE_500, 7, 'bold');
      doc.text(label, x, y + 22);
      fittedParagraph(doc, value, x, y + 40, columnWidth, rowHeight - 50, {
        color: SLATE_700,
        size: 8,
        minSize: 7.2,
        lineHeight: 10.2,
      });
    });
    y += rowHeight + 8;
  });
  return y;
}

function renderSummary(ctx: PdfContext, y: number, label: string, summary: string, height = 62) {
  nfiViewBand(ctx, y, label, summary, height);
}

export function renderProductReadinessPage(ctx: PdfContext, data: ProductReadinessData) {
  const y = reportPageHeading(ctx, 5, 'Product readiness', 'Product readiness: sensory GO, technical checks pending', data.intro);
  const bottom = renderRows(ctx, data.rows, y);
  renderSummary(ctx, bottom + 2, 'PRODUCT READINESS CONCLUSION', data.summary, 58);
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
  setText(doc, ctx.template === 'editorial-sage' ? NFI_AQUA_DARK : accent, 7, 'bold');
  doc.text('WORKING PROPOSITION', margin, y);
  setDisplayText(doc, SLATE_950, 14, 'bold');
  doc.text(concept.conceptName, margin, y + 22);
  fittedParagraph(doc, concept.positioning, margin, y + 42, copyWidth, 34, {
    color: SLATE_700,
    size: 8.2,
    minSize: 7.4,
    lineHeight: 10.4,
  });
  [
    ['PRIORITY CONSUMER', concept.targetConsumer],
    ['PROMISE', concept.productPromise],
    ['PRICE HYPOTHESIS', concept.pricePoint],
  ].forEach(([label, value], index) => {
    const factY = y + 86 + index * 36;
    setText(doc, SLATE_500, 7, 'bold');
    doc.text(label, margin, factY);
    fittedParagraph(doc, value, margin, factY + 12, copyWidth, 21, {
      color: SLATE_950,
      size: 8,
      minSize: 7.2,
      lineHeight: 10,
    });
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
  fittedParagraph(
    doc,
    `DIRECTIONAL CONCEPT VISUAL · CONCEPT EVIDENCE BOUNDARY · Concept test n=${consumer.responseCount}`,
    imageX,
    y + imageSize + 14,
    imageSize,
    14,
    { color: SLATE_500, size: 5.4, minSize: 4.8, weight: 'bold', lineHeight: 6.5 },
  );

  y += 186;
  const counts = readiness.rows.reduce<Record<ReadinessStatus, number>>((totals, row) => {
    totals[row.status] += 1;
    return totals;
  }, { Ready: 0, 'In progress': 0, Pending: 0, 'Evidence gap': 0, 'Requires validation': 0 });
  const chartItems = (Object.entries(counts) as Array<[ReadinessStatus, number]>).filter(([, count]) => count > 0);
  const activeCount = counts['In progress'] + counts.Pending;
  const gapCount = counts['Evidence gap'] + counts['Requires validation'];
  setText(doc, SLATE_500, 7, 'bold');
  doc.text('COMMERCIAL EVIDENCE COVERAGE', margin, y);
  setText(doc, SLATE_700, 7.2, 'bold');
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
    setText(doc, SLATE_700, 7.2);
    const label = `${status} ${count}`;
    doc.text(label, legendX + 10, y + 29);
    legendX += doc.getTextWidth(label) + 28;
  });
  y += 45;

  setText(doc, SLATE_500, 7, 'bold');
  doc.text('CURRENT STATUS', margin + 15, y - 4);
  doc.text('REQUIRED NEXT EVIDENCE', margin + contentWidth / 2 + 10, y - 4);

  const commercialGroups = [
    { title: 'Consumer proposition', rows: readiness.rows.slice(0, 2), next: 'Test proposition clarity and fit with matched target consumers.' },
    { title: 'Competition and price', rows: readiness.rows.slice(2, 4), next: 'Benchmark named alternatives and validate price and value.' },
    { title: 'Economics and route to market', rows: readiness.rows.slice(4, 6), next: 'Approve unit economics, priority channel, and buyer requirements.' },
    { title: 'Demand plan', rows: readiness.rows.slice(6, 7), next: 'Build a documented forecast from validated demand inputs.' },
  ].filter(group => group.rows.length > 0);
  const groupGap = 10;
  const groupWidth = (contentWidth - groupGap) / 2;
  const groupHeight = 92;
  commercialGroups.forEach((group, index) => {
    const column = index % 2;
    const rowIndex = Math.floor(index / 2);
    const rowY = y + rowIndex * (groupHeight + groupGap);
    const x = margin + column * (groupWidth + groupGap);
    const status = group.rows.some(row => row.status === 'Evidence gap')
      ? 'Evidence gap'
      : group.rows.some(row => row.status === 'Requires validation')
        ? 'Requires validation'
        : group.rows[0].status;
    doc.setFillColor(...(index % 2 === 0 ? SLATE_50 : WHITE));
    doc.setDrawColor(...SLATE_200);
    doc.roundedRect(x, rowY, groupWidth, groupHeight, 7, 7, 'FD');
    doc.setFillColor(...statusColor(status));
    doc.circle(x + 15, rowY + 18, 3.5, 'F');
    setText(doc, SLATE_950, 9, 'bold');
    doc.text(group.title, x + 26, rowY + 21);
    setText(doc, statusColor(status), 6.8, 'bold');
    doc.text(status.toUpperCase(), x + 15, rowY + 39);
    const current = group.rows.map(row => `${row.area}: ${row.status}`).join(' · ');
    const next = group.next;
    fittedParagraph(doc, current, x + 15, rowY + 55, groupWidth * 0.42, 27, {
      color: SLATE_700,
      size: 7.7,
      minSize: 7,
      lineHeight: 9.4,
    });
    fittedParagraph(doc, next, x + groupWidth * 0.48, rowY + 55, groupWidth * 0.46, 27, {
      color: SLATE_700,
      size: 7.7,
      minSize: 7,
      lineHeight: 9.4,
    });
  });
  y += Math.ceil(commercialGroups.length / 2) * (groupHeight + groupGap) + 2;
  renderSummary(ctx, y, 'COMMERCIAL CONCLUSION', readiness.summary, 52);
}
