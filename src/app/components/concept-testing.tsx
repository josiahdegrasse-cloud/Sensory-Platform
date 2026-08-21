import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
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
  ArrowRight, Beaker, ChevronRight, ChevronLeft, Send, CheckCircle2,
  AlertTriangle, Gauge, Loader2, CloudOff, RotateCcw,
  Search, FileText, Clock3,
} from 'lucide-react';
import {
  deleteConceptWorkspaceDraft,
  fetchConceptWorkspaceDraft,
  hydrateConceptWorkspaceImageUrls,
  insertConceptTest,
  listConceptWorkspaceDrafts,
  saveConceptWorkspaceDraft,
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
  useConceptResponseCounts,
  useDecisionFreshness,
  useDecisionRecords,
  useImportBatches,
  useInstrumentalDataset,
  useAdminConceptTests,
  usePanelists,
  useWorkspaceSettings,
} from '../lib/hooks';
import { useSurveyData } from '../lib/use-survey-data';
import { calculateGoStopTweakDecision } from '../utils/go-stop-tweak-engine';
import { findPendingConceptGoDecisions } from '../lib/concept-candidates';
import { conceptBelongsToProject } from '../lib/concept-project-scope';
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
  productReferences: [],
  productTruth: null,
  reportCover: null,
});

function stripDraftSignedImageUrls(draft: ConceptDraft): ConceptDraft {
  const withoutUrl = <T extends { url: string }>(asset: T): T => ({ ...asset, url: '' });
  return {
    ...draft,
    marketingImages: draft.marketingImages.map((url, index) => (
      draft.marketingImageIds[index] ? '' : url
    )),
    brandReference: draft.brandReference ? { ...draft.brandReference, url: '' } : null,
    productReferences: draft.productReferences.map(withoutUrl),
    productTruth: draft.productTruth ? withoutUrl(draft.productTruth) : null,
    reportCover: draft.reportCover ? withoutUrl(draft.reportCover) : null,
  };
}

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
  concept: 'Brief',
  visuals: 'Visuals',
  survey: 'Survey',
  panel: 'Panel',
  review: 'Review',
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
  const [workspaceView, setWorkspaceView] = useState<'work' | 'tests'>('work');
  const [conceptSearch, setConceptSearch] = useState('');
  const settingsQuery = useConceptGenerationSettings();
  const workspaceQuery = useWorkspaceSettings();
  const diagnosticsQuery = useConceptLabDiagnostics();
  const decisionsQuery = useDecisionRecords();
  const batchesQuery = useImportBatches();
  const conceptTestsQuery = useAdminConceptTests();
  const responseCountsQuery = useConceptResponseCounts();
  const { data: settings } = settingsQuery;
  const { data: workspaceSettings } = workspaceQuery;
  const { data: diagnostics } = diagnosticsQuery;
  const { data: decisionRecords = [] } = decisionsQuery;
  const { data: importBatches = [] } = batchesQuery;
  const { data: conceptTests = [] } = conceptTestsQuery;
  const { data: conceptResponseCounts = {} } = responseCountsQuery;
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

  const STEPS: Exclude<WizardStep, 'launched'>[] = ['concept', 'visuals', 'survey', 'panel', 'review'];
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
  const visualsStepReady = readinessItems.filter(item => item.fixStep === 'visuals').every(item => item.ready);
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
      const hydrateAsset = async <T extends { imageId: string; url: string }>(asset: T): Promise<T> => {
        const [url] = await hydrateConceptWorkspaceImageUrls([asset.imageId], [asset.url]);
        return { ...asset, url: url ?? asset.url };
      };
      const productReferences = await Promise.all(restoredDraft.productReferences.map(hydrateAsset));
      const productTruth = restoredDraft.productTruth ? await hydrateAsset(restoredDraft.productTruth) : null;
      const reportCover = restoredDraft.reportCover ? await hydrateAsset(restoredDraft.reportCover) : null;
      restoredDraft = {
        ...restoredDraft,
        marketingImages,
        brandReference,
        productReferences,
        productTruth,
        reportCover,
      };
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
        draft: stripDraftSignedImageUrls(payload.draft),
      };
      const saveRequest = saveConceptWorkspaceDraft({
        orgId: user.orgId,
        projectId: routeProjectId,
        decisionRecordId: sourceDecision.id,
        evidenceBundleId: sourceDecision.evidenceBundleId,
        formulationVersionId: sourceDecision.formulationVersionId,
        createdBy: user.id,
        // The database metadata keeps its legacy four-step vocabulary; the
        // exact five-step position is preserved in the JSON draft payload.
        currentStep: step === 'visuals' ? 'concept' : step,
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
        draft: stripDraftSignedImageUrls(payload.draft),
      };
      await saveConceptWorkspaceDraft({
        orgId: user.orgId,
        projectId: routeProjectId,
        decisionRecordId: sourceDecision.id,
        evidenceBundleId: sourceDecision.evidenceBundleId,
        formulationVersionId: sourceDecision.formulationVersionId,
        createdBy: user.id,
        currentStep: activeWizardStep === 'visuals' ? 'concept' : activeWizardStep,
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
  const projectConceptTests = useMemo(() => conceptTests
    .filter(concept => conceptBelongsToProject(concept, routeProjectId))
    .sort((left, right) => Date.parse(right.launchedAt ?? right.createdAt) - Date.parse(left.launchedAt ?? left.createdAt)),
  [conceptTests, routeProjectId]);
  const draftDecisionIds = useMemo(() => new Set(resumableDrafts.flatMap(entry => [
    entry.payload.sourceDecision?.id,
    entry.payload.sourceDecision?.evidenceBundleId,
  ].filter((value): value is string => Boolean(value)))), [resumableDrafts]);
  const readyToStartDecisions = useMemo(() => confirmedGoDecisions.filter(record => (
    !draftDecisionIds.has(record.id)
    && !draftDecisionIds.has(record.evidenceBundleId ?? '')
  )), [confirmedGoDecisions, draftDecisionIds]);
  const normalizedConceptSearch = conceptSearch.trim().toLocaleLowerCase();
  const matchesConceptSearch = (...values: Array<string | null | undefined>) => (
    !normalizedConceptSearch
    || values.some(value => value?.toLocaleLowerCase().includes(normalizedConceptSearch))
  );
  const visibleResumableDrafts = resumableDrafts.filter(entry => matchesConceptSearch(
    entry.payload.draft.name,
    entry.payload.draft.category,
    entry.payload.sourceDecision?.sampleName,
  ));
  const visibleReadyDecisions = readyToStartDecisions.filter(record => matchesConceptSearch(
    record.sampleName,
    record.note,
  ));
  const visiblePendingDecisions = pendingGoDecisions.filter(decision => matchesConceptSearch(decision.sampleName));
  const visibleConceptTests = projectConceptTests.filter(concept => matchesConceptSearch(
    concept.name,
    concept.category,
    concept.description,
  ));

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
        productTruthImageId: draft.productTruth?.imageId ?? null,
        reportCoverImageId: draft.reportCover?.imageId ?? null,
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
    : step === 'visuals'
      ? visualsStepReady
    : step === 'survey'
      ? surveyStepReady
      : step === 'panel'
        ? panelStepReady
        : launchReady;
  const currentBlockers = readinessItems.filter(item => !item.ready && (
    step === 'review' || item.fixStep === step
  ));
  const blockerMessage = currentBlockers[0]?.detail
    ?? (step === 'review' && sourceDecision?.id && decisionFreshness?.allowed === false
      ? decisionFreshness.reason ?? 'The linked GO evidence needs review before launch.'
      : '');
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
        description="Build and launch consumer concepts from confirmed product decisions."
        actions={conceptWorkspaceStarted ? saveStatus : undefined}
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
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex w-fit rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Concept Lab views">
              <button
                type="button"
                role="tab"
                aria-selected={workspaceView === 'work'}
                onClick={() => setWorkspaceView('work')}
                className={`min-h-11 rounded-md px-4 text-sm font-semibold transition-colors ${workspaceView === 'work' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}
              >
                Work queue
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={workspaceView === 'tests'}
                onClick={() => setWorkspaceView('tests')}
                className={`min-h-11 rounded-md px-4 text-sm font-semibold transition-colors ${workspaceView === 'tests' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}
              >
                Tests
                {projectConceptTests.length > 0 && <span className="ml-2 text-xs text-slate-500">{projectConceptTests.length}</span>}
              </button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative block min-w-0 sm:w-64">
                <span className="sr-only">Search concepts</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  value={conceptSearch}
                  onChange={event => setConceptSearch(event.target.value)}
                  placeholder="Search concepts"
                  className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <Button asChild type="button" variant="outline">
                <Link to={workflowStagePath('decision', routeProjectId)}>
                  <Gauge className="size-4" />
                  Decision review
                </Link>
              </Button>
            </div>
          </div>

          {workspaceView === 'work' ? (
            <div className="divide-y divide-slate-200">
              <div className="px-4 py-5 sm:px-5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-950">Continue working</h2>
                    <p className="mt-1 text-sm text-slate-600">Pick up a saved concept at the step where you left it.</p>
                  </div>
                  {!workspaceDraftsLoading && <span className="text-xs text-slate-500">{visibleResumableDrafts.length} open</span>}
                </div>
                {workspaceDraftsLoading ? (
                  <div className="mt-4 flex items-center gap-2 py-4 text-sm text-slate-600">
                    <Loader2 className="size-4 animate-spin text-blue-600" />
                    Loading saved concepts…
                  </div>
                ) : visibleResumableDrafts.length > 0 ? (
                  <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
                    {visibleResumableDrafts.map(entry => {
                      const name = entry.payload.draft.name || entry.payload.sourceDecision?.sampleName || 'Untitled concept';
                      const currentStep = entry.payload.step ?? 'concept';
                      return (
                        <div key={entry.key} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                              <FileText className="size-4" aria-hidden />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-950">{name}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-600">
                                {entry.payload.sourceDecision?.sampleName ?? 'Linked GO decision'} · {STEP_LABELS[currentStep]} · Saved {new Date(entry.updatedAt).toLocaleString()}
                                {entry.storage === 'browser' ? ' · This browser' : ''}
                              </p>
                            </div>
                          </div>
                          <Button type="button" size="sm" className="min-h-11 bg-blue-600 text-white hover:bg-blue-700" aria-label={`Continue ${name}`} onClick={() => void resumeDraft(entry)}>
                            Continue <ArrowRight className="size-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 border-y border-slate-200 py-4 text-sm text-slate-600">
                    {normalizedConceptSearch ? 'No saved concepts match your search.' : 'No concepts are in progress.'}
                  </p>
                )}
              </div>

              <div className="px-4 py-5 sm:px-5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-950">Ready to start</h2>
                    <p className="mt-1 text-sm text-slate-600">Confirmed GO decisions with evidence are ready for concept development.</p>
                  </div>
                  <span className="text-xs text-slate-500">{visibleReadyDecisions.length} ready</span>
                </div>
                {visibleReadyDecisions.length > 0 ? (
                  <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
                    {visibleReadyDecisions.map(record => (
                      <div key={record.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                            <CheckCircle2 className="size-4" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-slate-950">{record.sampleName}</p>
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Confirmed GO</span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              ISSF {record.issfScore.toFixed(0)} · {record.confidence.toFixed(0)}% confidence · Confirmed {new Date(record.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => void startFromDecision(record)}>
                          Start concept <ArrowRight className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 border-y border-slate-200 py-4 text-sm text-slate-600">
                    {normalizedConceptSearch ? 'No confirmed decisions match your search.' : 'No new confirmed GO decisions are waiting.'}
                  </p>
                )}
                {historicalGoDecisions.length > 0 && !normalizedConceptSearch && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setDecisionHistoryOpen(open => !open)}
                      aria-expanded={decisionHistoryOpen}
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                    >
                      Earlier confirmed decisions
                      <span className="font-normal text-slate-500">{historicalGoDecisions.length} record{historicalGoDecisions.length === 1 ? '' : 's'}</span>
                    </button>
                    {decisionHistoryOpen && (
                      <div className="divide-y divide-slate-200 border-y border-slate-200">
                        {historicalGoDecisions.map(record => (
                          <button key={record.id} type="button" onClick={() => void startFromDecision(record)} className="flex min-h-11 w-full items-center justify-between gap-3 px-2 py-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                            <span className="text-sm font-semibold text-slate-900">{record.sampleName}</span>
                            <span className="text-xs text-slate-500">{new Date(record.timestamp).toLocaleDateString()} · ISSF {record.issfScore.toFixed(0)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="px-4 py-5 sm:px-5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-950">Needs a decision</h2>
                    <p className="mt-1 text-sm text-slate-600">Calculated GO candidates must be confirmed in Decision Review before concept work starts.</p>
                  </div>
                  <span className="text-xs text-slate-500">{visiblePendingDecisions.length} waiting</span>
                </div>
                {visiblePendingDecisions.length > 0 ? (
                  <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
                    {visiblePendingDecisions.map(decision => (
                      <div key={`${decision.sampleId}:${decision.decisionFingerprint}`} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                            <Clock3 className="size-4" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">{decision.sampleName}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">Calculated GO · ISSF {decision.issfScore.toFixed(0)} · {decision.confidenceScore.toFixed(0)}% evidence confidence</p>
                          </div>
                        </div>
                        <Button asChild type="button" size="sm" variant="outline" className="min-h-11">
                          <Link to={workflowStagePath('decision', routeProjectId)}>Review decision <ArrowRight className="size-4" /></Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 border-y border-slate-200 py-4 text-sm text-slate-600">
                    {normalizedConceptSearch ? 'No pending decisions match your search.' : 'No calculated GO decisions are waiting for confirmation.'}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="px-4 py-5 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Concept tests</h2>
                  <p className="mt-1 text-sm text-slate-600">Track fieldwork here. Use Insights for detailed response analysis.</p>
                </div>
                <span className="text-xs text-slate-500">{visibleConceptTests.length} test{visibleConceptTests.length === 1 ? '' : 's'}</span>
              </div>
              {conceptTestsQuery.isLoading || responseCountsQuery.isLoading ? (
                <div className="mt-4 flex items-center gap-2 border-y border-slate-200 py-5 text-sm text-slate-600">
                  <Loader2 className="size-4 animate-spin text-blue-600" />
                  Loading concept tests…
                </div>
              ) : conceptTestsQuery.isError || responseCountsQuery.isError ? (
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" role="alert">
                  <div>
                    <p className="text-sm font-semibold text-rose-900">Concept test progress could not be loaded</p>
                    <p className="mt-0.5 text-xs text-rose-800">Check the connection, then try again.</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void conceptTestsQuery.refetch();
                      void responseCountsQuery.refetch();
                    }}
                  >
                    Try again
                  </Button>
                </div>
              ) : visibleConceptTests.length > 0 ? (
                <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
                  {visibleConceptTests.map(concept => {
                    const responseCount = conceptResponseCounts[concept.id] ?? 0;
                    const targetCount = concept.assignedPanelistIds.length || concept.panelSize;
                    const progress = targetCount > 0 ? Math.min(100, Math.round((responseCount / targetCount) * 100)) : 0;
                    const complete = concept.status === 'completed';
                    const statusClasses = complete
                      ? 'bg-emerald-50 text-emerald-800'
                      : concept.status === 'active'
                        ? 'bg-blue-50 text-blue-800'
                        : 'bg-slate-100 text-slate-700';
                    return (
                      <div key={concept.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_12rem_auto] md:items-center">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${complete ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                            <Beaker className="size-4" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-slate-950">{concept.name}</p>
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses}`}>
                                {complete ? 'Completed' : concept.status === 'active' ? 'Collecting responses' : concept.status}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-600">{concept.category || 'Uncategorised'} · Launched {new Date(concept.launchedAt ?? concept.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
                            <span>{responseCount} of {targetCount || '—'} responses</span>
                            <span>{progress}%</span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-label={`${progress}% response progress`} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                            <div className={`h-full rounded-full ${complete ? 'bg-emerald-600' : 'bg-blue-600'}`} style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        <Button asChild type="button" size="sm" variant="outline" className="min-h-11">
                          <Link to={workflowStagePath('insights', routeProjectId)}>Open results <ArrowRight className="size-4" /></Link>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 border-y border-slate-200 py-8 text-center">
                  <Beaker className="mx-auto size-5 text-slate-400" aria-hidden />
                  <p className="mt-2 text-sm font-semibold text-slate-900">{normalizedConceptSearch ? 'No tests match your search' : 'No concept tests launched yet'}</p>
                  <p className="mt-1 text-sm text-slate-600">Finish a concept in the work queue to start collecting responses.</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {conceptWorkspaceStarted && sourceDecision && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="button" size="sm" variant="ghost" className="min-h-11 w-fit text-slate-700" onClick={() => void returnToDraftDashboard()}>
              <ChevronLeft className="size-4" />
              Back to Concept Lab
            </Button>
            <div className="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden />
            <Select
              value={sourceDecision.id}
              onValueChange={value => {
                const target = resumableDrafts.find(entry => entry.payload.sourceDecision?.id === value);
                if (!target || value === sourceDecision.id) return;
                void (async () => {
                  await returnToDraftDashboard();
                  await resumeDraft(target);
                })();
              }}
            >
              <SelectTrigger size="sm" className="min-h-11 w-full border-slate-300 bg-white sm:w-64" aria-label="Switch concept">
                <SelectValue>{draft.name.trim() || sourceDecision.sampleName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={sourceDecision.id}>{draft.name.trim() || sourceDecision.sampleName}</SelectItem>
                {resumableDrafts
                  .filter(entry => entry.payload.sourceDecision?.id && entry.payload.sourceDecision.id !== sourceDecision.id)
                  .map(entry => (
                    <SelectItem key={entry.key} value={entry.payload.sourceDecision!.id}>
                      {entry.payload.draft.name || entry.payload.sourceDecision?.sampleName || 'Untitled concept'}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="truncate text-xs text-slate-600">
              Linked prototype: <span className="font-semibold text-slate-800">{sourceDecision.sampleName}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            <Button size="sm" variant="ghost" className="min-h-11 text-slate-700" onClick={() => setStartOverOpen(true)}>
              <RotateCcw className="size-4" />
              Start over
            </Button>
            <Button asChild size="sm" variant="ghost" className="min-h-11 text-slate-700">
              <Link to={workflowStagePath('decision', routeProjectId)}>
                <Gauge className="size-4" />
                Source decision
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
        <div className="min-w-0 space-y-4">
            <nav aria-label="Concept test progress" className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5">
              <div className="flex min-w-max gap-1 xl:min-w-0">
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
                      className={`flex min-h-11 min-w-28 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-left text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-blue-600 text-white'
                          : done
                            ? 'text-emerald-800 hover:bg-emerald-50'
                            : 'text-slate-500 hover:bg-slate-50 disabled:hover:bg-transparent'
                      }`}
                    >
                      <span className={`flex size-5 items-center justify-center rounded-full text-[11px] ${active ? 'bg-white/20' : done ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                        {done ? <CheckCircle2 className="size-3.5" /> : i + 1}
                      </span>
                      {STEP_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </nav>

            <section className="rounded-xl border border-slate-200 bg-white px-4 py-5 sm:px-6 sm:py-6">
              {step === 'concept' && <ConceptStep draft={draft} onChange={setDraft} />}
              {step === 'visuals' && (
                <ImagesStep
                  draft={draft}
                  onChange={setDraft}
                  settings={settings}
                  requireApproval={requireApprovedVisuals}
                />
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
                  segments={segments}
                  assignedPanelistIds={assignedPanelistIds}
                  requireApprovedVisuals={requireApprovedVisuals}
                  onEditConcept={() => setStep('concept')}
                  onEditVisuals={() => setStep('visuals')}
                  onEditSurvey={() => setStep('survey')}
                  onEditPanel={() => setStep('panel')}
                />
              )}
            </section>

            {launchError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700" role="alert">{launchError}</p>
            )}

            <div className="sticky bottom-0 z-20 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_-4px_8px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    const previous = STEPS[stepIndex - 1];
                    if (previous) setStep(previous);
                    else void returnToDraftDashboard();
                  }}
                  className="gap-1.5 sm:w-auto"
                >
                  <ChevronLeft className="size-4" /> {stepIndex === 0 ? 'Back to Concept Lab' : `Back to ${STEP_LABELS[STEPS[stepIndex - 1]]}`}
                </Button>

                <div className="flex min-w-0 flex-col gap-1 sm:items-end">
                  {step === 'review' ? (
                    <>
                      <Button
                        onClick={handleLaunch}
                        disabled={launching || !launchReady}
                        className="gap-2 bg-emerald-700 px-6 text-white hover:bg-emerald-800"
                      >
                        <Send className="size-4" />
                        {launching ? 'Launching…' : 'Launch concept test'}
                      </Button>
                      {!launchReady && (
                        <p className="max-w-md text-xs leading-5 text-amber-700 sm:text-right">
                          {blockerMessage || decisionFreshness?.reason || 'Complete the missing review items before launch.'}
                        </p>
                      )}
                    </>
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
                        <p className="max-w-md text-xs leading-5 text-amber-700 sm:text-right">{blockerMessage}</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
        </div>
      )}
    </div>
  );
}
