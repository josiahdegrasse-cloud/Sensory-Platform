import type { GoStopTweakDecision } from './go-stop-tweak-engine';

export interface DecisionReportOptions {
  foodType: string;
  decisions: GoStopTweakDecision[];
  organizationName: string;
  workspaceName: string;
  reportFooter?: string;
  goThreshold: number;
  stopThreshold: number;
  generatedAt?: Date;
}

function safeFilename(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sensory';
}

function summary(options: DecisionReportOptions) {
  return {
    total: options.decisions.length,
    go: options.decisions.filter(item => item.decision === 'GO').length,
    tweak: options.decisions.filter(item => item.decision === 'TWEAK').length,
    stop: options.decisions.filter(item => item.decision === 'STOP').length,
    confidence: options.decisions.length
      ? options.decisions.reduce((sum, item) => sum + item.confidenceScore, 0) / options.decisions.length
      : 0,
  };
}

export function buildDecisionReportRows(decisions: GoStopTweakDecision[]) {
  return decisions.map(item => ({
    sample: item.sampleName,
    sampleId: item.sampleId,
    decision: item.decision,
    issf: Number(item.issfScore.toFixed(1)),
    confidence: Number(item.confidenceScore.toFixed(0)),
    risk: item.riskLevel,
    hedonic: Number(item.dimensionScores.hedonic.toFixed(1)),
    texture: Number(item.dimensionScores.texture.toFixed(1)),
    cata: Number(item.dimensionScores.cata.toFixed(1)),
    emotional: Number(item.dimensionScores.emotional.toFixed(1)),
    recommendation: item.recommendation,
    nextActions: item.prescriptions.map(action => action.action).join('; '),
    methodVersion: item.methodVersion,
    fingerprint: item.decisionFingerprint,
  }));
}

export async function downloadDecisionReportPdf(options: DecisionReportOptions) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const generatedAt = options.generatedAt ?? new Date();
  const totals = summary(options);
  const rows = buildDecisionReportRows(options.decisions);
  const document = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  document.setFillColor(15, 23, 42);
  document.rect(0, 0, document.internal.pageSize.getWidth(), 82, 'F');
  document.setTextColor(255, 255, 255);
  document.setFontSize(10);
  document.text(options.organizationName, 36, 28);
  document.setFontSize(20);
  document.text(`${options.foodType} sensory decision report`, 36, 55);
  document.setFontSize(9);
  document.text(`Generated ${generatedAt.toLocaleString()} | ${options.workspaceName}`, 36, 72);

  document.setTextColor(30, 41, 59);
  document.setFontSize(11);
  document.text(
    `${totals.total} formulations | ${totals.go} GO | ${totals.tweak} TWEAK | ${totals.stop} STOP | ${totals.confidence.toFixed(0)}% average confidence`,
    36,
    108,
  );
  document.setFontSize(9);
  document.text(`Decision thresholds: STOP below ${options.stopThreshold}, GO at ${options.goThreshold} or above.`, 36, 126);

  autoTable(document, {
    startY: 146,
    head: [['Sample', 'Decision', 'ISSF', 'Confidence', 'Risk', 'Hedonic', 'Texture', 'CATA', 'Emotional', 'Recommendation']],
    body: rows.map(row => [
      `${row.sample}\n${row.sampleId}`,
      row.decision,
      row.issf,
      `${row.confidence}%`,
      row.risk,
      row.hedonic,
      row.texture,
      row.cata,
      row.emotional,
      row.recommendation,
    ]),
    styles: { fontSize: 7.5, cellPadding: 5, textColor: [51, 65, 85], valign: 'middle' },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 90 }, 9: { cellWidth: 180 } },
    didDrawPage: data => {
      const pageHeight = document.internal.pageSize.getHeight();
      document.setFontSize(8);
      document.setTextColor(100, 116, 139);
      document.text(options.reportFooter || 'Confidential sensory analysis report', 36, pageHeight - 20);
      document.text(`Page ${data.pageNumber}`, document.internal.pageSize.getWidth() - 70, pageHeight - 20);
    },
  });

  document.save(`${safeFilename(options.foodType)}-decision-report.pdf`);
}

export async function downloadDecisionReportExcel(options: DecisionReportOptions) {
  const excel = (await import('exceljs')).default;
  const { Workbook } = excel;
  const generatedAt = options.generatedAt ?? new Date();
  const totals = summary(options);
  const rows = buildDecisionReportRows(options.decisions);
  const workbook = new Workbook();
  workbook.creator = options.organizationName;
  workbook.created = generatedAt;

  const overview = workbook.addWorksheet('Executive Summary', { views: [{ showGridLines: false }] });
  overview.columns = [{ width: 26 }, { width: 52 }];
  overview.addRows([
    [options.organizationName],
    [`${options.foodType} sensory decision report`],
    [],
    ['Workspace', options.workspaceName],
    ['Generated', generatedAt],
    ['Formulations', totals.total],
    ['GO', totals.go],
    ['TWEAK', totals.tweak],
    ['STOP', totals.stop],
    ['Average confidence', Number(totals.confidence.toFixed(1)) / 100],
    ['STOP threshold', options.stopThreshold],
    ['GO threshold', options.goThreshold],
    ['Footer', options.reportFooter || 'Confidential sensory analysis report'],
  ]);
  overview.mergeCells('A1:B1');
  overview.mergeCells('A2:B2');
  overview.getRow(1).height = 28;
  overview.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16 };
  overview.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  overview.getRow(2).font = { bold: true, color: { argb: 'FF1E293B' }, size: 14 };
  overview.getCell('B5').numFmt = 'mmm d, yyyy h:mm AM/PM';
  overview.getCell('B10').numFmt = '0.0%';
  overview.eachRow((row, index) => {
    if (index >= 4) {
      row.getCell(1).font = { bold: true, color: { argb: 'FF475569' } };
      row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    }
  });

  const decisions = workbook.addWorksheet('Formulation Decisions', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  decisions.autoFilter = { from: 'A1', to: 'N1' };
  decisions.columns = [
    { header: 'Sample', key: 'sample', width: 28 },
    { header: 'Sample ID', key: 'sampleId', width: 14 },
    { header: 'Decision', key: 'decision', width: 12 },
    { header: 'ISSF', key: 'issf', width: 10 },
    { header: 'Confidence', key: 'confidence', width: 12 },
    { header: 'Risk', key: 'risk', width: 10 },
    { header: 'Hedonic', key: 'hedonic', width: 11 },
    { header: 'Texture', key: 'texture', width: 11 },
    { header: 'CATA', key: 'cata', width: 11 },
    { header: 'Emotional', key: 'emotional', width: 11 },
    { header: 'Recommendation', key: 'recommendation', width: 52 },
    { header: 'Next actions', key: 'nextActions', width: 62 },
    { header: 'Method version', key: 'methodVersion', width: 18 },
    { header: 'Fingerprint', key: 'fingerprint', width: 18 },
  ];
  decisions.addRows(rows);
  decisions.getRow(1).height = 24;
  decisions.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle' };
  });
  decisions.eachRow((row, index) => {
    if (index > 1) {
      row.alignment = { vertical: 'top', wrapText: true };
      row.getCell('confidence').numFmt = '0"%"';
      if (index % 2 === 0) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
      }
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFilename(options.foodType)}-decision-report.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
