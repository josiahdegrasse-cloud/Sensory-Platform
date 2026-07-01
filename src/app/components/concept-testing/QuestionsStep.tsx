import { useEffect, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { ChevronDown, ChevronUp, Plus, Trash2, FileText, GripVertical } from 'lucide-react';
import { detectFoodType } from '../../lib/food-intelligence';
import { AIReviewCard, type AIReviewState } from '../ai-review-card';
import type { ConceptDraft, Question } from './types';
import { CATEGORY_COLORS, QUESTION_TYPE_LABELS, CATEGORY_BAR_COLORS } from './types';
import { buildTailoredConceptQuestions } from './smart-defaults';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  estimateSurveySeconds,
  formatSurveyDuration,
} from './survey-utils';

export function QuestionsStep({
  draft,
  questions,
  onChange,
  reviewState,
  onReviewStateChange,
}: {
  draft: ConceptDraft;
  questions: Question[];
  onChange: (qs: Question[]) => void;
  /** 'none' = hand-built list. Persisted by the parent so a refresh does not lose pending-approval status. */
  reviewState: AIReviewState | 'none';
  onReviewStateChange: (state: AIReviewState | 'none') => void;
}) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<'regenerate' | 'reject' | null>(null);
  const [editing, setEditing] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const generated = reviewState !== 'none';
  const validImageCount = draft.marketingImages.filter(u => u.trim()).length;

  useEffect(() => {
    const imageChoiceRequired = validImageCount > 1;
    if (!questions.some(question =>
      question.type === 'image_choice' && question.required !== imageChoiceRequired
    )) return;

    onChange(questions.map(question =>
      question.type === 'image_choice'
        ? { ...question, required: imageChoiceRequired }
        : question
    ));
    if (reviewState === 'approved') onReviewStateChange('edited');
  }, [onChange, onReviewStateChange, questions, reviewState, validImageCount]);

  /** Any manual change to a generated survey returns it to edited review state. */
  const markEdited = () => {
    if (reviewState !== 'none' && reviewState !== 'edited') onReviewStateChange('edited');
  };

  const generateDraft = () => {
    onChange(buildTailoredConceptQuestions(draft));
    onReviewStateChange('draft');
  };

  const rejectDraft = () => {
    onChange([]);
    onReviewStateChange('none');
  };

  const requestRegenerate = () => {
    if (reviewState === 'edited') {
      setPendingConfirmation('regenerate');
      return;
    }
    generateDraft();
  };

  const requestReject = () => {
    if (reviewState === 'edited') {
      setPendingConfirmation('reject');
      return;
    }
    rejectDraft();
  };

  const remove = (id: string) => {
    markEdited();
    onChange(questions.filter(q => q.id !== id));
  };

  const addBlank = () => {
    markEdited();
    const id = `q_custom_${Date.now()}`;
    onChange([...questions, { id, text: '', type: 'scale', required: false, category: 'attributes' }]);
  };

  const update = (id: string, field: keyof Question, value: string | boolean) => {
    markEdited();
    onChange(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const handleDrop = (targetIdx: number) => {
    if (draggedIdx === null || draggedIdx === targetIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    markEdited();
    const reordered = [...questions];
    const [moved] = reordered.splice(draggedIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    onChange(reordered);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= questions.length || fromIndex === toIndex) return;
    markEdited();
    const reordered = [...questions];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    onChange(reordered);
  };

  // Coverage & time
  const categoryCounts = questions.reduce<Partial<Record<Question['category'], number>>>((acc, q) => {
    acc[q.category] = (acc[q.category] ?? 0) + 1;
    return acc;
  }, {});
  const maxCatCount = Math.max(1, ...Object.values(categoryCounts).filter((v): v is number => v !== undefined));
  const estimatedSeconds = estimateSurveySeconds(questions);
  const estimatedDuration = formatSurveyDuration(estimatedSeconds);

  // Provenance shown on the review card: what the deterministic draft used,
  // and where thin inputs forced assumptions.
  const renderDetection = detectFoodType(draft.category, draft.name, draft.description);
  const briefBenefits = draft.keyBenefits.split(/[,\n]+/).map(part => part.trim()).filter(Boolean);
  const draftSources = [
    `Concept brief "${draft.name.trim() || 'Untitled concept'}"`,
    `${renderDetection.label} category profile`,
    briefBenefits.length > 0 ? `${briefBenefits.length} key benefit${briefBenefits.length === 1 ? '' : 's'}` : null,
  ].filter((s): s is string => Boolean(s));
  const draftWarnings = [
    !draft.description.trim() && 'The brief has no consumer description — questions lean on category norms.',
    briefBenefits.length === 0 && 'No key benefits listed in the brief — benefit-motivation questions were omitted.',
    validImageCount < 2 && 'Fewer than two concept visuals provided — the visual-preference question is optional.',
  ].filter((w): w is string => Boolean(w));

  const surveyEditor = (
    <div className="space-y-4">
      <Collapsible open={coverageOpen} onOpenChange={setCoverageOpen} className="rounded-lg border border-slate-200 bg-slate-50">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
          <div>
            <p className="text-sm font-semibold text-slate-700">Survey coverage</p>
            <p className="text-xs text-slate-500">{questions.length} questions, about {estimatedDuration}</p>
          </div>
          <ChevronDown className={`size-4 text-slate-500 transition-transform ${coverageOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2.5 border-t border-slate-200 px-4 py-3">
        {(Object.keys(CATEGORY_BAR_COLORS) as Question['category'][]).map(cat => {
          const count = categoryCounts[cat] ?? 0;
          const width = count === 0 ? 0 : Math.round((count / maxCatCount) * 100);
          return (
            <div key={cat} className="flex items-center gap-3">
              <div className="w-24 text-[11px] font-semibold text-slate-500 capitalize text-right">{cat}</div>
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                {count > 0 && (
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${CATEGORY_BAR_COLORS[cat]}`}
                    style={{ width: `${width}%` }}
                  />
                )}
              </div>
              <div className="w-5 text-[11px] font-bold text-center">
                {count === 0
                  ? <span className="text-rose-400">✗</span>
                  : <span className="text-slate-700">{count}</span>
                }
              </div>
            </div>
          );
        })}
        </CollapsibleContent>
      </Collapsible>

      <div className="space-y-2">
        {questions.map((q, i) => (
          <div
            key={q.id}
            draggable={editing}
            onDragStart={() => setDraggedIdx(i)}
            onDragOver={e => { e.preventDefault(); setDragOverIdx(i); }}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
            className={`rounded-xl border bg-white transition-all ${
              dragOverIdx === i && draggedIdx !== i
                ? 'border-blue-400 shadow-md bg-blue-50'
                : 'border-slate-200 hover:border-slate-200'
            } ${draggedIdx === i ? 'opacity-40' : ''}`}
          >
            <div className="py-3 px-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex flex-col items-center gap-0.5 text-slate-300">
                  {editing && <GripVertical className="size-4 cursor-grab active:cursor-grabbing" aria-hidden />}
                  <span className="text-[11px] font-bold text-slate-500">{i + 1}</span>
                  {editing && <button
                    type="button"
                    onClick={() => moveQuestion(i, i - 1)}
                    disabled={i === 0}
                    className="rounded p-0.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Move question ${i + 1} up`}
                  >
                    <ChevronUp className="size-3.5" aria-hidden />
                  </button>}
                  {editing && <button
                    type="button"
                    onClick={() => moveQuestion(i, i + 1)}
                    disabled={i === questions.length - 1}
                    className="rounded p-0.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Move question ${i + 1} down`}
                  >
                    <ChevronDown className="size-3.5" aria-hidden />
                  </button>}
                </div>
                <div className="flex-1 min-w-0">
                  <Input
                    value={q.text}
                    onChange={e => update(q.id, 'text', e.target.value)}
                    readOnly={!editing}
                    placeholder="Question text…"
                    className="border-0 px-0 py-0 h-auto text-sm font-medium text-slate-900 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-500"
                  />
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[q.category]}`}>
                      {q.category}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                      {QUESTION_TYPE_LABELS[q.type]}
                    </span>
                    {q.required && (
                      <span className="text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">Required</span>
                    )}
                  </div>
                </div>
                {editing && <button
                  type="button"
                  onClick={() => remove(q.id)}
                  className="mt-1 text-slate-300 hover:text-rose-500 transition-colors flex-shrink-0"
                  aria-label={`Delete question ${i + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={addBlank} className="text-slate-700">
          <Plus className="size-3.5 mr-1.5" />Add another question
        </Button>
      </div>}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Design your survey</h2>
          <p className="text-slate-500 text-sm mt-1">
            {questions.length} question{questions.length !== 1 ? 's' : ''} — at least 5 recommended.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {questions.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setEditing(value => !value)} className="text-slate-700 border-slate-200">
              {editing ? 'Finish editing' : 'Edit survey'}
            </Button>
          )}
          {questions.length === 0 && (
            <Button variant="outline" size="sm" onClick={() => { addBlank(); setEditing(true); }} className="text-slate-700 border-slate-200">
              <Plus className="size-3.5 mr-1" />Add question
            </Button>
          )}
          <Button size="sm" onClick={requestRegenerate}>
            <FileText className="size-3.5 mr-1.5" />
            {generated ? 'Rebuild draft survey' : 'Build draft survey'}
          </Button>
        </div>
      </div>

      {questions.length === 0 && (
        <Card className="border-2 border-dashed border-blue-200 bg-blue-50">
          <CardContent className="py-12 text-center">
            <FileText className="size-10 text-blue-300 mx-auto mb-3" />
            <p className="text-blue-700 font-semibold">No questions yet</p>
            <p className="text-blue-500 text-sm mt-1">
              Build a deterministic draft from your concept brief and category templates, or add questions manually.
            </p>
          </CardContent>
        </Card>
      )}

      {questions.length > 0 && (
        reviewState !== 'none' ? (
          <AIReviewCard
            title="Draft survey from your concept brief"
            sources={draftSources}
            warnings={reviewState === 'approved' ? [] : draftWarnings}
            state={reviewState}
            onRegenerate={requestRegenerate}
            regenerateLabel="Rebuild draft"
            draftProvenance="template-draft"
            onReject={requestReject}
            onApprove={() => onReviewStateChange('approved')}
            approveLabel="Approve survey"
          >
            {surveyEditor}
          </AIReviewCard>
        ) : surveyEditor
      )}

      <AlertDialog open={pendingConfirmation !== null} onOpenChange={open => !open && setPendingConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingConfirmation === 'reject' ? 'Discard edited survey?' : 'Rebuild edited survey?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingConfirmation === 'reject'
                ? 'Your edited questions will be removed. This action cannot be undone.'
                : 'Rebuilding replaces your edited questions with a new deterministic draft from the current concept brief and category templates.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Keep editing</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className={pendingConfirmation === 'reject' ? 'bg-rose-600 hover:bg-rose-700' : ''}
              onClick={() => {
                if (pendingConfirmation === 'reject') rejectDraft();
                if (pendingConfirmation === 'regenerate') generateDraft();
                setPendingConfirmation(null);
              }}
            >
              {pendingConfirmation === 'reject' ? 'Discard survey' : 'Rebuild survey'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
