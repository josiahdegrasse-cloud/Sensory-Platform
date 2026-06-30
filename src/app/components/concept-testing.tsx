import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import {
  ChevronRight, ChevronLeft, Send, CheckCircle2,
  AlertTriangle, Gauge, Circle,
} from 'lucide-react';
import { insertConceptTest } from '../lib/database';
import { detectFoodType } from '../lib/food-intelligence';
import {
  useConceptGenerationSettings,
  useConceptLabDiagnostics,
  usePanelists,
  useWorkspaceSettings,
} from '../lib/hooks';
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
import { ProjectHeader } from './project-header';
import { WorkflowPageHeader } from './workflow-page-header';

// ─── Helper ───────────────────────────────────────────────────────────────────

const isValidImageUrlLaunch = (u: string) =>
  u.startsWith('data:image/') || ((): boolean => { try { return new URL(u).protocol === 'https:'; } catch { return false; } })();

const DRAFT_STORAGE_KEY = 'concept_lab_draft_v1';

const makeEmptyDraft = (promptStyle: string = 'balanced'): ConceptDraft => ({
  name: '',
  category: '',
  projectName: 'Project 1',
  description: '',
  marketingImages: [],
  marketingImageIds: [],
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
});

interface StoredConceptDraft {
  draft: ConceptDraft;
  questions: Question[];
  questionsReviewState?: AIReviewState | 'none';
  panelSize: number;
  segments: string[];
  assignedPanelistIds: string[];
  sourceDecision?: SourceDecisionSeed | null;
  savedAt: string;
}

interface SourceDecisionSeed {
  id: string;
  sampleName: string;
  issfScore: number;
  confidence: number;
  timestamp: string;
}

const STEP_LABELS: Record<WizardStep, string> = {
  concept: 'Brief',
  visuals: 'Visuals',
  survey: 'Survey',
  panel: 'Panel',
  review: 'Launch',
  launched: '',
};

// ─── Main component ───────────────────────────────────────────────────────────

export function ConceptTesting() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const { data: settings } = useConceptGenerationSettings();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const { data: diagnostics } = useConceptLabDiagnostics();
  const smartDefaultsApplied = useRef(false);

  const STEPS: Exclude<WizardStep, 'launched'>[] = ['concept', 'visuals', 'survey', 'panel', 'review'];
  const activeWizardStep: Exclude<WizardStep, 'launched'> = step === 'launched' ? 'review' : step;
  const stepIndex = STEPS.indexOf(activeWizardStep);

  const detection = detectFoodType(draft.category, draft.name, draft.description);
  const { items: readinessItems } = getConceptReadiness({ draft, questions, assignedPanelistIds, panelists });
  const launchReady = readinessItems.every(item => item.ready);
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

  useEffect(() => {
    const seed = (location.state as {
      conceptSeed?: {
        name?: string;
        category?: string;
        description?: string;
        sourceDecision?: SourceDecisionSeed;
      };
    } | null)?.conceptSeed;
    if (seed?.name) {
      const emptyDraft = makeEmptyDraft(settings?.promptStyle ?? 'balanced');
      const seededDraft = {
        ...emptyDraft,
        name: seed.name.trim(),
        category: seed.category?.trim() || emptyDraft.category,
        description: seed.description?.trim() || emptyDraft.description,
      };
      setDraft(seededDraft);
      setQuestions(buildTailoredConceptQuestions(seededDraft));
      setQuestionsReviewState('draft');
      setSegments([]);
      setAssignedPanelistIds([]);
      setSourceDecision(seed.sourceDecision ?? null);
      smartDefaultsApplied.current = false;
      setDraftNotice(`Started from the confirmed GO decision for "${seed.name}". A draft survey and panel defaults are ready for review.`);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }

    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as StoredConceptDraft;
        if (saved?.draft) {
          setDraft({ ...makeEmptyDraft(saved.draft.promptStyle), ...saved.draft });
          setQuestions(saved.questions ?? []);
          setQuestionsReviewState(saved.questionsReviewState ?? 'none');
          setSegments(saved.segments ?? []);
          setAssignedPanelistIds(saved.assignedPanelistIds ?? []);
          setPanelSize(saved.panelSize ?? 50);
          setSourceDecision(saved.sourceDecision ?? null);
          smartDefaultsApplied.current = true;
          setDraftNotice(`Draft restored from ${new Date(saved.savedAt).toLocaleString()}.`);
          return;
        }
      }
    } catch {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sourceDecision || smartDefaultsApplied.current || panelists.length === 0) return;
    setAssignedPanelistIds(defaultConceptPanelistIds(panelists));
    setPanelSize(workspaceSettings?.defaultPanelSize ?? 50);
    smartDefaultsApplied.current = true;
  }, [panelists, sourceDecision, workspaceSettings?.defaultPanelSize]);

  useEffect(() => {
    if (!draftHasWork && workspaceSettings?.defaultPanelSize) {
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
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
      setSaveState('saved');
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [assignedPanelistIds, draft, draftHasWork, panelSize, questions, questionsReviewState, segments, sourceDecision, step]);

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
    smartDefaultsApplied.current = false;
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  };

  const handleLaunch = async () => {
    if (launching) return;
    if (!launchReady) {
      const missing = readinessItems.filter(item => !item.ready).map(item => item.label.toLowerCase()).join(', ');
      setLaunchError(`Not ready to launch yet. Finish: ${missing}.`);
      return;
    }
    setLaunching(true);
    setLaunchError('');
    try {
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
        approvalNotes: draft.approvalStatus === 'approved' ? 'Approved in Concept Lab before launch.' : '',
        status: 'active',
        variantDimensions: draft.variantDimensions as unknown as Record<string, string | null>,
      });
      localStorage.removeItem(DRAFT_STORAGE_KEY);
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
          <Button variant="outline" onClick={() => navigate('/survey-analysis')}>
            View insights
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => navigate('/decision', { state: { openReport: true } })}
          >
            Prepare commercialization report
          </Button>
        </div>
      </div>
    );
  }

  const saveStatus = (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500" aria-live="polite">
      <CheckCircle2 className={`size-3.5 ${saveState === 'saved' ? 'text-emerald-600' : 'text-slate-400'}`} />
      {saveState === 'saved' ? 'Draft saved' : 'Autosaves'}
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
  const blockerMessage = currentBlockers[0]?.detail ?? '';
  const nextStep = STEPS[stepIndex + 1];
  const nextActionLabel = nextStep ? `Continue to ${STEP_LABELS[nextStep]}` : 'Continue';

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8">
      <ProjectHeader />
      <WorkflowPageHeader
        title="Concept Lab"
        description="Prepare one consumer concept test for launch."
        actions={saveStatus}
      />

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

      {sourceDecision && (
        <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
            <div>
              <p className="text-sm font-semibold text-emerald-950">
                Generated from a validated sample: {sourceDecision.sampleName}
              </p>
              <p className="mt-1 text-xs text-emerald-800">
                This concept is built on a sample that earned a confirmed <strong>GO</strong> decision —
                ISSF {sourceDecision.issfScore.toFixed(0)} at {sourceDecision.confidence.toFixed(0)}% confidence
                on {new Date(sourceDecision.timestamp).toLocaleDateString()}.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0 border-emerald-300 text-emerald-800 hover:bg-emerald-100">
            <Link to="/decision">
              <Gauge className="size-4" />
              View source decision
            </Link>
          </Button>
        </div>
      )}

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
            <ConceptStep draft={draft} onChange={setDraft} />
          )}
          {step === 'visuals' && (
            <ImagesStep draft={draft} onChange={setDraft} settings={settings} />
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
              onEditConcept={() => setStep('concept')}
              onEditVisuals={() => setStep('visuals')}
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
    </div>
  );
}
