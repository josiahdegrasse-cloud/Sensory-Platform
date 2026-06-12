export type PdfDocument = import('jspdf').jsPDF;
export type AutoTableFn = typeof import('jspdf-autotable').default;
export type Rgb = [number, number, number];

export const DEFAULT_ACCENT: Rgb = [37, 99, 235];

export const SLATE_950: Rgb = [15, 23, 42];
export const SLATE_700: Rgb = [51, 65, 85];
export const SLATE_500: Rgb = [100, 116, 139];
export const SLATE_200: Rgb = [226, 232, 240];
export const SLATE_50: Rgb = [248, 250, 252];
export const WHITE: Rgb = [255, 255, 255];
export const GREEN: Rgb = [5, 150, 105];
export const AMBER: Rgb = [180, 83, 9];
export const ROSE: Rgb = [190, 18, 60];

/** Shared layout/branding context passed to every PDF section renderer. */
export interface PdfContext {
  doc: PdfDocument;
  width: number;
  height: number;
  margin: number;
  contentWidth: number;
  primary: Rgb;
  accent: Rgb;
  organizationName: string;
  productName: string;
}

export function hexToRgb(hex?: string | null): Rgb | null {
  if (!hex) return null;
  const normalized = hex.trim().replace(/^#/, '');
  const full = normalized.length === 3
    ? normalized.split('').map(character => character + character).join('')
    : normalized;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Blends a color toward white, used for soft decorative accents on banners. */
export function lighten([r, g, b]: Rgb, amount: number): Rgb {
  return [
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount),
  ];
}

export async function imageDataUrl(url: string) {
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

export function imageFormat(dataUrl: string) {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
}

export function setText(doc: PdfDocument, color: Rgb, size: number, weight: 'normal' | 'bold' = 'normal') {
  doc.setTextColor(...color);
  doc.setFont('helvetica', weight);
  doc.setFontSize(size);
}

export function paragraph(doc: PdfDocument, text: string, x: number, y: number, maxWidth: number, options?: {
  color?: Rgb;
  size?: number;
  weight?: 'normal' | 'bold';
  lineHeight?: number;
}) {
  const size = options?.size ?? 10;
  const lineHeight = options?.lineHeight ?? size * 1.35;
  setText(doc, options?.color ?? SLATE_700, size, options?.weight);
  const lines = doc.splitTextToSize(text || 'Not available.', maxWidth) as string[];
  doc.text(lines, x, y, { lineHeightFactor: lineHeight / size });
  return y + lines.length * lineHeight;
}

export function sectionTitle(ctx: PdfContext, title: string, y: number) {
  const { doc, margin, accent } = ctx;
  doc.setFillColor(...accent);
  doc.roundedRect(margin, y - 13, 5, 22, 2, 2, 'F');
  setText(doc, SLATE_950, 16, 'bold');
  doc.text(title, margin + 16, y + 3);
  return y + 24;
}

export function labelValue(doc: PdfDocument, label: string, value: string, x: number, y: number, width: number) {
  doc.setFillColor(...SLATE_50);
  doc.setDrawColor(...SLATE_200);
  doc.roundedRect(x, y, width, 54, 6, 6, 'FD');
  setText(doc, SLATE_500, 7.5, 'bold');
  doc.text(label.toUpperCase(), x + 10, y + 16);
  setText(doc, SLATE_950, 12, 'bold');
  const lines = doc.splitTextToSize(value, width - 20) as string[];
  doc.text(lines.slice(0, 2), x + 10, y + 35);
}

export function bulletList(doc: PdfDocument, items: string[], x: number, y: number, maxWidth: number, accent: Rgb) {
  let nextY = y;
  items.filter(Boolean).forEach(item => {
    doc.setFillColor(...accent);
    doc.circle(x + 3, nextY - 3, 2.2, 'F');
    nextY = paragraph(doc, item, x + 13, nextY, maxWidth - 13, { size: 9.5, lineHeight: 13 }) + 7;
  });
  return nextY;
}

function pageHeader(ctx: PdfContext) {
  const { doc, width, organizationName, productName, accent } = ctx;
  doc.setFillColor(...accent);
  doc.rect(0, 0, width, 5, 'F');
  setText(doc, SLATE_500, 8, 'bold');
  doc.text(organizationName, 40, 25);
  setText(doc, SLATE_500, 8);
  doc.text(productName, width - 40, 25, { align: 'right' });
}

/** Starts a new page with the standard branded header and returns the starting content y. */
export function addContentPage(ctx: PdfContext) {
  ctx.doc.addPage();
  pageHeader(ctx);
  return 58;
}

/**
 * Editorial chapter banner: accent-bordered color block with an eyebrow
 * chapter label and a large title, plus a soft decorative tint that echoes
 * the photo-led section headers of print-style reports.
 */
export function chapterBanner(ctx: PdfContext, chapter: string, title: string, y: number) {
  const { doc, width, primary, accent } = ctx;
  const bannerWidth = width - 80;
  doc.setFillColor(...primary);
  doc.roundedRect(40, y, bannerWidth, 86, 8, 8, 'F');
  const tint = lighten(primary, 0.14);
  doc.setFillColor(...tint);
  doc.roundedRect(40 + bannerWidth - 150, y, 150, 86, 8, 8, 'F');
  doc.setFillColor(...primary);
  doc.rect(40 + bannerWidth - 150, y, 8, 86, 'F');
  doc.setFillColor(...accent);
  doc.roundedRect(40, y, 8, 86, 4, 4, 'F');
  doc.setFillColor(...accent);
  doc.roundedRect(64, y + 16, 86, 16, 8, 8, 'F');
  setText(doc, WHITE, 8.5, 'bold');
  doc.text(chapter.toUpperCase(), 64 + 43, y + 27, { align: 'center' });
  setText(doc, WHITE, 20, 'bold');
  const lines = doc.splitTextToSize(title, width - 144) as string[];
  doc.text(lines.slice(0, 2), 64, y + 58, { lineHeightFactor: 1.1 });
  return y + 112;
}

/**
 * Branded footer applied to every page: report footer copy on the left and a
 * rounded "Page N" pill on the right, matching the badge-style pagination
 * used in client-facing print reports.
 */
export function renderFooter(ctx: PdfContext, page: number, reportFooter?: string) {
  const { doc, width, height, margin, accent } = ctx;
  setText(doc, SLATE_500, 7.5);
  doc.text(reportFooter || 'Confidential commercialization report', margin, height - 21);
  const pillHeight = 22;
  const pillWidth = 60;
  const pillX = width - margin - pillWidth;
  const pillY = height - 21 - pillHeight / 2 - 6;
  doc.setFillColor(...accent);
  doc.roundedRect(pillX, pillY, pillWidth, pillHeight, pillHeight / 2, pillHeight / 2, 'F');
  setText(doc, WHITE, 9, 'bold');
  doc.text(`Page ${page}`, pillX + pillWidth / 2, pillY + pillHeight / 2 + 3, { align: 'center' });
}
