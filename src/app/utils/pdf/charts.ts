import { SLATE_200, SLATE_500, SLATE_700, SLATE_950, setText, type PdfContext } from './theme';

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
