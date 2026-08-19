import type { EnhancedSensoryProfile } from '../data/enhanced-sensory';
import { PANEL_N, type GoStopTweakDecision } from '../utils/go-stop-tweak-engine';
import { parseEvidenceAssistResult, type EvidenceAssistResult } from './evidence-assist';
import { openRagSource, ragFetch } from './rag-client';
import type { FormulationVersion } from './formulation-profile';

const CACHE_PREFIX = 'nfi:tweak-intelligence:v13';

type CategoryFamily = 'plant_based_cheese' | 'cheese' | 'bread' | 'meat' | 'yogurt' | 'generic';
type PrimaryIssueKind = 'texture' | 'aroma' | 'go_protection' | 'generic';

export type TweakLanguageContext = {
  foodTypeSlug: string;
  categoryLabel: string;
  categoryFamily: CategoryFamily;
  primaryIssue: {
    kind: PrimaryIssueKind;
    target: string;
    action: string;
    compound?: string;
    odour?: string;
    intensity?: number;
    concentration?: number;
    threshold?: number;
    thresholdRatio?: number;
  };
  protectedAttributes: string[];
  negativeAttributes: string[];
};

export type TweakDiagnosisRequest = {
  projectId?: string;
  decisionRecordId?: string;
  evidenceBundleId?: string;
  formulationVersionId?: string;
  question: string;
  sample: {
    sampleId: string;
    sampleName: string;
    foodType: string;
  };
  decision: {
    outcome: GoStopTweakDecision['decision'];
    issfScore: number;
    confidenceScore: number;
    riskLevel: GoStopTweakDecision['riskLevel'];
    methodVersion: string;
    decisionFingerprint: string;
  };
  sensoryEvidence: {
    panelN: number;
    dimensionScores: Record<string, number>;
    cata: Record<string, number>;
    intensity: Record<string, number>;
    hedonic: Record<string, number>;
    gates: Array<{ label: string; status: string; detail: string }>;
    prescriptions: Array<{ target: string; action: string; expectedLift: number }>;
  };
  instrumentalEvidence: {
    taste: Record<string, number>;
    composition: Record<string, number>;
    gcmsOlfactometry: Array<{
      compound: string;
      odour: string;
      odourIntensity: number;
      concentration?: number;
      threshold?: number;
      nistProbability?: number;
    }>;
    qc: {
      istdRecovery: number | null;
      olfactometryFlowSplit: string;
    };
  };
  formulationContext?: {
    versionId: string;
    versionNumber: number;
    fingerprint: string;
    exactStatement: string;
    ingredients: Array<{
      name: string;
      functionalRole: string;
      percentage: number | null;
      allergenTags: string[];
    }>;
    boundary: string;
  };
  languageContext: TweakLanguageContext;
  options: {
    evidenceDepth: 'focused' | 'all_applicable';
    reportMode: 'deterministic_only' | 'ollama_report_writer' | 'auto';
  };
};

export type TweakDiagnosisResponse = {
  summary: string;
  diagnosis: Array<{ heading: string; body: string; citationIds: string[] }>;
  recommendations: Array<{ priority: number; action: string; rationale: string; citationIds: string[] }>;
  benchPlan: Array<{ trial: string; variable: string; method: string; passCriteria: string }>;
  evidenceGroups: Array<{ label: string; confidence: 'direct' | 'supporting' | 'method' | 'context'; sources: string[] }>;
  citations: Array<{ id: string; title: string; page?: number | null; sourcePath: string; evidenceSourcePath?: string; evidenceRole?: string }>;
  appendix: Array<{ id: string; title: string; excerpt: string; page?: number | null }>;
  reportNarrative?: string | null;
  evidenceAssist: EvidenceAssistResult;
  warnings: string[];
  metadata: {
    engineMode: string;
    ragAvailable: boolean;
    llmUsed: boolean;
    sourceCount: number;
    generatedAt: string;
    decisionFingerprint: string;
  };
};

export type TweakEvidenceChain = {
  observation: string;
  evidenceBoundary: string;
  hypothesis: string;
  hypothesisStatus: 'supported' | 'needs_confirmation';
  verification: string;
  experimentScope: string;
  advancementGates: string[];
};

export type RagStatus = {
  app_name: string;
  pdf_count: number;
  document_count: number;
  chunk_count: number;
  papers_dir: string;
  collection_name: string;
  llm_enabled: boolean;
  llm_provider: string;
  llm_model: string;
  llm_message: string;
};

export function filterTweakDisplayWarnings(warnings: string[]) {
  return warnings.filter(warning => {
    const isEmptyConceptWarning = /concept evidence is n\s*=\s*0/i.test(warning)
      && /consumer preference/i.test(warning)
      && /packaging claims remain blocked/i.test(warning);
    const isInternalDecisionVerificationWarning = /project decision facts were not verified against the tenant database/i.test(warning)
      && /no product-specific evidence card was produced/i.test(warning);
    return !isEmptyConceptWarning && !isInternalDecisionVerificationWarning;
  });
}

export function buildTweakDiagnosisRequest(input: {
  question?: string;
  decision: GoStopTweakDecision;
  profile: EnhancedSensoryProfile;
  foodType: string;
  formulation?: FormulationVersion | null;
  projectId?: string | null;
  decisionRecordId?: string | null;
  evidenceBundleId?: string | null;
  formulationVersionId?: string | null;
}): TweakDiagnosisRequest {
  const { decision, profile, foodType, formulation } = input;
  const weakDimensions = Object.entries(decision.dimensionScores)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([name, score]) => `${name} ${score.toFixed(0)}/100`)
    .join(', ');
  const defaultQuestion = decision.decision === 'GO'
    ? `How should we protect and commercialize ${decision.sampleName} based on its sensory evidence?`
    : `How do we improve ${decision.sampleName} from ${decision.decision} to GO? Focus on ${weakDimensions || 'the weakest sensory drivers'}.`;
  const question = input.question?.trim() || defaultQuestion;

  const languageContext = buildLanguageContext(decision, profile, foodType);

  return {
    projectId: input.projectId ?? undefined,
    decisionRecordId: input.decisionRecordId ?? undefined,
    evidenceBundleId: input.evidenceBundleId ?? undefined,
    formulationVersionId: input.formulationVersionId ?? formulation?.id,
    question: `${question}\n\nAnalysis requirements: identify the measured blocker before proposing a mechanism; do not infer a formulation cause from aggregate CATA or liking scores alone; label literature-backed mechanisms as hypotheses unless the product evidence directly supports them; require a control or category benchmark diagnostic; limit the first screen to the current control plus no more than three targeted variants; preserve current positive attributes; and define measurable advancement gates, confirmation-batch requirements, and storage checkpoints before resubmission.`,
    sample: {
      sampleId: decision.sampleId,
      sampleName: decision.sampleName,
      foodType,
    },
    decision: {
      outcome: decision.decision,
      issfScore: decision.issfScore,
      confidenceScore: decision.confidenceScore,
      riskLevel: decision.riskLevel,
      methodVersion: decision.methodVersion,
      decisionFingerprint: decision.decisionFingerprint,
    },
    sensoryEvidence: {
      panelN: profile.panelN ?? (profile.evidence?.provenance === 'imported' ? 0 : PANEL_N),
      dimensionScores: decision.dimensionScores,
      cata: numericRecord(profile.cata),
      intensity: numericRecord(profile.intensity),
      hedonic: numericRecord(profile.hedonic),
      gates: decision.gates.map(gate => ({
        label: gate.label,
        status: gate.status,
        detail: gate.detail,
      })),
      prescriptions: decision.prescriptions.map(prescription => ({
        target: prescription.target,
        action: prescription.action,
        expectedLift: prescription.expectedLift,
      })),
    },
    instrumentalEvidence: {
      taste: numericRecord(profile.taste),
      composition: numericRecord(profile.composition),
      gcmsOlfactometry: profile.gcmsOlfactometry
        .filter(item => !item.isBlankArtefact)
        .sort((a, b) => {
          const aOverThreshold = a.threshold && a.concentration ? a.concentration / a.threshold : 0;
          const bOverThreshold = b.threshold && b.concentration ? b.concentration / b.threshold : 0;
          return b.odourIntensity - a.odourIntensity || bOverThreshold - aOverThreshold;
        })
        .slice(0, 12)
        .map(item => ({
          compound: item.compound,
          odour: item.odour,
          odourIntensity: item.odourIntensity,
          concentration: item.concentration,
          threshold: item.threshold,
          nistProbability: item.nistProbability,
        })),
      qc: {
        istdRecovery: profile.istdRecovery,
        olfactometryFlowSplit: profile.olfactometryFlowSplit,
      },
    },
    formulationContext: formulation?.reviewStatus === 'reviewed' ? {
      versionId: formulation.id,
      versionNumber: formulation.versionNumber,
      fingerprint: formulation.fingerprint,
      exactStatement: formulation.exactStatement,
      ingredients: formulation.ingredients
        .filter(ingredient => ingredient.reviewStatus === 'verified')
        .map(ingredient => ({
          name: ingredient.canonicalName,
          functionalRole: ingredient.functionalRole,
          percentage: ingredient.percentage,
          allergenTags: ingredient.allergenTags,
        })),
      boundary: 'Reviewed formulation context may guide hypotheses and controlled trials. It does not prove that an ingredient caused a sensory outcome, and missing percentages must not be inferred.',
    } : undefined,
    languageContext,
    options: {
      evidenceDepth: 'all_applicable',
      reportMode: 'deterministic_only',
    },
  };
}

export function buildTweakEvidenceChain(input: {
  decision: GoStopTweakDecision;
  profile: EnhancedSensoryProfile;
  foodType: string;
  goThreshold?: number;
}): TweakEvidenceChain {
  const { decision, profile, foodType, goThreshold = 75 } = input;
  const dimensions = Object.entries(decision.dimensionScores) as Array<
    [keyof GoStopTweakDecision['dimensionScores'], number]
  >;
  const [weakestKey, weakestScore] = [...dimensions].sort((a, b) => a[1] - b[1])[0];
  const label = dimensionLabel(weakestKey);
  const gap = Math.max(0, goThreshold - decision.issfScore);
  const panelN = profile.panelN ?? (profile.evidence?.provenance === 'imported' ? 0 : PANEL_N);
  const evidenceBoundary = panelN > 0
    ? `${decision.confidenceScore.toFixed(0)}% evidence strength supports this formulation-screening call at n=${panelN}. It does not establish consumer concept, purchase, packaging, shelf-life, or commercialization readiness.`
    : `${decision.confidenceScore.toFixed(0)}% evidence strength supports this formulation-screening call, but the panel size is not recorded. It does not establish consumer concept, purchase, packaging, shelf-life, or commercialization readiness.`;

  if (weakestKey === 'cata') {
    const textureScore = decision.dimensionScores.texture;
    const textureLiking = profile.hedonic.texture;
    return {
      observation: `${label} is the measured blocker at ${weakestScore.toFixed(0)}/100; the prototype is ${gap.toFixed(1)} ISSF points below GO.`,
      evidenceBoundary,
      hypothesis: textureScore < 72
        ? `Texture or body is a plausible contributor because texture scored ${textureScore.toFixed(0)}/100${Number.isFinite(textureLiking) ? ` and texture liking was ${textureLiking.toFixed(1)}/9` : ''}. Aggregate results do not prove that texture caused the category-fit failure.`
        : 'The current aggregate data do not identify a formulation mechanism. The category benchmark, descriptor list, positioning, and serving protocol remain competing explanations.',
      hypothesisStatus: 'needs_confirmation',
      verification: `Before reformulation, compare the current control with an intended-${canonicalFoodType(foodType, decision.sampleName).label.toLowerCase()} benchmark using the same ballot. Collect respondent-level category fit, CATA, texture liking, and overall liking so descriptor penalties and drivers can be tested rather than assumed.`,
      experimentScope: 'Only after the driver is confirmed: run C0 plus no more than three targeted variants. Change one predeclared mechanism per variant and keep all other process conditions fixed.',
      advancementGates: buildAdvancementGates(decision, profile, goThreshold, weakestScore),
    };
  }

  if (weakestKey === 'texture') {
    return {
      observation: `${label} is the measured blocker at ${weakestScore.toFixed(0)}/100; the prototype is ${gap.toFixed(1)} ISSF points below GO.`,
      evidenceBoundary,
      hypothesis: 'The measured texture result justifies a focused texture diagnosis, but it does not by itself identify the responsible ingredient or process mechanism.',
      hypothesisStatus: 'needs_confirmation',
      verification: 'Benchmark the current control and repeat the texture scorecard with respondent-level liking plus the relevant instrumental checks. Use those results to select the mechanism—not the literature title alone.',
      experimentScope: 'Run C0 plus no more than three targeted variants selected from the confirmed driver. Change one predeclared mechanism per variant and keep all other process conditions fixed.',
      advancementGates: buildAdvancementGates(decision, profile, goThreshold, weakestScore),
    };
  }

  const primaryIssue = buildLanguageContext(decision, profile, foodType).primaryIssue;
  return {
    observation: `${label} is the weakest measured dimension at ${weakestScore.toFixed(0)}/100; the prototype is ${gap.toFixed(1)} ISSF points below GO.`,
    evidenceBoundary,
    hypothesis: primaryIssue.kind === 'aroma'
      ? `${primaryIssue.target} is supported by the measured aroma gate, but the corrective mechanism still requires a controlled trial.`
      : 'The current evidence identifies where performance is weak, not the ingredient or process mechanism responsible.',
    hypothesisStatus: primaryIssue.kind === 'aroma' ? 'supported' : 'needs_confirmation',
    verification: 'Confirm the blocker against the current control and a relevant category benchmark before selecting a formulation mechanism.',
    experimentScope: 'Run C0 plus no more than three targeted variants. Change one predeclared mechanism per variant and keep all other process conditions fixed.',
    advancementGates: buildAdvancementGates(decision, profile, goThreshold, weakestScore),
  };
}

function buildAdvancementGates(
  decision: GoStopTweakDecision,
  profile: EnhancedSensoryProfile,
  goThreshold: number,
  currentFocusScore: number,
) {
  const currentOverall = Number.isFinite(profile.hedonic.overall) ? profile.hedonic.overall : null;
  const protectedCues = protectedAttributes(profile).slice(0, 4);
  return [
    `The failing dimension improves from the current ${currentFocusScore.toFixed(0)}/100 result by more than the study's predeclared uncertainty margin; a score at or below ${currentFocusScore.toFixed(0)}/100 does not pass.`,
    `${currentOverall !== null ? `Overall liking remains at or above the current ${currentOverall.toFixed(1)}/9` : 'Overall liking does not decline'}${protectedCues.length > 0 ? `, while ${protectedCues.join(', ')} remain protected` : ''}.`,
    `ISSF reaches GO ≥ ${goThreshold}, evidence strength remains ≥72%, and no defect or quality gate is open.`,
    'The improvement repeats on a fresh confirmation batch. Storage temperature, evaluation timepoints, pH drift, and physical stability limits are defined before the run; passing a day-0 screen alone is not enough.',
  ];
}

function dimensionLabel(key: keyof GoStopTweakDecision['dimensionScores']) {
  switch (key) {
    case 'cata': return 'Category / lexicon fit';
    case 'hedonic': return 'Consumer acceptance';
    case 'texture': return 'Texture';
    case 'emotional': return 'Emotional response';
  }
}

export async function fetchRagStatus(): Promise<RagStatus> {
  const response = await ragFetch('/api/status');
  if (!response.ok) throw new Error(`RAG status unavailable (${response.status})`);
  return response.json() as Promise<RagStatus>;
}

export async function fetchTweakDiagnosis(
  request: TweakDiagnosisRequest,
  signal?: AbortSignal,
): Promise<TweakDiagnosisResponse> {
  const response = await ragFetch('/api/tweak-diagnosis', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) throw new Error(`Tweak Intelligence unavailable (${response.status})`);
  const payload = await response.json() as TweakDiagnosisResponse;
  parseEvidenceAssistResult(payload.evidenceAssist);
  return payload;
}

export const openSourceViewer = openRagSource;

export function tweakDiagnosisCacheKey(request: TweakDiagnosisRequest) {
  return `${CACHE_PREFIX}:${request.sample.sampleId}:${request.decision.decisionFingerprint}:${requestSignature(request)}`;
}

function requestSignature(request: TweakDiagnosisRequest) {
  const stable = JSON.stringify({
    question: request.question,
    sample: request.sample,
    decision: request.decision,
    sensoryEvidence: request.sensoryEvidence,
    instrumentalEvidence: request.instrumentalEvidence,
    languageContext: request.languageContext,
    options: request.options,
  });
  let hash = 0;
  for (let index = 0; index < stable.length; index += 1) {
    hash = ((hash << 5) - hash + stable.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function numericRecord(value: Record<string, number | undefined | null>) {
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, number] => Number.isFinite(entry[1]))
      .map(([key, item]) => [key, Number(item)]),
  );
}

function buildLanguageContext(
  decision: GoStopTweakDecision,
  profile: EnhancedSensoryProfile,
  foodType: string,
): TweakLanguageContext {
  const category = canonicalFoodType(foodType, decision.sampleName);
  return {
    foodTypeSlug: category.slug,
    categoryLabel: category.label,
    categoryFamily: category.family,
    primaryIssue: primaryIssueFromDecision(decision, profile),
    protectedAttributes: protectedAttributes(profile),
    negativeAttributes: negativeAttributes(profile),
  };
}

function canonicalFoodType(foodType: string, sampleName: string) {
  const text = normalize(`${foodType} ${sampleName}`);
  if (hasAny(text, ['pbca', 'plant based cheese', 'plant based cheese alternative', 'cheese alternative'])) {
    return { slug: 'plant_based_cheese', label: 'Plant-based cheese alternative', family: 'plant_based_cheese' as const };
  }
  if (hasAny(text, ['sourdough', 'bread', 'boule', 'loaf', 'baguette', 'rye', 'brioche', 'ciabatta', 'focaccia'])) {
    return { slug: 'bread', label: 'Bread and bakery', family: 'bread' as const };
  }
  if (hasAny(text, ['meat', 'burger', 'sausage', 'chicken', 'beef', 'nugget'])) {
    return { slug: 'meat', label: 'Plant-based meat or savory analogue', family: 'meat' as const };
  }
  if (hasAny(text, ['yogurt', 'yoghurt', 'kefir', 'pudding', 'cultured'])) {
    const isPlantBased = hasAny(text, ['plant based', 'coconut', 'oat', 'soy', 'almond', 'cashew']);
    return {
      slug: 'yogurt',
      label: isPlantBased ? 'Cultured dairy alternative' : 'Yogurt or kefir',
      family: 'yogurt' as const,
    };
  }
  if (hasAny(text, ['cheese', 'cheddar', 'mozzarella', 'gouda', 'feta', 'parmesan'])) {
    return { slug: 'cheese', label: 'Cheese or cheese alternative', family: 'cheese' as const };
  }
  const slug = normalize(foodType).replace(/\s+/g, '_') || 'generic';
  return { slug, label: foodType || 'Generic food product', family: 'generic' as const };
}

function primaryIssueFromDecision(
  decision: GoStopTweakDecision,
  profile: EnhancedSensoryProfile,
): TweakLanguageContext['primaryIssue'] {
  if (decision.decision === 'GO') {
    return {
      kind: 'go_protection',
      target: 'validated sensory profile protection',
      action: decision.recommendation,
    };
  }

  const primaryPrescription = [...decision.prescriptions].sort((a, b) => a.priority - b.priority)[0];
  const target = primaryPrescription?.target ?? 'Focused formula optimization';
  const action = primaryPrescription?.action ?? decision.recommendation;
  const issueText = normalize(`${target} ${action}`);

  if (hasAny(issueText, ['aroma defect', 'aroma balance', 'off note', 'offnote', 'remove or mask', 'rebalance', 'gc o', 'gc ms', 'gcms'])) {
    const parsed = parseAromaIssue(action, profile);
    return {
      kind: 'aroma',
      target,
      action,
      ...parsed,
    };
  }

  if (hasAny(issueText, ['texture', 'formula', 'smooth', 'cream', 'chalk', 'grain', 'body', 'mouthfeel', 'hydration', 'fat protein'])) {
    return { kind: 'texture', target, action };
  }

  return { kind: 'generic', target, action };
}

function parseAromaIssue(action: string, profile: EnhancedSensoryProfile) {
  const match = action.match(/(?:remove or mask|control|reduce(?: or rebalance)?|rebalance|lower|address)\s+([^:.]+):\s*([^.]*)/i);
  const compound = match?.[1]?.trim();
  const fallbackDetail = match?.[2]?.trim();
  const signal = compound
    ? profile.gcmsOlfactometry.find(item => normalizeCompound(item.compound) === normalizeCompound(compound))
    : undefined;
  if (signal) {
    return {
      compound: signal.compound,
      odour: signal.odour,
      intensity: signal.odourIntensity,
      concentration: signal.concentration,
      threshold: signal.threshold,
      thresholdRatio: signal.threshold && signal.concentration != null ? signal.concentration / signal.threshold : undefined,
    };
  }
  return {
    compound,
    odour: fallbackDetail,
  };
}

function protectedAttributes(profile: EnhancedSensoryProfile) {
  const protectedWords = [
    'creamy', 'smooth', 'firm', 'spreadable', 'cheddar', 'cheese', 'cheesy', 'butter', 'buttery', 'milk', 'milky', 'nutty',
    'thick', 'spoonable', 'tangy', 'fresh', 'fermented', 'lemon', 'citrus',
    'juicy', 'tender', 'umami', 'savory', 'savoury',
    'fresh-baked', 'fresh baked', 'crusty', 'yeasty', 'balanced', 'chewy', 'airy',
  ];
  return topMatchingAttributes(profile.cata, protectedWords, 8);
}

function negativeAttributes(profile: EnhancedSensoryProfile) {
  const negativeWords = [
    'grainy', 'chalky', 'dry', 'rubbery', 'gummy', 'sticky', 'dense', 'watery', 'thin',
    'rancid', 'cardboard', 'sulfur', 'sulphur', 'beany', 'bitter', 'astringent', 'sour',
  ];
  const cataTerms = topMatchingAttributes(profile.cata, negativeWords, 8);
  const intensityTerms = Object.entries(profile.intensity)
    .filter(([attribute, value]) => Number.isFinite(value) && Number(value) >= 3 && hasAny(normalize(attribute), negativeWords))
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([attribute]) => attribute);
  return unique([...cataTerms, ...intensityTerms]).slice(0, 8);
}

function topMatchingAttributes(values: Record<string, number | undefined | null>, words: string[], limit: number) {
  return Object.entries(values)
    .filter(([attribute, value]) => Number.isFinite(value) && hasAny(normalize(attribute), words))
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([attribute]) => attribute)
    .slice(0, limit);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeCompound(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function hasAny(value: string, words: string[]) {
  return words.some(word => value.includes(normalize(word)));
}
