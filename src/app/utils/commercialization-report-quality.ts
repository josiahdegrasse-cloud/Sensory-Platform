import { formatDecisionDimension } from '../lib/commercialization-report';
import { reportPageHeadings, type CommercializationReportPdfInput } from './pdf/sections';
import type { PdfDocument } from './pdf/theme';
import { excerptAppearsInClientCopy, scanClientFacingText } from '../lib/evidence-assist';

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

function findRawFloatArtifact(text: string) {
  const pattern = /\b\d+\.\d{5,}\b/g;
  for (const match of text.matchAll(pattern)) {
    const offset = match.index ?? 0;
    const tokenStart = text.lastIndexOf(' ', offset) + 1;
    const nextSpace = text.indexOf(' ', offset + match[0].length);
    const tokenEnd = nextSpace === -1 ? text.length : nextSpace;
    const token = text.slice(tokenStart, tokenEnd).replace(/^[([{'"`]+|[)\]},;'"`]+$/g, '');
    if (/^(?:doi:?)?10\.\d{4,9}\//i.test(token) || /^https?:\/\/(?:dx\.)?doi\.org\/10\.\d{4,9}\//i.test(token)) continue;
    return match[0];
  }
  return null;
}

export function evaluateCommercializationReport(
  doc: PdfDocument,
  input: CommercializationReportPdfInput,
): CommercializationReportEvaluation {
  const pageTexts = extractGeneratedPdfPageText(doc);
  const pageWordCounts = pageTexts.map(countWords);
  const clientReport = pageTexts.join(' ').toLowerCase();
  const dimensions = Object.keys(input.snapshot.decision.dimensions) as Array<keyof typeof input.snapshot.decision.dimensions>;
  const repeatedWarnings = repeatedCaveats(pageTexts);
  const expectedHeadings: string[] = [...reportPageHeadings];
  const readinessThreshold = input.reportContext?.thresholds.readiness ?? 60;
  const productGo = input.snapshot.decision.outcome === 'GO'
    && !(input.snapshot.decision.gates ?? []).some(gate => gate.status === 'fail')
    && Object.values(input.snapshot.decision.dimensions).every(score => Number(score) >= readinessThreshold);
  const launchBlockingLanguage = /not approval to launch|approval to continue validation, not approval to launch|launch is blocked|conditional advancement|commercialization is not approved/i;
  const rawFloatPage = pageTexts.findIndex(page => findRawFloatArtifact(page) !== null);
  const evidenceLeakage = scanClientFacingText(pageTexts.join(' '));
  const internalLanguage = /evidence bundle|retrieved chunk|raw rag|backend source|rag_food|sourcePath|chunkId|saved sensory decision model|deterministic candidate decision|dimensionScores|scoreImplication/i;
  const rawSourceMetadata = /(?:file:\/\/|\/(?:Users|home|var|tmp)\/)|nfi_publications[\\/]|sensory_rag_bulk_pack|uploaded_project_docs|(?:^|\s)[^\s]+\.(?:pdf|docx?|txt)(?:\s|$)/i;
  const rawLiteratureExcerpt = excerptAppearsInClientCopy(
    pageTexts.join(' '),
    (input.snapshot.literatureCitations ?? []).map(citation => citation.excerpt),
  );
  const malformedCopy = /Shoppers who value the sensory strengths validated in screening/i.test(pageTexts.join(' '))
    || /\.\s+(?:bagels|crackers|dips|sandwiches|seeking|looking)\b/.test(pageTexts.join(' '));
  const cashewIdentity = /cashew.*cream cheese/i.test(`${input.snapshot.product.sampleName} ${input.snapshot.concept.name}`);
  const identityDrift = cashewIdentity && /\b(?:cheddar|coconut-based|melting cheese|hard cheese)\b/i.test(pageTexts[5] ?? '');
  const checks: QualityCheck[] = [
    {
      id: 'page-count',
      passed: pageTexts.length === 8,
      detail: `Expected 8 pages; generated ${pageTexts.length}.`,
    },
    {
      id: 'required-headings',
      passed: expectedHeadings.every((heading, index) => pageTexts[index]?.toLowerCase().includes(heading.toLowerCase())),
      detail: 'Each required heading must appear on its intended page.',
    },
    {
      id: 'cover-decision',
      passed: includesAll(pageTexts[0] ?? '', [input.snapshot.product.sampleName, input.snapshot.product.foodType, 'Sensory decision', 'Readiness stage', 'Recommended next action']),
      detail: 'Cover identifies the product, decision, readiness, and next action.',
    },
    {
      id: 'decision-facts',
      passed: includesAll(pageTexts[0] ?? '', ['ISSF score', 'Evidence strength', 'Concept evidence', 'Core strength', 'Main watch point']),
      detail: 'Executive decision page includes the canonical decision facts and watch point.',
    },
    {
      id: 'product-go-framing',
      passed: !productGo || includesAll(pageTexts[0] ?? '', ['PRODUCT DECISION: GO', 'Approved for launch preparation', 'claims evidence limited']),
      detail: 'A clean product GO must authorize launch preparation without being downgraded by concept evidence.',
    },
    {
      id: 'claims-layer-separation',
      passed: input.snapshot.evidence.responseCount >= 30
        || includesAll(pageTexts.join(' '), ['directional only', 'Consumer preference', 'demand', 'Price acceptance', 'Packaging preference', 'purchase intent']),
      detail: 'Low concept n limits named consumer and market claims without downgrading product GO.',
    },
    {
      id: 'no-unsupported-launch-block',
      passed: !launchBlockingLanguage.test(pageTexts.join(' ')),
      detail: 'Launch-blocking language is prohibited unless a separate critical product gate has failed.',
    },
    {
      id: 'flow',
      passed: expectedHeadings.every((heading, index) => pageTexts[index]?.includes(heading)),
      detail: 'Report follows decision, evidence, product direction, and validation/release flow.',
    },
    {
      id: 'decision-basis',
      passed: includesAll(pageTexts[1] ?? '', ['Decision margin', 'Evidence populations and provenance', 'What would change the decision', 'Material limitations', 'Management decision']),
      detail: 'Decision basis must explain evidence quality, sensitivity, limitations, and the management authorization.',
    },
    {
      id: 'commercial-actions',
      passed: includesAll(pageTexts[6] ?? '', ['Protocol', 'Pass / next gate', 'Owner:', 'Timing:', 'Budget:', 'If not met', 'Next decision gate']),
      detail: 'Validation protocol identifies the method, passing criteria, ownership, timing, budget status, and next gate.',
    },
    {
      id: 'product-readiness',
      passed: includesAll(pageTexts[4] ?? '', ['Pilot manufacturing', 'Packaging compatibility', 'Regulatory, labeling, and nutrition', 'Required next evidence'])
        && !/shelf[- ]?life/i.test(pageTexts[4] ?? ''),
      detail: 'Product readiness covers manufacturing, packaging, regulatory, labeling, and nutrition evidence without the deferred shelf-life workstream.',
    },
    {
      id: 'commercial-readiness',
      passed: includesAll(pageTexts[5] ?? '', ['Competitive benchmark', 'Price architecture', 'Unit economics', 'Channel and buyer strategy', 'Demand and launch forecast', 'Required next evidence']),
      detail: 'Commercial readiness covers competition, price, economics, channel, buyer strategy, and demand evidence.',
    },
    {
      id: 'blocked-language-scope',
      passed: !pageTexts.slice(0, 7).some(page => /\bblocked\b/i.test(page))
        && includesAll(pageTexts[7] ?? '', ['Blocked', 'External claim']),
      detail: 'Blocked status is reserved for external claims; ordinary commercial evidence gaps use validation language.',
    },
    {
      id: 'score-interpretation',
      passed: dimensions.every(dimension => {
        const label = formatDecisionDimension(dimension).toLowerCase();
        const page = (pageTexts[2] ?? '').toLowerCase();
        const labelIndex = page.indexOf(label);
        return labelIndex >= 0 && page.includes('what the evidence supports');
      }),
      detail: 'Every major score has a nearby business implication.',
    },
    {
      id: 'scientific-context-separation',
      passed: includesAll(pageTexts[3] ?? '', ['Instrumental status', 'Technical and execution risks', 'Evidence-led recommendations for the next study', 'Sources']),
      detail: 'Project instrumental evidence, product risks, and citation-backed scientific context must remain visibly separate.',
    },
    {
      id: 'consumer-evidence-boundary',
      passed: includesAll(pageTexts[5] ?? '', ['Concept evidence boundary', `n=${input.snapshot.evidence.responseCount}`]),
      detail: 'The commercial proposition must disclose the concept sample size and evidence boundary.',
    },
    {
      id: 'concept-strategy',
      passed: includesAll(pageTexts[5] ?? '', ['Working proposition', 'Priority consumer', 'Promise', 'Price hypothesis', 'Directional concept visual', 'Competitive benchmark', 'Unit economics', 'Commercial conclusion']),
      detail: 'Commercial case presents the proposition and visually summarizes consumer, competition, price, economics, channel, and demand readiness.',
    },
    {
      id: 'final-summary',
      passed: includesAll(pageTexts[7] ?? '', ['Claims release status by evidence level', 'Current release boundary', 'Internal decision statement', 'External claim', 'Permitted wording', 'Requirement', 'Report status']),
      detail: 'Final page closes with a claim-by-claim release matrix and report status.',
    },
    {
      id: 'scanability',
      passed: pageTexts.every((_, index) => pageWordCounts[index] >= (index === 0 ? 50 : 40) && pageWordCounts[index] <= 400),
      detail: `Page word counts: ${pageWordCounts.join(', ')}.`,
    },
    {
      id: 'appendix-discipline',
      passed: !clientReport.includes('decision record id')
        && !clientReport.includes('decision fingerprint')
        && !clientReport.includes('export timestamp')
        && !clientReport.includes('model-confidence input'),
      detail: 'Technical identifiers and calculation tables are excluded from the client PDF.',
    },
    {
      id: 'specific-language',
      passed: FORBIDDEN_GENERIC_PHRASES.every(phrase => !pageTexts.join(' ').toLowerCase().includes(phrase)),
      detail: 'Forbidden generic interpretation phrases are absent.',
    },
    {
      id: 'number-formatting',
      passed: rawFloatPage === -1,
      detail: rawFloatPage === -1
        ? 'Client-facing numbers must not contain raw floating-point artifacts.'
        : `Page ${rawFloatPage + 1} contains an unformatted numeric value: ${findRawFloatArtifact(pageTexts[rawFloatPage]) ?? 'unknown'}.`,
    },
    {
      id: 'product-identity',
      passed: !identityDrift,
      detail: 'Product identity must remain consistent with the selected product format.',
    },
    {
      id: 'internal-language',
      passed: !internalLanguage.test(pageTexts.join(' ')) && evidenceLeakage.length === 0,
      detail: 'Client-facing text must not contain internal evidence or system phrases.',
    },
    {
      id: 'raw-source-metadata',
      passed: !rawSourceMetadata.test(pageTexts.join(' ')) && !rawLiteratureExcerpt,
      detail: 'Client-facing literature must not expose storage paths, raw filenames, or retrieval-pack identifiers.',
    },
    {
      id: 'copy-integrity',
      passed: !malformedCopy,
      detail: 'Client-facing copy must not contain sentence fragments or known generated-language failures.',
    },
    {
      id: 'translated-positioning',
      passed: !/e-tongue|GC-MS|GC-O|ISTD|\bppm\b|emotion balance/i.test(pageTexts[5] ?? ''),
      detail: 'Product direction must translate evidence rather than dump raw metrics.',
    },
    {
      id: 'warning-repetition',
      passed: repeatedWarnings.length === 0,
      detail: repeatedWarnings.length ? `Repeated caveats: ${repeatedWarnings.join(' | ')}` : 'No repeated caveat sentence detected.',
    },
  ];

  const scores: Record<RubricCategory, number> = {
    A: scoreChecks(checks, ['cover-decision', 'decision-facts', 'product-go-framing', 'claims-layer-separation', 'decision-basis']),
    B: scoreChecks(checks, ['page-count', 'required-headings', 'flow', 'scanability', 'final-summary']),
    C: scoreChecks(checks, ['commercial-actions', 'product-readiness', 'commercial-readiness', 'score-interpretation', 'consumer-evidence-boundary']),
    D: scoreChecks(checks, ['score-interpretation', 'scientific-context-separation', 'specific-language', 'number-formatting']),
    E: scoreChecks(checks, ['concept-strategy', 'commercial-readiness', 'blocked-language-scope', 'product-identity', 'translated-positioning']),
    F: scoreChecks(checks, ['scanability', 'flow', 'final-summary']),
    G: scoreChecks(checks, ['appendix-discipline']),
    H: scoreChecks(checks, ['specific-language', 'warning-repetition', 'internal-language', 'raw-source-metadata', 'copy-integrity', 'no-unsupported-launch-block']),
  };
  const weaknesses = checks.filter(check => !check.passed).map(check => check.detail);
  const passed = Object.values(scores).every(score => score >= 4)
    && checks.every(check => check.passed);
  return { pageTexts, pageWordCounts, checks, scores, weaknesses, passed };
}
