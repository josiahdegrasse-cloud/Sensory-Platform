import { jsPDF } from 'jspdf';

/**
 * One-click "concept board" export: the concept's visuals laid out on a single
 * landscape page with captions, panel-preference evidence (when present), and
 * an honest AI-provenance line — a buyer-meeting leave-behind, not final art.
 */
export interface ConceptBoardImage {
  url: string;
  /** e.g. "Option 2 — Packaging mockup" */
  label: string;
  /** e.g. "8 of 14 selections (57%)" */
  sublabel?: string;
  highlight?: boolean;
}

export interface ConceptBoardInput {
  conceptName: string;
  organizationName: string;
  contextLine: string;
  images: ConceptBoardImage[];
  footer?: string;
}

async function toDataUrl(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
      image.onerror = () => reject(new Error('image decode failed'));
      image.src = dataUrl;
    });
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

export async function downloadConceptBoardPdf(input: ConceptBoardInput): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();   // 297
  const pageHeight = doc.internal.pageSize.getHeight(); // 210
  const margin = 14;

  // Masthead
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(input.conceptName || 'Concept board', margin, margin + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    [input.organizationName, new Date().toLocaleDateString()].filter(Boolean).join('  ·  '),
    pageWidth - margin,
    margin + 6,
    { align: 'right' },
  );
  if (input.contextLine) {
    doc.setFontSize(9.5);
    doc.text(doc.splitTextToSize(input.contextLine, pageWidth - margin * 2), margin, margin + 12);
  }

  // Image grid (up to 4 per board), aspect-fit inside each cell.
  const images = input.images.slice(0, 4);
  const gridTop = margin + 20;
  const gridBottom = pageHeight - margin - 8;
  const columns = Math.min(2, Math.max(1, images.length));
  const rows = images.length > 2 ? 2 : 1;
  const gap = 8;
  const cellWidth = (pageWidth - margin * 2 - gap * (columns - 1)) / columns;
  const cellHeight = (gridBottom - gridTop - gap * (rows - 1)) / rows;
  const captionHeight = 10;

  for (let index = 0; index < images.length; index++) {
    const item = images[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cellX = margin + column * (cellWidth + gap);
    const cellY = gridTop + row * (cellHeight + gap);
    const frameHeight = cellHeight - captionHeight;

    const loaded = await toDataUrl(item.url);
    if (loaded) {
      const scale = Math.min(cellWidth / loaded.width, frameHeight / loaded.height);
      const drawWidth = loaded.width * scale;
      const drawHeight = loaded.height * scale;
      const drawX = cellX + (cellWidth - drawWidth) / 2;
      const drawY = cellY + (frameHeight - drawHeight) / 2;
      doc.addImage(loaded.dataUrl, 'PNG', drawX, drawY, drawWidth, drawHeight, undefined, 'FAST');
    } else {
      doc.setDrawColor(203, 213, 225);
      doc.rect(cellX, cellY, cellWidth, frameHeight);
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Image unavailable', cellX + cellWidth / 2, cellY + frameHeight / 2, { align: 'center' });
    }
    if (item.highlight) {
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(0.8);
      doc.rect(cellX - 1, cellY - 1, cellWidth + 2, frameHeight + 2);
      doc.setLineWidth(0.2);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(item.label, cellX, cellY + frameHeight + 5);
    if (item.sublabel) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(item.sublabel, cellX, cellY + frameHeight + 9);
    }
  }

  // Provenance footer — the platform's honesty rule travels with the export.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    input.footer?.trim()
      || 'AI-generated concept visuals for directional review — not final artwork. Preference figures reflect the panel sample shown.',
    margin,
    pageHeight - margin + 4,
  );

  const safeName = (input.conceptName || 'concept-board').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  doc.save(`${safeName || 'concept-board'}-board.pdf`);
}
