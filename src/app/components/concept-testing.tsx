import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import {
  ChevronRight, ChevronLeft, Send, CheckCircle2,
  AlertTriangle, Gauge, Circle,
} from 'lucide-react';
import { insertConceptTest } from '../lib/database';
import type { DecisionRecord } from '../lib/database';
import { ENHANCED_SENSORY_DATA, type EnhancedSensoryProfile } from '../data/enhanced-sensory';
import { detectFoodType, formatFoodTypeLabel, getFoodTypeProfile } from '../lib/food-intelligence';
import { sampleMatchesFoodType, useFoodType } from '../contexts/food-type-context';
import { workflowStagePath } from '../lib/project-journey-routes';
import {
  buildEvidencePositioningPromise,
  buildInstrumentEvidenceSummary,
  buildPanelEvidenceSummary,
  strongestHedonicSignals,
  topSuccessfulPanelSignals,
} from '../lib/concept-positioning-promise';
import {
  buildImportedSensoryProfiles,
  findSensoryEvidenceProfile,
} from '../lib/sensory-evidence-profile';
import { useAuth } from '../contexts/auth-context';
import {
  useConceptGenerationSettings,
  useConceptLabDiagnostics,
  useDecisionFreshness,
  useDecisionRecords,
  useInstrumentalDataset,
  usePanelists,
  useWorkspaceSettings,
} from '../lib/hooks';
import { useSurveyData } from '../lib/use-survey-data';
import type { ConceptDraft, Question, WizardStep } from './concept-testing/types';
import { EMPTY_VARIANT_DIMENSIONS } from './concept-testing/types';
import type { AIReviewState } from './ai-review-card';
import { ConceptStep } from './concept-testing/ConceptStep';
import { ImagesStep } from './concept-testing/ImagesStep';
import { QuestionsStep } from './concept-testing/QuestionsStep';
import { PanelStep } from './concept-testing/PanelStep';
import { ReviewStep } from './concept-testing/ReviewStep';
import { getConceptReadiness } from './concept-testing/concept-readiness';
import { buildTailoredConceptQuestions, defaultConceptPanelistIds } from './concept-testing/smart-defaults';
import { WorkflowPageHeader } from './workflow-page-header';
import { FormulationContextStrip } from './formulation-context-strip';

// ─── Helper ───────────────────────────────────────────────────────────────────

const isValidImageUrlLaunch = (u: string) =>
  u.startsWith('data:image/') || ((): boolean => { try { return new URL(u).protocol === 'https:'; } catch { return false; } })();

const DRAFT_STORAGE_KEY = 'concept_lab_draft_v1';
const CONCEPT_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const makeEmptyDraft = (promptStyle: string = 'balanced'): ConceptDraft => ({
  name: '',
  category: '',
  projectName: 'Project 1',
  description: '',
  marketingImages: [],
  marketingImageIds: [],
  marketingImageReviews: [],
  targetMarket: '',
  targetOccasion: '',
  productAppearance: '',
  packageFormat: '',
  visualSetting: '',
  colorDirection: '',
  mustShow: '',
  pricePoint: '',
  keyBenefits: '',
  technicalChallenges: '',
  promptStyle,
  visualNotes: '',
  forbiddenClaims: '',
  approvalStatus: 'draft',
  variantDimensions: { ...EMPTY_VARIANT_DIMENSIONS },
  brandReference: null,
});

interface StoredConceptDraft {
  draft: ConceptDraft;
  questions: Question[];
  questionsReviewState?: AIReviewState | 'none';
  panelSize: number;
  segments: string[];
  assignedPanelistIds: string[];
  sourceDecision?: SourceDecisionSeed | null;
  conceptSourceChosen?: boolean;
  savedAt: string;
}

interface SourceDecisionSeed {
  id: string;
  sampleId: string;
  sampleName: string;
  issfScore: number;
  confidence: number;
  timestamp: string;
  likedSignals?: string[];
  formulationVersionId?: string | null;
  evidenceBundleId?: string | null;
}

interface ConceptSeed {
  name?: string;
  category?: string;
  description?: string;
  productAppearance?: string;
  packageFormat?: string;
  targetMarket?: string;
  targetOccasion?: string;
  visualSetting?: string;
  colorDirection?: string;
  mustShow?: string;
  keyBenefits?: string;
  technicalChallenges?: string;
  sourceDecision?: SourceDecisionSeed;
}

function conceptSeedFromDecisionRecord(
  record: DecisionRecord,
  promptStyle: string,
  activeFoodType: string,
  evidenceProfile?: EnhancedSensoryProfile,
): { draft: ConceptDraft; seed: ConceptSeed } {
  const detected = detectFoodType(record.sampleName, record.note);
  const evidenceFoodType = evidenceProfile ? sampleMatchesFoodType(evidenceProfile.sampleId, evidenceProfile.sampleName) : detected.slug;
  const foodTypeSlug = activeFoodType !== 'all' ? activeFoodType : evidenceFoodType;
  const category = activeFoodType !== 'all'
    ? formatFoodTypeLabel(activeFoodType)
    : evidenceProfile
      ? formatFoodTypeLabel(evidenceFoodType)
      : detected.label;
  const profile = getFoodTypeProfile(foodTypeSlug);
  const likedSignals = evidenceProfile
    ? [...topSuccessfulPanelSignals(evidenceProfile, foodTypeSlug), ...strongestHedonicSignals(evidenceProfile)]
    : profile.successMarkers.slice(0, 4);
  const strengths = likedSignals.join(', ');
  const seed: ConceptSeed = {
    name: record.sampleName,
    category,
    description: buildEvidencePositioningPromise({
      category,
      sourceSampleName: record.sampleName,
      sensoryStrengths: likedSignals,
      panelEvidence: evidenceProfile ? buildPanelEvidenceSummary(evidenceProfile, foodTypeSlug) : [],
      instrumentEvidence: evidenceProfile ? buildInstrumentEvidenceSummary(evidenceProfile) : [],
      issfScore: record.issfScore,
      confidence: record.confidence,
      decisionRationale: record.note,
    }),
    productAppearance: `Show ${record.sampleName} as a believable ${category.toLowerCase()} product with appetizing texture and clear cues for ${strengths}.`,
    packageFormat: 'Retail-ready pack with clear product name, category recognition, and a believable serving suggestion.',
    targetMarket: `Shoppers looking for ${category.toLowerCase()} with validated sensory appeal.`,
    targetOccasion: 'Everyday use occasion where the validated sensory strengths are easy to understand.',
    visualSetting: 'Clean retail or kitchen setting that makes the product quality easy to judge.',
    colorDirection: 'Use a commercial palette that supports the strongest liked sensory cues without overclaiming.',
    mustShow: `Product name, category cue, serving suggestion, and visual support for ${strengths}.`,
    keyBenefits: strengths,
    technicalChallenges: record.note,
    sourceDecision: {
      id: record.id,
      sampleId: record.sampleId,
      sampleName: record.sampleName,
      issfScore: record.issfScore,
      confidence: record.confidence,
      timestamp: record.timestamp,
      likedSignals,
      formulationVersionId: record.formulationVersionId ?? null,
      evidenceBundleId: record.evidenceBundleId ?? null,
    },
  };
  return {
    seed,
    draft: {
      ...makeEmptyDraft(promptStyle),
      name: seed.name ?? '',
      category: seed.category ?? '',
      description: seed.description ?? '',
      productAppearance: seed.productAppearance ?? '',
      packageFormat: seed.packageFormat ?? '',
      targetMarket: seed.targetMarket ?? '',
      targetOccasion: seed.targetOccasion ?? '',
      visualSetting: seed.visualSetting ?? '',
      colorDirection: seed.colorDirection ?? '',
      mustShow: seed.mustShow ?? '',
      keyBenefits: seed.keyBenefits ?? '',
      technicalChallenges: seed.technicalChallenges ?? '',
    },
  };
}

const STEP_LABELS: Record<WizardStep, string> = {
  concept: 'Brief & visuals',
  survey: 'Survey',
  panel: 'Panel',
  review: 'Launch',
  launched: '',
};

// ─── Main component ───────────────────────────────────────────────────────────

export function ConceptTesting() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId: routeProjectId } = useParams<{ projectId?: string }>();
  const { foodType } = useFoodType();
  const { user } = useAuth();
  // Scope the autosaved draft per user + project so drafts never leak across
  // projects or between users sharing a browser.
  const draftStorageKey = `${DRAFT_STORAGE_KEY}:${user?.id ?? 'anon'}:${routeProjectId ?? 'standalone'}`;
  const [step, setStep] = useState<WizardStep>('concept');
  const [draft, setDraft] = useState<ConceptDraft>(() => makeEmptyDraft());
  const [questions, setQuestions] = useState<Question[]>([]);
  // 'none' = hand-built list with no generated draft to review.
  const [questionsReviewState, setQuestionsReviewState] = useState<AIReviewState | 'none'>('none');
  const [panelSize, setPanelSize] = useState(50);
  const [segments, setSegments] = useState<string[]>([]);
  const [assignedPanelistIds, setAssignedPanelistIds] = useState<string[]>([]);
  const { data: panelists = [] } = usePanelists();
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState('');
  const [draftNotice, setDraftNotice] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
  const [sourceDecision, setSourceDecision] = useState<SourceDecisionSeed | null>(null);
  const [conceptSourceChosen, setConceptSourceChosen] = useState(false);
  const { data: settings } = useConceptGenerationSettings();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const { data: diagnostics } = useConceptLabDiagnostics();
  const { data: decisionRecords = [] } = useDecisionRecords();
  const { data: decisionFreshness } = useDecisionFreshness(sourceDecision?.id);
  const { data: instrumentalDataset } = useInstrumentalDataset(user?.role === 'admin');
  const { liveAggregations } = useSurveyData();
  const smartDefaultsApplied = useRef(false);
  const minimumResponses = workspaceSettings?.decisionMinResponses ?? 12;

  const evidenceProfiles = useMemo(() => {
    const referenceIds = new Set(ENHANCED_SENSORY_DATA.map(profile => profile.sampleId));
    const importedProfiles = buildImportedSensoryProfiles(
      instrumentalDataset,
      liveAggregations,
      { minimumResponses, excludeSampleIds: referenceIds },
    );
    return [...ENHANCED_SENSORY_DATA, ...importedProfiles];
  }, [instrumentalDataset, liveAggregations, minimumResponses]);

  const STEPS: Exclude<WizardStep, 'launched'>[] = ['concept', 'survey', 'panel', 'review'];
  const activeWizardStep: Exclude<WizardStep, 'launched'> = step === 'launched' ? 'review' : step;
  const stepIndex = STEPS.indexOf(activeWizardStep);

  const detection = detectFoodType(draft.category, draft.name, draft.description);
  const requireApprovedVisuals = Boolean(workspaceSettings?.conceptRequireApproval);
  const { items: readinessItems } = getConceptReadiness({
    draft,
    questions,
    assignedPanelistIds,
    panelists,
    requireApprovedVisuals,
  });
  const launchReady = readinessItems.every(item => item.ready)
    && Boolean(sourceDecision?.id)
    && decisionFreshness?.allowed === true;
  const conceptStepReady = readinessItems.filter(item => item.fixStep === 'concept').every(item => item.ready);
  const surveyStepReady = readinessItems.filter(item => item.fixStep === 'survey').every(item => item.ready);
  const panelStepReady = readinessItems.filter(item => item.fixStep === 'panel').every(item => item.ready);
  const setupWarnings = diagnostics?.messages ?? [];
  const draftHasWork = useMemo(() => (
    draft.name.trim()
    || draft.category.trim()
    || draft.description.trim()
    || draft.marketingImages.some(Boolean)
    || questions.length > 0
  ), [draft.category, draft.description, draft.marketingImages, draft.name, questions.length]);

  /* eslint-disable react-hooks/set-state-in-effect -- one-time seed/draft hydration from external route and storage state */
  useEffect(() => {
    const seed = (location.state as {
      conceptSeed?: ConceptSeed;
    } | null)?.conceptSeed;
    if (seed?.name) {
      if (!seed.sourceDecision?.id || !seed.sourceDecision.evidenceBundleId) {
        localStorage.removeItem(draftStorageKey);
        setDraftNotice('A confirmed GO decision with linked evidence is required before starting concept work.');
        return;
      }
      const emptyDraft = makeEmptyDraft(settings?.promptStyle ?? 'balanced');
      const seededDraft = {
        ...emptyDraft,
        name: seed.name.trim(),
        category: seed.category?.trim() || emptyDraft.category,
        description: seed.description?.trim() || emptyDraft.description,
        productAppearance: seed.productAppearance?.trim() || emptyDraft.productAppearance,
        packageFormat: seed.packageFormat?.trim() || emptyDraft.packageFormat,
        targetMarket: seed.targetMarket?.trim() || emptyDraft.targetMarket,
        targetOccasion: seed.targetOccasion?.trim() || emptyDraft.targetOccasion,
        visualSetting: seed.visualSetting?.trim() || emptyDraft.visualSetting,
        colorDirection: seed.colorDirection?.trim() || emptyDraft.colorDirection,
        mustShow: seed.mustShow?.trim() || emptyDraft.mustShow,
        keyBenefits: seed.keyBenefits?.trim() || emptyDraft.keyBenefits,
        technicalChallenges: seed.technicalChallenges?.trim() || emptyDraft.technicalChallenges,
      };
      setDraft(seededDraft);
      setQuestions(buildTailoredConceptQuestions(seededDraft));
      setQuestionsReviewState('draft');
      setSegments([]);
      setAssignedPanelistIds([]);
      setSourceDecision(seed.sourceDecision ?? null);
      setConceptSourceChosen(true);
      smartDefaultsApplied.current = false;
      setDraftNotice(
        seed.sourceDecision?.likedSignals?.length
          ? `Started from the confirmed GO decision for "${seed.name}" and prefilled image cues from panel strengths: ${seed.sourceDecision.likedSignals.slice(0, 4).join(', ')}.`
          : `Started from the confirmed GO decision for "${seed.name}". A draft survey and panel defaults are ready for review.`
      );
      localStorage.removeItem(draftStorageKey);
      return;
    }

    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (raw) {
        const saved = JSON.parse(raw) as StoredConceptDraft;
        const savedAt = Date.parse(saved.savedAt);
        if (!Number.isFinite(savedAt) || Date.now() - savedAt > CONCEPT_DRAFT_TTL_MS) {
          localStorage.removeItem(draftStorageKey);
          setDraftNotice('The previous concept draft expired after seven days and was removed for workspace privacy.');
          return;
        }
        if (saved?.draft && saved.sourceDecision?.id && saved.sourceDecision.evidenceBundleId) {
          setDraft({ ...makeEmptyDraft(saved.draft.promptStyle), ...saved.draft });
          setQuestions(saved.questions ?? []);
          setQuestionsReviewState(saved.questionsReviewState ?? 'none');
          setSegments(saved.segments ?? []);
          setAssignedPanelistIds(saved.assignedPanelistIds ?? []);
          setPanelSize(saved.panelSize ?? 50);
          setSourceDecision(saved.sourceDecision ?? null);
          setConceptSourceChosen(saved.conceptSourceChosen ?? true);
          smartDefaultsApplied.current = true;
          setDraftNotice(`Draft restored from ${new Date(saved.savedAt).toLocaleString()}.`);
          return;
        }
        localStorage.removeItem(draftStorageKey);
        setDraftNotice('An older unlinked concept draft was removed. Select a confirmed GO decision to continue.');
      }
    } catch {
      localStorage.removeItem(draftStorageKey);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!sourceDecision || smartDefaultsApplied.current || panelists.length === 0) return;
    setAssignedPanelistIds(defaultConceptPanelistIds(panelists));
    setPanelSize(workspaceSettings?.defaultPanelSize ?? 50);
    smartDefaultsApplied.current = true;
  }, [panelists, sourceDecision, workspaceSettings?.defaultPanelSize]);

  useEffect(() => {
    if (!draftHasWork && workspaceSettings?.defaultPanelSize) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- default panel size from async workspace settings
      setPanelSize(workspaceSettings.defaultPanelSize);
    }
  }, [draftHasWork, workspaceSettings?.defaultPanelSize]);

  useEffect(() => {
    if (!draftHasWork || step === 'launched') return;
    const timeout = window.setTimeout(() => {
      const payload: StoredConceptDraft = {
        draft,
        questions,
        questionsReviewState,
        panelSize,
        segments,
        assignedPanelistIds,
        sourceDecision,
        conceptSourceChosen,
        savedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(draftStorageKey, JSON.stringify(payload));
        setSaveState('saved');
      } catch {
        setSaveState('idle');
        setDraftNotice('This draft is too large for browser autosave. Approved records remain stored in the workspace.');
      }
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [assignedPanelistIds, conceptSourceChosen, draft, draftHasWork, draftStorageKey, panelSize, questions, questionsReviewState, segments, sourceDecision, step]);

  const resetForm = () => {
    setStep('concept');
    setDraft(makeEmptyDraft(settings?.promptStyle ?? 'balanced'));
    setQuestions([]);
    setQuestionsReviewState('none');
    setSegments([]);
    setAssignedPanelistIds([]);
    setPanelSize(workspaceSettings?.defaultPanelSize ?? 50);
    setLaunchError('');
    setDraftNotice('');
    setSaveState('idle');
    setSourceDecision(null);
    setConceptSourceChosen(false);
    smartDefaultsApplied.current = false;
    localStorage.removeItem(draftStorageKey);
  };

  const confirmedGoDecisions = useMemo(
    () => decisionRecords
      .filter(record => (
        record.decision === 'GO'
        && Boolean(record.evidenceBundleId)
        && (!routeProjectId || record.projectId === routeProjectId)
      ))
      .slice(0, 6),
    [decisionRecords, routeProjectId],
  );

  const startFromDecision = (record: DecisionRecord) => {
    const evidenceProfile = findSensoryEvidenceProfile(evidenceProfiles, {
      sampleId: record.sampleId,
      sampleName: record.sampleName,
    });
    const { draft: seededDraft, seed } = conceptSeedFromDecisionRecord(
      record,
      settings?.promptStyle ?? 'balanced',
      foodType,
      evidenceProfile,
    );
    const reviewedFormulation = instrumentalDataset?.formulationVersions?.[record.sampleId]
      ?.find(version => version.isCurrent && version.reviewStatus === 'reviewed');
    const ingredientCues = reviewedFormulation?.ingredients
      .filter(ingredient => ingredient.reviewStatus === 'verified')
      .map(ingredient => ingredient.canonicalName)
      .slice(0, 4) ?? [];
    const formulationAwareDraft = ingredientCues.length > 0 ? {
      ...seededDraft,
      keyBenefits: [seededDraft.keyBenefits, `Ingredient-led cue candidates (claims review required): ${ingredientCues.join(', ')}`]
        .filter(Boolean)
        .join('\n'),
      technicalChallenges: [
        seededDraft.technicalChallenges,
        `Formulation v${reviewedFormulation?.versionNumber} is linked. Ingredient cues are positioning inputs only; do not convert them into nutrition, free-from, or performance claims without separate substantiation.`,
      ].filter(Boolean).join('\n'),
    } : seededDraft;
    setStep('concept');
    setDraft(formulationAwareDraft);
    setQuestions(buildTailoredConceptQuestions(formulationAwareDraft));
    setQuestionsReviewState('draft');
    setSegments([]);
    setAssignedPanelistIds([]);
    setSourceDecision(seed.sourceDecision ?? null);
    setConceptSourceChosen(true);
    smartDefaultsApplied.current = false;
    setDraftNotice(
      seed.sourceDecision?.likedSignals?.length
        ? `Started from the confirmed GO decision for "${record.sampleName}" and prefilled image cues: ${seed.sourceDecision.likedSignals.join(', ')}.${ingredientCues.length ? ' Reviewed formulation cues were added for claims review.' : ''}`
        : `Started from the confirmed GO decision for "${record.sampleName}".`
    );
    localStorage.removeItem(draftStorageKey);
  };

  const handleLaunch = async () => {
    if (launching) return;
    if (!launchReady) {
      const missing = readinessItems.filter(item => !item.ready).map(item => item.label.toLowerCase());
      if (!sourceDecision?.id) missing.push('confirmed GO decision');
      if (sourceDecision?.id && decisionFreshness && !decisionFreshness.allowed) {
        missing.push(decisionFreshness.reason ?? 'current decision evidence');
      }
      setLaunchError(`Not ready to launch yet. Finish: ${missing.join(', ')}.`);
      return;
    }
    setLaunching(true);
    setLaunchError('');
    try {
      const visualApprovalNotes = draft.marketingImages
        .map((url, index) => ({ url, review: draft.marketingImageReviews[index] }))
        .filter(entry => entry.url.trim())
        .map((entry, index) => {
          const status = entry.review?.status ?? 'selected';
          const note = entry.review?.notes?.trim();
          return `Visual ${index + 1}: ${status}${note ? ` — ${note}` : ''}`;
        })
        .join('\n');
      await insertConceptTest({
        name: draft.name,
        category: draft.category,
        description: draft.description,
        imageUrls: draft.marketingImages.filter(u => u.trim() && isValidImageUrlLaunch(u)),
        imageIds: draft.marketingImageIds,
        targetMarket: draft.targetMarket,
        pricePoint: draft.pricePoint,
        keyBenefits: draft.keyBenefits,
        questions,
        panelSize,
        assignedPanelistIds,
        projectName: draft.projectName,
        foodTypeSlug: detection.slug,
        approvalNotes: requireApprovedVisuals
          ? `All selected concept visuals were approved in Concept Lab before launch.${visualApprovalNotes ? `\n${visualApprovalNotes}` : ''}`
          : draft.approvalStatus === 'approved' ? `Approved in Concept Lab before launch.${visualApprovalNotes ? `\n${visualApprovalNotes}` : ''}` : '',
        status: 'active',
        variantDimensions: draft.variantDimensions as unknown as Record<string, string | null>,
        brandReferenceImageId: draft.brandReference?.imageId ?? null,
        projectId: routeProjectId ?? null,
        formulationVersionId: sourceDecision?.formulationVersionId ?? null,
        decisionRecordId: sourceDecision?.id ?? null,
        evidenceBundleId: sourceDecision?.evidenceBundleId ?? null,
      });
      localStorage.removeItem(draftStorageKey);
      setStep('launched');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isMissingTable = msg.includes('concept_tests') || msg.includes('does not exist') || msg.includes('relation');
      setLaunchError(
        isMissingTable
          ? 'Database setup required: the concept_tests table does not exist yet. Run the SQL migrations at the top of src/app/lib/database.ts in your Supabase SQL editor.'
          : `Launch failed: ${msg}`
      );
    } finally {
      setLaunching(false);
    }
  };

  if (step === 'launched') {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="size-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900">Concept test launched</h2>
        <p className="text-slate-500 text-lg">
          Your survey has been sent to <strong>{assignedPanelistIds.length} panelist{assignedPanelistIds.length === 1 ? '' : 's'}</strong>.
          Results will appear in <strong>Insights</strong> as responses come in.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Button variant="outline" onClick={resetForm}>
            New concept test
          </Button>
          <Button variant="outline" onClick={() => navigate(workflowStagePath('insights', routeProjectId))}>
            View insights
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => navigate(workflowStagePath('report', routeProjectId, '?create=1'))}
          >
            Prepare commercialization report
          </Button>
        </div>
      </div>
    );
  }

  const saveStatus = (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500" aria-live="polite">
      <CheckCircle2 className={`size-3.5 ${saveState === 'saved' ? 'text-emerald-600' : 'text-slate-500'}`} />
      {saveState === 'saved' ? 'Draft saved' : 'Autosaves'}
    </span>
  );

  const currentStepReady = step === 'concept'
    ? conceptStepReady
    : step === 'survey'
      ? surveyStepReady
      : step === 'panel'
        ? panelStepReady
        : launchReady;
  const currentBlockers = readinessItems.filter(item => !item.ready && (
    step === 'review' || item.fixStep === step
  ));
  const blockerMessage = currentBlockers[0]?.detail ?? '';
  const nextStep = STEPS[stepIndex + 1];
  const nextActionLabel = nextStep ? `Continue to ${STEP_LABELS[nextStep]}` : 'Continue';
  const conceptWorkspaceStarted = Boolean(sourceDecision?.id && sourceDecision.evidenceBundleId);

  return (
    <div className="space-y-6 pb-8">
      <WorkflowPageHeader
        title="Concept Lab"
        description="Prepare one consumer concept test for launch."
        actions={saveStatus}
      />

      <FormulationContextStrip projectId={routeProjectId} context="concept" />

      {setupWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Concept Lab setup needs attention</p>
              <p className="mt-0.5 text-xs text-amber-800">{setupWarnings.join(' ')}</p>
            </div>
          </div>
        </div>
      )}

      {draftNotice && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
          <span>{draftNotice}</span>
          <button type="button" onClick={() => setDraftNotice('')} className="text-xs font-semibold text-blue-700 hover:text-blue-900">
            Dismiss
          </button>
        </div>
      )}

      {!conceptWorkspaceStarted && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Start concept work from confirmed evidence</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                Pick a confirmed GO item so the concept, image brief, survey, and launch record inherit the correct product identity and evidence lineage.
              </p>
            </div>
            <Button asChild type="button" variant="outline" className="shrink-0">
              <Link to={workflowStagePath('decision', routeProjectId)}>
                <Gauge className="size-4" />
                Review decisions
              </Link>
            </Button>
          </div>

          {confirmedGoDecisions.length > 0 ? (
            <div className="mt-5 grid gap-2 lg:grid-cols-2">
              {confirmedGoDecisions.map(record => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => startFromDecision(record)}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{record.sampleName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        ISSF {record.issfScore.toFixed(0)} · {record.confidence.toFixed(0)}% confidence · {new Date(record.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-semibold text-white">GO</span>
                  </div>
                  {record.note.trim() && (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{record.note}</p>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
              No confirmed GO decisions with linked evidence are available yet. Confirm the product decision before starting concept work.
            </div>
          )}
        </section>
      )}

      {conceptWorkspaceStarted && sourceDecision && (
        <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
            <div>
              <p className="text-sm font-semibold text-emerald-950">
                Concept is linked to validated GO evidence
              </p>
              <dl className="mt-2 grid gap-2 text-xs text-emerald-900 sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-emerald-700">Source sample</dt>
                  <dd className="mt-0.5">{sourceDecision.sampleName}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-emerald-700">Panelist-facing concept</dt>
                  <dd className="mt-0.5">{draft.name.trim() || 'Untitled concept'}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-emerald-800">
                Confirmed GO: ISSF {sourceDecision.issfScore.toFixed(0)} at {sourceDecision.confidence.toFixed(0)}% confidence
                on {new Date(sourceDecision.timestamp).toLocaleDateString()}.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0 border-emerald-300 text-emerald-800 hover:bg-emerald-100">
            <Link to={workflowStagePath('decision', routeProjectId)}>
              <Gauge className="size-4" />
              View source decision
            </Link>
          </Button>
        </div>
      )}

      {conceptWorkspaceStarted && (
        <>
          <nav aria-label="Concept test progress" className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">
            {STEPS.map((s, i) => {
              const done = i < stepIndex;
              const active = s === step;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => i <= stepIndex && setStep(s)}
                  disabled={i > stepIndex}
                  aria-current={active ? 'step' : undefined}
                  className={`flex min-w-fit items-center gap-1.5 rounded-md px-3 py-2 text-left text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-slate-900 text-white'
                      : done
                        ? 'text-emerald-800 hover:bg-emerald-50'
                        : 'text-slate-500 hover:bg-slate-50 disabled:hover:bg-transparent'
                  }`}
                >
                  {done ? <CheckCircle2 className="size-3.5 shrink-0" /> : <Circle className="size-3.5 shrink-0" />}
                  <span><span className="hidden sm:inline">{i + 1}. </span>{STEP_LABELS[s]}</span>
                </button>
              );
            })}
          </nav>

          <Card className="border border-slate-200 shadow-none">
            <CardContent className="space-y-8 py-6">
              {step === 'concept' && (
                <>
                  <ConceptStep draft={draft} onChange={setDraft} />
                  <ImagesStep
                    draft={draft}
                    onChange={setDraft}
                    settings={settings}
                    requireApproval={requireApprovedVisuals}
                  />
                </>
              )}
              {step === 'survey' && (
                <QuestionsStep
                  draft={draft}
                  questions={questions}
                  onChange={setQuestions}
                  reviewState={questionsReviewState}
                  onReviewStateChange={setQuestionsReviewState}
                />
              )}
              {step === 'panel' && (
                <PanelStep
                  panelSize={panelSize}
                  setPanelSize={setPanelSize}
                  targetSegments={segments}
                  setTargetSegments={setSegments}
                  assignedPanelistIds={assignedPanelistIds}
                  setAssignedPanelistIds={setAssignedPanelistIds}
                />
              )}
              {step === 'review' && (
                <ReviewStep
                  draft={draft}
                  questions={questions}
                  panelSize={panelSize}
                  segments={segments}
                  assignedPanelistIds={assignedPanelistIds}
                  requireApprovedVisuals={requireApprovedVisuals}
                  onEditConcept={() => setStep('concept')}
                  onEditSurvey={() => setStep('survey')}
                  onEditPanel={() => setStep('panel')}
                />
              )}
            </CardContent>
          </Card>

          {launchError && (
            <p className="text-sm text-rose-600 font-medium text-center">{launchError}</p>
          )}

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:sticky md:bottom-4 md:z-20 md:bg-white/95 md:backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  const previous = STEPS[stepIndex - 1];
                  if (previous) setStep(previous);
                }}
                disabled={stepIndex === 0}
                className="gap-1.5 sm:w-auto"
              >
                <ChevronLeft className="size-4" /> Back
              </Button>

              <div className="flex min-w-0 flex-col gap-1 sm:items-end">
                {step === 'review' ? (
                  <Button
                    onClick={handleLaunch}
                    disabled={launching || !launchReady}
                    className="gap-2 bg-emerald-600 px-8 text-white hover:bg-emerald-700"
                  >
                    <Send className="size-4" />
                    {launching ? 'Launching…' : 'Launch concept test'}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => {
                        if (nextStep) setStep(nextStep);
                      }}
                      disabled={!currentStepReady}
                      className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {nextActionLabel} <ChevronRight className="size-4" />
                    </Button>
                    {!currentStepReady && blockerMessage && (
                      <div className="flex max-w-md flex-col gap-1 text-xs text-amber-700 sm:items-end sm:text-right">
                        <p>{blockerMessage}</p>
                        {currentBlockers[0] && (
                          <button
                            type="button"
                            onClick={() => setStep(currentBlockers[0].fixStep)}
                            className="font-semibold text-blue-700 hover:text-blue-900"
                          >
                            Fix {currentBlockers[0].label.toLowerCase()}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
