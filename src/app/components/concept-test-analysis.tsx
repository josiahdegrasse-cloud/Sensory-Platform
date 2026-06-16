import { useState, type ReactNode } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { StageEmptyState } from './stage-empty-state';
import { DataProvenanceBadge } from './data-provenance-badge';
import { useAdminConceptTests, useConceptTestResponses } from '../lib/hooks';
import type { ConceptTest, ConceptQuestion, ConceptResponse } from '../lib/database';
import {
  AlertTriangle, CheckCircle2, Megaphone, MessageSquare, ShoppingBag, Sparkles, Target, Trophy, Users,
} from 'lucide-react';
import { InsightInterpretationBlock } from './insights-ui';
import { TEMPORARY_CHEESE_DEMO_LABEL } from '../data/temporary-cheese-demo';
import { summarizeConceptResponses } from '../lib/commercialization-report';

const CONCEPT_ACCENT = '#2563eb';

export function ConceptTestAnalysis({ projectTests, minimumResponses = 12 }: {
  projectTests?: ConceptTest[];
  minimumResponses?: number;
}) {
  const { data: allTests = [], isLoading } = useAdminConceptTests();
  const tests = projectTests ?? allTests;
  const [selectedTestId, setSelectedTestId] = useState('');
  const activeTestId = tests.some(test => test.id === selectedTestId)
    ? selectedTestId
    : tests[0]?.id || '';
  const selectedTest = tests.find(t => t.id === activeTestId);
  const { data: responses = [], isLoading: responsesLoading } = useConceptTestResponses(activeTestId || undefined);

  if (isLoading) {
    return <div className="text-center py-16 text-slate-500">Loading concept tests…</div>;
  }

  if (tests.length === 0) {
    return (
      <StageEmptyState
        icon={Megaphone}
        headline="No concept tests yet"
        body="Launch a concept test from the Concept Lab to see panelist feedback here."
        cta={{ label: 'Open Concept Lab', to: '/concept-testing' }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg">Choose a concept test</CardTitle>
          <p className="text-sm text-slate-600">Select a launched concept to update every result below.</p>
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
                    isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'
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
        <StageEmptyState
          icon={Users}
          headline="No responses yet"
          body={`Results will appear here once panelists complete ${selectedTest?.name ?? 'this test'}.`}
          locked
        />
      ) : (
        <ConceptResultsPanel test={selectedTest} responses={responses} minimumResponses={minimumResponses} />
      )}
    </div>
  );
}

function ConceptResultsPanel({ test, responses, minimumResponses }: {
  test: ConceptTest;
  responses: ConceptResponse[];
  minimumResponses: number;
}) {
  const validImages = test.imageUrls.filter(u => u.trim());
  const evidenceIsLimited = responses.length < minimumResponses;
  const summary = summarizeConceptResponses(test.questions, responses);
  const strongestScale = [...summary.scaleMetrics].sort((a, b) => b.average - a.average)[0];
  const weakestScale = [...summary.scaleMetrics].sort((a, b) => a.average - b.average)[0];
  const topSelection = summary.topSelections[0];
  const appealMetric = findMetric(summary.scaleMetrics, ['appeal', 'like', 'overall']);
  const purchaseScaleMetric = findMetric(summary.scaleMetrics, ['purchase', 'buy', 'intent']);
  const purchaseMetric = summary.purchaseIntent != null
    ? {
        question: purchaseScaleMetric?.question ?? 'Purchase intent',
        average: summary.purchaseIntent,
        count: purchaseScaleMetric?.count ?? responses.length,
      }
    : purchaseScaleMetric;
  const conceptContext = [
    test.projectName ? `Project: ${test.projectName}` : null,
    test.foodTypeSlug ? `Sample type: ${humanizeLabel(test.foodTypeSlug)}` : null,
    test.category ? `Category: ${test.category}` : null,
  ].filter((item): item is string => Boolean(item));
  const groupedQuestions = groupConceptQuestions(test.questions);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border border-slate-200">
        <div className="border-b border-blue-100 bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-blue-600 text-white">Concept results</Badge>
                <Badge variant="outline">{test.status}</Badge>
                {test.approvalNotes === TEMPORARY_CHEESE_DEMO_LABEL && (
                  <Badge className="border border-amber-200 bg-amber-50 text-amber-800">Temporary demo responses</Badge>
                )}
              </div>
              <h3 className="mt-3 text-xl font-bold text-slate-950">{test.name}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">{test.description}</p>
              {conceptContext.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                  {conceptContext.map(item => (
                    <span key={item} className="rounded-full border border-slate-200 bg-white px-3 py-1">{item}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm lg:min-w-[14rem]">
              <DataProvenanceBadge provenance="live" n={responses.length} />
              <div className="mt-3 text-3xl font-bold text-slate-950">{responses.length}</div>
              <p className="text-sm text-slate-600">of {test.panelSize} invited panelists responded</p>
            </div>
          </div>
        </div>

        <CardContent className="space-y-5 pt-5">
          <div className="grid gap-3 md:grid-cols-3">
            <ConceptMetricCard
              icon={Users}
              label="Evidence coverage"
              value={`${responses.length}/${minimumResponses}`}
              detail={responses.length >= minimumResponses ? 'Meets decision minimum' : 'Needs more responses'}
              tone={responses.length >= minimumResponses ? 'success' : 'warning'}
            />
            <ConceptMetricCard
              icon={Sparkles}
              label="Appeal signal"
              value={appealMetric ? `${appealMetric.average.toFixed(1)}/9` : '—'}
              detail={appealMetric ? `${appealMetric.count} rated · ${shortQuestion(appealMetric.question)}` : 'No appeal scale found'}
              tone={appealMetric && appealMetric.average >= 7 ? 'success' : 'neutral'}
            />
            <ConceptMetricCard
              icon={ShoppingBag}
              label="Purchase intent"
              value={purchaseMetric ? `${purchaseMetric.average.toFixed(1)}/9` : '—'}
              detail={purchaseMetric ? `${purchaseMetric.count} rated · directional` : 'No purchase question found'}
              tone={purchaseMetric && purchaseMetric.average >= 7 ? 'success' : 'neutral'}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <SignalCard
              icon={Trophy}
              eyebrow="Strongest signal"
              title={strongestScale ? `${shortQuestion(strongestScale.question)}: ${strongestScale.average.toFixed(1)}/9` : topSelection ? topSelection.option : 'No signal yet'}
              body={strongestScale
                ? `${strongestScale.count} panelists answered this scale question.`
                : topSelection
                  ? `${topSelection.count} picks (${topSelection.percentage}%) make this the leading response.`
                  : 'Responses have not established a clear concept strength yet.'}
            />
            <SignalCard
              icon={Target}
              eyebrow="Message to use"
              title={topSelection ? topSelection.option : test.keyBenefits || 'Benefit language pending'}
              body={topSelection
                ? 'Use this as the first copy direction to explore, not a final product claim.'
                : 'The concept needs choice or benefit responses before the strongest message is clear.'}
            />
            <SignalCard
              icon={evidenceIsLimited ? AlertTriangle : CheckCircle2}
              eyebrow={evidenceIsLimited ? 'Evidence gap' : 'Decision readiness'}
              title={evidenceIsLimited ? `Collect ${Math.max(0, minimumResponses - responses.length)} more responses` : 'Enough responses for a first read'}
              body={evidenceIsLimited
                ? 'Treat concept preference and purchase intent as directional until the response minimum is met.'
                : weakestScale
                  ? `Watch the lowest scale: ${shortQuestion(weakestScale.question)} at ${weakestScale.average.toFixed(1)}/9.`
                  : 'Use the question detail below to confirm the launch story.'}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Concept setup</p>
            <dl className="mt-3 grid gap-3 text-sm md:grid-cols-3">
              <DefinitionItem label="Target market" value={test.targetMarket || 'Not defined'} />
              <DefinitionItem label="Price point" value={test.pricePoint || 'Not defined'} />
              <DefinitionItem label="Key benefits" value={test.keyBenefits || 'Not defined'} />
            </dl>
          </div>
        </CardContent>
      </Card>

      {evidenceIsLimited && (
        <InsightInterpretationBlock
          tone="warning"
          finding="Concept feedback is directional, not representative."
          evidence={`${responses.length} of ${test.panelSize} invited panelists have responded.`}
          confidence={responses.length === 1 ? 'Low because only one response is available.' : `Limited until at least ${minimumResponses} responses are available.`}
          action="Collect more concept responses before naming a winning direction or using purchase intent as representative evidence."
        />
      )}

      <Card className="border border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base">Question breakdown</CardTitle>
          <p className="text-sm text-slate-600">
            Results are grouped by job so appeal, purchase intent, message preference, visual direction, and comments do not blur together.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
          {groupedQuestions.map(group => (
            <section key={group.id} className="space-y-3">
              <div>
                <h4 className="text-sm font-bold text-slate-950">{group.title}</h4>
                <p className="text-xs text-slate-500">{group.description}</p>
              </div>
              <div className="grid gap-3">
                {group.questions.map(question => (
                  <QuestionResultCard
                    key={question.id}
                    question={question}
                    responses={responses}
                    images={validImages}
                    evidenceIsLimited={evidenceIsLimited}
                  />
                ))}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ConceptMetricCard({
  icon: Icon, label, value, detail, tone = 'neutral',
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const toneClass = tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-blue-100 bg-blue-50 text-blue-700';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className={`mb-3 inline-flex rounded-lg border p-2 ${toneClass}`}>
        <Icon className="size-4" aria-hidden />
      </div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function SignalCard({
  icon: Icon, eyebrow, title, body,
}: {
  icon: typeof Trophy;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        <Icon className="size-4 text-blue-600" aria-hidden />
        {eyebrow}
      </div>
      <p className="mt-2 text-sm font-bold text-slate-950">{title}</p>
      <p className="mt-1 text-sm leading-5 text-slate-600">{body}</p>
    </div>
  );
}

function DefinitionItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium leading-5 text-slate-800">{value}</dd>
    </div>
  );
}

function findMetric(
  metrics: Array<{ question: string; average: number; count: number }>,
  terms: string[],
) {
  return metrics.find(metric => terms.some(term => metric.question.toLowerCase().includes(term)));
}

function shortQuestion(text: string) {
  return text
    .replace(/\?$/, '')
    .replace(/^how much do you /i, '')
    .replace(/^how likely are you to /i, '')
    .replace(/^which /i, '')
    .trim();
}

function humanizeLabel(value: string) {
  return value.replace(/[-_]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function groupConceptQuestions(questions: ConceptQuestion[]) {
  const groupDefs = [
    {
      id: 'appeal',
      title: 'Appeal and purchase read',
      description: 'Scale questions that show whether the concept is liked and commercially interesting.',
      matches: (question: ConceptQuestion) => question.type === 'scale',
    },
    {
      id: 'message',
      title: 'Message and benefit preference',
      description: 'Choice questions that reveal which claims, benefits, or positioning angles are resonating.',
      matches: (question: ConceptQuestion) => question.type === 'multiple_choice' || question.type === 'ranking',
    },
    {
      id: 'visual',
      title: 'Visual direction',
      description: 'Packaging or image choices tied to the concept shown to panelists.',
      matches: (question: ConceptQuestion) => question.type === 'image_choice',
    },
    {
      id: 'comments',
      title: 'Panelist language',
      description: 'Open text that can become copy inspiration, objections, or follow-up questions.',
      matches: (question: ConceptQuestion) => question.type === 'open_text',
    },
  ];

  return groupDefs
    .map(group => ({ ...group, questions: questions.filter(group.matches) }))
    .filter(group => group.questions.length > 0);
}

function QuestionResultCard({
  question, responses, images, evidenceIsLimited,
}: {
  question: ConceptQuestion;
  responses: ConceptResponse[];
  images: string[];
  evidenceIsLimited: boolean;
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
          <ImageChoiceResults answers={answered.map(r => r.answers[question.id] as string)} images={images} evidenceIsLimited={evidenceIsLimited} />
        ) : (
          <OpenTextResults answers={answered.map(r => String(r.answers[question.id]))} />
        )}
      </CardContent>
    </Card>
  );
}

function ChartTooltip({ render }: { render: (payload: Record<string, unknown>) => ReactNode }) {
  return ({ active, payload }: { active?: boolean; payload?: Array<{ payload?: Record<string, unknown> }> }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white px-3 py-2 shadow-lg rounded-lg border text-xs">
        {render(payload[0].payload ?? {})}
      </div>
    );
  };
}

function LeadingOptionBadge({ label, detail }: { label: string; detail: string }) {
  return (
    <Badge className="border border-blue-200 bg-blue-50 text-blue-800">
      <Trophy className="size-3" aria-hidden />
      {label}: {detail}
    </Badge>
  );
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
        <span className="text-2xl font-bold text-blue-700">{avg.toFixed(1)}</span>
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
          <Bar dataKey="count" fill={CONCEPT_ACCENT} radius={[3, 3, 0, 0]} isAnimationActive={false} />
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
  const leading = data[0];
  return (
    <div className="space-y-3">
      {leading && <LeadingOptionBadge label="Leading response" detail={`${leading.opt} (${leading.pct}%)`} />}
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
          <Bar dataKey="count" fill={CONCEPT_ACCENT} radius={[0, 3, 3, 0]} isAnimationActive={false}>
            <LabelList dataKey="pct" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
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
  const leading = data[0];
  return (
    <div className="space-y-3">
      {leading && leading.firstPlace > 0 && (
        <LeadingOptionBadge label="Most first-place selections" detail={`${leading.opt} (${leading.firstPlace})`} />
      )}
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
          <Bar dataKey="firstPlace" fill={CONCEPT_ACCENT} radius={[0, 3, 3, 0]} isAnimationActive={false}>
            <LabelList
              dataKey="avgRank"
              position="right"
              formatter={(v: number | null) => v != null ? `avg rank ${v}` : ''}
              style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ImageChoiceResults({ answers, images, evidenceIsLimited }: {
  answers: string[];
  images: string[];
  evidenceIsLimited: boolean;
}) {
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
        <LeadingOptionBadge
          label={evidenceIsLimited ? 'Current leading direction' : 'Leading visual'}
          detail={`Option ${winner.index + 1}, ${winner.count} of ${total} selections (${Math.round((winner.count / total) * 100)}%)`}
        />
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {entries.map(({ url, index, count }) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isWinner = !!winner && url === winner.url && count > 0;
          return (
            <div key={`${url}-${index}`} className={`relative rounded-lg overflow-hidden border-2 ${isWinner ? 'border-blue-500 shadow-md' : 'border-slate-200'}`}>
              <img src={url} alt={`Concept test visual option ${index + 1}`} className="w-full aspect-square object-cover" />
              {isWinner && (
                <span className="absolute top-1.5 right-1.5 flex items-center justify-center rounded-full bg-blue-600 p-1 text-white shadow-sm" aria-label="Leading visual">
                  <Trophy className="size-3" aria-hidden />
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-slate-950/75 px-1.5 py-1">
                <div className="flex items-center justify-between text-[10px] font-semibold text-white">
                  <span>Option {index + 1}</span>
                  <span>{count} vote{count !== 1 ? 's' : ''} ({pct}%)</span>
                </div>
                <div className="mt-1 h-1 bg-white/25 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
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
