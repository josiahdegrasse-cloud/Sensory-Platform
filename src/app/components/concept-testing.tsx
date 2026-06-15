import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import {
  Lightbulb, ChevronRight, ChevronLeft, Send, CheckCircle2,
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
import type { AIReviewState } from './ai-review-card';
import { ConceptStep } from './concept-testing/ConceptStep';
import { ImagesStep } from './concept-testing/ImagesStep';
import { QuestionsStep } from './concept-testing/QuestionsStep';
import { PanelStep } from './concept-testing/PanelStep';
import { ReviewStep } from './concept-testing/ReviewStep';
import { getConceptReadiness } from './concept-testing/concept-readiness';
import { buildTailoredConceptQuestions, defaultConceptPanelistIds } from './concept-testing/smart-defaults';
import { ProjectHeader } from './project-header';

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
  pricePoint: '',
  keyBenefits: '',
  technicalChallenges: '',
  promptStyle,
  visualNotes: '',
  forbiddenClaims: '',
  approvalStatus: 'draft',
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

  const STEPS: WizardStep[] = ['concept', 'visuals', 'survey', 'review'];
  const stepIndex = STEPS.indexOf(step);

  const detection = detectFoodType(draft.category, draft.name, draft.description);
  const readinessItems = getConceptReadiness({ draft, questions, assignedPanelistIds, panelists });
  const launchReady = readinessItems.every(item => item.ready);
  const conceptStepReady = readinessItems.filter(item => item.fixStep === 'concept').every(item => item.ready);
  const visualsStepReady = readinessItems.filter(item => item.fixStep === 'visuals').every(item => item.ready);
  const surveyStepReady = readinessItems.filter(item => item.fixStep === 'survey').every(item => item.ready);
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
        <h2 className="text-3xl font-black text-slate-900">Concept test launched!</h2>
        <p className="text-slate-500 text-lg">
          Your survey has been sent to <strong>{assignedPanelistIds.length} panelist{assignedPanelistIds.length === 1 ? '' : 's'}</strong>.
          Results will appear in <strong>Insights</strong> as responses come in.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Button variant="outline" onClick={resetForm}>
            New concept test
          </Button>
          <Button variant="outline" onClick={() => navigate('/survey-analysis')}>
            View responses
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

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      <ProjectHeader />
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-slate-900">
            <Lightbulb className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Concept Lab</h1>
            <p className="text-sm text-slate-500">Prepare and launch one consumer concept test.</p>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-slate-500" aria-live="polite">
          <CheckCircle2 className={`size-3.5 ${saveState === 'saved' ? 'text-emerald-600' : 'text-slate-400'}`} />
          {saveState === 'saved' ? 'Draft saved' : 'Draft saves automatically'}
        </p>
      </div>

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

      <nav aria-label="Concept test progress" className="grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => {
          const done = i < stepIndex;
          const active = s === step;
          const labels: Record<WizardStep, string> = {
            concept: 'Concept', visuals: 'Visuals', survey: 'Survey & panel', review: 'Review', launched: '',
          };
          return (
            <button
              key={s}
              type="button"
              onClick={() => i <= stepIndex && setStep(s)}
              disabled={i > stepIndex}
              aria-current={active ? 'step' : undefined}
              className={`flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition-colors sm:px-3 ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              {done ? <CheckCircle2 className="size-3.5 shrink-0" /> : <Circle className="size-3.5 shrink-0" />}
              <span className="truncate"><span className="hidden sm:inline">{i + 1}. </span>{labels[s]}</span>
            </button>
          );
        })}
      </nav>

      {/* Step content */}
      <Card className="border border-slate-200 shadow-none">
        <CardContent className="space-y-8 py-6">
          {step === 'concept' && (
            <ConceptStep draft={draft} onChange={setDraft} />
          )}
          {step === 'visuals' && (
            <ImagesStep draft={draft} onChange={setDraft} settings={settings} />
          )}
          {step === 'survey' && (
            <>
              <QuestionsStep
                draft={draft}
                questions={questions}
                onChange={setQuestions}
                reviewState={questionsReviewState}
                onReviewStateChange={setQuestionsReviewState}
              />
              <div className="border-t border-slate-100 pt-8">
                <PanelStep panelSize={panelSize} setPanelSize={setPanelSize} targetSegments={segments} setTargetSegments={setSegments} assignedPanelistIds={assignedPanelistIds} setAssignedPanelistIds={setAssignedPanelistIds} />
              </div>
            </>
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
            />
          )}
        </CardContent>
      </Card>

      {launchError && (
        <p className="text-sm text-rose-600 font-medium text-center">{launchError}</p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6 lg:left-64">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={() => setStep(STEPS[stepIndex - 1])}
            disabled={stepIndex === 0}
            className="gap-1.5"
          >
            <ChevronLeft className="size-4" /> Back
          </Button>

          <div className="flex min-w-0 flex-col items-end gap-1">
            {step === 'review' ? (
              <Button
                onClick={handleLaunch}
                disabled={launching || !launchReady}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-8"
              >
                <Send className="size-4" />
                {launching ? 'Launching…' : 'Launch concept test'}
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => setStep(STEPS[stepIndex + 1])}
                  disabled={step === 'concept' ? !conceptStepReady : step === 'visuals' ? !visualsStepReady : !surveyStepReady}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                >
                  Continue <ChevronRight className="size-4" />
                </Button>
                {((step === 'concept' && !conceptStepReady) || (step === 'visuals' && !visualsStepReady) || (step === 'survey' && !surveyStepReady)) && (
                  <p className="hidden max-w-md text-right text-xs text-amber-700 sm:block">
                    {readinessItems
                      .filter(item => !item.ready && item.fixStep === step)
                      .map(item => item.detail)
                      .join(' ')}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
