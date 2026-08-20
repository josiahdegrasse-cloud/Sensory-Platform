import {
  CHARCOAL,
  DEFAULT_ACCENT,
  SAGE,
  SLATE_950,
  addContentPage,
  hexToRgb,
  imageDataUrl,
  renderFooter,
  type PdfContext,
  type Rgb,
} from './pdf/theme';
import {
  buildAppendix,
  buildCommercializationPlan,
  buildClaimsMatrix,
  buildConsumerEvidence,
  buildDecisionBasis,
  buildConceptPackaging,
  buildDecisionSnapshot,
  buildExecutiveReadout,
  buildMethodEvidence,
  buildPerformanceDashboard,
  buildProductReadiness,
  buildCommercialReadiness,
  buildRisks,
  buildScientificContext,
  type CommercializationReportPdfInput,
} from './pdf/sections';
import {
  renderDecisionSnapshotPage,
  renderPerformanceDashboardPage,
} from './pdf/pages/decision-pages';
import {
  renderClaimsMatrixPage,
  renderCommercializationPlanPage,
} from './pdf/pages/action-pages';
import {
  renderDecisionBasisPage,
  renderInstrumentalRiskPage,
} from './pdf/pages/professional-pages';
import {
  renderCommercialStrategyPage,
  renderProductReadinessPage,
} from './pdf/pages/readiness-pages';
import { runQcPipeline, type GeneratedSections, type QcPipelineResult } from '../lib/report-qc';
import { evaluateCommercializationReport } from './commercialization-report-quality';

export type { CommercializationReportPdfInput } from './pdf/sections';

const RAW_CLIENT_FLOAT = /(-?\d+\.\d{5,})/g;

export function normalizeClientFacingNumbers(value: string) {
  if (/^(?:data|blob):/i.test(value)) return value;
  return value.replace(RAW_CLIENT_FLOAT, (raw, _capture, offset: number) => {
    const tokenStart = value.lastIndexOf(' ', offset) + 1;
    const nextSpace = value.indexOf(' ', offset + raw.length);
    const tokenEnd = nextSpace === -1 ? value.length : nextSpace;
    const token = value.slice(tokenStart, tokenEnd).replace(/^[([{'"`]+|[)\]},;'"`]+$/g, '');
    if (/^(?:doi:?)?10\.\d{4,9}\//i.test(token) || /^https?:\/\/(?:dx\.)?doi\.org\/10\.\d{4,9}\//i.test(token)) {
      return raw;
    }
    const number = Number(raw);
    if (!Number.isFinite(number)) return raw;
    if (number !== 0 && Math.abs(number) < 0.0001) return number.toExponential(2);
    return Number(number.toFixed(4)).toString();
  });
}

function normalizeReportValue<T>(value: T): T {
  if (typeof value === 'string') return normalizeClientFacingNumbers(value) as T;
  if (Array.isArray(value)) return value.map(item => normalizeReportValue(item)) as T;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeReportValue(item)]),
    ) as T;
  }
  return value;
}

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\p{Diacritic}]/gu, '')
    .replace(/\bv(\d+)\.0\b/gi, 'v$1')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Builds a clean, descriptive PDF filename, e.g.
 * `new-food-innovation-coconut-cheddar-v3-commercialization-report-go-2026-06-11.pdf`.
 * Falls back to "food-platform" when no client/organization name is available.
 */
export function buildCommercializationReportFilename(input: {
  clientName?: string | null;
  productName: string;
  decision?: string | null;
  generatedAt: string | Date;
  version?: number;
}) {
  const generatedAt = input.generatedAt instanceof Date ? input.generatedAt : new Date(input.generatedAt);
  const date = Number.isNaN(generatedAt.getTime())
    ? new Date().toISOString().slice(0, 10)
    : generatedAt.toISOString().slice(0, 10);
  const client = slugify(input.clientName || '') || 'food-platform';
  const product = slugify(input.productName) || 'product';
  const parts = [client, product, 'commercialization-report'];
  if (input.decision) parts.push(slugify(input.decision));
  parts.push(date);
  if (input.version && input.version > 1) parts.push(`r${input.version}`);
  return `${parts.join('-')}.pdf`;
}

export async function buildCommercializationReportPdf(input: CommercializationReportPdfInput) {
  input = normalizeReportValue(input);
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const template = input.reportTemplate ?? 'editorial-sage';
  const primary: Rgb = template === 'editorial-sage' ? CHARCOAL : hexToRgb(input.primaryColor) ?? SLATE_950;
  const accent: Rgb = template === 'editorial-sage' ? SAGE : hexToRgb(input.accentColor) ?? DEFAULT_ACCENT;
  const coverPrimary = hexToRgb(input.primaryColor) ?? primary;
  const coverAccent = hexToRgb(input.accentColor) ?? accent;
  const ctx: PdfContext = {
    doc,
    width: doc.internal.pageSize.getWidth(),
    height: doc.internal.pageSize.getHeight(),
    margin: 40,
    contentWidth: doc.internal.pageSize.getWidth() - 80,
    primary,
    accent,
    organizationName: input.organizationName || 'Food Platform',
    productName: input.snapshot.product.sampleName,
    documentWarning: !input.reportContext
      ? 'INTERNAL PREVIEW — VALIDATED REPORT CONTEXT NOT ATTACHED'
      : /reference\/demo|reference-demo/i.test(input.reportContext.evidenceProvenance)
        ? 'REFERENCE / DEMONSTRATION EVIDENCE — NOT APPROVED FOR EXTERNAL USE'
        : undefined,
    template,
  };

  const [packaging, reportCover, logo] = await Promise.all([
    imageDataUrl(input.snapshot.concept.packagingImageUrl),
    imageDataUrl(
      input.snapshot.concept.reportCoverApprovedForExternalUse
        ? input.snapshot.concept.reportCoverImageUrl ?? ''
        : '',
    ),
    imageDataUrl(input.logoUrl ?? ''),
  ]);

  renderDecisionSnapshotPage({ ...ctx, primary: coverPrimary, accent: coverAccent }, buildDecisionSnapshot(input), {
    cover: reportCover ?? packaging,
    logo,
    approvedCover: Boolean(reportCover),
    aiGenerated: reportCover
      ? Boolean(input.snapshot.concept.reportCoverImageAiGenerated)
      : Boolean(input.snapshot.concept.packagingImageAiGenerated),
  });

  addContentPage(ctx);
  renderDecisionBasisPage(ctx, buildDecisionBasis(input));

  addContentPage(ctx);
  renderPerformanceDashboardPage(ctx, buildPerformanceDashboard(input));

  const scientific = buildScientificContext(input);
  const risks = buildRisks(input);
  addContentPage(ctx);
  renderInstrumentalRiskPage(ctx, scientific, risks);

  addContentPage(ctx);
  renderProductReadinessPage(ctx, buildProductReadiness(input));

  addContentPage(ctx);
  renderCommercialStrategyPage(
    ctx,
    buildConceptPackaging(input),
    buildConsumerEvidence(input),
    buildCommercialReadiness(input),
    packaging,
  );

  addContentPage(ctx);
  renderCommercializationPlanPage(ctx, buildCommercializationPlan(input));

  addContentPage(ctx);
  renderClaimsMatrixPage(ctx, buildClaimsMatrix(input));

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    renderFooter(ctx, page, input.reportFooter);
  }

  const filename = buildCommercializationReportFilename({
    clientName: input.organizationName,
    productName: input.snapshot.product.sampleName,
    decision: input.snapshot.decision.outcome,
    generatedAt: input.snapshot.generatedAt,
    version: input.version,
  });

  // Stage-aware QC: when a typed context is supplied, run the deterministic
  // pipeline over the rendered prose and return the result + machine-readable
  // quality report. Critical errors set qc.exportAllowed=false.
  let qc: QcPipelineResult | undefined;
  if (input.reportContext) {
    const generated = buildGeneratedReportSections(input);
    qc = runQcPipeline({ ctx: input.reportContext, generated });
  }

  const clientEvaluation = evaluateCommercializationReport(doc, input);
  return { doc, filename, qc, clientEvaluation };
}

export function buildGeneratedReportSections(input: CommercializationReportPdfInput): GeneratedSections {
  const exec = buildExecutiveReadout(input);
  const basis = buildDecisionBasis(input);
  const method = buildMethodEvidence(input);
  const concept = buildConceptPackaging(input);
  const plan = buildCommercializationPlan(input);
  const appendix = buildAppendix(input);
  const claims = buildClaimsMatrix(input);
  const productReadiness = buildProductReadiness(input);
  const commercialReadiness = buildCommercialReadiness(input);
  const scientificContext = buildScientificContext(input);
  return {
    sections: [
      { label: 'Decision', text: `${buildDecisionSnapshot(input).reportTitle}. ${buildDecisionSnapshot(input).decisionSubheading}` },
      { label: 'Decision basis', text: `${basis.decisionMargin}. ${basis.managementDecision}` },
      { label: 'Executive rationale', text: `${exec.decision} ${exec.rationale}` },
      { label: 'Executive recommendation', text: exec.commercialImplication },
      { label: 'Next move', text: exec.nextMove },
      { label: 'Methodology', text: `${method.issfFormula}. ${method.gateLogic}. ${method.instrumentalNote}` },
      { label: 'Scientific guidance', text: scientificContext.guidance.map(item => `${item.title}: ${item.guidance}`).join(' ') || 'No report-safe external scientific guidance was saved with this report version.' },
      { label: 'Concept hypothesis', text: `${concept.positioning} ${concept.targetConsumer} ${concept.consumerNeed} ${concept.usageOccasion} ${concept.productPromise}` },
      { label: 'Packaging rationale', text: concept.packagingDirection },
      { label: 'Product readiness', text: `${productReadiness.rows.map(row => `${row.area}: ${row.status}. ${row.currentEvidence} Required: ${row.requiredEvidence}`).join(' ')} ${productReadiness.summary}` },
      { label: 'Commercial readiness', text: `${commercialReadiness.rows.map(row => `${row.area}: ${row.status}. ${row.currentEvidence} Required: ${row.requiredEvidence}`).join(' ')} ${commercialReadiness.summary}` },
      { label: 'Execution plan', text: `Consumer and market claims remain unvalidated until the named concept and claims steps are complete. ${plan.rows.map(row => `${row.workstream}: ${row.protocol}. Passing criteria: ${row.passingCriteria}. Owner: ${row.owner}. Timing: ${row.timing}. Budget: ${row.budget}.`).join(' ')}` },
      { label: 'Risks and limitations', text: buildRisks(input).claimsNote },
      { label: 'Claims release', text: `${claims.rows.map(row => `${row.claim}: ${row.status}. ${row.permittedWording}`).join(' ')} ${claims.releaseDecision}` },
      { label: 'Traceability and approval', text: `${appendix.rows.map(row => row.join(': ')).join('. ')}. ${appendix.approvalNote}` },
    ],
  };
}

export async function downloadCommercializationReportPdf(input: CommercializationReportPdfInput) {
  if (!input.reportContext) {
    throw new Error('Report export blocked: a validated ReportContext is required. Open the report workspace to rebuild and authorize this version.');
  }
  const { doc, filename, qc, clientEvaluation } = await buildCommercializationReportPdf(input);
  // Critical QC errors block export (only enforced when a typed context is supplied).
  if (qc && !qc.exportAllowed) {
    const reasons = qc.score.blockers.slice(0, 5).join('; ');
    throw new Error(`Report export blocked by quality control: ${reasons}`);
  }
  if (!clientEvaluation.passed) {
    throw new Error(`Report export blocked by client quality control: ${clientEvaluation.weaknesses.slice(0, 5).join('; ')}`);
  }
  doc.save(filename);
}
