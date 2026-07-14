import { AMBER, GREEN, ROSE, SLATE_200, SLATE_500, SLATE_700, SLATE_950, setText, type PdfContext, type Rgb } from './theme';

export interface BarChartEntry {
  label: string;
  value: number;
  max?: number;
  valueLabel?: string;
}

/** Draws a labeled horizontal bar chart (used for sensory dimension scores) and returns the y after the last row. */
export function renderBarChart(ctx: PdfContext, entries: BarChartEntry[], x: number, y: number, width: number) {
  const { doc, accent } = ctx;
  const labelWidth = 150;
  const valueWidth = 46;
  const trackWidth = width - labelWidth - valueWidth;
  const barHeight = 9;
  const gap = 17;
  let currentY = y;
  entries.forEach(entry => {
    const max = entry.max ?? 100;
    const ratio = Math.max(0, Math.min(1, entry.value / max));
    setText(doc, SLATE_700, 9, 'bold');
    const labelLines = doc.splitTextToSize(entry.label, labelWidth - 8) as string[];
    doc.text(labelLines[0], x, currentY + barHeight - 3);
    doc.setFillColor(...SLATE_200);
    doc.rect(x + labelWidth, currentY, trackWidth, barHeight, 'F');
    const filled = Math.max(trackWidth * ratio, ratio > 0 ? 8 : 0);
    doc.setFillColor(...accent);
    doc.rect(x + labelWidth, currentY, filled, barHeight, 'F');
    setText(doc, SLATE_950, 9.5, 'bold');
    doc.text(entry.valueLabel ?? entry.value.toFixed(0), x + labelWidth + trackWidth + 8, currentY + barHeight - 3);
    setText(doc, SLATE_500, 6.5);
    doc.text('0', x + labelWidth, currentY + barHeight + 9);
    doc.text(String(max), x + labelWidth + trackWidth, currentY + barHeight + 9, { align: 'right' });
    currentY += barHeight + gap;
  });
  return currentY;
}

/** Sensory score chart with a visible readiness threshold. */
export function renderThresholdBarChart(
  ctx: PdfContext,
  entries: BarChartEntry[],
  threshold: number,
  x: number,
  y: number,
  width: number,
) {
  const { doc, accent } = ctx;
  const labelWidth = 145;
  const valueWidth = 92;
  const trackWidth = width - labelWidth - valueWidth;
  const rowHeight = 38;
  entries.forEach((entry, index) => {
    const rowY = y + index * rowHeight;
    const ratio = Math.max(0, Math.min(1, entry.value / (entry.max ?? 100)));
    const thresholdRatio = Math.max(0, Math.min(1, threshold / (entry.max ?? 100)));
    setText(doc, SLATE_700, 8.3, 'bold');
    doc.text((doc.splitTextToSize(entry.label, labelWidth - 8) as string[])[0], x, rowY + 13);
    doc.setFillColor(...SLATE_200);
    doc.roundedRect(x + labelWidth, rowY + 4, trackWidth, 10, 5, 5, 'F');
    doc.setFillColor(...accent);
    doc.roundedRect(x + labelWidth, rowY + 4, Math.max(8, trackWidth * ratio), 10, 5, 5, 'F');
    const thresholdX = x + labelWidth + trackWidth * thresholdRatio;
    doc.setDrawColor(...SLATE_950);
    doc.setLineWidth(1);
    doc.line(thresholdX, rowY, thresholdX, rowY + 19);
    setText(doc, SLATE_950, 9, 'bold');
    doc.text(entry.valueLabel ?? entry.value.toFixed(0), x + width, rowY + 13, { align: 'right' });
    setText(doc, SLATE_500, 6.4);
    doc.text(`Readiness ${threshold.toFixed(0)}`, thresholdX, rowY + 29, { align: 'center' });
  });
  return y + entries.length * rowHeight;
}

/** Categorical evidence balance. Segment lengths represent the real finding counts. */
export function renderEvidenceBalance(
  ctx: PdfContext,
  counts: Array<{ label: string; value: number; tone: 'supports' | 'watch' | 'contradicts' | 'neutral' }>,
  x: number,
  y: number,
  width: number,
) {
  const { doc } = ctx;
  const colors: Record<(typeof counts)[number]['tone'], Rgb> = {
    supports: GREEN,
    watch: AMBER,
    contradicts: ROSE,
    neutral: SLATE_500,
  };
  const total = counts.reduce((sum, item) => sum + item.value, 0);
  if (!total) return y;
  let cursor = x;
  counts.filter(item => item.value > 0).forEach(item => {
    const segmentWidth = width * item.value / total;
    doc.setFillColor(...colors[item.tone]);
    doc.rect(cursor, y, segmentWidth, 14, 'F');
    cursor += segmentWidth;
  });
  let legendX = x;
  counts.filter(item => item.value > 0).forEach(item => {
    doc.setFillColor(...colors[item.tone]);
    doc.circle(legendX + 4, y + 31, 3, 'F');
    setText(doc, SLATE_700, 7);
    const label = `${item.label} ${item.value}`;
    doc.text(label, legendX + 12, y + 33);
    legendX += doc.getTextWidth(label) + 34;
  });
  return y + 44;
}
