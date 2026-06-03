import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Lightbulb, ChevronRight, ChevronLeft, Send, CheckCircle2,
} from 'lucide-react';
import { insertConceptTest } from '../lib/database';
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
    name: '', category: '', description: '', marketingImages: [],
    targetMarket: '', pricePoint: '', keyBenefits: '', technicalChallenges: '',
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [panelSize, setPanelSize] = useState(50);
  const [segments, setSegments] = useState<string[]>([]);
  const [assignedPanelistIds, setAssignedPanelistIds] = useState<string[]>([]);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState('');

  const STEPS: WizardStep[] = ['concept', 'images', 'questions', 'panel', 'review'];
  const stepIndex = STEPS.indexOf(step);

  const conceptValid = draft.name.trim() && draft.category.trim() && draft.description.trim();

  const resetForm = () => {
    setStep('concept');
    setDraft({ name: '', category: '', description: '', marketingImages: [], targetMarket: '', pricePoint: '', keyBenefits: '', technicalChallenges: '' });
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
        targetMarket: draft.targetMarket,
        pricePoint: draft.pricePoint,
        keyBenefits: draft.keyBenefits,
        questions,
        panelSize,
        assignedPanelistIds,
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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
          <Lightbulb className="size-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Concept Testing</h1>
          <p className="text-slate-500 text-sm">Design consumer surveys to validate product concepts before launch.</p>
        </div>
        <Badge className="ml-auto bg-slate-900 text-white text-xs font-bold">Pro</Badge>
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

      {/* Step content */}
      <Card className="border-2 border-slate-200">
        <CardContent className="pt-6 pb-6">
          {step === 'concept'    && <ConceptStep draft={draft} onChange={setDraft} />}
          {step === 'images'     && <ImagesStep draft={draft} onChange={setDraft} />}
          {step === 'questions'  && <QuestionsStep questions={questions} onChange={setQuestions} />}
          {step === 'panel'      && <PanelStep panelSize={panelSize} setPanelSize={setPanelSize} targetSegments={segments} setTargetSegments={setSegments} assignedPanelistIds={assignedPanelistIds} setAssignedPanelistIds={setAssignedPanelistIds} />}
          {step === 'review'     && <ReviewStep draft={draft} questions={questions} panelSize={panelSize} segments={segments} assignedPanelistIds={assignedPanelistIds} />}
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
