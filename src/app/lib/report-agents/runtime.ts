import type { CommercializationReportSnapshot } from '../commercialization-report';
import type { GeneratedSections, ReportContext } from '../report-qc';
import {
  buildCommercializationReportPdf,
  buildGeneratedReportSections,
  type CommercializationReportPdfInput,
} from '../../utils/commercialization-report-export';
import type {
  RenderedPagePacket,
  ReportRenderResult,
  WrittenReportResult,
} from './types';
import { containsInternalWritingInstructions } from '../report-evaluator';

function sectionText(draft: WrittenReportResult, patterns: RegExp[]): string {
  const sections = draft.pages.flatMap(page => page.sections);
  const match = sections.find(section =>
    patterns.some(pattern => pattern.test(`${section.sectionId} ${section.heading}`)),
  );
  const body = match?.body.trim() ?? '';
  return containsInternalWritingInstructions(body) ? '' : body;
}

export function applyAgentDraftToSnapshot(
  snapshot: CommercializationReportSnapshot,
  draft: WrittenReportResult,
): CommercializationReportSnapshot {
  const executiveSummary = sectionText(draft, [/executive/i, /decision/i, /summary/i]);
  const whyLiked = sectionText(draft, [/performance/i, /evidence/i, /sensory/i, /why/i]);
  const packagingRationale = sectionText(draft, [/packag/i, /concept/i, /position/i]);
  const launchRecommendation = sectionText(draft, [/recommend/i, /next[-_ ]?move/i, /action/i]);
  const claimCaution = sectionText(draft, [/limitation/i, /risk/i, /claim/i, /caution/i]);
  return {
    ...snapshot,
    narrative: {
      executiveSummary: executiveSummary || snapshot.narrative.executiveSummary,
      whyLiked: whyLiked || snapshot.narrative.whyLiked,
      packagingRationale: packagingRationale || snapshot.narrative.packagingRationale,
      launchRecommendation: launchRecommendation || snapshot.narrative.launchRecommendation,
      claimCaution: claimCaution || snapshot.narrative.claimCaution,
    },
  };
}

async function renderPdfPages(pdfBytes: ArrayBuffer, warningRequired: boolean): Promise<RenderedPagePacket[]> {
  const [{ getDocument, GlobalWorkerOptions }, workerUrl] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  GlobalWorkerOptions.workerSrc = workerUrl.default;
  const pdf = await getDocument({ data: new Uint8Array(pdfBytes) }).promise;
  const pages: RenderedPagePacket[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.05 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error(`Unable to create a canvas for report page ${pageNumber}.`);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map(item => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push({
      page: pageNumber,
      imageUrl: canvas.toDataURL('image/jpeg', 0.72),
      width: canvas.width,
      height: canvas.height,
      text,
      minimumFontSizePt: null,
      contrastFailures: [],
      warningRequired,
      warningVisible: !warningRequired || /REFERENCE\s*\/\s*DEMONSTRATION EVIDENCE/i.test(text),
    });
  }
  return pages;
}

export function buildPageText(generated: GeneratedSections): Array<{ page: number; text: string }> {
  return generated.sections.map((section, index) => ({
    page: Math.min(index + 1, 9),
    text: `${section.label}: ${section.text}`,
  }));
}

export async function renderAgentReviewedReport(input: {
  baseInput: CommercializationReportPdfInput & { reportContext: ReportContext };
  draft: WrittenReportResult;
}): Promise<ReportRenderResult & { snapshot: CommercializationReportSnapshot }> {
  const snapshot = applyAgentDraftToSnapshot(input.baseInput.snapshot, input.draft);
  const pdfInput = { ...input.baseInput, snapshot };
  const { doc } = await buildCommercializationReportPdf(pdfInput);
  const pdfBytes = doc.output('arraybuffer');
  const generatedSections = buildGeneratedReportSections(pdfInput);
  const renderedPages = await renderPdfPages(
    pdfBytes,
    /reference\/demo|reference-demo/i.test(input.baseInput.reportContext.evidenceProvenance),
  );
  return {
    snapshot,
    generatedSections,
    writtenReport: input.draft,
    finalPdfText: renderedPages.map(page => `Page ${page.page}\n${page.text}`).join('\n\n'),
    renderedPages,
  };
}
