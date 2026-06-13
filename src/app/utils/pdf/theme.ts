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

// "Editorial sage" template — cream/sage masthead palette.
export const CREAM: Rgb = [247, 244, 236];
export const CREAM_LINE: Rgb = [237, 232, 220];
export const SAGE: Rgb = [124, 154, 137];
export const SAGE_DARK: Rgb = [82, 108, 95];
export const CHARCOAL: Rgb = [42, 53, 48];
export const BODY_SAGE: Rgb = [101, 117, 108];

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
  /** PDF layout: navy/blue editorial (default) or the cream/sage masthead. */
  template?: 'standard' | 'editorial-sage';
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
  if (url.startsWith('data:image/')) return url;
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

export function setDisplayText(doc: PdfDocument, color: Rgb, size: number, weight: 'normal' | 'bold' = 'bold') {
  doc.setTextColor(...color);
  doc.setFont('times', weight);
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
  const { doc, margin, contentWidth, primary } = ctx;
  setDisplayText(doc, primary, 17, 'bold');
  doc.text(title, margin, y);
  doc.setDrawColor(...primary);
  doc.setLineWidth(1.2);
  doc.line(margin, y + 8, margin + contentWidth, y + 8);
  return y + 29;
}

export function labelValue(ctx: PdfContext, label: string, value: string, x: number, y: number, width: number) {
  const { doc, template } = ctx;
  const lineColor = template === 'editorial-sage' ? CREAM_LINE : SLATE_200;
  const labelColor = template === 'editorial-sage' ? BODY_SAGE : SLATE_500;
  const valueColor = template === 'editorial-sage' ? CHARCOAL : SLATE_950;
  doc.setDrawColor(...lineColor);
  doc.setLineWidth(0.7);
  doc.line(x, y, x + width, y);
  setText(doc, labelColor, 7.5, 'bold');
  doc.text(label, x, y + 15);
  setDisplayText(doc, valueColor, 13, 'bold');
  const lines = doc.splitTextToSize(value, width - 4) as string[];
  doc.text(lines.slice(0, 2), x, y + 35, { lineHeightFactor: 1.05 });
}

export function bulletList(doc: PdfDocument, items: string[], x: number, y: number, maxWidth: number, accent: Rgb) {
  let nextY = y;
  items.filter(Boolean).forEach(item => {
    doc.setDrawColor(...accent);
    doc.setLineWidth(1.4);
    doc.line(x, nextY - 4, x + 9, nextY - 4);
    nextY = paragraph(doc, item, x + 17, nextY, maxWidth - 17, { size: 9.5, lineHeight: 13 }) + 8;
  });
  return nextY;
}

function pageHeader(ctx: PdfContext) {
  const { doc, width, height, organizationName, productName, margin, primary, template } = ctx;
  if (template === 'editorial-sage') {
    doc.setFillColor(...CREAM);
    doc.rect(0, 0, width, height, 'F');
  }
  setText(doc, primary, 7.5, 'bold');
  doc.text(organizationName, margin, 26);
  setText(doc, template === 'editorial-sage' ? BODY_SAGE : SLATE_500, 7.5);
  doc.text(productName, width - margin, 26, { align: 'right' });
  doc.setDrawColor(...(template === 'editorial-sage' ? CREAM_LINE : SLATE_200));
  doc.setLineWidth(0.5);
  doc.line(margin, 35, width - margin, 35);
}

/** Starts a new page with the standard branded header and returns the starting content y. */
export function addContentPage(ctx: PdfContext) {
  ctx.doc.addPage();
  pageHeader(ctx);
  return 64;
}

/**
 * Editorial chapter opener inspired by authored food-industry reports:
 * a restrained color field, clear section label, and large publication title.
 */
export function chapterBanner(ctx: PdfContext, chapter: string, title: string, y: number) {
  const { doc, width, margin, primary, accent, template } = ctx;
  const bannerWidth = width - margin * 2;
  if (template === 'editorial-sage') {
    doc.setFillColor(...accent);
    doc.roundedRect(margin, y, bannerWidth, 100, 14, 14, 'F');
    setText(doc, CREAM, 8, 'bold');
    doc.text(chapter, margin + 26, y + 30);
    setDisplayText(doc, CREAM, 22, 'bold');
    const sageLines = doc.splitTextToSize(title, bannerWidth - 52) as string[];
    doc.text(sageLines.slice(0, 2), margin + 26, y + 60, { lineHeightFactor: 1.05 });
    return y + 132;
  }
  doc.setFillColor(...lighten(primary, 0.08));
  doc.rect(margin, y, bannerWidth, 104, 'F');
  doc.setFillColor(...accent);
  doc.rect(margin, y, 12, 104, 'F');
  setText(doc, WHITE, 8, 'bold');
  doc.text(chapter, margin + 29, y + 28);
  setDisplayText(doc, WHITE, 23, 'bold');
  const lines = doc.splitTextToSize(title, bannerWidth - 58) as string[];
  doc.text(lines.slice(0, 2), margin + 29, y + 60, { lineHeightFactor: 1.05 });
  return y + 135;
}

/**
 * Branded footer applied to every page with a quiet publication-style folio.
 */
export function renderFooter(ctx: PdfContext, page: number, reportFooter?: string) {
  const { doc, width, height, margin, primary, accent, template } = ctx;
  if (template === 'editorial-sage') {
    setText(doc, BODY_SAGE, 7);
    doc.text(reportFooter || 'Confidential commercialization report', margin, height - 19);
    const label = String(page).padStart(2, '0');
    const pillWidth = 30;
    const pillHeight = 17;
    const pillX = width - margin - pillWidth;
    const pillY = height - 28;
    doc.setFillColor(...accent);
    doc.roundedRect(pillX, pillY, pillWidth, pillHeight, pillHeight / 2, pillHeight / 2, 'F');
    setText(doc, CREAM, 8, 'bold');
    doc.text(label, pillX + pillWidth / 2, pillY + 12, { align: 'center' });
    return;
  }
  doc.setDrawColor(...SLATE_200);
  doc.setLineWidth(0.5);
  doc.line(margin, height - 34, width - margin, height - 34);
  setText(doc, SLATE_500, 7);
  doc.text(reportFooter || 'Confidential commercialization report', margin, height - 19);
  setText(doc, primary, 8, 'bold');
  doc.text(String(page).padStart(2, '0'), width - margin, height - 19, { align: 'right' });
}
