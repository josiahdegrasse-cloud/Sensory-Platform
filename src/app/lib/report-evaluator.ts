import type { EvidenceBundle } from './report-evidence-types';
import type { ReportPlan } from './report-plan';

export type SectionEvaluation = {
  key: string;
  hasContent: boolean;
  citedEvidenceIds: string[];
  unknownEvidenceIds: string[];
  outOfScopeEvidenceIds: string[];
  contradiction: boolean;
  issues: string[];
  ok: boolean;
};

export type NarrativeEvaluation = {
  score: number;
  passed: boolean;
  issues: string[];
  sections: SectionEvaluation[];
};

const CITATION_RE = /\[evidence:([^\]]+)\]/g;
const PASS_THRESHOLD = 70;
const LAUNCH_POSITIVE_RE = /\b(recommend(?:ed|ing)?\s+(?:to\s+)?launch|proceed\s+to\s+launch|ready\s+(?:to|for)\s+launch|green[\s-]?light|go\s+to\s+market)\b/i;
const CAUTION_RE = /\b(however|caution|risk|limitation|insufficient|do not|not recommend|hold|before launch|tweak|stop)\b/i;
// Generic, non-specific hedging that signals templated rather than product-specific writing.
const HEDGE_RE = /\b(depending on the food type|various factors|in general|may or may not|could potentially|as needed|where applicable|if applicable)\b/i;
// A demographic/age range or explicit price is an unsupported claim unless the
// text grounds it (a cited evidence id or an explicit "not yet determined").
const DEMOGRAPHIC_RE = /\b(\d{2}\s*[-–]\s*\d{2})\b|\b(?:aged?|ages)\s+\d{2}\b/i;
const PRICE_RE = /(?:[$£€]\s?\d|\b\d+(?:\.\d{2})?\s?(?:USD|GBP|EUR|dollars|pounds|euros)\b)/i;
const NOT_DETERMINED_RE = /\bnot yet determined|requires (?:segmented|broader|further) (?:panel )?data|requires validation\b/i;

// Removes inline [evidence:<id>] provenance tokens for human-facing display.
// The tokens are required while the evaluator validates citations, but must
// never reach the editor, the saved report, or the exported PDF. Also tidies the
// whitespace/punctuation the removal leaves behind.
export function stripEvidenceCitations(text: string): string {
  return text
    .replace(/\s*\[evidence:[^\]]+\]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,;:)])/g, '$1')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

function citationsIn(text: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  CITATION_RE.lastIndex = 0;
  while ((m = CITATION_RE.exec(text)) !== null) out.push(m[1].trim());
  return out;
}

// Deterministic quality gate for AI-generated narrative. Verifies every
// evidence-backed section cites real, in-scope evidence and does not contradict
// the deterministic candidate decision. Returns a 0–100 score + actionable issues
// (the issues feed one bounded revision pass).
export function evaluateNarrative(input: {
  plan: ReportPlan;
  sections: Record<string, string>;
  bundle: EvidenceBundle;
}): NarrativeEvaluation {
  const knownIds = new Set(input.bundle.evidence.map(record => record.id));
  const candidate = input.plan.candidateDecision;
  const expectsCaution = candidate === 'STOP' || candidate === 'INSUFFICIENT_DATA';

  const sectionEvals: SectionEvaluation[] = input.plan.sections.map(section => {
    const text = (input.sections[section.key] ?? '').trim();
    const allowed = new Set(section.evidenceIds);
    const cited = citationsIn(text);
    const unknown = cited.filter(id => !knownIds.has(id));
    const outOfScope = cited.filter(id => knownIds.has(id) && !allowed.has(id));
    const issues: string[] = [];

    if (section.evidenceBacked && section.evidenceIds.length > 0) {
      if (!text) issues.push(`${section.title}: section is empty but evidence is available.`);
      else if (cited.length === 0) issues.push(`${section.title}: makes claims without citing any evidence.`);
    }
    unknown.forEach(id => issues.push(`${section.title}: cites unknown evidence id "${id}".`));
    outOfScope.forEach(id => issues.push(`${section.title}: cites out-of-scope evidence id "${id}".`));

    let contradiction = false;
    if (expectsCaution
      && (section.key === 'executiveSummary' || section.key === 'launchRecommendation')
      && LAUNCH_POSITIVE_RE.test(text) && !CAUTION_RE.test(text)) {
      contradiction = true;
      issues.push(`${section.title}: asserts a launch recommendation that contradicts the ${candidate} candidate decision.`);
    }

    // Anti-boilerplate: generic hedging reads as templated, not product-specific.
    if (text && HEDGE_RE.test(text)) {
      issues.push(`${section.title}: uses generic hedged language ("${(text.match(HEDGE_RE) ?? [''])[0]}"); write specifically about this product.`);
    }
    // Unsupported demographic/price claims must be grounded or flagged as unknown.
    if (text && (DEMOGRAPHIC_RE.test(text) || PRICE_RE.test(text))
      && cited.length === 0 && !NOT_DETERMINED_RE.test(text)) {
      issues.push(`${section.title}: states a demographic or price claim without supporting evidence or a "not yet determined" qualifier.`);
    }

    return {
      key: section.key,
      hasContent: !!text,
      citedEvidenceIds: cited,
      unknownEvidenceIds: unknown,
      outOfScopeEvidenceIds: outOfScope,
      contradiction,
      issues,
      ok: issues.length === 0,
    };
  });

  const issues = sectionEvals.flatMap(section => section.issues);
  // Hard failures (regardless of score): hallucinated/out-of-scope citations or a
  // claim that contradicts the deterministic decision.
  const hardFail = sectionEvals.some(section =>
    section.unknownEvidenceIds.length > 0
    || section.outOfScopeEvidenceIds.length > 0
    || section.contradiction);
  const score = Math.max(0, 100 - issues.length * 15);
  return {
    score,
    passed: score >= PASS_THRESHOLD && !hardFail,
    issues,
    sections: sectionEvals,
  };
}
