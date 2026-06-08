import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Lightbulb, ChevronRight, ChevronLeft, Send, CheckCircle2, Image as ImageIcon,
  ListChecks, Users, AlertTriangle, FileCheck2, ChevronDown, Gauge,
} from 'lucide-react';
import { insertConceptTest } from '../lib/database';
import { detectFoodType } from '../lib/food-intelligence';
import {
  useConceptGenerationSettings,
  useConceptLabDiagnostics,
  useCommercializationReports,
  useWorkspaceSettings,
} from '../lib/hooks';
import type { ConceptDraft, Question, WizardStep } from './concept-testing/types';
import { ConceptStep } from './concept-testing/ConceptStep';
import { ImagesStep } from './concept-testing/ImagesStep';
import { QuestionsStep } from './concept-testing/QuestionsStep';
import { PanelStep } from './concept-testing/PanelStep';
import { ReviewStep } from './concept-testing/ReviewStep';
import { ProjectHeader } from './project-header';

// ─── Helper ───────────────────────────────────────────────────────────────────

const isValidImageUrlLaunch = (u: string) =>
  u.startsWith('data:image/') || ((): boolean => { try { return new URL(u).protocol === 'https:'; } catch { return false; } })();

const DRAFT_STORAGE_KEY = 'concept_lab_draft_v1';

const makeEmptyDraft = (promptStyle: ConceptDraft['promptStyle'] = 'balanced'): ConceptDraft => ({
  name: '',
  category: '',
  projectName: 'Project 1',
  description: '',
  marketingImages: [],
  marketingImageIds: [],
  targetMarket: '',
  pricePoint: '',
  keyBenefits: '',
  technicalChallenges: '',
  promptStyle,
  approvalStatus: 'draft',
});

interface StoredConceptDraft {
  draft: ConceptDraft;
  questions: Question[];
  panelSize: number;
  segments: string[];
  assignedPanelistIds: string[];
  savedAt: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConceptTesting() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<WizardStep>('concept');
  const [draft, setDraft] = useState<ConceptDraft>(() => makeEmptyDraft());
  const [questions, setQuestions] = useState<Question[]>([]);
  const [panelSize, setPanelSize] = useState(50);
  const [segments, setSegments] = useState<string[]>([]);
  const [assignedPanelistIds, setAssignedPanelistIds] = useState<string[]>([]);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState('');
  const [draftNotice, setDraftNotice] = useState('');
  const [sourceDecision, setSourceDecision] = useState<{ id: string; sampleName: string; issfScore: number; confidence: number; timestamp: string } | null>(null);
  const [reportsExpanded, setReportsExpanded] = useState(false);
  const { data: settings } = useConceptGenerationSettings();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const { data: diagnostics } = useConceptLabDiagnostics();
  const { data: commercializationReports = [] } = useCommercializationReports();

  const STEPS: WizardStep[] = ['concept', 'survey', 'review'];
  const stepIndex = STEPS.indexOf(step);

  const conceptValid = draft.name.trim() && draft.category.trim() && draft.description.trim();
  const detection = detectFoodType(draft.category, draft.name, draft.description);
  const validImageCount = draft.marketingImages.filter(u => u.trim()).length;
  const visualReady = validImageCount >= 1;
  const questionReady = questions.length >= 5;
  const readinessItems = [
    { label: 'Concept brief', ready: !!conceptValid, detail: conceptValid ? 'Name, category, and description are ready.' : 'Add name, category, and consumer-facing description.' },
    { label: 'Concept visuals', ready: visualReady, detail: validImageCount === 0 ? 'Add at least one concept visual.' : `${validImageCount} visual${validImageCount !== 1 ? 's' : ''} added.` },
    { label: 'Survey questions', ready: questionReady, detail: questions.length === 0 ? 'Generate a tailored questionnaire.' : `${questions.length} question${questions.length !== 1 ? 's' : ''} in the survey.` },
  ];
  const readyCount = readinessItems.filter(item => item.ready).length;
  const launchReady = readinessItems.every(item => item.ready);
  const setupWarnings = diagnostics?.messages ?? [];
  const draftHasWork = useMemo(() => (
    draft.name.trim()
    || draft.category.trim()
    || draft.description.trim()
    || draft.marketingImages.some(Boolean)
    || questions.length > 0
  ), [draft.category, draft.description, draft.marketingImages, draft.name, questions.length]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as StoredConceptDraft;
        if (saved?.draft) {
          setDraft({ ...makeEmptyDraft(saved.draft.promptStyle), ...saved.draft });
          setQuestions(saved.questions ?? []);
          setSegments(saved.segments ?? []);
          setAssignedPanelistIds(saved.assignedPanelistIds ?? []);
          setPanelSize(saved.panelSize ?? 50);
          setDraftNotice(`Draft restored from ${new Date(saved.savedAt).toLocaleString()}.`);
          return;
        }
      }
    } catch {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }

    const seed = (location.state as {
      conceptSeed?: {
        name?: string;
        category?: string;
        description?: string;
        sourceDecision?: { id: string; sampleName: string; issfScore: number; confidence: number; timestamp: string };
      };
    } | null)?.conceptSeed;
    if (seed?.name) {
      setDraft(prev => ({
        ...prev,
        name: seed.name?.trim() || prev.name,
        category: seed.category?.trim() || prev.category,
        description: seed.description?.trim() || prev.description,
      }));
      setDraftNotice(`Pre-filled from your "${seed.name}" GO decision — review and personalize before launching.`);
      if (seed.sourceDecision) setSourceDecision(seed.sourceDecision);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        panelSize,
        segments,
        assignedPanelistIds,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [assignedPanelistIds, draft, draftHasWork, panelSize, questions, segments, step]);

  const resetForm = () => {
    setStep('concept');
    setDraft(makeEmptyDraft(settings?.promptStyle ?? 'balanced'));
    setQuestions([]);
    setSegments([]);
    setAssignedPanelistIds([]);
    setPanelSize(workspaceSettings?.defaultPanelSize ?? 50);
    setLaunchError('');
    setDraftNotice('');
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
          Your survey has been sent to <strong>{assignedPanelistIds.length > 0 ? assignedPanelistIds.length : panelSize} panelists</strong>.
          Results will appear in <strong>Analyze Results</strong> as responses come in.
        </p>
        <div className="flex items-center justify-center gap-3 pt-4">
          <Button variant="outline" onClick={resetForm}>
            New concept test
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => navigate('/survey-analysis')}>
            View responses
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <ProjectHeader />
      {/* Page header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center">
              <Lightbulb className="size-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-slate-900">Concept Lab</h1>
                <Badge className="bg-slate-900 text-white text-xs font-bold">Pro</Badge>
              </div>
              <p className="text-slate-500 text-sm">
                Build food concepts, generate visuals, create panel surveys, and launch consumer validation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[560px]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500"><ImageIcon className="size-3.5" /> Visuals</div>
              <p className="text-lg font-bold text-slate-900">{validImageCount}/4</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500"><ListChecks className="size-3.5" /> Questions</div>
              <p className="text-lg font-bold text-slate-900">{questions.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500"><Users className="size-3.5" /> Panel</div>
              <p className="text-lg font-bold text-slate-900">{assignedPanelistIds.length || panelSize}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500"><FileCheck2 className="size-3.5" /> Reports</div>
              <p className="text-lg font-bold text-slate-900">{commercializationReports.length}</p>
            </div>
          </div>
        </div>
      </div>

      {commercializationReports.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setReportsExpanded(prev => !prev)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3"
          >
            <div className="text-left">
              <h2 className="text-sm font-semibold text-slate-900">Commercialization reports</h2>
              <p className="text-xs text-slate-500">GO-approved formulation and packaging handoffs.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{commercializationReports.filter(report => report.status === 'approved').length} approved</Badge>
              <ChevronDown className={`size-4 text-slate-400 transition-transform ${reportsExpanded ? 'rotate-180' : ''}`} />
            </div>
          </button>
          {reportsExpanded && (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {commercializationReports.slice(0, 5).map(report => (
                <div key={report.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{report.title}</p>
                    <p className="text-xs text-slate-500">Version {report.version} · {new Date(report.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <Badge className={report.status === 'approved' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}>
                    {report.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

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

      {/* Step progress */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const done = i < stepIndex;
          const active = s === step;
          const labels: Record<WizardStep, string> = {
            concept: '1. Concept & visuals', survey: '2. Survey & panel', review: '3. Review', launched: '',
          };
          return (
            <div key={s} className="flex items-center flex-1">
              <div className={`flex-1 flex items-center justify-center py-2 px-3 text-xs font-semibold transition-all ${
                done    ? 'bg-emerald-600 text-white' :
                active  ? 'bg-blue-600 text-white' :
                          'bg-slate-100 text-slate-400'
              } ${i === 0 ? 'rounded-l-lg' : ''} ${i === STEPS.length - 1 ? 'rounded-r-lg' : ''}`}>
                {done ? <CheckCircle2 className="size-3.5 mr-1" /> : null}
                {labels[s]}
              </div>
              {i < STEPS.length - 1 && <div className="w-0.5 h-9 bg-white" />}
            </div>
          );
        })}
      </div>

      {/* Launch readiness strip */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="text-xs font-semibold text-slate-500 mr-1">Launch readiness ({readyCount}/{readinessItems.length})</span>
        {readinessItems.map(item => (
          <span
            key={item.label}
            title={item.detail}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              item.ready ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-500 border border-slate-200'
            }`}
          >
            <CheckCircle2 className="size-3.5" />
            {item.label}
          </span>
        ))}
      </div>

      {/* Step content */}
      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="pt-6 pb-6 space-y-8">
          {step === 'concept' && (
            <>
              <ConceptStep draft={draft} onChange={setDraft} />
              <div className="border-t border-slate-100 pt-8">
                <ImagesStep draft={draft} onChange={setDraft} estimatedCostPerImage={settings?.estimatedCostPerImage ?? 0.034} />
              </div>
            </>
          )}
          {step === 'survey' && (
            <>
              <QuestionsStep draft={draft} questions={questions} onChange={setQuestions} />
              <div className="border-t border-slate-100 pt-8">
                <PanelStep panelSize={panelSize} setPanelSize={setPanelSize} targetSegments={segments} setTargetSegments={setSegments} assignedPanelistIds={assignedPanelistIds} setAssignedPanelistIds={setAssignedPanelistIds} />
              </div>
            </>
          )}
          {step === 'review' && (
            <ReviewStep draft={draft} questions={questions} panelSize={panelSize} segments={segments} assignedPanelistIds={assignedPanelistIds} />
          )}
        </CardContent>
      </Card>

      {launchError && (
        <p className="text-sm text-rose-600 font-medium text-center">{launchError}</p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(STEPS[stepIndex - 1])}
          disabled={stepIndex === 0}
          className="gap-1.5"
        >
          <ChevronLeft className="size-4" /> Back
        </Button>

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
          <Button
            onClick={() => setStep(STEPS[stepIndex + 1])}
            disabled={step === 'concept' && !conceptValid}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
          >
            Continue <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
