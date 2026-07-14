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

// The legacy template key is retained for saved reports, but now renders the
// NFI house style established by its authored food-industry publications.
export const NFI_CORAL: Rgb = [124, 154, 137];
export const NFI_CORAL_DARK: Rgb = [82, 108, 95];
export const NFI_AQUA: Rgb = [170, 192, 180];
export const NFI_AQUA_DARK: Rgb = [82, 108, 95];
export const NFI_AQUA_SOFT: Rgb = [238, 243, 240];
export const NFI_INK: Rgb = [42, 53, 48];
export const NFI_MUTED: Rgb = [101, 117, 108];
export const NFI_SURFACE: Rgb = [247, 244, 236];
export const NFI_LINE: Rgb = [237, 232, 220];

export const CREAM: Rgb = NFI_SURFACE;
export const CREAM_LINE: Rgb = NFI_LINE;
export const SAGE: Rgb = NFI_CORAL;
export const SAGE_DARK: Rgb = NFI_CORAL_DARK;
export const CHARCOAL: Rgb = NFI_INK;
export const BODY_SAGE: Rgb = NFI_MUTED;

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
  /** Mandatory page-level provenance warning, rendered on every page. */
  documentWarning?: string;
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
    doc.setFillColor(...NFI_CORAL);
    doc.rect(0, 0, width * 0.78, 4, 'F');
    doc.setFillColor(...NFI_AQUA);
    doc.rect(width * 0.78, 0, width * 0.22, 4, 'F');
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

/** Consistent conclusion-led heading used by the eight-page client report. */
export function reportPageHeading(
  ctx: PdfContext,
  page: number,
  section: string,
  title: string,
  purpose: string,
) {
  const { doc, width, margin, contentWidth, primary, template } = ctx;
  const brandTemplate = template === 'editorial-sage';
  const brandAccent = brandTemplate ? NFI_CORAL : ctx.accent;
  const sectionTone = brandTemplate ? NFI_AQUA_DARK : ctx.accent;
  const purposeTone = brandTemplate ? NFI_MUTED : SLATE_500;

  setDisplayText(doc, lighten(brandAccent, 0.88), 46, 'bold');
  doc.text(String(page).padStart(2, '0'), width - margin, 92, { align: 'right' });
  setText(doc, sectionTone, 8, 'bold');
  doc.text(`PAGE ${page} · ${section.toUpperCase()}`, margin, 68);

  let titleSize = 24;
  setDisplayText(doc, primary, titleSize, 'bold');
  while (doc.getTextWidth(title) > contentWidth - 52 && titleSize > 14) {
    titleSize -= 1;
    setDisplayText(doc, primary, titleSize, 'bold');
  }
  doc.text(title, margin, 99);
  const bottom = paragraph(doc, purpose, margin, 122, Math.min(contentWidth, 450), {
    color: purposeTone,
    size: 9,
    lineHeight: 13,
  });

  doc.setDrawColor(...brandAccent);
  doc.setLineWidth(3);
  doc.line(margin, bottom + 8, margin + 48, bottom + 8);
  doc.setDrawColor(...(brandTemplate ? NFI_AQUA : ctx.accent));
  doc.line(margin + 54, bottom + 8, margin + 78, bottom + 8);
  doc.setDrawColor(...(brandTemplate ? NFI_LINE : SLATE_200));
  doc.setLineWidth(0.6);
  doc.line(margin + 86, bottom + 8, width - margin, bottom + 8);
  return bottom + 30;
}

/** A concise authored interpretation band, distinct from measured evidence. */
export function nfiViewBand(
  ctx: PdfContext,
  y: number,
  label: string,
  text: string,
  height = 58,
) {
  const { doc, margin, contentWidth, template } = ctx;
  const fill = template === 'editorial-sage' ? NFI_AQUA_SOFT : lighten(ctx.accent, 0.91);
  const labelTone = template === 'editorial-sage' ? NFI_CORAL_DARK : ctx.accent;
  const textTone = template === 'editorial-sage' ? NFI_INK : SLATE_950;
  doc.setFillColor(...fill);
  doc.rect(margin, y, contentWidth, height, 'F');
  doc.setDrawColor(...(template === 'editorial-sage' ? NFI_AQUA : ctx.accent));
  doc.setLineWidth(1.2);
  doc.line(margin, y, margin + contentWidth, y);
  setText(doc, labelTone, 6.6, 'bold');
  doc.text(`NFI VIEW · ${label.toUpperCase()}`, margin + 14, y + 19);
  paragraph(doc, text, margin + 14, y + 38, contentWidth - 28, {
    color: textTone,
    size: 7.7,
    weight: 'bold',
    lineHeight: 9.8,
  });
  return y + height;
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
  const { doc, width, height, margin, primary, template, documentWarning } = ctx;
  if (documentWarning) {
    setText(doc, AMBER, 6.5, 'bold');
    const warning = doc.splitTextToSize(documentWarning, width - margin * 2 - 42) as string[];
    doc.text(warning.slice(0, 1), margin, height - 34);
  }
  if (template === 'editorial-sage') {
    doc.setDrawColor(...NFI_LINE);
    doc.setLineWidth(0.5);
    doc.line(margin, height - 28, width - margin, height - 28);
    setText(doc, NFI_MUTED, 7);
    doc.text(reportFooter || `Prepared by ${ctx.organizationName} · Confidential commercialization report`, margin, height - 14);
    doc.setDrawColor(...NFI_AQUA);
    doc.setLineWidth(2.2);
    doc.line(width - margin - 45, height - 15, width - margin - 24, height - 15);
    setText(doc, NFI_CORAL_DARK, 8, 'bold');
    doc.text(String(page).padStart(2, '0'), width - margin, height - 13, { align: 'right' });
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
