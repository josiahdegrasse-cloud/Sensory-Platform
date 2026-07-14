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
  type PdfContext,
  type Rgb,
} from '../theme';
import type { ConsumerEvidenceData, ScientificContextData } from '../sections';

function pageHeading(ctx: PdfContext, page: number, eyebrow: string, title: string, purpose: string) {
  const { doc, width, margin, contentWidth, primary, accent } = ctx;
  setDisplayText(doc, lighten(accent, 0.84), 46, 'bold');
  doc.text(String(page).padStart(2, '0'), width - margin, 92, { align: 'right' });
  setText(doc, accent, 8, 'bold');
  doc.text(eyebrow.toUpperCase(), margin, 68);
  setDisplayText(doc, primary, 24, 'bold');
  doc.text(title, margin, 99);
  const bottom = paragraph(doc, purpose, margin, 122, Math.min(contentWidth, 445), {
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

function effectColor(effect: ScientificContextData['findings'][number]['decisionEffect']): Rgb {
  if (effect === 'supports') return GREEN;
  if (effect === 'contradicts') return ROSE;
  if (effect === 'watch') return AMBER;
  return SLATE_500;
}

export function renderScientificContextPage(ctx: PdfContext, data: ScientificContextData) {
  const { doc, margin, contentWidth, accent } = ctx;
  let y = pageHeading(
    ctx,
    3,
    'Page 3 · Measurement and literature',
    'Instrumental and Scientific Context',
    'Project measurements are shown separately from guidance drawn from verified external literature.',
  );

  doc.setFillColor(...(data.instrumentalAvailable ? lighten(accent, 0.9) : SLATE_50));
  doc.roundedRect(margin, y, contentWidth, 58, 8, 8, 'F');
  setText(doc, data.instrumentalAvailable ? accent : SLATE_500, 7, 'bold');
  doc.text(data.instrumentalAvailable ? 'PROJECT INSTRUMENTAL EVIDENCE' : 'INSTRUMENTAL EVIDENCE NOT AVAILABLE', margin + 14, y + 19);
  paragraph(doc, data.instrumentalNote, margin + 14, y + 36, contentWidth - 28, {
    color: SLATE_700,
    size: 8,
    lineHeight: 10.5,
  });
  y += 76;

  if (data.findings.length > 0) {
    setText(doc, SLATE_950, 9, 'bold');
    doc.text('Instrumental decision evidence', margin, y);
    y += 18;

    data.findings.slice(0, 3).forEach(finding => {
      const tone = effectColor(finding.decisionEffect);
      doc.setFillColor(...WHITE);
      doc.setDrawColor(...SLATE_200);
      doc.roundedRect(margin, y, contentWidth, 72, 8, 8, 'FD');
      doc.setFillColor(...tone);
      doc.roundedRect(margin + 12, y + 13, 70, 20, 10, 10, 'F');
      setText(doc, WHITE, 6.5, 'bold');
      doc.text(finding.decisionEffect.toUpperCase(), margin + 47, y + 26, { align: 'center' });
      setText(doc, SLATE_950, 8.5, 'bold');
      doc.text(finding.source, margin + 94, y + 24);
      if (finding.replicateCount !== null) {
        setText(doc, SLATE_500, 6.5);
        doc.text(`Replicates: ${finding.replicateCount}`, margin + contentWidth - 14, y + 24, { align: 'right' });
      }
      paragraph(doc, finding.finding, margin + 14, y + 45, contentWidth * 0.61, { color: SLATE_700, size: 7.3, lineHeight: 9.2 });
      setText(doc, SLATE_500, 6.4, 'bold');
      doc.text('BENCHMARK', margin + contentWidth * 0.66, y + 45);
      paragraph(doc, finding.benchmark, margin + contentWidth * 0.66, y + 59, contentWidth * 0.31, { color: SLATE_700, size: 6.8, lineHeight: 8.5 });
      y += 82;
    });
    y += 10;
  } else {
    paragraph(doc, 'No instrumental findings are attached to this saved report version. The absence is disclosed rather than replaced with inferred measurements.', margin, y, contentWidth, {
      color: SLATE_700,
      size: 8.5,
      lineHeight: 12,
    });
    y += 52;
  }

  setDisplayText(doc, SLATE_950, 13, 'bold');
  doc.text('Scientific guidance', margin, y);
  setText(doc, SLATE_500, 7);
  doc.text('Method guidance only - literature does not replace project evidence or change the product decision.', margin, y + 15);
  y += 28;

  if (data.guidance.length === 0) {
    doc.setFillColor(...SLATE_50);
    doc.roundedRect(margin, y, contentWidth, 68, 8, 8, 'F');
    paragraph(doc, 'No verified literature guidance was saved with this version. Generate a new complete report to retrieve and validate relevant scientific context.', margin + 14, y + 23, contentWidth - 28, {
      color: SLATE_700,
      size: 8,
      lineHeight: 11,
    });
    return;
  }

  data.guidance.forEach(item => {
    doc.setDrawColor(...SLATE_200);
    doc.line(margin, y, margin + contentWidth, y);
    setText(doc, accent, 7, 'bold');
    doc.text(item.citationIds.map(id => `[${id}]`).join(' '), margin, y + 17);
    setText(doc, SLATE_950, 8, 'bold');
    doc.text(item.title, margin + 52, y + 17);
    paragraph(doc, item.guidance, margin + 52, y + 34, contentWidth - 69, {
      color: SLATE_700,
      size: 7.1,
      lineHeight: 9,
    });
    y += 53;
  });

  y += 6;
  setText(doc, SLATE_500, 6.6, 'bold');
  doc.text('VERIFIED SOURCE REGISTER', margin, y);
  y += 14;
  data.sources.forEach(source => {
    setText(doc, accent, 6.6, 'bold');
    doc.text(`[${source.id}]`, margin, y);
    setText(doc, SLATE_700, 6.6);
    doc.text((doc.splitTextToSize(source.title, contentWidth - 40) as string[])[0], margin + 35, y);
    y += 11;
  });
  setText(doc, SLATE_500, 6.2);
  doc.text('Full source files and verified excerpts are retained in the internal traceability record.', margin, y + 3);
}

export function renderConsumerEvidencePage(ctx: PdfContext, data: ConsumerEvidenceData) {
  const { doc, margin, contentWidth, accent, primary } = ctx;
  const directionalLog = data.responseCount > 0 && data.responseCount < 5;
  let y = pageHeading(
    ctx,
    4,
    'Page 4 · Consumer validation',
    directionalLog ? 'Directional Concept Log' : 'Consumer and Concept Evidence',
    directionalLog
      ? 'The single observed response is logged for traceability and is not interpreted as a consumer pattern.'
      : 'Observed concept responses are shown with their sample size and claim boundary.',
  );

  const metricWidth = (contentWidth - 12) / 2;
  [
    ['RESPONSES', String(data.responseCount), `${data.evidenceStrength} evidence`],
    ['PURCHASE INTENT', data.purchaseIntent === null ? 'Not collected' : data.purchaseIntent.toFixed(1), data.purchaseIntent === null ? 'No score available' : 'Directional until panel fit is confirmed'],
  ].forEach(([label, value, detail], index) => {
    const x = margin + index * (metricWidth + 12);
    doc.setFillColor(...SLATE_50);
    doc.setDrawColor(...SLATE_200);
    doc.roundedRect(x, y, metricWidth, 64, 8, 8, 'FD');
    setText(doc, index === 0 ? accent : primary, 6.8, 'bold');
    doc.text(label, x + 13, y + 18);
    setDisplayText(doc, SLATE_950, value.length > 12 ? 13 : 19, 'bold');
    doc.text(value, x + 13, y + 42);
    setText(doc, SLATE_500, 6.5);
    doc.text(detail, x + 13, y + 55);
  });
  y += 84;

  if (directionalLog) {
    doc.setFillColor(...lighten(AMBER, 0.88));
    doc.roundedRect(margin, y, contentWidth, 48, 8, 8, 'F');
    setText(doc, AMBER, 7, 'bold');
    doc.text('OBSERVATION STATUS', margin + 14, y + 18);
    paragraph(doc, 'Observed once. These entries are preserved as a log, not visualized as percentages or interpreted as a market signal.', margin + 14, y + 34, contentWidth - 28, {
      color: SLATE_950,
      size: 7.5,
      weight: 'bold',
      lineHeight: 9.5,
    });
    y += 64;

    const loggedRatings = [
      ...(data.purchaseIntent === null ? [] : [`Purchase intent ${data.purchaseIntent.toFixed(1)}`]),
      ...data.scaleMetrics.slice(0, 3).map(metric => `${metric.question} ${metric.average.toFixed(1)} (n=${metric.count})`),
    ];
    setDisplayText(doc, SLATE_950, 11.5, 'bold');
    doc.text('Logged response', margin, y);
    paragraph(doc, loggedRatings.length > 0 ? loggedRatings.join(' · ') : 'No scale rating was collected.', margin, y + 17, contentWidth, {
      color: SLATE_700,
      size: 7.7,
      lineHeight: 10,
    });
    y += 47;

    setText(doc, SLATE_500, 6.8, 'bold');
    doc.text('LOGGED SELECTIONS', margin, y);
    paragraph(doc, data.descriptors.length > 0 ? data.descriptors.map(item => item.label).join(' · ') : 'No selections were recorded.', margin, y + 17, contentWidth, {
      color: SLATE_700,
      size: 7.7,
      lineHeight: 10,
    });
    y += 50;
  }

  const scaleEntries = [
    ...(data.purchaseIntent === null ? [] : [{ label: 'Purchase intent', value: data.purchaseIntent, max: 10, valueLabel: data.purchaseIntent.toFixed(1) }]),
    ...data.scaleMetrics.slice(0, 3).map(metric => ({ label: metric.question, value: metric.average, max: 10, valueLabel: `${metric.average.toFixed(1)} (n=${metric.count})` })),
  ];
  if (!directionalLog && scaleEntries.length > 0) {
    setDisplayText(doc, SLATE_950, 12, 'bold');
    doc.text('Concept ratings', margin, y);
    y = renderBarChart(ctx, scaleEntries, margin, y + 17, contentWidth) + 7;
  }

  if (!directionalLog && data.descriptors.length > 0) {
    setDisplayText(doc, SLATE_950, 12, 'bold');
    doc.text('Selected concept descriptors', margin, y);
    y = renderBarChart(ctx, data.descriptors.slice(0, 5).map(item => ({
      label: item.label,
      value: item.percentage,
      max: 100,
      valueLabel: `${item.percentage.toFixed(0)}% (${item.count})`,
    })), margin, y + 17, contentWidth) + 4;
  }

  doc.setFillColor(...lighten(accent, 0.91));
  doc.roundedRect(margin, y, contentWidth, 72, 8, 8, 'F');
  setText(doc, accent, 6.8, 'bold');
  doc.text('EVIDENCE BOUNDARY', margin + 14, y + 19);
  paragraph(doc, data.boundary, margin + 14, y + 38, contentWidth - 28, {
    color: SLATE_950,
    size: 8,
    weight: 'bold',
    lineHeight: 10.5,
  });
  y += 88;

  if (data.responseCount < 5) {
    setDisplayText(doc, SLATE_950, 12, 'bold');
    doc.text(data.responseCount === 0 ? 'Required consumer validation' : 'How to use this observation', margin, y);
    y += 16;
    const gap = 10;
    const boxWidth = (contentWidth - gap * 2) / 3;
    [
      ['KNOWN NOW', data.responseCount === 0 ? 'The tested product has a sensory decision. No consumer or concept response has been observed.' : 'One person completed the concept response. Their selections are recorded accurately above.'],
      ['DO NOT CLAIM', 'Consumer preference, purchase demand, price acceptance, packaging preference, or representative market response.'],
      ['NEXT STUDY', 'Collect at least 30 target-consumer responses and document panel fit, concept clarity, usage occasion, price, packaging response, and purchase intent.'],
    ].forEach(([label, copy], index) => {
      const x = margin + index * (boxWidth + gap);
      doc.setFillColor(...SLATE_50);
      doc.setDrawColor(...SLATE_200);
      doc.roundedRect(x, y, boxWidth, 112, 8, 8, 'FD');
      setText(doc, index === 1 ? AMBER : accent, 6.7, 'bold');
      doc.text(label, x + 12, y + 20);
      paragraph(doc, copy, x + 12, y + 39, boxWidth - 24, {
        color: SLATE_700,
        size: 7.2,
        lineHeight: 9.5,
      });
    });
    y += 128;
  }

  if (data.comments.length > 0) {
    setText(doc, SLATE_500, 6.8, 'bold');
    doc.text('REPRESENTATIVE COMMENTS', margin, y);
    paragraph(doc, data.comments.map(comment => `"${comment}"`).join('   '), margin, y + 18, contentWidth, {
      color: SLATE_700,
      size: 7.6,
      lineHeight: 10,
    });
  }
}
