import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { useAuth } from '../contexts/auth-context';
import {
  type ConceptQuestion,
} from '../lib/database';
import { useConceptTest, useInsertConceptResponse } from '../lib/hooks';
import { CheckCircle2, ChevronLeft, ChevronRight, Image as ImageIcon, AlertCircle, Megaphone } from 'lucide-react';
import { useScrollToTop } from '../lib/use-scroll-to-top';
import { PanelistTaskLoading, PanelistTaskUnavailable } from './panelist-task-state';

const SCALE_MIDPOINT = 5;

export function ConceptSurvey() {
  const { conceptId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  useScrollToTop(conceptId);
  const { data: test, isLoading: loading, isError } = useConceptTest(conceptId);
  const insertResponse = useInsertConceptResponse();
  const [answers, setAnswers] = useState<Record<string, string | number | string[]>>({});
  const [imageIndex, setImageIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  // Load failure surfaces inline alongside submit/validation errors — derived
  // from the query state rather than mirrored into `error` via an effect.
  const loadError = isError ? 'Could not load this concept test.' : '';
  const shownError = error || loadError;

  const setAnswer = (questionId: string, value: string | number | string[]) =>
    setAnswers(prev => ({ ...prev, [questionId]: value }));

  const handleSubmit = async () => {
    if (!user?.id || !conceptId) return;
    if (user.role !== 'panelist') {
      setError('Preview mode only. Sign in as an assigned panelist to submit feedback.');
      return;
    }
    const completedAnswers = { ...answers };
    test?.questions.forEach(question => {
      if (question.type === 'scale' && completedAnswers[question.id] === undefined) {
        completedAnswers[question.id] = SCALE_MIDPOINT;
      }
    });
    const unanswered = test?.questions.filter(q => q.required && (completedAnswers[q.id] === undefined || completedAnswers[q.id] === null || (typeof completedAnswers[q.id] === 'string' && !(completedAnswers[q.id] as string).trim()) || (Array.isArray(completedAnswers[q.id]) && (completedAnswers[q.id] as string[]).length === 0)));
    if (unanswered && unanswered.length > 0) {
      setError(`Please answer all required questions before submitting (${unanswered.length} remaining).`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await insertResponse.mutateAsync({ userId: user.id, conceptTestId: conceptId!, answers: completedAnswers });
      setSubmitted(true);
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PanelistTaskLoading message="Loading your concept task…" />;
  }

  if (!test) {
    return <PanelistTaskUnavailable message={isError ? 'We could not load this concept task. Check your connection and try again.' : 'This concept task is not available.'} onBack={() => navigate('/panelist')} />;
  }

  if (test.status !== 'active') {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="size-8 text-slate-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">This concept test is closed.</h2>
        <p className="text-slate-700">No further responses are being accepted for this study.</p>
        <Button variant="outline" onClick={() => navigate('/panelist')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="size-10 text-emerald-600" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900">Thank you!</h2>
        <p className="text-slate-700 text-lg">
          Your feedback on <strong>{test.name}</strong> has been recorded and will help shape the product.
        </p>
        <Button onClick={() => navigate('/panelist')} className="bg-emerald-600 hover:bg-emerald-700 text-white mt-4">
          Back to my dashboard
        </Button>
      </div>
    );
  }

  const validImages = test.imageUrls.filter(u => u.trim());

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-200">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center">
            <Megaphone className="size-4 text-white" />
          </div>
          <div>
            <Badge className="bg-orange-500 text-white text-xs">Marketing Evaluation</Badge>
          </div>
          <Badge variant="outline" className="text-xs">{test.category}</Badge>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{test.name}</h1>
        {test.pricePoint && (
          <div className="mt-3 text-xs text-slate-500">
            <span><strong>Expected price:</strong> {test.pricePoint}</span>
          </div>
        )}
      </div>

      {shownError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{shownError}</AlertDescription>
        </Alert>
      )}

      {/* Marketing image gallery */}
      {validImages.length > 0 && (
        <Card className="border-2 border-orange-200 overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <ImageIcon className="size-4 text-orange-500" />
            <span className="text-sm font-bold text-slate-700">
              Marketing Concepts — review carefully before answering
            </span>
          </div>
          <CardContent className="pt-0 pb-4">
            <div className="relative rounded-xl overflow-hidden bg-slate-50 mb-3">
              <img
                src={validImages[imageIndex]}
                alt={`Marketing concept ${imageIndex + 1}`}
                decoding="async"
                className="w-full h-72 object-contain"
              />
              {validImages.length > 1 && (
                <>
                  <button
                    onClick={() => setImageIndex(i => Math.max(0, i - 1))}
                    disabled={imageIndex === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 shadow-md disabled:opacity-30 transition-opacity"
                  >
                    <ChevronLeft className="size-5 text-slate-700" />
                  </button>
                  <button
                    onClick={() => setImageIndex(i => Math.min(validImages.length - 1, i + 1))}
                    disabled={imageIndex === validImages.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 shadow-md disabled:opacity-30 transition-opacity"
                  >
                    <ChevronRight className="size-5 text-slate-700" />
                  </button>
                </>
              )}
              <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                {imageIndex + 1} / {validImages.length}
              </div>
            </div>
            {validImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {validImages.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setImageIndex(i)}
                    className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                      i === imageIndex ? 'border-orange-500 shadow-sm' : 'border-slate-200 hover:border-orange-300'
                    }`}
                  >
                    <img src={url} alt={`Concept ${i + 1}`} loading="lazy" decoding="async" className="w-20 h-14 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Survey questions */}
      {test.questions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">
            Survey — {test.questions.length} question{test.questions.length !== 1 ? 's' : ''}
          </h2>
          {test.questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i}
              answer={answers[q.id]}
              onAnswer={val => setAnswer(q.id, val)}
              images={validImages}
            />
          ))}
        </div>
      )}

      {/* Submit */}
      <div className="pt-2">
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-base font-semibold"
        >
          {submitting ? 'Submitting…' : 'Submit my feedback'}
        </Button>
        <p className="text-xs text-slate-500 text-center mt-2">
          Your feedback is stored securely and is visible only to authorized research administrators.
        </p>
      </div>
    </div>
  );
}

// ─── Question renderers ───────────────────────────────────────────────────────

function QuestionCard({
  question, index, answer, onAnswer, images,
}: {
  question: ConceptQuestion;
  index: number;
  answer: string | number | string[] | undefined;
  onAnswer: (val: string | number | string[]) => void;
  images: string[];
}) {
  return (
    <Card className="border border-slate-200 hover:border-orange-200 transition-colors">
      <CardContent className="pt-4 pb-4">
        <div className="flex gap-3">
          <span className="text-sm font-bold text-slate-500 mt-0.5 w-6 flex-shrink-0">{index + 1}.</span>
          <div className="flex-1 space-y-3">
            {question.imageIndex !== undefined && images[question.imageIndex] && (
              <div className="max-w-sm overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <img
                  src={images[question.imageIndex]}
                  alt={`Concept visual ${question.imageIndex + 1} being rated`}
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full object-contain"
                />
                <p className="border-t border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                  Visual {question.imageIndex + 1}
                </p>
              </div>
            )}
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-900 leading-snug">{question.text}</p>
              {question.required && (
                <span className="text-[11px] text-rose-500 font-semibold flex-shrink-0">Required</span>
              )}
            </div>
            {question.type === 'scale' && (
              <ScaleInput value={answer as number | undefined} onChange={onAnswer} />
            )}
            {question.type === 'multiple_choice' && question.options && (
              <MultipleChoiceInput
                options={question.options}
                value={answer as string | string[] | undefined}
                onChange={onAnswer}
                multiSelect={question.text.toLowerCase().includes('select all')}
              />
            )}
            {question.type === 'open_text' && (
              <Textarea
                value={(answer as string) ?? ''}
                onChange={e => onAnswer(e.target.value)}
                placeholder="Your answer…"
                rows={3}
                className="resize-none"
              />
            )}
            {question.type === 'ranking' && question.options && (
              <RankingInput
                options={question.options}
                value={answer as string[] | undefined}
                onChange={onAnswer}
              />
            )}
            {question.type === 'image_choice' && (
              <ImageChoiceInput
                images={images}
                value={answer as string | undefined}
                onChange={onAnswer}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScaleInput({ value, onChange }: { value: number | undefined; onChange: (v: number) => void }) {
  const currentValue = value ?? SCALE_MIDPOINT;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-slate-500">
        <span>1 — Not at all</span>
        <span>9 — Extremely</span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 py-2 rounded-md text-sm font-bold border-2 transition-all ${
              currentValue === n
                ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                : 'border-slate-200 text-slate-700 hover:border-orange-300 hover:text-orange-600'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function MultipleChoiceInput({
  options, value, onChange, multiSelect,
}: {
  options: string[];
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
  multiSelect: boolean;
}) {
  if (multiSelect) {
    const selected = (value as string[]) ?? [];
    const toggle = (opt: string) =>
      onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
    return (
      <div className="space-y-2">
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded-md p-1.5 transition-colors">
            <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} className="accent-orange-500" />
            <span className="text-sm text-slate-700">{opt}</span>
          </label>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded-md p-1.5 transition-colors">
          <input
            type="radio"
            checked={value === opt}
            onChange={() => onChange(opt)}
            name={`q_${options.join('').slice(0, 12)}`}
            className="accent-orange-500"
          />
          <span className="text-sm text-slate-700">{opt}</span>
        </label>
      ))}
    </div>
  );
}

function ImageChoiceInput({
  images, value, onChange,
}: {
  images: string[];
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  if (images.length === 0) {
    return <p className="text-xs text-slate-500 italic">No concept visuals to compare.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {images.map((url, i) => (
        <button
          key={`${url}-${i}`}
          type="button"
          onClick={() => onChange(url)}
          className={`relative rounded-lg overflow-hidden border-2 transition-all ${
            value === url ? 'border-orange-500 shadow-md' : 'border-slate-200 hover:border-orange-300'
          }`}
        >
          <img src={url} alt={`Concept visual ${i + 1}`} loading="lazy" decoding="async" className="w-full aspect-square object-cover" />
          <span className={`absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full border-2 shadow-sm ${
            value === url ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/90 border-slate-200 text-transparent'
          }`}>
            <CheckCircle2 className="size-3" />
          </span>
          <span className="absolute bottom-1.5 left-1.5 rounded-md bg-slate-950/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            Option {i + 1}
          </span>
        </button>
      ))}
    </div>
  );
}

function RankingInput({
  options, value, onChange,
}: {
  options: string[];
  value: string[] | undefined;
  onChange: (v: string[]) => void;
}) {
  const ranked = value ?? [];
  const select = (pos: number, opt: string) => {
    const next = [...ranked];
    const existing = next.indexOf(opt);
    if (existing !== -1) next.splice(existing, 1);
    next[pos] = opt;
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Rank from 1 (most preferred) to {options.length} (least preferred)</p>
      {options.map((opt, i) => (
        <div key={opt} className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 w-4">{i + 1}.</span>
          <select
            value={ranked[i] ?? ''}
            onChange={e => select(i, e.target.value)}
            className="flex-1 text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white"
          >
            <option value="">— Select —</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}
