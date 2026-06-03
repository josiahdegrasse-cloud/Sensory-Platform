import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { CheckCircle2 } from 'lucide-react';
import type { ConceptDraft, Question } from './types';
import { CATEGORY_COLORS } from './types';

export function ReviewStep({ draft, questions, panelSize, segments, assignedPanelistIds }: {
  draft: ConceptDraft;
  questions: Question[];
  panelSize: number;
  segments: string[];
  assignedPanelistIds: string[];
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Review & launch</h2>
        <p className="text-slate-500 text-sm mt-1">Confirm everything looks right before sending to your panel.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-black text-blue-600">{questions.length}</div>
            <div className="text-xs text-blue-700 font-medium mt-0.5">Questions</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-emerald-200 bg-emerald-50">
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-black text-emerald-600">
              {assignedPanelistIds.length > 0 ? assignedPanelistIds.length : panelSize}
            </div>
            <div className="text-xs text-emerald-700 font-medium mt-0.5">
              {assignedPanelistIds.length > 0 ? 'Assigned' : 'Target size'}
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-black text-amber-600">{Math.ceil(questions.length * 0.6)}</div>
            <div className="text-xs text-amber-700 font-medium mt-0.5">Est. minutes</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-slate-700">Concept</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-base font-bold text-slate-900">{draft.name || '(unnamed)'}</div>
          <div className="text-xs text-slate-500 mt-0.5">{draft.category}</div>
          {draft.description && <p className="text-sm text-slate-700 mt-2">{draft.description}</p>}
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-600">
            {draft.targetMarket && <span><strong>Target:</strong> {draft.targetMarket}</span>}
            {draft.pricePoint && <span><strong>Price:</strong> {draft.pricePoint}</span>}
            {draft.marketingImages.filter(u => u.trim()).length > 0 && (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="size-3.5" />{draft.marketingImages.filter(u => u.trim()).length} marketing image{draft.marketingImages.filter(u => u.trim()).length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-slate-700">Survey questions ({questions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-1.5">
            {questions.map((q, i) => (
              <li key={q.id} className="flex items-start gap-2 text-sm">
                <span className="text-slate-400 font-bold w-5 flex-shrink-0">{i + 1}.</span>
                <span className="text-slate-700 line-clamp-1">{q.text || <em className="text-slate-400">Empty question</em>}</span>
                <span className={`ml-auto flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[q.category]}`}>{q.category}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {segments.length > 0 && (
        <Card className="border border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-700">Target segments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {segments.map(s => (
                <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
