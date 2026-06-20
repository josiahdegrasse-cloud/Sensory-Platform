import type { ReportContext, ValidationFinding } from './types';
import type { GeneratedSections } from './validate';

export interface RenderedReportInspection {
  pages: Array<{
    page: number;
    text: string;
    minimumFontSizePt?: number | null;
    overflow?: boolean;
    warningVisible?: boolean;
    tableCoverageRatio?: number | null;
  }>;
}

function blocking(code: string, message: string, deduction = 20): ValidationFinding {
  return { code, severity: 'error', message, deduction, blocksExport: true };
}

function sectionText(generated: GeneratedSections): string {
  return generated.sections.map(section => `${section.label}\n${section.text}`).join('\n');
}

export function validateVersion7ContextDefects(ctx: ReportContext): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  const zeroImputation = ctx.dimensions.some(dimension =>
    dimension.rawMetrics.some(metric => metric.missing)
    && /\b(?:count(?:s|ed)?|treat(?:s|ed)?)\s+as\s+(?:numeric\s+)?0\b/i.test(dimension.calculationExplanation),
  ) && !/\b(?:versioned|documented|approved)\b/i.test(ctx.methodology.missingDataPolicy);
  if (zeroImputation) {
    findings.push(blocking(
      'missing-metric-zero-imputation',
      'A missing firmness/spreadability or other expected metric is treated as measured zero without an approved imputation rule.',
      30,
    ));
  }

  return findings;
}

export function validateVersion7GeneratedDefects(
  ctx: ReportContext,
  generated: GeneratedSections,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const text = sectionText(generated);

  const methodIdLabels = text.match(/\bMethod ID\b/gi) ?? [];
  if (methodIdLabels.length > 1) {
    findings.push(blocking(
      'duplicate-method-id',
      'The rendered report duplicates the Method ID field in the same report content.',
      10,
    ));
  }

  if (/\bconfirmed\s+GO\s+for\s+commerciali[sz]ation\b/i.test(text)
    && ctx.decision.launchAuthorization !== 'approved') {
    findings.push(blocking(
      'contradictory-commercialization-go',
      'Rendered language presents a sensory GO as confirmed commercialization approval.',
      30,
    ));
  }

  const texture = ctx.dimensions.find(dimension => dimension.key === 'texture');
  const creamy = texture?.rawMetrics.find(metric => /^creamy\b/i.test(metric.label));
  const smooth = texture?.rawMetrics.find(metric => /^smooth\b/i.test(metric.label));
  const highCue = [creamy, smooth].some(metric => typeof metric?.value === 'number' && metric.value >= 7);
  if (highCue && /\b(?:improve|increase|strengthen|optimi[sz]e)\s+(?:the\s+)?(?:creaminess|creamy|smoothness|smooth)\b/i.test(text)) {
    findings.push(blocking(
      'texture-recommendation-evidence-conflict',
      'Texture recommendation asks to improve an already-high creamy or smooth cue instead of resolving the actual missing structure evidence.',
      20,
    ));
  }

  if (/\b95\.1\b[\s\S]{0,160}\b96\.0\b|\b96\.0\b[\s\S]{0,160}\b95\.1\b/.test(text)
    && !/\b(?:rounded|normalized|transformed|conversion|maps? to)\b/i.test(text)) {
    findings.push(blocking(
      'unexplained-numeric-transformation',
      'The report displays 95.1 and 96.0 for the same result without documenting a transformation or rounding rule.',
      20,
    ));
  }

  if (/\b(?:sensory composite|weighted sensory base)\b[^.]{0,100}\bfinal ISSF\b/i.test(text)) {
    findings.push(blocking(
      'sensory-composite-issf-conflation',
      'The weighted sensory composite is described as the final ISSF even though the final index also includes instrumental and gate adjustments.',
      20,
    ));
  }

  if (/\b(?:shelf standout|packaging appeal|appealing package|eye-catching package)\b/i.test(text)
    && ctx.concept.responseCount === 0) {
    findings.push(blocking(
      'unsupported-packaging-appeal',
      'Packaging appeal or shelf standout is asserted without packaging or consumer evidence.',
      25,
    ));
  }

  if (/\bconsumers?\b[^.]{0,100}\b(?:descriptor|cheesy|buttery|lactic|creamy|smooth)\b/i.test(text)
    && ctx.concept.responseCount === 0) {
    findings.push(blocking(
      'sensory-consumer-population-conflation',
      'Sensory-panel descriptors are presented as consumer evidence.',
      25,
    ));
  }

  if (/\binstrumental findings\s+n\s*=\s*\d+\b/i.test(text)) {
    findings.push(blocking(
      'instrumental-finding-count-as-sample-size',
      'A count of instrumental findings is labeled as sample size; report replicate counts and findings separately.',
      20,
    ));
  }

  const dependencyMatches = text.match(/Dependencies:\s*source evidence and cross-functional review/gi) ?? [];
  if (dependencyMatches.length >= 2) {
    findings.push(blocking(
      'generic-repeated-dependency',
      'The action plan repeats the same generic dependency rather than naming workstream-specific dependencies.',
      12,
    ));
  }

  const priceText = ctx.conceptStrategy.priceHypothesis;
  if (/[$£€]\s*\d/.test(priceText)
    && !/\b(?:hypothesis|not researched|validation|required|source)\b/i.test(priceText)) {
    findings.push(blocking(
      'unexplained-price-range',
      'A numeric price range is shown without a source, hypothesis label, and validation requirement.',
      20,
    ));
  }

  return findings;
}

export function validateVersion7RenderedDefects(
  ctx: ReportContext,
  inspection: RenderedReportInspection,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const allText = inspection.pages.map(page => page.text).join('\n');

  if (/ISSF/.test(allText) && /(?:�|□|\uFFFD)/.test(allText)) {
    findings.push(blocking(
      'broken-issf-formula-glyph',
      'The rendered ISSF formula contains a missing or replacement glyph.',
      25,
    ));
  }

  if (/reference\/demo|reference-demo/i.test(ctx.evidenceProvenance)) {
    const missingWarnings = inspection.pages.filter(page => !page.warningVisible);
    if (missingWarnings.length > 0) {
      findings.push(blocking(
        'demo-warning-not-page-visible',
        `Reference/demo warning is not visible on page(s) ${missingWarnings.map(page => page.page).join(', ')}.`,
        30,
      ));
    }
  }

  const densePages = inspection.pages.filter(page =>
    page.overflow
    || (page.minimumFontSizePt !== null && page.minimumFontSizePt !== undefined && page.minimumFontSizePt < 8)
    || (page.tableCoverageRatio !== null && page.tableCoverageRatio !== undefined && page.tableCoverageRatio > 0.72),
  );
  if (densePages.length > 0) {
    findings.push(blocking(
      'action-plan-density',
      `Action-plan or table layout is too dense on page(s) ${densePages.map(page => page.page).join(', ')}.`,
      20,
    ));
  }

  return findings;
}
