import type { ConceptDraft, Question } from './types';

export interface StudyWarning {
  code: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
}

export interface StudyQualityScore {
  overall: number;
  panelAdequacy: number;
  surveyBalance: number;
  conceptClarity: number;
  researchIntegrity: number;
  warnings: StudyWarning[];
}

const LEADING_PATTERNS = [
  /don'?t you agree/i,
  /wouldn'?t you say/i,
  /as you can see/i,
  /obviously/i,
  /clearly/i,
  /of course/i,
];

function scorePanelAdequacy(assignedCount: number, targetSize: number): { score: number; warnings: StudyWarning[] } {
  const warnings: StudyWarning[] = [];
  if (assignedCount === 0) {
    warnings.push({ code: 'no_panelists', severity: 'error', message: 'No panelists assigned. Assign at least one panelist to launch.' });
    return { score: 0, warnings };
  }
  if (assignedCount < 8) {
    warnings.push({ code: 'underpowered', severity: 'warn', message: `Panel may be underpowered (${assignedCount} assigned). Consider 12 or more for reliable results.` });
    return { score: 8, warnings };
  }
  if (assignedCount < 12) {
    const needed = 12 - assignedCount;
    warnings.push({ code: 'borderline', severity: 'info', message: `Adding ${needed} more panelist${needed === 1 ? '' : 's'} would bring the panel to the recommended minimum of 12.` });
    return { score: 16, warnings };
  }
  if (assignedCount < targetSize * 0.8) {
    warnings.push({ code: 'below_target', severity: 'info', message: `${assignedCount} of ${targetSize} target panelists assigned (${Math.round(assignedCount / targetSize * 100)}%).` });
    return { score: 21, warnings };
  }
  return { score: 25, warnings };
}

function scoreSurveyBalance(questions: Question[]): { score: number; warnings: StudyWarning[] } {
  if (questions.length === 0) {
    return { score: 0, warnings: [{ code: 'no_questions', severity: 'error', message: 'No survey questions added.' }] };
  }
  const warnings: StudyWarning[] = [];
  let score = 25;

  const hasPurchaseIntent = questions.some(q =>
    /purchase|buy|trial|interest/i.test(q.text) && q.category === 'purchase'
  );
  if (!hasPurchaseIntent) {
    warnings.push({ code: 'no_purchase_intent', severity: 'warn', message: 'No purchase intent question found. Add one to measure commercial potential.' });
    score -= 10;
  }

  const hasAppeal = questions.some(q =>
    /overall|appeal|like|liking|enjoy/i.test(q.text) && q.category === 'appeal'
  );
  if (!hasAppeal) {
    warnings.push({ code: 'no_appeal', severity: 'warn', message: 'No overall liking or appeal question found. Add one for a baseline consumer response.' });
    score -= 8;
  }

  if (questions.length > 15) {
    warnings.push({ code: 'fatigue_risk', severity: 'warn', message: `Survey fatigue risk: ${questions.length} questions is above the recommended maximum of 15.` });
    score -= 5;
  }

  const categoryCounts = questions.reduce<Record<string, number>>((acc, q) => {
    acc[q.category] = (acc[q.category] ?? 0) + 1;
    return acc;
  }, {});
  const categoriesUsed = Object.keys(categoryCounts).length;
  if (categoriesUsed < 3) {
    warnings.push({ code: 'narrow_coverage', severity: 'info', message: `Questions cover only ${categoriesUsed} of 6 available categories. Broader coverage improves interpretation.` });
    score -= 5;
  }

  return { score: Math.max(0, score), warnings };
}

function scoreConceptClarity(draft: ConceptDraft): { score: number; warnings: StudyWarning[] } {
  const dims = draft.variantDimensions ?? {};
  const filled = Object.values(dims).filter(v => v !== null && v !== undefined).length;
  const total = 8;
  const warnings: StudyWarning[] = [];

  // Coherence check: premium brand should not be budget-priced
  if (dims.positioning === 'premium' && dims.pricePositioning === 'budget') {
    warnings.push({ code: 'positioning_conflict', severity: 'warn', message: 'Positioning conflict: premium brand paired with budget price positioning may confuse consumers.' });
  }
  if (dims.positioning === 'accessible' && dims.pricePositioning === 'ultra_premium') {
    warnings.push({ code: 'positioning_conflict_2', severity: 'warn', message: 'Positioning conflict: accessible brand paired with ultra-premium price positioning is inconsistent.' });
  }

  if (filled < 4) {
    warnings.push({ code: 'underspecified', severity: 'info', message: `Only ${filled} of ${total} positioning dimensions are set. Adding more makes results easier to interpret.` });
  }

  return { score: Math.round((filled / total) * 25), warnings };
}

function scoreResearchIntegrity(draft: ConceptDraft, questions: Question[]): { score: number; warnings: StudyWarning[] } {
  const warnings: StudyWarning[] = [];
  let score = 25;

  if (draft.marketingImages.filter(u => u.trim()).length === 0) {
    warnings.push({ code: 'no_image', severity: 'warn', message: 'No concept visual added. Consumer reactions to a concept without an image are less reliable.' });
    score -= 5;
  }

  if (questions.length > 1) {
    const uniqueCategories = new Set(questions.map(q => q.category)).size;
    if (uniqueCategories === 1) {
      warnings.push({ code: 'single_construct', severity: 'warn', message: 'All questions measure the same construct. Diversify question categories for richer insight.' });
      score -= 8;
    }
  }

  questions.forEach(q => {
    const leading = LEADING_PATTERNS.find(p => p.test(q.text));
    if (leading) {
      warnings.push({ code: `leading_${q.id}`, severity: 'warn', message: `Question may be leading: "${q.text.slice(0, 60)}…" — rephrase to a neutral form.` });
      score -= 5;
    }
  });

  return { score: Math.max(0, score), warnings };
}

export function scoreStudyQuality(
  draft: ConceptDraft,
  questions: Question[],
  assignedPanelistCount: number,
  targetPanelSize: number,
): StudyQualityScore {
  const panel = scorePanelAdequacy(assignedPanelistCount, targetPanelSize);
  const survey = scoreSurveyBalance(questions);
  const clarity = scoreConceptClarity(draft);
  const integrity = scoreResearchIntegrity(draft, questions);

  const overall = panel.score + survey.score + clarity.score + integrity.score;
  const warnings = [...panel.warnings, ...survey.warnings, ...clarity.warnings, ...integrity.warnings];

  return {
    overall,
    panelAdequacy: panel.score,
    surveyBalance: survey.score,
    conceptClarity: clarity.score,
    researchIntegrity: integrity.score,
    warnings,
  };
}
