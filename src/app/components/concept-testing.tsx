import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  ChevronRight, ChevronLeft, Send, CheckCircle2,
  AlertTriangle, Gauge, Circle, Loader2, CloudOff, RotateCcw,
} from 'lucide-react';
import {
  deleteConceptWorkspaceDraft,
  fetchConceptWorkspaceDraft,
  hydrateConceptWorkspaceImageUrls,
  insertConceptTest,
  insertDecisionRecord,
  listConceptWorkspaceDrafts,
  saveConceptWorkspaceDraft,
  saveEvidenceBundle,
} from '../lib/database';
import type { ConceptWorkspaceDraftRecord, DecisionRecord } from '../lib/database';
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
  useImportBatches,
  useInstrumentalDataset,
  usePanelists,
  useWorkspaceSettings,
} from '../lib/hooks';
import { queryKeys } from '../lib/hooks';
import { useSurveyData } from '../lib/use-survey-data';
import { calculateGoStopTweakDecision, type GoStopTweakDecision } from '../utils/go-stop-tweak-engine';
import { buildEvidenceBundleFromProfiles } from '../lib/report-evidence';
import { findPendingConceptGoDecisions } from '../lib/concept-candidates';
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
import { WorkflowLoadingState, WorkflowQueryErrorState } from './workflow-loading-state';
import { buildConsumerBriefSuggestions } from './concept-testing/consumer-brief-defaults';
import { chooseNewestConceptDraft, conceptDraftMatchesLineage } from './concept-testing/draft-selection';

// ─── Helper ───────────────────────────────────────────────────────────────────

const isValidImageUrlLaunch = (u: string) =>
  u.startsWith('data:image/') || ((): boolean => { try { return new URL(u).protocol === 'https:'; } catch { return false; } })();

const DRAFT_STORAGE_KEY = 'concept_lab_draft_v1';
const CONCEPT_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_DECISION_WEIGHTS = { hedonic: 30, texture: 25, cata: 25, emotional: 15 };

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
  version?: 2;
  draft: ConceptDraft;
  questions: Question[];
  questionsReviewState?: AIReviewState | 'none';
  panelSize: number;
  segments: string[];
  assignedPanelistIds: string[];
  sourceDecision?: SourceDecisionSeed | null;
  conceptSourceChosen?: boolean;
  step?: Exclude<WizardStep, 'launched'>;
  savedAt: string;
}

interface ResumeDraftEntry {
  key: string;
  workspaceId: string | null;
  payload: StoredConceptDraft;
  updatedAt: string;
  storage: 'workspace' | 'browser';
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

function upgradeEvidenceHeavyDraft(draft: ConceptDraft): ConceptDraft {
  const description = draft.description.trim();
  const evidenceHeavy = description.length > 320
    || /panel evidence behind|instrument evidence to preserve|evidence context:\s*issf/i.test(description);
  if (!evidenceHeavy) return draft;
  const proofCues = draft.keyBenefits
    .split(/[,\n]+/)
    .map(value => value.trim())
    .filter(Boolean)
    .slice(0, 3);
  const concisePromise = proofCues.length > 0
    ? `${draft.category || 'Product'} built around ${proofCues.join(', ')} for a clear, believable consumer experience.`
    : `${draft.category || 'Product'} concept grounded in the confirmed product decision and intended use occasion.`;
  const evidenceNote = `Decision evidence (read-only): ${description}`;
  return {
    ...draft,
    description: concisePromise,
    technicalChallenges: draft.technicalChallenges.includes(description)
      ? draft.technicalChallenges
      : [draft.technicalChallenges, evidenceNote].filter(Boolean).join('\n\n'),
  };
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
  const consumerBrief = buildConsumerBriefSuggestions({
    name: record.sampleName,
    category,
    sensorySignals: likedSignals,
  });
  const evidencePositioning = buildEvidencePositioningPromise({
    category,
    sourceSampleName: record.sampleName,
    sensoryStrengths: likedSignals,
    panelEvidence: evidenceProfile ? buildPanelEvidenceSummary(evidenceProfile, foodTypeSlug) : [],
    instrumentEvidence: evidenceProfile ? buildInstrumentEvidenceSummary(evidenceProfile) : [],
    issfScore: record.issfScore,
    confidence: record.confidence,
    decisionRationale: record.note,
  });
  const seed: ConceptSeed = {
    name: record.sampleName,
    category,
    description: consumerBrief.promise,
    productAppearance: `Show ${record.sampleName} as a believable ${category.toLowerCase()} product with appetizing texture and clear cues for ${strengths}.`,
    packageFormat: 'Retail-ready pack with clear product name, category recognition, and a believable serving suggestion.',
    targetMarket: consumerBrief.audience,
    targetOccasion: consumerBrief.occasions[0] ?? '',
    visualSetting: 'Clean retail or kitchen setting that makes the product quality easy to judge.',
    colorDirection: 'Use a commercial palette that supports the strongest liked sensory cues without overclaiming.',
    mustShow: `Product name, category cue, serving suggestion, and visual support for ${strengths}.`,
    keyBenefits: consumerBrief.proofCues.join(', '),
    technicalChallenges: `Decision evidence (read-only): ${evidencePositioning}`,
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
  const queryClient = useQueryClient();
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
  const panelistsQuery = usePanelists();
  const { data: panelists = [] } = panelistsQuery;
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState('');
  const [draftNotice, setDraftNotice] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'local' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [workspaceDraftId, setWorkspaceDraftId] = useState<string | null>(null);
  const [workspaceDrafts, setWorkspaceDrafts] = useState<ConceptWorkspaceDraftRecord<StoredConceptDraft>[]>([]);
  const [browserDraftFallback, setBrowserDraftFallback] = useState<StoredConceptDraft | null>(null);
  const [workspaceDraftsLoading, setWorkspaceDraftsLoading] = useState(Boolean(routeProjectId));
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [startOverOpen, setStartOverOpen] = useState(false);
  const [discardingDraft, setDiscardingDraft] = useState(false);
  const [sourceDecision, setSourceDecision] = useState<SourceDecisionSeed | null>(null);
  const [conceptSourceChosen, setConceptSourceChosen] = useState(false);
  const [decisionHistoryOpen, setDecisionHistoryOpen] = useState(false);
  const settingsQuery = useConceptGenerationSettings();
  const workspaceQuery = useWorkspaceSettings();
  const diagnosticsQuery = useConceptLabDiagnostics();
  const decisionsQuery = useDecisionRecords();
  const batchesQuery = useImportBatches();
  const { data: settings } = settingsQuery;
  const { data: workspaceSettings } = workspaceQuery;
  const { data: diagnostics } = diagnosticsQuery;
  const { data: decisionRecords = [] } = decisionsQuery;
  const { data: importBatches = [] } = batchesQuery;
  const { data: decisionFreshness } = useDecisionFreshness(sourceDecision?.id);
  const instrumentalQuery = useInstrumentalDataset(user?.role === 'admin');
  const { data: instrumentalDataset } = instrumentalQuery;
  const surveyData = useSurveyData();
  const { liveAggregations } = surveyData;
  const smartDefaultsApplied = useRef(false);
  const hydrationStarted = useRef(false);
  const pendingWorkspaceSave = useRef<Promise<void> | null>(null);
  const minimumResponses = workspaceSettings?.decisionMinResponses ?? 12;
  const stopThreshold = workspaceSettings?.decisionStopThreshold ?? 45;
  const goThreshold = workspaceSettings?.decisionGoThreshold ?? 75;
  const [confirmingSampleId, setConfirmingSampleId] = useState<string | null>(null);
  const [confirmationError, setConfirmationError] = useState('');

  const projectBatchIds = useMemo(() => new Set(importBatches
    .filter(batch => batch.status === 'active' && batch.projectId === routeProjectId)
    .map(batch => batch.id)), [importBatches, routeProjectId]);
  const projectInstrumentSamples = useMemo(() => (instrumentalDataset?.eTongueData ?? [])
    .filter(sample => Boolean(sample.importBatchId && projectBatchIds.has(sample.importBatchId))),
  [instrumentalDataset?.eTongueData, projectBatchIds]);
  const projectSampleIds = useMemo(() => new Set(projectInstrumentSamples.map(sample => sample.sampleId)), [projectInstrumentSamples]);

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
  const resumableDrafts = useMemo<ResumeDraftEntry[]>(() => {
    const workspaceEntries = workspaceDrafts
      .filter(record => conceptDraftMatchesLineage(record.payload, null))
      .map(record => ({
        key: record.id,
        workspaceId: record.id,
        payload: record.payload,
        updatedAt: record.updatedAt,
        storage: 'workspace' as const,
      }));
    if (!browserDraftFallback || workspaceEntries.some(entry => (
      entry.payload.sourceDecision?.id === browserDraftFallback.sourceDecision?.id
    ))) return workspaceEntries;
    return [
      ...workspaceEntries,
      {
        key: `browser:${browserDraftFallback.sourceDecision?.id ?? 'draft'}`,
        workspaceId: null,
        payload: browserDraftFallback,
        updatedAt: browserDraftFallback.savedAt,
        storage: 'browser' as const,
      },
    ].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  }, [browserDraftFallback, workspaceDrafts]);

  const restoreSavedDraft = async (
    saved: StoredConceptDraft,
    options: { workspaceId?: string | null; workspaceUpdatedAt?: string; notice?: string } = {},
  ) => {
    let restoredDraft = upgradeEvidenceHeavyDraft({ ...makeEmptyDraft(saved.draft.promptStyle), ...saved.draft });
    try {
      const marketingImages = await hydrateConceptWorkspaceImageUrls(
        restoredDraft.marketingImageIds,
        restoredDraft.marketingImages,
      );
      let brandReference = restoredDraft.brandReference;
      if (brandReference?.imageId) {
        const [brandUrl] = await hydrateConceptWorkspaceImageUrls([brandReference.imageId], [brandReference.url]);
        brandReference = { ...brandReference, url: brandUrl ?? brandReference.url };
      }
      restoredDraft = { ...restoredDraft, marketingImages, brandReference };
    } catch {
      // A stale signed URL should not prevent the rest of the draft from opening.
    }
    setDraft(restoredDraft);
    setQuestions(saved.questions ?? []);
    setQuestionsReviewState(saved.questionsReviewState ?? 'none');
    setSegments(saved.segments ?? []);
    setAssignedPanelistIds(saved.assignedPanelistIds ?? []);
    setPanelSize(saved.panelSize ?? 50);
    setSourceDecision(saved.sourceDecision ?? null);
    setConceptSourceChosen(saved.conceptSourceChosen ?? true);
    setStep(saved.step ?? 'concept');
    setWorkspaceDraftId(options.workspaceId ?? null);
    setLastSavedAt(saved.savedAt || options.workspaceUpdatedAt || null);
    setSaveState(options.workspaceId ? 'saved' : 'local');
    setDraftHydrated(true);
    smartDefaultsApplied.current = true;
    setDraftNotice(options.notice ?? `Draft restored from ${new Date(saved.savedAt || options.workspaceUpdatedAt || Date.now()).toLocaleString()}.`);
  };

  useEffect(() => {
    if (!user?.id || !routeProjectId || hydrationStarted.current) return;
    hydrationStarted.current = true;
    let cancelled = false;

    const seed = (location.state as { conceptSeed?: ConceptSeed } | null)?.conceptSeed;
    const seedDecisionId = seed?.sourceDecision?.id ?? null;
    const validSavedDraft = (saved: StoredConceptDraft | null | undefined): saved is StoredConceptDraft => Boolean(
      conceptDraftMatchesLineage(saved, seed?.sourceDecision)
    );

    void (async () => {
      let browserDraft: StoredConceptDraft | null = null;
      try {
        const raw = localStorage.getItem(draftStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as StoredConceptDraft;
          const parsedAt = Date.parse(parsed.savedAt);
          if (!Number.isFinite(parsedAt) || Date.now() - parsedAt > CONCEPT_DRAFT_TTL_MS) {
            localStorage.removeItem(draftStorageKey);
          } else if (validSavedDraft(parsed)) {
            browserDraft = parsed;
          }
        }
      } catch {
        localStorage.removeItem(draftStorageKey);
      }

      let records: ConceptWorkspaceDraftRecord<StoredConceptDraft>[] = [];
      try {
        if (seedDecisionId) {
          const record = await fetchConceptWorkspaceDraft<StoredConceptDraft>({
            projectId: routeProjectId,
            decisionRecordId: seedDecisionId,
          });
          records = record ? [record] : [];
        } else {
          records = await listConceptWorkspaceDrafts<StoredConceptDraft>(routeProjectId);
        }
      } catch {
        // Browser autosave remains available when the workspace cannot be reached.
      }
      if (cancelled) return;
      setWorkspaceDrafts(records);
      setBrowserDraftFallback(browserDraft);
      setWorkspaceDraftsLoading(false);

      // Opening the Concept Lab directly always shows the draft dashboard.
      // A decision route seed may resume its matching draft immediately.
      if (!seed) {
        setDraftHydrated(true);
        return;
      }

      const workspaceRecord = records[0] ?? null;
      const workspaceDraft = validSavedDraft(workspaceRecord?.payload) ? workspaceRecord.payload : null;
      const saved = chooseNewestConceptDraft({
        browser: browserDraft,
        workspace: workspaceDraft,
        workspaceUpdatedAt: workspaceRecord?.updatedAt,
      });
      if (saved) {
        await restoreSavedDraft(saved, {
          workspaceId: saved === workspaceDraft ? workspaceRecord?.id : null,
          workspaceUpdatedAt: saved === workspaceDraft ? workspaceRecord?.updatedAt : undefined,
        });
        navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
        return;
      }

      if (seed?.name) {
        if (!seed.sourceDecision?.id || !seed.sourceDecision.evidenceBundleId) {
          setDraftNotice('A confirmed GO decision with linked evidence is required before starting concept work.');
          setDraftHydrated(true);
          return;
        }
        const empty = makeEmptyDraft(settings?.promptStyle ?? 'balanced');
        const seededDraft = upgradeEvidenceHeavyDraft({
          ...empty,
          name: seed.name.trim(),
          category: seed.category?.trim() || empty.category,
          description: seed.description?.trim() || empty.description,
          productAppearance: seed.productAppearance?.trim() || empty.productAppearance,
          packageFormat: seed.packageFormat?.trim() || empty.packageFormat,
          targetMarket: seed.targetMarket?.trim() || empty.targetMarket,
          targetOccasion: seed.targetOccasion?.trim() || empty.targetOccasion,
          visualSetting: seed.visualSetting?.trim() || empty.visualSetting,
          colorDirection: seed.colorDirection?.trim() || empty.colorDirection,
          mustShow: seed.mustShow?.trim() || empty.mustShow,
          keyBenefits: seed.keyBenefits?.trim() || empty.keyBenefits,
          technicalChallenges: seed.technicalChallenges?.trim() || empty.technicalChallenges,
        });
        setDraft(seededDraft);
        setQuestions(buildTailoredConceptQuestions(seededDraft));
        setQuestionsReviewState('draft');
        setSegments([]);
        setAssignedPanelistIds([]);
        setSourceDecision(seed.sourceDecision);
        setConceptSourceChosen(true);
        smartDefaultsApplied.current = false;
        setDraftNotice(`Started from the confirmed GO decision for "${seed.name}". Review the suggested consumer brief before continuing.`);
        navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
      }
      setDraftHydrated(true);
    })();

    return () => {
      cancelled = true;
      hydrationStarted.current = false;
    };
    // Route identity deliberately controls this one-time hydration. Settings only affect a brand-new draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeProjectId, user?.id]);
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
    if (!draftHydrated || !draftHasWork || step === 'launched' || launching) return;
    const timeout = window.setTimeout(() => {
      let browserSaved = false;
      const savedAt = new Date().toISOString();
      const payload: StoredConceptDraft = {
        version: 2,
        draft,
        questions,
        questionsReviewState,
        panelSize,
        segments,
        assignedPanelistIds,
        sourceDecision,
        conceptSourceChosen,
        step,
        savedAt,
      };
      try {
        localStorage.setItem(draftStorageKey, JSON.stringify(payload));
        browserSaved = true;
      } catch {
        // Durable workspace save below remains authoritative for linked drafts.
      }
      if (!user?.id || !user.orgId || !routeProjectId || !sourceDecision?.id || !sourceDecision.evidenceBundleId) {
        setLastSavedAt(browserSaved ? savedAt : null);
        setSaveState(browserSaved ? 'local' : 'error');
        return;
      }
      setSaveState('saving');
      const workspacePayload: StoredConceptDraft = {
        ...payload,
        draft: {
          ...payload.draft,
          marketingImages: payload.draft.marketingImages.map((url, index) => (
            payload.draft.marketingImageIds[index] ? '' : url
          )),
          brandReference: payload.draft.brandReference
            ? { ...payload.draft.brandReference, url: '' }
            : null,
        },
      };
      const saveRequest = saveConceptWorkspaceDraft({
        orgId: user.orgId,
        projectId: routeProjectId,
        decisionRecordId: sourceDecision.id,
        evidenceBundleId: sourceDecision.evidenceBundleId,
        formulationVersionId: sourceDecision.formulationVersionId,
        createdBy: user.id,
        currentStep: step,
        payload: workspacePayload,
      }).then(record => {
        setWorkspaceDraftId(record.id);
        setWorkspaceDrafts(current => [record, ...current.filter(item => item.id !== record.id)]);
        setBrowserDraftFallback(null);
        setLastSavedAt(record.updatedAt);
        setSaveState('saved');
      }).catch(() => {
        setLastSavedAt(browserSaved ? savedAt : null);
        setSaveState(browserSaved ? 'local' : 'error');
        setDraftNotice(browserSaved
          ? 'Workspace save is temporarily unavailable. This draft is saved in this browser.'
          : 'This draft could not be saved. Keep this page open and try again.');
      });
      pendingWorkspaceSave.current = saveRequest;
      void saveRequest.finally(() => {
        if (pendingWorkspaceSave.current === saveRequest) pendingWorkspaceSave.current = null;
      });
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [assignedPanelistIds, conceptSourceChosen, draft, draftHasWork, draftHydrated, draftStorageKey, launching, panelSize, questions, questionsReviewState, routeProjectId, segments, sourceDecision, step, user?.id, user?.orgId]);

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
    setLastSavedAt(null);
    setWorkspaceDraftId(null);
    setSourceDecision(null);
    setConceptSourceChosen(false);
    smartDefaultsApplied.current = false;
    localStorage.removeItem(draftStorageKey);
  };

  const clearEditorForDraftDashboard = () => {
    setStep('concept');
    setDraft(makeEmptyDraft(settings?.promptStyle ?? 'balanced'));
    setQuestions([]);
    setQuestionsReviewState('none');
    setSegments([]);
    setAssignedPanelistIds([]);
    setPanelSize(workspaceSettings?.defaultPanelSize ?? 50);
    setLaunchError('');
    setSaveState('idle');
    setLastSavedAt(null);
    setWorkspaceDraftId(null);
    setSourceDecision(null);
    setConceptSourceChosen(false);
    smartDefaultsApplied.current = false;
  };

  const resumeDraft = async (entry: ResumeDraftEntry) => {
    await restoreSavedDraft(entry.payload, {
      workspaceId: entry.workspaceId,
      workspaceUpdatedAt: entry.storage === 'workspace' ? entry.updatedAt : undefined,
      notice: `Continuing "${entry.payload.draft.name || entry.payload.sourceDecision?.sampleName || 'Untitled concept'}" from ${STEP_LABELS[entry.payload.step ?? 'concept']}.`,
    });
  };

  const returnToDraftDashboard = async () => {
    if (!sourceDecision?.id || !sourceDecision.evidenceBundleId) {
      clearEditorForDraftDashboard();
      return;
    }
    const savedAt = new Date().toISOString();
    const payload: StoredConceptDraft = {
      version: 2,
      draft,
      questions,
      questionsReviewState,
      panelSize,
      segments,
      assignedPanelistIds,
      sourceDecision,
      conceptSourceChosen,
      step: activeWizardStep,
      savedAt,
    };
    let browserSaved = false;
    try {
      localStorage.setItem(draftStorageKey, JSON.stringify(payload));
      browserSaved = true;
      setBrowserDraftFallback(payload);
    } catch {
      // Workspace persistence below may still succeed when browser storage is full.
    }

    setSaveState('saving');
    try {
      await pendingWorkspaceSave.current;
      if (!user?.id || !user.orgId || !routeProjectId) throw new Error('Workspace identity is unavailable.');
      const workspacePayload: StoredConceptDraft = {
        ...payload,
        draft: {
          ...payload.draft,
          marketingImages: payload.draft.marketingImages.map((url, index) => (
            payload.draft.marketingImageIds[index] ? '' : url
          )),
          brandReference: payload.draft.brandReference ? { ...payload.draft.brandReference, url: '' } : null,
        },
      };
      await saveConceptWorkspaceDraft({
        orgId: user.orgId,
        projectId: routeProjectId,
        decisionRecordId: sourceDecision.id,
        evidenceBundleId: sourceDecision.evidenceBundleId,
        formulationVersionId: sourceDecision.formulationVersionId,
        createdBy: user.id,
        currentStep: activeWizardStep,
        payload: workspacePayload,
      });
      const records = await listConceptWorkspaceDrafts<StoredConceptDraft>(routeProjectId);
      setWorkspaceDrafts(records);
      setBrowserDraftFallback(null);
      clearEditorForDraftDashboard();
      setDraftNotice(`"${draft.name || sourceDecision.sampleName}" was saved. Continue whenever you are ready.`);
    } catch (error) {
      if (browserSaved) {
        clearEditorForDraftDashboard();
        setDraftNotice(`"${draft.name || sourceDecision.sampleName}" is saved in this browser. Workspace sync will retry when you reopen it.`);
      } else {
        setSaveState('error');
        setDraftNotice(error instanceof Error ? `Could not save this draft: ${error.message}` : 'Could not save this draft.');
      }
    }
  };

  const discardDraftAndReset = async () => {
    if (discardingDraft) return;
    setDiscardingDraft(true);
    try {
      let draftId = workspaceDraftId;
      if (!draftId && routeProjectId && sourceDecision?.id) {
        const record = await fetchConceptWorkspaceDraft<StoredConceptDraft>({
          projectId: routeProjectId,
          decisionRecordId: sourceDecision.id,
        });
        draftId = record?.id ?? null;
      }
      if (draftId) await deleteConceptWorkspaceDraft(draftId);
      if (draftId) setWorkspaceDrafts(current => current.filter(record => record.id !== draftId));
      setBrowserDraftFallback(null);
      resetForm();
      setStartOverOpen(false);
    } catch (error) {
      setDraftNotice(error instanceof Error
        ? `The draft could not be removed: ${error.message}`
        : 'The draft could not be removed. Try again.');
    } finally {
      setDiscardingDraft(false);
    }
  };

  const confirmedGoDecisionGroups = useMemo(() => {
    const eligible = decisionRecords
      .filter(record => (
        record.decision === 'GO'
        && Boolean(record.evidenceBundleId)
        && (!routeProjectId || record.projectId === routeProjectId)
      ));
    const byPrototype = new Map<string, DecisionRecord[]>();
    eligible.forEach(record => {
      const key = record.instrumentalSampleId ?? record.sampleId;
      const records = byPrototype.get(key) ?? [];
      records.push(record);
      byPrototype.set(key, records);
    });
    return [...byPrototype.values()]
      .map(records => ({ latest: records[0], history: records.slice(1) }))
      .slice(0, 6);
  }, [decisionRecords, routeProjectId]);
  const confirmedGoDecisions = confirmedGoDecisionGroups.map(group => group.latest);
  const historicalGoDecisions = confirmedGoDecisionGroups.flatMap(group => group.history);
  const pendingGoDecisions = useMemo(() => findPendingConceptGoDecisions(
    evidenceProfiles
      .filter(profile => projectSampleIds.has(profile.sampleId))
      .map(profile => calculateGoStopTweakDecision(profile, DEFAULT_DECISION_WEIGHTS, foodType, {
        go: goThreshold,
        stop: stopThreshold,
      })),
    decisionRecords,
    routeProjectId,
  ), [
      decisionRecords,
      evidenceProfiles,
      foodType,
      goThreshold,
      projectSampleIds,
      routeProjectId,
      stopThreshold,
    ]);

  const startFromDecision = async (record: DecisionRecord) => {
    const existingDraft = resumableDrafts.find(entry => (
      entry.payload.sourceDecision?.id === record.id
      || entry.payload.sourceDecision?.evidenceBundleId === record.evidenceBundleId
    ));
    if (existingDraft) {
      await resumeDraft(existingDraft);
      return;
    }
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

  const confirmGoAndStart = async (decision: GoStopTweakDecision) => {
    if (!user?.id || !routeProjectId || confirmingSampleId) return;
    setConfirmingSampleId(decision.sampleId);
    setConfirmationError('');
    try {
      const evidenceProfile = evidenceProfiles.find(profile => profile.sampleId === decision.sampleId);
      if (!evidenceProfile) throw new Error('The selected sample evidence is unavailable.');
      const matchingSamples = projectInstrumentSamples.filter(sample => sample.sampleId === decision.sampleId);
      const instrumentalSampleId = matchingSamples.length === 1
        ? matchingSamples[0].instrumentalSampleId ?? null
        : null;
      const formulationVersionId = instrumentalDataset?.formulationVersions?.[decision.sampleId]
        ?.find(version => version.isCurrent && version.projectId === routeProjectId)?.id ?? null;
      const evidencePayload = buildEvidenceBundleFromProfiles({
        projectId: decision.sampleId,
        profiles: [evidenceProfile],
        foodTypeSlug: foodType,
        createdBy: user.id,
        thresholds: { go: goThreshold, stop: stopThreshold },
        minimumResponses,
      });
      const evidenceBundle = await saveEvidenceBundle({
        projectId: decision.sampleId,
        canonicalProjectId: routeProjectId,
        formulationVersionId,
        schemaVersion: evidencePayload.schemaVersion,
        sourceDataVersion: evidencePayload.sourceDataVersion,
        payload: evidencePayload as unknown as Record<string, unknown>,
      });
      const timestamp = new Date().toISOString();
      const decisionRecordId = await insertDecisionRecord({
        sampleId: decision.sampleId,
        sampleName: decision.sampleName,
        decision: 'GO',
        issfScore: decision.issfScore,
        confidence: decision.confidenceScore,
        note: 'Confirmed in Concept Lab to begin concept development.',
        methodVersion: decision.methodVersion,
        decisionFingerprint: decision.decisionFingerprint,
        createdBy: user.id,
        projectId: routeProjectId,
        instrumentalSampleId,
        formulationVersionId,
        evidenceBundleId: evidenceBundle.id,
      });
      if (!decisionRecordId) throw new Error('The GO decision could not be saved.');
      await saveEvidenceBundle({
        projectId: decision.sampleId,
        canonicalProjectId: routeProjectId,
        decisionRecordId,
        formulationVersionId,
        schemaVersion: evidencePayload.schemaVersion,
        sourceDataVersion: evidencePayload.sourceDataVersion,
        payload: evidencePayload as unknown as Record<string, unknown>,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.decisionRecords });
      await startFromDecision({
        id: decisionRecordId,
        timestamp,
        sampleId: decision.sampleId,
        sampleName: decision.sampleName,
        decision: 'GO',
        issfScore: decision.issfScore,
        confidence: decision.confidenceScore,
        user: 'Administrator',
        note: 'Confirmed in Concept Lab to begin concept development.',
        methodVersion: decision.methodVersion,
        decisionFingerprint: decision.decisionFingerprint,
        projectId: routeProjectId,
        instrumentalSampleId,
        parentDecisionId: null,
        formulationVersionId,
        evidenceBundleId: evidenceBundle.id,
        researchRefreshedAt: null,
        researchFingerprint: null,
      });
    } catch (error) {
      setConfirmationError(error instanceof Error ? error.message : 'Unable to confirm this GO decision.');
    } finally {
      setConfirmingSampleId(null);
    }
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
      await pendingWorkspaceSave.current;
      let draftIdToDelete = workspaceDraftId;
      if (!draftIdToDelete && routeProjectId && sourceDecision?.id) {
        const savedDraft = await fetchConceptWorkspaceDraft<StoredConceptDraft>({
          projectId: routeProjectId,
          decisionRecordId: sourceDecision.id,
        }).catch(() => null);
        draftIdToDelete = savedDraft?.id ?? null;
      }
      if (draftIdToDelete) {
        await deleteConceptWorkspaceDraft(draftIdToDelete).catch(() => undefined);
        setWorkspaceDrafts(current => current.filter(record => record.id !== draftIdToDelete));
      }
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

  const saveStatusLabel = saveState === 'saving'
    ? 'Saving…'
    : saveState === 'saved'
      ? `Saved to workspace${lastSavedAt ? ` at ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`
      : saveState === 'local'
        ? 'Saved in this browser'
        : saveState === 'error'
          ? 'Save failed'
          : 'Autosaves after edits';
  const SaveStatusIcon = saveState === 'saving' ? Loader2 : saveState === 'local' || saveState === 'error' ? CloudOff : CheckCircle2;
  const saveStatus = (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500" aria-live="polite">
      <SaveStatusIcon className={`size-3.5 ${saveState === 'saving' ? 'animate-spin text-blue-600' : saveState === 'saved' ? 'text-emerald-600' : saveState === 'error' ? 'text-rose-600' : 'text-slate-500'}`} />
      {saveStatusLabel}
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

  const sourceQueries = [decisionsQuery, batchesQuery, instrumentalQuery, workspaceQuery];
  if (!conceptWorkspaceStarted && (sourceQueries.some(query => query.isLoading) || surveyData.isLoading)) {
    return <WorkflowLoadingState title="Loading concept candidates" />;
  }
  if (!conceptWorkspaceStarted && (sourceQueries.some(query => query.isError) || surveyData.liveDataFetchFailed)) {
    return (
      <WorkflowQueryErrorState
        projectName="the selected project"
        checked="calculated and confirmed GO decisions with their linked product evidence"
        onRetry={() => sourceQueries.forEach(query => void query.refetch())}
      />
    );
  }

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
        <div className="flex items-center justify-between gap-3 border-y border-slate-200 py-2 text-xs text-slate-600">
          <span className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-emerald-700" />{draftNotice}</span>
          <button type="button" onClick={() => setDraftNotice('')} className="font-semibold text-slate-700 hover:text-slate-950">
            Dismiss
          </button>
        </div>
      )}

      {!conceptWorkspaceStarted && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">GO prototypes ready for concept work</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                Confirm a calculated GO here, or reopen an existing confirmed GO. The concept workspace inherits the exact prototype and evidence record.
              </p>
            </div>
            <Button asChild type="button" variant="outline" className="shrink-0">
              <Link to={workflowStagePath('decision', routeProjectId)}>
                <Gauge className="size-4" />
                Review decisions
              </Link>
            </Button>
          </div>

          {(workspaceDraftsLoading || resumableDrafts.length > 0) && (
            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">In-progress concepts</h3>
                  <p className="mt-1 text-xs text-slate-600">Resume the exact brief, survey, panel, and step you last saved.</p>
                </div>
                {!workspaceDraftsLoading && (
                  <span className="text-xs text-slate-500">{resumableDrafts.length} draft{resumableDrafts.length === 1 ? '' : 's'}</span>
                )}
              </div>
              {workspaceDraftsLoading ? (
                <div className="mt-3 flex items-center gap-2 py-3 text-sm text-slate-600">
                  <Loader2 className="size-4 animate-spin text-blue-600" />
                  Loading saved concepts…
                </div>
              ) : (
                <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
                  {resumableDrafts.map(entry => {
                    const name = entry.payload.draft.name || entry.payload.sourceDecision?.sampleName || 'Untitled concept';
                    const currentStep = entry.payload.step ?? 'concept';
                    return (
                      <div key={entry.key} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {entry.payload.sourceDecision?.sampleName ?? 'Linked GO decision'} · {STEP_LABELS[currentStep]} · Saved {new Date(entry.updatedAt).toLocaleString()}
                            {entry.storage === 'browser' ? ' · This browser' : ''}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          aria-label={`Continue ${name}`}
                          onClick={() => void resumeDraft(entry)}
                        >
                          Continue
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {confirmationError && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
              {confirmationError}
            </div>
          )}

          {pendingGoDecisions.length > 0 && (
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">Awaiting confirmation</h3>
                <span className="text-xs text-slate-500">{pendingGoDecisions.length} calculated GO{pendingGoDecisions.length === 1 ? '' : 's'}</span>
              </div>
              <div className="grid gap-2 lg:grid-cols-2">
                {pendingGoDecisions.map(decision => {
                  const confirming = confirmingSampleId === decision.sampleId;
                  return (
                    <div key={`${decision.sampleId}:${decision.decisionFingerprint}`} className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{decision.sampleName}</p>
                          <p className="mt-1 text-xs text-emerald-800">
                            ISSF {decision.issfScore.toFixed(0)} · {decision.confidenceScore.toFixed(0)}% evidence
                          </p>
                        </div>
                        <span className="rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Calculated GO</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="mt-3 w-full bg-emerald-700 text-white hover:bg-emerald-800"
                        disabled={Boolean(confirmingSampleId)}
                        onClick={() => void confirmGoAndStart(decision)}
                      >
                        {confirming ? 'Confirming…' : 'Confirm GO and start concept'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {confirmedGoDecisions.length > 0 ? (
            <div className="mt-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Confirmed GO decisions</h3>
              <div className="grid gap-2 lg:grid-cols-2">
              {confirmedGoDecisions.map(record => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => void startFromDecision(record)}
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
              {historicalGoDecisions.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setDecisionHistoryOpen(open => !open)}
                    aria-expanded={decisionHistoryOpen}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:text-slate-950"
                  >
                    Earlier confirmed decisions
                    <span className="font-normal text-slate-500">{historicalGoDecisions.length} record{historicalGoDecisions.length === 1 ? '' : 's'}</span>
                  </button>
                  {decisionHistoryOpen && (
                    <div className="grid gap-2 border-t border-slate-200 p-2 lg:grid-cols-2">
                      {historicalGoDecisions.map(record => (
                        <button
                          key={record.id}
                          type="button"
                          onClick={() => void startFromDecision(record)}
                          className="rounded-md border border-slate-200 bg-white p-3 text-left hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                        >
                          <p className="text-sm font-semibold text-slate-900">{record.sampleName}</p>
                          <p className="mt-1 text-xs text-slate-500">GO recorded {new Date(record.timestamp).toLocaleDateString()} · ISSF {record.issfScore.toFixed(0)}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : pendingGoDecisions.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
              No calculated or confirmed GO decisions with linked evidence are available yet.
            </div>
          ) : null}
        </section>
      )}

      {conceptWorkspaceStarted && sourceDecision && (
        <div className="flex flex-col gap-3 border-y border-slate-200 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Linked GO evidence
              </p>
              <p className="mt-0.5 text-xs leading-5 text-slate-600">
                {sourceDecision.sampleName} · ISSF {sourceDecision.issfScore.toFixed(0)} · {sourceDecision.confidence.toFixed(0)}% confidence · Confirmed {new Date(sourceDecision.timestamp).toLocaleDateString()}
                {' · '}Concept: {draft.name.trim() || 'Untitled concept'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" variant="ghost" className="text-slate-700" onClick={() => setStartOverOpen(true)}>
              <RotateCcw className="size-4" />
              Start over
            </Button>
            <Button asChild size="sm" variant="ghost" className="text-slate-700">
              <Link to={workflowStagePath('decision', routeProjectId)}>
                <Gauge className="size-4" />
                View source decision
              </Link>
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={startOverOpen} onOpenChange={setStartOverOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start this concept again?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the saved brief, survey edits, panel selection, and wizard progress for this GO decision. The confirmed decision and generated image library are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={discardingDraft}>Keep draft</AlertDialogCancel>
            <AlertDialogAction
              onClick={event => {
                event.preventDefault();
                void discardDraftAndReset();
              }}
              disabled={discardingDraft}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {discardingDraft ? 'Removing…' : 'Remove draft and start over'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                  formulationVersionId={sourceDecision?.formulationVersionId ?? null}
                  sampleName={sourceDecision?.sampleName ?? draft.name}
                  ingredientStatement={sourceDecision ? instrumentalDataset?.formulationVersions?.[sourceDecision.sampleId]?.find(version => version.id === sourceDecision.formulationVersionId)?.exactStatement ?? '' : ''}
                />
              )}
              {step === 'review' && (
                <ReviewStep
                  draft={draft}
                  questions={questions}
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

          <div className="border-t border-slate-200 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  const previous = STEPS[stepIndex - 1];
                  if (previous) setStep(previous);
                  else void returnToDraftDashboard();
                }}
                className="gap-1.5 sm:w-auto"
              >
                <ChevronLeft className="size-4" /> {stepIndex === 0 ? 'Back to concepts' : 'Back'}
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
