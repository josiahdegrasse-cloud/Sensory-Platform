import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Lightbulb, ChevronRight, ChevronLeft, Send, CheckCircle2, Image as ImageIcon,
  ListChecks, Users, WandSparkles, AlertTriangle,
} from 'lucide-react';
import { insertConceptTest } from '../lib/database';
import { detectFoodType } from '../lib/food-intelligence';
import {
  useConceptGenerationSettings,
  useConceptImageGenerations,
} from '../lib/hooks';
import type { ConceptDraft, Question, WizardStep } from './concept-testing/types';
import { ConceptStep } from './concept-testing/ConceptStep';
import { ImagesStep } from './concept-testing/ImagesStep';
import { QuestionsStep } from './concept-testing/QuestionsStep';
import { PanelStep } from './concept-testing/PanelStep';
import { ReviewStep } from './concept-testing/ReviewStep';

// ─── Helper ───────────────────────────────────────────────────────────────────

const isValidImageUrlLaunch = (u: string) =>
  u.startsWith('data:image/') || ((): boolean => { try { return new URL(u).protocol === 'https:'; } catch { return false; } })();

// ─── Main component ───────────────────────────────────────────────────────────

export function ConceptTesting() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>('concept');
  const [draft, setDraft] = useState<ConceptDraft>({
    name: '', category: '', projectName: 'Project 1', description: '', marketingImages: [], marketingImageIds: [],
    targetMarket: '', pricePoint: '', keyBenefits: '', technicalChallenges: '', promptStyle: 'balanced', approvalStatus: 'draft',
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [panelSize, setPanelSize] = useState(50);
  const [segments, setSegments] = useState<string[]>([]);
  const [assignedPanelistIds, setAssignedPanelistIds] = useState<string[]>([]);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState('');
  const { data: settings } = useConceptGenerationSettings();
  const { data: history = [] } = useConceptImageGenerations();

  const STEPS: WizardStep[] = ['concept', 'images', 'questions', 'panel', 'review'];
  const stepIndex = STEPS.indexOf(step);

  const conceptValid = draft.name.trim() && draft.category.trim() && draft.description.trim();
  const detection = detectFoodType(draft.category, draft.name, draft.description);
  const validImageCount = draft.marketingImages.filter(u => u.trim()).length;
  const visualReady = validImageCount >= 2 && validImageCount <= 4;
  const questionReady = questions.length >= 18 && questions.length <= 30;
  const estimatedGenerationCost = (settings?.estimatedCostPerImage ?? 0.034) * (settings?.defaultImageCount ?? 4);
  const monthSpend = history.reduce((total, generation) => total + generation.estimatedCost, 0);
  const readinessItems = [
    { label: 'Concept brief', ready: !!conceptValid, detail: conceptValid ? 'Name, category, and description are ready.' : 'Add name, category, and consumer-facing description.' },
    { label: 'Concept visuals', ready: visualReady, detail: validImageCount === 0 ? 'Generate 4 visuals and select 2-4.' : `${validImageCount} visual${validImageCount !== 1 ? 's' : ''} selected.` },
    { label: 'Survey questions', ready: questionReady, detail: questions.length === 0 ? 'Generate a tailored questionnaire.' : `${questions.length} question${questions.length !== 1 ? 's' : ''} in the survey.` },
    { label: 'Panel target', ready: assignedPanelistIds.length > 0 || panelSize > 0 || segments.length > 0, detail: assignedPanelistIds.length > 0 ? `${assignedPanelistIds.length} named panelist${assignedPanelistIds.length !== 1 ? 's' : ''}.` : `${panelSize} target responses.` },
  ];
  const readyCount = readinessItems.filter(item => item.ready).length;
  const nextBestAction = !conceptValid
    ? 'Finish the concept brief first.'
    : !visualReady
      ? 'Generate 4 visuals and select the strongest 2-4.'
      : !questionReady
        ? 'Generate a tailored 18-30 question survey.'
        : 'Assign panelists and launch when ready.';

  const resetForm = () => {
    setStep('concept');
    setDraft({
      name: '', category: '', projectName: 'Project 1', description: '', marketingImages: [], marketingImageIds: [],
      targetMarket: '', pricePoint: '', keyBenefits: '', technicalChallenges: '', promptStyle: settings?.promptStyle ?? 'balanced', approvalStatus: 'draft',
    });
    setQuestions([]);
    setSegments([]);
    setAssignedPanelistIds([]);
    setPanelSize(50);
  };

  const handleLaunch = async () => {
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

          <div className="grid grid-cols-3 gap-3 lg:w-[420px]">
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
          </div>
        </div>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const done = i < stepIndex;
          const active = s === step;
          const labels: Record<WizardStep, string> = {
            concept: '1. Concept', images: '2. Images', questions: '3. Questions', panel: '4. Panel', review: '5. Review', launched: '',
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

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* Step content */}
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="pt-6 pb-6">
            {step === 'concept'    && <ConceptStep draft={draft} onChange={setDraft} />}
            {step === 'images'     && <ImagesStep draft={draft} onChange={setDraft} />}
            {step === 'questions'  && <QuestionsStep draft={draft} questions={questions} onChange={setQuestions} />}
            {step === 'panel'      && <PanelStep panelSize={panelSize} setPanelSize={setPanelSize} targetSegments={segments} setTargetSegments={setSegments} assignedPanelistIds={assignedPanelistIds} setAssignedPanelistIds={setAssignedPanelistIds} />}
            {step === 'review'     && <ReviewStep draft={draft} questions={questions} panelSize={panelSize} segments={segments} assignedPanelistIds={assignedPanelistIds} />}
          </CardContent>
        </Card>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="border border-slate-200">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <WandSparkles className="size-4 text-blue-600" />
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Launch readiness</p>
                  <p className="text-xs text-slate-500">{readyCount} of {readinessItems.length} signals ready</p>
                </div>
              </div>
              <div className="space-y-2">
                {readinessItems.map(item => (
                  <div key={item.label} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{item.label}</span>
                      <span className={`flex size-5 items-center justify-center rounded-full ${
                        item.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-300'
                      }`}>
                        <CheckCircle2 className="size-3.5" />
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{item.detail}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-4 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-900">Next best action</p>
                    <p className="text-xs text-amber-800 mt-0.5">{nextBestAction}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-blue-950">Lab context</p>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-blue-700">Food type</dt>
                  <dd className="font-semibold text-blue-950">{detection.label}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-blue-700">Project</dt>
                  <dd className="font-semibold text-blue-950 text-right">{draft.projectName || 'Project 1'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-blue-700">Visuals</dt>
                  <dd className="font-semibold text-blue-950">4 · {settings?.defaultQuality ?? 'medium'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-blue-700">Next estimate</dt>
                  <dd className="font-semibold text-blue-950">${estimatedGenerationCost.toFixed(2)}</dd>
                </div>
                {history.length > 0 && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-blue-700">Tracked spend</dt>
                    <dd className="font-semibold text-blue-950">${monthSpend.toFixed(2)}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>

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
            disabled={launching || questions.length === 0 || !conceptValid}
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
