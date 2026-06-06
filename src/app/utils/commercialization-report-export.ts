import type { CommercializationReportSnapshot } from '../lib/commercialization-report';

async function imageDataUrl(url: string) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function downloadCommercializationReportPdf(input: {
  snapshot: CommercializationReportSnapshot;
  organizationName: string;
  workspaceName: string;
  reportFooter?: string;
  version: number;
  status: string;
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const packaging = await imageDataUrl(input.snapshot.concept.packagingImageUrl);

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, width, 150, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(input.organizationName, 40, 38);
  doc.setFontSize(24);
  doc.text('Commercialization Report', 40, 76);
  doc.setFontSize(16);
  doc.text(input.snapshot.product.sampleName, 40, 106);
  doc.setFontSize(9);
  doc.text(`${input.workspaceName} | Version ${input.version} | ${input.status.toUpperCase()}`, 40, 130);

  let y = 185;
  if (packaging) {
    doc.addImage(packaging, packaging.startsWith('data:image/png') ? 'PNG' : 'JPEG', width - 205, 170, 150, 150, undefined, 'FAST');
  }
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.text('EXECUTIVE RECOMMENDATION', 40, y);
  doc.setFontSize(12);
  doc.text(doc.splitTextToSize(input.snapshot.narrative.executiveSummary, packaging ? width - 270 : width - 80), 40, y + 22);
  y += packaging ? 165 : 95;

  autoTable(doc, {
    startY: y,
    head: [['Decision', 'ISSF', 'Confidence', 'Panel responses', 'Purchase intent']],
    body: [[
      input.snapshot.decision.outcome,
      input.snapshot.decision.issfScore.toFixed(1),
      `${input.snapshot.decision.confidence.toFixed(0)}%`,
      input.snapshot.evidence.responseCount,
      input.snapshot.evidence.purchaseIntent === null ? 'Not measured' : input.snapshot.evidence.purchaseIntent.toFixed(1),
    ]],
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 9, cellPadding: 7 },
  });

  const sections = [
    ['Why this product is liked', input.snapshot.narrative.whyLiked],
    ['Packaging direction', input.snapshot.narrative.packagingRationale],
    ['Launch recommendation', input.snapshot.narrative.launchRecommendation],
    ['Claims and limitations', input.snapshot.narrative.claimCaution],
  ];
  let sectionY = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 70;
  sections.forEach(([heading, body]) => {
    if (sectionY > height - 120) {
      doc.addPage();
      sectionY = 50;
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(heading, 40, sectionY + 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(body, width - 80);
    doc.text(lines, 40, sectionY + 47);
    sectionY += 52 + lines.length * 10;
  });

  if (input.snapshot.evidence.topSelections.length > 0) {
    if (sectionY > height - 180) {
      doc.addPage();
      sectionY = 50;
    }
    autoTable(doc, {
      startY: sectionY + 20,
      head: [['Panelist language', 'Selections', 'Share of panel']],
      body: input.snapshot.evidence.topSelections.map(item => [item.option, item.count, `${item.percentage.toFixed(0)}%`]),
      headStyles: { fillColor: [51, 65, 85] },
      styles: { fontSize: 9, cellPadding: 6 },
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(input.reportFooter || 'Confidential commercialization evidence', 40, height - 24);
    doc.text(`Page ${page} of ${pageCount}`, width - 90, height - 24);
  }
  doc.save(`${input.snapshot.product.sampleId.toLowerCase()}-commercialization-report-v${input.version}.pdf`);
}
