import { useState, type ReactNode } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useAdminConceptTests, useConceptTestResponses } from '../lib/hooks';
import type { ConceptTest, ConceptQuestion, ConceptResponse } from '../lib/database';
import { Megaphone, Trophy, MessageSquare, Users } from 'lucide-react';

export function ConceptTestAnalysis() {
  const { data: tests = [], isLoading } = useAdminConceptTests();
  const [selectedTestId, setSelectedTestId] = useState('');
  const activeTestId = selectedTestId || tests[0]?.id || '';
  const selectedTest = tests.find(t => t.id === activeTestId);
  const { data: responses = [], isLoading: responsesLoading } = useConceptTestResponses(activeTestId || undefined);

  if (isLoading) {
    return <div className="text-center py-16 text-slate-500">Loading concept tests…</div>;
  }

  if (tests.length === 0) {
    return (
      <Card className="border-2 border-dashed border-orange-200">
        <CardContent className="pt-12 pb-12 text-center">
          <Megaphone className="size-16 text-orange-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">No concept tests yet</h3>
          <p className="text-slate-600">
            Launch a concept test from the Concept Lab to see panelist feedback here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b">
          <CardTitle className="text-lg">Select Concept Test</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tests.map(test => {
              const isSelected = test.id === activeTestId;
              return (
                <button
                  key={test.id}
                  onClick={() => setSelectedTestId(test.id)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    isSelected ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-orange-300 bg-white'
                  }`}
                >
                  <div className="font-bold text-slate-900 text-sm leading-tight truncate">{test.name}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="outline" className="text-[10px]">{test.category}</Badge>
                    <Badge className={`text-[10px] text-white ${
                      test.status === 'active' ? 'bg-emerald-500' : test.status === 'completed' ? 'bg-slate-500' : 'bg-amber-500'
                    }`}>
                      {test.status}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {responsesLoading ? (
        <div className="text-center py-16 text-slate-500">Loading responses…</div>
      ) : !selectedTest || responses.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-200">
          <CardContent className="pt-12 pb-12 text-center">
            <Users className="size-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-700 mb-1">No responses yet</h3>
            <p className="text-slate-500 text-sm">
              Results will appear here once panelists complete <strong>{selectedTest?.name ?? 'this test'}</strong>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ConceptResultsPanel test={selectedTest} responses={responses} />
      )}
    </div>
  );
}

function ConceptResultsPanel({ test, responses }: { test: ConceptTest; responses: ConceptResponse[] }) {
  const validImages = test.imageUrls.filter(u => u.trim());

  return (
    <div className="space-y-4">
      <Card className="border-2 border-orange-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Users className="size-8 text-orange-500" />
            <div>
              <div className="text-2xl font-bold text-slate-900">{responses.length}</div>
              <div className="text-sm text-slate-600">Panelist responses</div>
              <div className="text-xs text-slate-500">of {test.panelSize} invited to {test.name}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {test.questions.map(question => (
          <QuestionResultCard key={question.id} question={question} responses={responses} images={validImages} />
        ))}
      </div>
    </div>
  );
}

function QuestionResultCard({
  question, responses, images,
}: {
  question: ConceptQuestion;
  responses: ConceptResponse[];
  images: string[];
}) {
  const answered = responses.filter(r => {
    const v = r.answers[question.id];
    if (v === undefined || v === null) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  });
  const n = answered.length;

  return (
    <Card className="border border-slate-200">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-slate-900 leading-snug">{question.text}</p>
          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">
            {n} response{n !== 1 ? 's' : ''}
          </span>
        </div>

        {n === 0 ? (
          <p className="text-xs text-slate-400 italic">No answers yet.</p>
        ) : question.type === 'scale' ? (
          <ScaleResults values={answered.map(r => Number(r.answers[question.id]))} />
        ) : question.type === 'multiple_choice' ? (
          <ChoiceResults answers={answered.map(r => r.answers[question.id] as string | string[])} />
        ) : question.type === 'ranking' ? (
          <RankingResults answers={answered.map(r => r.answers[question.id] as string[])} options={question.options ?? []} />
        ) : question.type === 'image_choice' ? (
          <ImageChoiceResults answers={answered.map(r => r.answers[question.id] as string)} images={images} />
        ) : (
          <OpenTextResults answers={answered.map(r => String(r.answers[question.id]))} />
        )}
      </CardContent>
    </Card>
  );
}

function ChartTooltip({ render }: { render: (payload: Record<string, unknown>) => ReactNode }) {
  return ({ active, payload }: { active?: boolean; payload?: Array<{ payload: Record<string, unknown> }> }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white px-3 py-2 shadow-lg rounded-lg border text-xs">
        {render(payload[0].payload)}
      </div>
    );
  };
}

function ScaleResults({ values }: { values: number[] }) {
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(rating => ({
    rating: String(rating),
    count: values.filter(v => v === rating).length,
  }));
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-orange-600">{avg.toFixed(1)}</span>
        <span className="text-xs text-slate-500">average · {values.length} rating{values.length !== 1 ? 's' : ''} (1–9 scale)</span>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="rating" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
          <RechartsTooltip
            content={ChartTooltip({
              render: d => (
                <>
                  <p className="font-semibold text-slate-900">Rating {String(d.rating)}</p>
                  <p className="text-slate-600">{String(d.count)} response{Number(d.count) !== 1 ? 's' : ''}</p>
                </>
              ),
            })}
          />
          <Bar dataKey="count" fill="#fb923c" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChoiceResults({ answers }: { answers: (string | string[])[] }) {
  const tally = new Map<string, number>();
  let total = 0;
  answers.forEach(a => {
    const picks = Array.isArray(a) ? a : [a];
    picks.forEach(p => {
      tally.set(p, (tally.get(p) ?? 0) + 1);
      total += 1;
    });
  });
  const data = Array.from(tally.entries())
    .map(([opt, count]) => ({ opt, count, pct: Math.round((count / Math.max(1, total)) * 100) }))
    .sort((a, b) => b.count - a.count);
  return (
    <ResponsiveContainer width="100%" height={Math.max(80, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="opt" width={150} tick={{ fontSize: 11 }} tickLine={false} />
        <RechartsTooltip
          content={ChartTooltip({
            render: d => (
              <>
                <p className="font-semibold text-slate-900">{String(d.opt)}</p>
                <p className="text-slate-600">{String(d.count)} pick{Number(d.count) !== 1 ? 's' : ''} ({String(d.pct)}%)</p>
              </>
            ),
          })}
        />
        <Bar dataKey="count" fill="#fb923c" radius={[0, 3, 3, 0]} isAnimationActive={false}>
          <LabelList dataKey="pct" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function RankingResults({ answers, options }: { answers: string[][]; options: string[] }) {
  const stats = new Map<string, { sum: number; n: number; firstPlace: number }>();
  answers.forEach(ranking => {
    ranking.forEach((opt, idx) => {
      const s = stats.get(opt) ?? { sum: 0, n: 0, firstPlace: 0 };
      s.sum += idx + 1;
      s.n += 1;
      if (idx === 0) s.firstPlace += 1;
      stats.set(opt, s);
    });
  });
  const data = (options.length > 0 ? options : Array.from(stats.keys()))
    .map(opt => {
      const s = stats.get(opt);
      return {
        opt,
        firstPlace: s?.firstPlace ?? 0,
        avgRank: s && s.n > 0 ? Number((s.sum / s.n).toFixed(1)) : null,
      };
    })
    .sort((a, b) => b.firstPlace - a.firstPlace);
  return (
    <ResponsiveContainer width="100%" height={Math.max(80, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 80, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} hide />
        <YAxis type="category" dataKey="opt" width={150} tick={{ fontSize: 11 }} tickLine={false} />
        <RechartsTooltip
          content={ChartTooltip({
            render: d => (
              <>
                <p className="font-semibold text-slate-900">{String(d.opt)}</p>
                <p className="text-slate-600">
                  {String(d.firstPlace)} first-place pick{Number(d.firstPlace) !== 1 ? 's' : ''} · avg rank {d.avgRank != null ? String(d.avgRank) : '—'}
                </p>
              </>
            ),
          })}
        />
        <Bar dataKey="firstPlace" fill="#f59e0b" radius={[0, 3, 3, 0]} isAnimationActive={false}>
          <LabelList
            dataKey="avgRank"
            position="right"
            formatter={(v: number | null) => v != null ? `avg rank ${v}` : ''}
            style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ImageChoiceResults({ answers, images }: { answers: string[]; images: string[] }) {
  if (images.length === 0) {
    return <p className="text-xs text-slate-400 italic">No concept visuals were attached to this test.</p>;
  }
  const tally = new Map<string, number>();
  answers.forEach(url => tally.set(url, (tally.get(url) ?? 0) + 1));
  const total = answers.length;
  const entries = images
    .map((url, index) => ({ url, index, count: tally.get(url) ?? 0 }))
    .sort((a, b) => b.count - a.count);
  const winner = entries[0];

  return (
    <div className="space-y-3">
      {winner && winner.count > 0 && (
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 w-fit">
          <Trophy className="size-3.5" />
          Option {winner.index + 1} is the panel favorite — picked by {winner.count} of {total} ({Math.round((winner.count / total) * 100)}%)
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {entries.map(({ url, index, count }) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isWinner = !!winner && url === winner.url && count > 0;
          return (
            <div key={`${url}-${index}`} className={`relative rounded-lg overflow-hidden border-2 ${isWinner ? 'border-amber-400 shadow-md' : 'border-slate-200'}`}>
              <img src={url} alt={`Concept visual ${index + 1}`} className="w-full aspect-square object-cover" />
              {isWinner && (
                <span className="absolute top-1.5 right-1.5 flex items-center justify-center rounded-full bg-amber-400 p-1 text-white shadow-sm">
                  <Trophy className="size-3" />
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-slate-950/75 px-1.5 py-1">
                <div className="flex items-center justify-between text-[10px] font-semibold text-white">
                  <span>Option {index + 1}</span>
                  <span>{count} vote{count !== 1 ? 's' : ''} ({pct}%)</span>
                </div>
                <div className="mt-1 h-1 bg-white/25 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OpenTextResults({ answers }: { answers: string[] }) {
  return (
    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
      {answers.map((text, i) => (
        <div key={i} className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 rounded-md px-2.5 py-1.5">
          <MessageSquare className="size-3 text-slate-400 mt-0.5 flex-shrink-0" />
          <span>{text}</span>
        </div>
      ))}
    </div>
  );
}
