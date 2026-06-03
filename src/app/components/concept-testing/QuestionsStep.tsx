import { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Trash2, Sparkles, GripVertical } from 'lucide-react';
import type { Question } from './types';
import { CATEGORY_COLORS, QUESTION_TYPE_LABELS, CATEGORY_BAR_COLORS, QUESTION_SECONDS } from './types';
import { AI_QUESTION_TEMPLATES } from './questions-data';

export function QuestionsStep({
  questions,
  onChange,
}: {
  questions: Question[];
  onChange: (qs: Question[]) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      onChange(AI_QUESTION_TEMPLATES.slice(0, 20));
      setGenerating(false);
      setGenerated(true);
    }, 1400);
  };

  const remove = (id: string) => onChange(questions.filter(q => q.id !== id));

  const addBlank = () => {
    const id = `q_custom_${Date.now()}`;
    onChange([...questions, { id, text: '', type: 'scale', required: false, category: 'attributes' }]);
  };

  const update = (id: string, field: keyof Question, value: string | boolean) => {
    onChange(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const handleDrop = (targetIdx: number) => {
    if (draggedIdx === null || draggedIdx === targetIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    const reordered = [...questions];
    const [moved] = reordered.splice(draggedIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    onChange(reordered);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  // Coverage & time
  const categoryCounts = questions.reduce<Partial<Record<Question['category'], number>>>((acc, q) => {
    acc[q.category] = (acc[q.category] ?? 0) + 1;
    return acc;
  }, {});
  const maxCatCount = Math.max(1, ...Object.values(categoryCounts).filter((v): v is number => v !== undefined));
  const estimatedSeconds = questions.reduce((total, q) => total + QUESTION_SECONDS[q.type], 0);
  const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Design your survey</h2>
          <p className="text-slate-500 text-sm mt-1">
            {questions.length} question{questions.length !== 1 ? 's' : ''} — aim for 20–30 for reliable insights.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addBlank} className="text-slate-700 border-slate-300">
            <Plus className="size-3.5 mr-1" />Add question
          </Button>
          <Button size="sm" onClick={handleGenerate} disabled={generating} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Sparkles className="size-3.5 mr-1.5" />
            {generating ? 'Generating…' : generated ? 'Regenerate with AI' : 'Generate with AI'}
          </Button>
        </div>
      </div>

      {/* Coverage meter */}
      {questions.length > 0 && (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Survey Coverage</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              estimatedMinutes <= 20 ? 'bg-emerald-100 text-emerald-700' :
              estimatedMinutes <= 30 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
            }`}>~{estimatedMinutes} min</span>
          </div>
          {(Object.keys(CATEGORY_BAR_COLORS) as Question['category'][]).map(cat => {
            const count = categoryCounts[cat] ?? 0;
            const width = count === 0 ? 0 : Math.round((count / maxCatCount) * 100);
            return (
              <div key={cat} className="flex items-center gap-3">
                <div className="w-24 text-[10px] font-semibold text-slate-500 capitalize text-right">{cat}</div>
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  {count > 0 && (
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${CATEGORY_BAR_COLORS[cat]}`}
                      style={{ width: `${width}%` }}
                    />
                  )}
                </div>
                <div className="w-5 text-[10px] font-bold text-center">
                  {count === 0
                    ? <span className="text-rose-400">✗</span>
                    : <span className="text-slate-600">{count}</span>
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}

      {questions.length === 0 && (
        <Card className="border-2 border-dashed border-blue-200 bg-blue-50">
          <CardContent className="py-12 text-center">
            <Sparkles className="size-10 text-blue-300 mx-auto mb-3" />
            <p className="text-blue-700 font-semibold">No questions yet</p>
            <p className="text-blue-500 text-sm mt-1">
              Click <strong>Generate with AI</strong> to create a tailored 20-question survey, or add questions manually.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {questions.map((q, i) => (
          <Card
            key={q.id}
            draggable
            onDragStart={() => setDraggedIdx(i)}
            onDragOver={e => { e.preventDefault(); setDragOverIdx(i); }}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
            className={`border transition-all ${
              dragOverIdx === i && draggedIdx !== i
                ? 'border-blue-400 shadow-md bg-blue-50'
                : 'border-slate-200 hover:border-slate-300'
            } ${draggedIdx === i ? 'opacity-40' : ''}`}
          >
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 mt-1 text-slate-300 cursor-grab active:cursor-grabbing">
                  <GripVertical className="size-4" />
                  <span className="text-[11px] font-bold text-slate-400">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <Input
                    value={q.text}
                    onChange={e => update(q.id, 'text', e.target.value)}
                    placeholder="Question text…"
                    className="border-0 px-0 py-0 h-auto text-sm font-medium text-slate-900 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
                  />
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[q.category]}`}>
                      {q.category}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {QUESTION_TYPE_LABELS[q.type]}
                    </span>
                    {q.required && (
                      <span className="text-[10px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">Required</span>
                    )}
                  </div>
                </div>
                <button onClick={() => remove(q.id)} className="mt-1 text-slate-300 hover:text-rose-500 transition-colors flex-shrink-0">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {questions.length > 0 && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={addBlank} className="text-slate-600">
            <Plus className="size-3.5 mr-1.5" />Add another question
          </Button>
        </div>
      )}
    </div>
  );
}
