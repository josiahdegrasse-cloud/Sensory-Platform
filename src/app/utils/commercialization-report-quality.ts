import { formatDecisionDimension } from '../lib/commercialization-report';
import { reportPageHeadings, type CommercializationReportPdfInput } from './pdf/sections';
import type { PdfDocument } from './pdf/theme';

export type RubricCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export interface QualityCheck {
  id: string;
  passed: boolean;
  detail: string;
}

export interface CommercializationReportEvaluation {
  pageTexts: string[];
  pageWordCounts: number[];
  checks: QualityCheck[];
  scores: Record<RubricCategory, number>;
  weaknesses: string[];
  passed: boolean;
}

const FORBIDDEN_GENERIC_PHRASES = [
  'current evidence indicates a relative strength',
  'current evidence is acceptable, with room to strengthen',
  'this area should be reviewed before broader commercialization claims',
];

function decodePdfText(value: string) {
  return value
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\([0-7]{3})/g, (_, octal: string) => String.fromCharCode(parseInt(octal, 8)));
}

/**
 * Parses text operands from the actual jsPDF page command streams. This keeps
 * quality checks tied to the generated PDF rather than the source data alone.
 */
export function extractGeneratedPdfPageText(doc: PdfDocument) {
  const pages = (doc.internal as unknown as { pages: Array<string[] | undefined> }).pages;
  return pages.slice(1).map(commands => {
    const stream = (commands ?? []).join('\n');
    const values: string[] = [];
    const textPattern = /\((?:\\.|[^\\)])*\)/g;
    for (const match of stream.matchAll(textPattern)) {
      values.push(decodePdfText(match[0].slice(1, -1)));
    }
    return values.join(' ').replace(/\s+/g, ' ').trim();
  });
}

function includesAll(text: string, values: readonly string[]) {
  return values.every(value => text.toLowerCase().includes(value.toLowerCase()));
}

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function repeatedCaveats(pageTexts: string[]) {
  const caveatPattern = /[^.!?]*(?:directional|representative|legal approval|external distribution|broad market claims)[^.!?]*[.!?]/gi;
  const seen = new Map<string, number>();
  pageTexts.forEach(text => {
    for (const match of text.matchAll(caveatPattern)) {
      const normalized = match[0].toLowerCase().replace(/\s+/g, ' ').trim();
      if (normalized.length >= 45) seen.set(normalized, (seen.get(normalized) ?? 0) + 1);
    }
  });
  return [...seen.entries()].filter(([, count]) => count > 1).map(([text]) => text);
}

function scoreChecks(checks: QualityCheck[], ids: string[]) {
  const relevant = checks.filter(check => ids.includes(check.id));
  const ratio = relevant.length ? relevant.filter(check => check.passed).length / relevant.length : 0;
  if (ratio === 1) return 5;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio > 0) return 2;
  return 1;
}

export function evaluateCommercializationReport(
  doc: PdfDocument,
  input: CommercializationReportPdfInput,
): CommercializationReportEvaluation {
  const pageTexts = extractGeneratedPdfPageText(doc);
  const pageWordCounts = pageTexts.map(countWords);
  const beforeAppendix = pageTexts.slice(0, 7).join(' ').toLowerCase();
  const appendix = pageTexts[7]?.toLowerCase() ?? '';
  const dimensions = Object.keys(input.snapshot.decision.dimensions) as Array<keyof typeof input.snapshot.decision.dimensions>;
  const repeatedWarnings = repeatedCaveats(pageTexts);
  const checks: QualityCheck[] = [
    {
      id: 'page-count',
      passed: pageTexts.length === 9,
      detail: `Expected 9 pages; generated ${pageTexts.length}.`,
    },
    {
      id: 'required-headings',
      passed: reportPageHeadings.every((heading, index) => pageTexts[index]?.toLowerCase().includes(heading.toLowerCase())),
      detail: 'Each required heading must appear on its intended page.',
    },
    {
      id: 'cover-decision',
      passed: includesAll(pageTexts[0] ?? '', [input.snapshot.product.sampleName, input.snapshot.product.foodType, 'Commercial decision', 'Readiness stage', 'Recommended next action']),
      detail: 'Cover identifies the product, decision, readiness, and next action.',
    },
    {
      id: 'memo-structure',
      passed: includesAll(pageTexts[1] ?? '', ['Decision', 'Rationale', 'Commercial implication', 'Next move']),
      detail: 'Executive summary uses the required business memo structure.',
    },
    {
      id: 'flow',
      passed: reportPageHeadings.every((heading, index) => pageTexts[index]?.includes(heading)),
      detail: 'Report follows decision, evidence, insight, direction, plan, risk, and source flow.',
    },
    {
      id: 'commercial-actions',
      passed: includesAll(pageTexts[3] ?? '', ['Why it matters commercially', 'Recommended action'])
        && includesAll(pageTexts[5] ?? '', ['Required action', 'Status / owner', 'Next decision gate']),
      detail: 'Insights and plan pages translate evidence into named actions.',
    },
    {
      id: 'score-interpretation',
      passed: dimensions.every(dimension => {
        const label = formatDecisionDimension(dimension).toLowerCase();
        const page = (pageTexts[2] ?? '').toLowerCase();
        const labelIndex = page.indexOf(label);
        const implicationIndex = page.indexOf('business implication', labelIndex);
        return labelIndex >= 0 && implicationIndex >= labelIndex && implicationIndex - labelIndex < 700;
      }),
      detail: 'Every major score has a nearby business implication.',
    },
    {
      id: 'concept-strategy',
      passed: includesAll(pageTexts[4] ?? '', ['Packaging direction', 'Core message', 'Why this supports the product', 'Refine before external use', 'Directional concept visual']),
      detail: 'Concept page connects packaging to strategy and labels the visual as directional.',
    },
    {
      id: 'final-summary',
      passed: includesAll(pageTexts[8] ?? '', [
        'Report at a Glance',
        'Commercial decision',
        'Evidence snapshot',
        'Core strength',
        'Main watch point',
        'Immediate priorities',
        'Next gate',
      ]),
      detail: 'Final page condenses the decision, evidence, watch point, priorities, owners, and next gate.',
    },
    {
      id: 'scanability',
      passed: pageTexts.every((_, index) => pageWordCounts[index] >= (index === 0 ? 55 : 70) && pageWordCounts[index] <= 520),
      detail: `Page word counts: ${pageWordCounts.join(', ')}.`,
    },
    {
      id: 'appendix-discipline',
      passed: !beforeAppendix.includes('decision record id')
        && !beforeAppendix.includes('decision fingerprint')
        && !beforeAppendix.includes('method id')
        && includesAll(appendix, ['Decision record ID', 'Decision fingerprint', 'Method ID', 'Export timestamp', 'Approval status']),
      detail: 'Technical identifiers appear in the appendix and not the commercial body.',
    },
    {
      id: 'specific-language',
      passed: FORBIDDEN_GENERIC_PHRASES.every(phrase => !pageTexts.join(' ').toLowerCase().includes(phrase)),
      detail: 'Forbidden generic interpretation phrases are absent.',
    },
    {
      id: 'warning-repetition',
      passed: repeatedWarnings.length === 0,
      detail: repeatedWarnings.length ? `Repeated caveats: ${repeatedWarnings.join(' | ')}` : 'No repeated caveat sentence detected.',
    },
  ];

  const scores: Record<RubricCategory, number> = {
    A: scoreChecks(checks, ['cover-decision', 'memo-structure']),
    B: scoreChecks(checks, ['page-count', 'required-headings', 'flow', 'scanability', 'final-summary']),
    C: scoreChecks(checks, ['commercial-actions', 'score-interpretation']),
    D: scoreChecks(checks, ['score-interpretation', 'specific-language']),
    E: scoreChecks(checks, ['concept-strategy']),
    F: scoreChecks(checks, ['scanability', 'flow', 'final-summary']),
    G: scoreChecks(checks, ['appendix-discipline']),
    H: scoreChecks(checks, ['specific-language', 'warning-repetition']),
  };
  const weaknesses = checks.filter(check => !check.passed).map(check => check.detail);
  const passed = Object.values(scores).every(score => score >= 4)
    && checks.every(check => check.passed);
  return { pageTexts, pageWordCounts, checks, scores, weaknesses, passed };
}
