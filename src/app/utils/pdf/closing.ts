import {
  SLATE_950,
  WHITE,
  bulletList,
  paragraph,
  setText,
  type PdfContext,
} from './theme';
import type { ClosingSectionData } from './sections';

/** Final page: organization "about" note, source caveats, and the distribution-readiness check. */
export function renderClosingPage(ctx: PdfContext, data: ClosingSectionData, startY: number) {
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = startY;
  setText(doc, SLATE_950, 16, 'bold');
  doc.text(data.organizationName, margin, y);
  y = paragraph(doc, data.intro, margin, y + 26, contentWidth, { size: 11, lineHeight: 16 }) + 28;

  setText(doc, SLATE_950, 12, 'bold');
  doc.text('Evidence and source notes', margin, y);
  y = bulletList(doc, data.sourceNotes, margin, y + 22, contentWidth, accent) + 18;

  doc.setFillColor(...primary);
  doc.roundedRect(margin, y, contentWidth, 110, 8, 8, 'F');
  setText(doc, WHITE, 13, 'bold');
  doc.text('Final distribution check', margin + 16, y + 28);
  paragraph(doc, data.distributionMessage, margin + 16, y + 52, contentWidth - 32, {
    color: WHITE,
    size: 10,
    lineHeight: 15,
  });
}
