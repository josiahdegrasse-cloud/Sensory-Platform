import {
  AMBER,
  GREEN,
  NFI_AQUA,
  NFI_AQUA_DARK,
  NFI_AQUA_SOFT,
  NFI_CORAL_DARK,
  ROSE,
  SLATE_50,
  SLATE_200,
  SLATE_500,
  SLATE_700,
  SLATE_950,
  WHITE,
  lighten,
  nfiViewBand,
  paragraph,
  reportPageHeading,
  setDisplayText,
  setText,
  type PdfContext,
  type Rgb,
} from '../theme';
import type { DecisionBasisData, RisksData, ScientificContextData } from '../sections';

function statusColor(status: string): Rgb {
  if (/support|pass|approved|go/i.test(status)) return GREEN;
  if (/block|fail|stop/i.test(status)) return ROSE;
  return AMBER;
}

export function renderDecisionBasisPage(ctx: PdfContext, data: DecisionBasisData) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = reportPageHeading(
    ctx,
    2,
    'Decision basis',
    'The product clears the GO threshold and all critical product gates',
    'Why the decision was reached, how strong the evidence is, and which changes would require a new review.',
  );

  const gap = 9;
  const metricWidth = (contentWidth - gap * 3) / 4;
  [
    ['DECISION', data.decision],
    ['ISSF / GO LINE', `${data.issfScore} / ${data.goThreshold}`],
    ['DECISION MARGIN', data.decisionMargin],
    ['EVIDENCE STRENGTH', data.evidenceStrength],
  ].forEach(([label, value], index) => {
    const x = margin + index * (metricWidth + gap);
    doc.setFillColor(...SLATE_50);
    doc.setDrawColor(...SLATE_200);
    doc.roundedRect(x, y, metricWidth, 62, 7, 7, 'FD');
    setText(doc, index === 0 ? accent : SLATE_500, 6.2, 'bold');
    doc.text(label, x + 10, y + 17);
    paragraph(doc, value, x + 10, y + 36, metricWidth - 20, {
      color: SLATE_950,
      size: value.length > 18 ? 7.2 : 12,
      weight: 'bold',
      lineHeight: 9,
    });
  });
  y += 76;

  const score = Math.max(0, Math.min(100, Number(data.issfScore)));
  const goLine = Math.max(0, Math.min(100, Number(data.goThreshold)));
  const trackY = y + 4;
  doc.setFillColor(...SLATE_200);
  doc.roundedRect(margin, trackY, contentWidth, 10, 5, 5, 'F');
  doc.setFillColor(...accent);
  doc.roundedRect(margin, trackY, contentWidth * score / 100, 10, 5, 5, 'F');
  const thresholdX = margin + contentWidth * goLine / 100;
  doc.setDrawColor(...SLATE_950);
  doc.setLineWidth(1);
  doc.line(thresholdX, trackY - 5, thresholdX, trackY + 16);
  setText(doc, SLATE_500, 6.2);
  doc.text('0', margin, trackY + 25);
  doc.text(`GO line ${data.goThreshold}`, thresholdX, trackY + 25, { align: 'center' });
  setText(doc, accent, 6.5, 'bold');
  doc.text(`ISSF ${data.issfScore}`, margin + contentWidth * score / 100, trackY - 8, { align: 'center' });
  y += 38;

  setDisplayText(doc, SLATE_950, 11.5, 'bold');
  doc.text('Evidence populations and provenance', margin, y);
  y += 14;
  const popWidth = (contentWidth - 18) / 3;
  data.populations.forEach((population, index) => {
    const x = margin + index * (popWidth + 9);
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...SLATE_200);
    doc.roundedRect(x, y, popWidth, 67, 7, 7, 'FD');
    setText(doc, SLATE_500, 6.3, 'bold');
    doc.text(population.label.toUpperCase(), x + 11, y + 17);
    setDisplayText(doc, SLATE_950, 11, 'bold');
    doc.text(population.value, x + 11, y + 37);
    paragraph(doc, population.provenance, x + 11, y + 51, popWidth - 22, { color: SLATE_500, size: 6.4, lineHeight: 8 });
  });
  y += 81;

  nfiViewBand(ctx, y, 'What this means', data.whatThisMeans, 56);
  y += 68;

  const half = (contentWidth - 12) / 2;
  setDisplayText(doc, SLATE_950, 11.5, 'bold');
  doc.text('Decision gates', margin, y);
  doc.text('What would change the decision', margin + half + 12, y);
  y += 14;
  const leftHeight = 150;
  doc.setFillColor(...SLATE_50);
  doc.roundedRect(margin, y, half, leftHeight, 7, 7, 'F');
  if (data.gates.length === 0) {
    paragraph(doc, 'No explicit gate records are attached to this report version.', margin + 12, y + 24, half - 24, { color: SLATE_700, size: 7.2, lineHeight: 9 });
  } else {
    data.gates.slice(0, 4).forEach((gate, index) => {
      const rowY = y + 13 + index * 33;
      const tone = statusColor(gate.status);
      doc.setFillColor(...tone);
      doc.circle(margin + 17, rowY + 5, 3.5, 'F');
      setText(doc, SLATE_950, 7, 'bold');
      doc.text(`${gate.label} · ${gate.status.toUpperCase()}`, margin + 27, rowY + 7);
      paragraph(doc, gate.detail, margin + 27, rowY + 19, half - 39, { color: SLATE_500, size: 6.2, lineHeight: 7.4 });
    });
  }

  const rightX = margin + half + 12;
  doc.setFillColor(...SLATE_50);
  doc.roundedRect(rightX, y, half, leftHeight, 7, 7, 'F');
  paragraph(doc, data.sensitivity.map(item => `- ${item}`).join('\n'), rightX + 12, y + 21, half - 24, {
    color: SLATE_700,
    size: 6.8,
    lineHeight: 9.4,
  });
  y += leftHeight + 14;

  setText(doc, SLATE_500, 6.5, 'bold');
  doc.text('MATERIAL LIMITATIONS', margin, y);
  y += 13;
  paragraph(doc, data.limitations.map(item => `- ${item}`).join('\n'), margin, y, contentWidth, {
    color: SLATE_700,
    size: 6.8,
    lineHeight: 9,
  });
  y += Math.max(38, data.limitations.slice(0, 4).length * 10);

  doc.setFillColor(...primary);
  doc.roundedRect(margin, y, contentWidth, 72, 8, 8, 'F');
  setText(doc, accent, 6.8, 'bold');
  doc.text(`MANAGEMENT DECISION · ${data.reportStatus.toUpperCase()}`, margin + 14, y + 21);
  paragraph(doc, data.managementDecision, margin + 14, y + 42, contentWidth - 28, {
    color: WHITE,
    size: 8.8,
    weight: 'bold',
    lineHeight: 11.5,
  });
}

export function renderInstrumentalRiskPage(ctx: PdfContext, scientific: ScientificContextData, risks: RisksData) {
  const { doc, margin, contentWidth, accent } = ctx;
  let y = reportPageHeading(
    ctx,
    4,
    'Triangulated evidence',
    'Instrumental evidence supports the decision and directs the next controls',
    'Project measurements show whether the sensory result is technically coherent; literature is used beside the evidence to shape the next validation method.',
  );

  doc.setFillColor(...(ctx.template === 'editorial-sage' ? NFI_AQUA_SOFT : SLATE_50));
  doc.roundedRect(margin, y, contentWidth, 46, 7, 7, 'F');
  doc.setDrawColor(...(ctx.template === 'editorial-sage' ? NFI_AQUA : accent));
  doc.setLineWidth(1);
  doc.line(margin, y, margin + contentWidth, y);
  setText(doc, scientific.instrumentalAvailable ? accent : (ctx.template === 'editorial-sage' ? NFI_AQUA_DARK : SLATE_500), 6.6, 'bold');
  doc.text(scientific.instrumentalAvailable ? 'INSTRUMENTAL STATUS · INCLUDED' : 'INSTRUMENTAL STATUS · NOT AVAILABLE', margin + 13, y + 17);
  paragraph(doc, scientific.instrumentalNote, margin + 13, y + 31, contentWidth - 26, { color: SLATE_700, size: 7, lineHeight: 8.5 });
  y += 58;

  scientific.findings.slice(0, 3).forEach(finding => {
    const tone = statusColor(finding.decisionEffect);
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...SLATE_200);
    doc.roundedRect(margin, y, contentWidth, 62, 7, 7, 'FD');
    doc.setFillColor(...tone);
    doc.roundedRect(margin + 11, y + 11, 64, 18, 9, 9, 'F');
    setText(doc, WHITE, 6, 'bold');
    doc.text(finding.decisionEffect.toUpperCase(), margin + 43, y + 23, { align: 'center' });
    setText(doc, SLATE_950, 8, 'bold');
    doc.text(finding.source, margin + 88, y + 23);
    if (finding.replicateCount !== null) {
      setText(doc, finding.replicateCount === 1 ? AMBER : SLATE_500, 6.2, finding.replicateCount === 1 ? 'bold' : 'normal');
      doc.text(
        finding.replicateCount === 1 ? '1 replicate · repeatability not established' : `Replicates ${finding.replicateCount}`,
        margin + contentWidth - 12,
        y + 23,
        { align: 'right' },
      );
    }
    paragraph(doc, finding.finding, margin + 13, y + 43, contentWidth * 0.58, { color: SLATE_700, size: 6.8, lineHeight: 8.2 });
    paragraph(doc, `Benchmark: ${finding.benchmark}`, margin + contentWidth * 0.64, y + 43, contentWidth * 0.33, { color: SLATE_500, size: 6.5, lineHeight: 8 });
    y += 70;
  });

  setDisplayText(doc, SLATE_950, 11.5, 'bold');
  doc.text('Technical and execution risks', margin, y + 2);
  y += 17;
  const riskLimit = scientific.findings.length > 0 ? 2 : 3;
  risks.rows.slice(0, riskLimit).forEach(risk => {
    doc.setFillColor(...SLATE_50);
    doc.roundedRect(margin, y, contentWidth, 74, 7, 7, 'F');
    setText(doc, AMBER, 6.3, 'bold');
    doc.text(`${risk.category.toUpperCase()} · NEXT GATE ${risk.nextGate.toUpperCase()}`, margin + 12, y + 17);
    setText(doc, SLATE_950, 7.3, 'bold');
    paragraph(doc, risk.risk, margin + 12, y + 32, contentWidth * 0.31, { color: SLATE_950, size: 6.8, weight: 'bold', lineHeight: 8.2 });
    paragraph(doc, `Impact: ${risk.impact}`, margin + contentWidth * 0.35, y + 32, contentWidth * 0.29, { color: SLATE_700, size: 6.5, lineHeight: 8 });
    paragraph(doc, `Control: ${risk.mitigation}`, margin + contentWidth * 0.67, y + 32, contentWidth * 0.3, { color: SLATE_700, size: 6.5, lineHeight: 8 });
    y += 82;
  });

  if (scientific.guidance.length > 0) {
    setDisplayText(doc, SLATE_950, 10.5, 'bold');
    doc.text('NFI view · Scientific guidance applied to the next study', margin, y + 2);
    y += 16;
    scientific.guidance.slice(0, 3).forEach(item => {
      const citationLabel = item.citationIds.map(id => `[${id}]`).join(' ');
      setText(doc, ctx.template === 'editorial-sage' ? NFI_CORAL_DARK : accent, 6.2, 'bold');
      doc.text(citationLabel, margin, y + 12);
      setText(doc, SLATE_950, 6.8, 'bold');
      doc.text(item.title, margin + 42, y + 12);
      paragraph(doc, item.guidance, margin + 42, y + 25, contentWidth - 42, { color: SLATE_700, size: 6.2, lineHeight: 7.4 });
      y += 38;
    });
    setText(doc, SLATE_500, 5.9, 'bold');
    doc.text('VERIFIED SOURCES:', margin, y + 4);
    y += 12;
    scientific.sources.slice(0, 3).forEach(source => {
      const hasAuthority = source.authors !== 'Not captured' && source.year !== 'Not captured';
      const authority = hasAuthority
        ? `${source.authors} (${source.year}), ${source.studyType.toLowerCase()}`
        : `${source.title}, ${source.studyType.toLowerCase()}`;
      const identifier = source.doi === 'Not captured'
        ? ''
        : source.doi === 'Internal method record'
          ? ` · ${source.doi}`
          : ` · DOI ${source.doi}`;
      setText(doc, accent, 5.9, 'bold');
      doc.text(`[${source.id}]`, margin, y + 4);
      paragraph(doc, `${authority}${identifier}`, margin + 28, y + 4, contentWidth - 28, { color: SLATE_500, size: 5.9, lineHeight: 7.2 });
      y += 12;
    });
  }
}

export function renderScientificEvidencePage(ctx: PdfContext, data: ScientificContextData) {
  const { doc, margin, contentWidth, accent } = ctx;
  let y = reportPageHeading(
    ctx,
    5,
    'Scientific evidence',
    'Scientific Evidence and Application',
    'Verified literature is translated into project-specific study guidance without replacing the measured product evidence.',
  );

  if (data.guidance.length === 0) {
    doc.setFillColor(...SLATE_50);
    doc.roundedRect(margin, y, contentWidth, 70, 7, 7, 'F');
    paragraph(doc, 'No verified literature guidance is attached to this report version.', margin + 14, y + 28, contentWidth - 28, { color: SLATE_700, size: 8, lineHeight: 10 });
    return;
  }

  setDisplayText(doc, SLATE_950, 11.5, 'bold');
  doc.text('Application to this project', margin, y);
  y += 14;
  data.guidance.forEach(item => {
    doc.setFillColor(...SLATE_50);
    doc.roundedRect(margin, y, contentWidth, 64, 7, 7, 'F');
    setText(doc, accent, 6.5, 'bold');
    doc.text(item.citationIds.map(id => `[${id}]`).join(' '), margin + 12, y + 18);
    setText(doc, SLATE_950, 8, 'bold');
    doc.text(item.title, margin + 64, y + 18);
    paragraph(doc, item.guidance, margin + 64, y + 36, contentWidth - 78, { color: SLATE_700, size: 7, lineHeight: 8.8 });
    y += 72;
  });

  setDisplayText(doc, SLATE_950, 11.5, 'bold');
  doc.text('Source authority and metadata', margin, y + 2);
  y += 17;
  data.sources.forEach(source => {
    doc.setDrawColor(...SLATE_200);
    doc.line(margin, y, margin + contentWidth, y);
    setText(doc, accent, 6.5, 'bold');
    doc.text(`[${source.id}]`, margin, y + 17);
    setText(doc, SLATE_950, 7.5, 'bold');
    paragraph(doc, source.title, margin + 34, y + 17, contentWidth * 0.47, { color: SLATE_950, size: 7.2, weight: 'bold', lineHeight: 8.5 });
    setText(doc, SLATE_500, 6.3, 'bold');
    doc.text(source.studyType.toUpperCase(), margin + contentWidth * 0.56, y + 17);
    paragraph(doc, `${source.evidenceRole}. Authors: ${source.authors}. Year: ${source.year}. DOI: ${source.doi}.`, margin + contentWidth * 0.56, y + 32, contentWidth * 0.41, { color: SLATE_700, size: 6.5, lineHeight: 8 });
    y += 58;
  });

  doc.setFillColor(...lighten(accent, 0.91));
  doc.roundedRect(margin, y + 8, contentWidth, 58, 7, 7, 'F');
  setText(doc, accent, 6.5, 'bold');
  doc.text('EVIDENCE ROLE', margin + 13, y + 27);
  paragraph(doc, 'Literature informs study design, interpretation, and benchmark selection. It does not prove this product performs, is preferred, or is commercially successful.', margin + 13, y + 43, contentWidth - 26, { color: SLATE_950, size: 7.4, weight: 'bold', lineHeight: 9.2 });
}
