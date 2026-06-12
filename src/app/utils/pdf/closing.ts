import {
  SLATE_950,
  WHITE,
  bulletList,
  paragraph,
  setDisplayText,
  type PdfContext,
} from './theme';
import type { ClosingSectionData } from './sections';

/** Final page: organization "about" note, source caveats, and the distribution-readiness check. */
export function renderClosingPage(ctx: PdfContext, data: ClosingSectionData, startY: number) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = startY;
  setDisplayText(doc, SLATE_950, 22, 'bold');
  doc.text(data.organizationName, margin, y);
  y = paragraph(doc, data.intro, margin, y + 33, 390, { size: 11, lineHeight: 16 }) + 34;

  setDisplayText(doc, SLATE_950, 14, 'bold');
  doc.text('Evidence and source notes', margin, y);
  y = bulletList(doc, data.sourceNotes, margin, y + 22, contentWidth, accent) + 18;

  doc.setFillColor(...primary);
  doc.rect(margin, y, contentWidth, 110, 'F');
  setDisplayText(doc, WHITE, 14, 'bold');
  doc.text('Distribution status', margin + 18, y + 29);
  paragraph(doc, data.distributionMessage, margin + 18, y + 55, contentWidth - 36, {
    color: WHITE,
    size: 10,
    lineHeight: 15,
  });
}
