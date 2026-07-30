import { useMemo, useState, type ReactNode } from 'react';
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
  AlertTriangle, CheckCircle2, ChevronDown, FileDown, Layers, Megaphone, MessageSquare, Search, ShoppingBag, Sparkles, Star, Target, Trophy, Users,
} from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../contexts/auth-context';
import { useAdoptBrandKit, useWorkspaceSettings } from '../lib/hooks';
import { downloadConceptBoardPdf } from '../utils/concept-board-export';
import { InsightInterpretationBlock } from './insights-ui';
import { TEMPORARY_CHEESE_DEMO_LABEL } from '../data/demo/temporary-cheese-demo';
import { summarizeConceptResponses } from '../lib/commercialization-report';

const CONCEPT_ACCENT = '#2563eb';

export function ConceptTestAnalysis({ projectTests, minimumResponses = 12 }: {
  projectTests?: ConceptTest[];
  minimumResponses?: number;
}) {
  const { data: allTests = [], isLoading } = useAdminConceptTests();
  const tests = projectTests ?? allTests;
  const [selectedTestId, setSelectedTestId] = useState('');
  const [testQuery, setTestQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ConceptTest['status']>('all');
  const [testSort, setTestSort] = useState<'newest' | 'name' | 'status'>('newest');
  const activeTestId = tests.some(test => test.id === selectedTestId)
    ? selectedTestId
    : tests[0]?.id || '';
  const selectedTest = tests.find(t => t.id === activeTestId);
  const { data: responses = [], isLoading: responsesLoading } = useConceptTestResponses(activeTestId || undefined);
  const visibleTests = useMemo(() => {
    const query = testQuery.trim().toLowerCase();
    return [...tests]
      .filter(test => (
        (statusFilter === 'all' || test.status === statusFilter)
        && (
          !query
          || test.name.toLowerCase().includes(query)
          || test.category.toLowerCase().includes(query)
          || test.projectName?.toLowerCase().includes(query)
        )
      ))
      .sort((a, b) => {
        if (testSort === 'name') return a.name.localeCompare(b.name);
        if (testSort === 'status') return a.status.localeCompare(b.status) || a.name.localeCompare(b.name);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [statusFilter, testQuery, testSort, tests]);

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
    <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="self-start overflow-hidden rounded-xl border border-slate-200 bg-white lg:sticky lg:top-24">
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-900">Concept tests</h3>
          <p className="mt-1 text-xs text-slate-500">Filter the study list, then inspect one concept at a time.</p>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" aria-hidden />
            <input
              value={testQuery}
              onChange={event => setTestQuery(event.target.value)}
              placeholder="Search concepts"
              aria-label="Search concept tests"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}
              aria-label="Filter concept tests by status"
              className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="approved">Approved</option>
              <option value="review">In review</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={testSort}
              onChange={event => setTestSort(event.target.value as typeof testSort)}
              aria-label="Sort concept tests"
              className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="newest">Newest</option>
              <option value="name">Name</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>
        <div className="max-h-[32rem] space-y-1 overflow-y-auto p-2">
            {visibleTests.map(test => {
              const isSelected = test.id === activeTestId;
              return (
                <button
                  key={test.id}
                  onClick={() => setSelectedTestId(test.id)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={`w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isSelected ? 'border-blue-200 bg-blue-50' : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className={`truncate text-sm font-bold ${isSelected ? 'text-blue-950' : 'text-slate-900'}`}>{test.name}</div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="truncate">{test.category}</span>
                    <span className="shrink-0 capitalize">{test.status}</span>
                  </div>
                </button>
              );
            })}
            {visibleTests.length === 0 && (
              <p className="px-3 py-8 text-center text-xs text-slate-500">No concept tests match these filters.</p>
            )}
        </div>
      </aside>

      <div className="min-w-0">
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
    </div>
  );
}

function ConceptResultsPanel({ test, responses, minimumResponses }: {
  test: ConceptTest;
  responses: ConceptResponse[];
  minimumResponses: number;
}) {
  const validImages = test.imageUrls.filter(u => u.trim());
  // URL/id pairs stay index-aligned so a panel-winning visual can be traced
  // back to its concept_images row (and adopted as the company brand kit).
  const validImagePairs = test.imageUrls
    .map((url, index) => ({ url, id: test.imageIds?.[index] ?? '' }))
    .filter(pair => pair.url.trim());
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
        <div className="border-b border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-blue-600 text-white">Concept results</Badge>
                <Badge variant="outline">{test.status}</Badge>
                {test.approvalNotes === TEMPORARY_CHEESE_DEMO_LABEL && (
                  <Badge className="border border-amber-200 bg-amber-50 text-amber-800">Temporary demo responses</Badge>
                )}
              </div>
              <h3 className="mt-3 text-xl font-bold text-slate-900">{test.name}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-700">{test.description}</p>
              {conceptContext.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                  {conceptContext.map(item => (
                    <span key={item} className="rounded-full border border-slate-200 bg-white px-3 py-1">{item}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 lg:min-w-[14rem]">
              <DataProvenanceBadge provenance="live" n={responses.length} />
              <div className="mt-3 text-3xl font-bold text-slate-900">{responses.length}</div>
              <p className="text-sm text-slate-700">of {test.panelSize} invited panelists responded</p>
            </div>
          </div>
        </div>

        <CardContent className="space-y-5 pt-5">
          <div className="grid overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-slate-100">
            <ConceptMetric
              label="Evidence coverage"
              value={`${responses.length}/${minimumResponses}`}
              detail={responses.length >= minimumResponses ? 'Meets decision minimum' : `${Math.max(0, minimumResponses - responses.length)} more needed`}
              icon={Users}
            />
            <ConceptMetric
              label="Appeal"
              value={appealMetric ? `${appealMetric.average.toFixed(1)}/9` : '—'}
              detail={appealMetric ? `${appealMetric.count} ratings` : 'Question not found'}
              icon={Sparkles}
            />
            <ConceptMetric
              label="Purchase intent"
              value={purchaseMetric ? `${purchaseMetric.average.toFixed(1)}/9` : '—'}
              detail={purchaseMetric ? `${purchaseMetric.count} ratings, directional` : 'Question not found'}
              icon={ShoppingBag}
            />
          </div>

          <div className="rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 px-4 py-3">
              <h4 className="text-sm font-bold text-slate-900">Food developer read</h4>
              <p className="mt-0.5 text-xs text-slate-500">Translate concept feedback into what to keep, change, and validate next.</p>
            </div>
            <dl className="divide-y divide-slate-100 px-4">
              <DeveloperReadRow
                icon={Trophy}
                label="Protect"
                title={strongestScale ? `${shortQuestion(strongestScale.question)}: ${strongestScale.average.toFixed(1)}/9` : topSelection ? topSelection.option : 'No clear strength yet'}
                body={strongestScale
                  ? `${strongestScale.count} panelists rated this dimension.`
                  : topSelection
                    ? `${topSelection.count} selections (${topSelection.percentage}%) make this the current lead.`
                    : 'More responses are needed before preserving a specific concept element.'}
              />
              <DeveloperReadRow
                icon={Target}
                label="Build the story around"
                title={topSelection ? topSelection.option : test.keyBenefits || 'Benefit language pending'}
                body={topSelection
                  ? 'Use this as the first message direction to develop and validate, not as a finished claim.'
                  : 'Choice and ranking responses have not established a leading message yet.'}
              />
              <DeveloperReadRow
                icon={evidenceIsLimited ? AlertTriangle : CheckCircle2}
                label={evidenceIsLimited ? 'Validate next' : 'Watch during development'}
                title={evidenceIsLimited
                  ? `Collect ${Math.max(0, minimumResponses - responses.length)} more responses`
                  : weakestScale
                    ? `${shortQuestion(weakestScale.question)}: ${weakestScale.average.toFixed(1)}/9`
                    : 'Confirm the concept story in the question detail'}
                body={evidenceIsLimited
                  ? 'Keep preference and purchase conclusions directional until the response minimum is met.'
                  : 'Use the detailed responses below to identify the weakest part of the proposition.'}
              />
            </dl>
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
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="text-base">Detailed evidence</CardTitle>
          <p className="text-sm text-slate-700">
            Open only the evidence area you need. Each group keeps its response coverage attached.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          {groupedQuestions.map((group, index) => (
            <details key={group.id} open={index === 0} className="group rounded-xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                <span>
                  <span className="block text-sm font-bold text-slate-900">{group.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                    {group.description} · {group.questions.length} question{group.questions.length === 1 ? '' : 's'}
                  </span>
                </span>
                <ChevronDown className="mt-1 size-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-3">
                {group.questions.map(question => (
                    <QuestionResultCard
                      key={question.id}
                      question={question}
                      responses={responses}
                      images={validImages}
                      imagePairs={validImagePairs}
                      conceptName={test.name}
                      evidenceIsLimited={evidenceIsLimited}
                    />
                  ))}
              </div>
            </details>
          ))}
        </CardContent>
      </Card>

      {test.variantDimensions && (
        <PositioningAnalysisCard
          dims={test.variantDimensions}
          purchaseIntent={summary.purchaseIntent}
        />
      )}
    </div>
  );
}

function ConceptMetric({
  icon: Icon, label, value, detail,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-200 p-4 last:border-b-0 sm:border-b-0">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">
        <Icon className="size-4" aria-hidden />
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-700">{label}</p>
        <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">{value}</p>
        <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function DeveloperReadRow({
  icon: Icon, label, title, body,
}: {
  icon: typeof Trophy;
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div className="grid gap-2 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <dt className="flex items-center gap-2 text-xs font-bold text-slate-700">
        <Icon className="size-4 text-blue-600" aria-hidden />
        {label}
      </dt>
      <dd>
        <p className="text-sm font-bold text-slate-900">{title}</p>
        <p className="mt-1 text-sm leading-5 text-slate-700">{body}</p>
      </dd>
    </div>
  );
}

function DefinitionItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium leading-5 text-slate-700">{value}</dd>
    </div>
  );
}

function findMetric(
  metrics: Array<{ question: string; average: number; count: number }>,
  terms: string[],
) {
  return metrics.find(metric => terms.some(term => metric.question.toLowerCase().includes(term)));
}

const DIM_LABELS: Record<string, string> = {
  positioning: 'Brand positioning', visualComplexity: 'Visual complexity', appeal: 'Consumer appeal',
  channel: 'Primary channel', packagingFormat: 'Packaging format', brandColorScheme: 'Colour scheme',
  targetDemographic: 'Target demographic', pricePositioning: 'Price positioning',
};
const OPTION_LABELS: Record<string, string> = {
  premium: 'Premium', accessible: 'Accessible', value: 'Value', craft: 'Craft',
  functional: 'Functional', playful: 'Playful', heritage: 'Heritage', disruptive: 'Disruptive',
  minimal: 'Minimal', expressive: 'Expressive', ingredient_led: 'Ingredient-led',
  clinical: 'Clinical', editorial: 'Editorial', abundant: 'Abundant',
  health: 'Health-focused', indulgent: 'Indulgent', taste_first: 'Taste-first',
  convenience: 'Convenience', sustainable: 'Sustainable', family_friendly: 'Family-friendly',
  adventurous: 'Adventurous',
  retail: 'Retail shelf', lifestyle: 'Lifestyle / DTC', ecommerce: 'Ecommerce',
  foodservice: 'Foodservice', buyer_deck: 'Buyer deck', club_store: 'Club store',
  young_active: 'Young & Active', family: 'Family', professional: 'Professional', senior: 'Senior',
  health_seeker: 'Health-seeker', parent: 'Parent', kid: 'Kid', flexitarian: 'Flexitarian',
  foodie: 'Foodie', budget_shopper: 'Budget shopper', retail_buyer: 'Retail buyer',
  budget: 'Budget', mainstream: 'Mainstream', ultra_premium: 'Ultra-premium',
  trial_size: 'Trial size', bulk_value: 'Bulk value',
  earthy: 'Earthy', vibrant: 'Vibrant', minimalist: 'Minimalist',
  luxury: 'Luxury', bold: 'Bold', pastel: 'Pastel', fresh: 'Fresh',
  warm: 'Warm', cool: 'Cool', monochrome: 'Monochrome', natural: 'Natural',
  pouch: 'Pouch', block: 'Block', jar: 'Jar', can: 'Can', bottle: 'Bottle',
  sleeve: 'Sleeve', tray: 'Tray', tube: 'Tube', carton: 'Carton', box: 'Box',
  cup: 'Cup', wrapper: 'Wrapper', multipack: 'Multipack', sachet: 'Sachet',
};

function PositioningAnalysisCard({
  dims, purchaseIntent,
}: {
  dims: Record<string, string | null>;
  purchaseIntent: number | null | undefined;
}) {
  const set = Object.entries(DIM_LABELS).filter(([k]) => dims[k]);
  if (set.length === 0) return null;
  return (
    <Card className="border border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="size-4 text-slate-500" aria-hidden />
          Positioning profile
        </CardTitle>
        <p className="text-sm text-slate-700">Dimensions set for this concept variant.</p>
      </CardHeader>
      <CardContent className="pt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="pb-2 text-left text-xs font-semibold text-slate-500">Dimension</th>
              <th className="pb-2 text-left text-xs font-semibold text-slate-500">Value</th>
              <th className="pb-2 text-right text-xs font-semibold text-slate-500">Purchase intent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {set.map(([key, label]) => (
              <tr key={key}>
                <td className="py-2 text-slate-700">{label}</td>
                <td className="py-2">
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                    {OPTION_LABELS[dims[key]!] ?? dims[key]}
                  </span>
                </td>
                <td className="py-2 text-right font-semibold tabular-nums text-slate-900">
                  {purchaseIntent != null ? `${purchaseIntent.toFixed(1)}/9` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {purchaseIntent == null && (
          <p className="mt-3 text-xs text-slate-500 italic">Add a purchase intent question to see the outcome score here.</p>
        )}
      </CardContent>
    </Card>
  );
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
  question, responses, images, imagePairs, conceptName, evidenceIsLimited,
}: {
  question: ConceptQuestion;
  responses: ConceptResponse[];
  images: string[];
  imagePairs: Array<{ url: string; id: string }>;
  conceptName: string;
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
          <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full flex-shrink-0">
            {n} response{n !== 1 ? 's' : ''}
          </span>
        </div>

        {n === 0 ? (
          <p className="text-xs text-slate-500 italic">No answers yet.</p>
        ) : question.type === 'scale' ? (
          <ScaleResults values={answered.map(r => Number(r.answers[question.id]))} />
        ) : question.type === 'multiple_choice' ? (
          <ChoiceResults answers={answered.map(r => r.answers[question.id] as string | string[])} />
        ) : question.type === 'ranking' ? (
          <RankingResults answers={answered.map(r => r.answers[question.id] as string[])} options={question.options ?? []} />
        ) : question.type === 'image_choice' ? (
          <ImageChoiceResults
            answers={answered.map(r => r.answers[question.id] as string)}
            images={images}
            imagePairs={imagePairs}
            conceptName={conceptName}
            evidenceIsLimited={evidenceIsLimited}
          />
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
                  <p className="text-slate-700">{String(d.count)} response{Number(d.count) !== 1 ? 's' : ''}</p>
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
                  <p className="text-slate-700">{String(d.count)} pick{Number(d.count) !== 1 ? 's' : ''} ({String(d.pct)}%)</p>
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
                  <p className="text-slate-700">
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

function ImageChoiceResults({ answers, images, imagePairs, conceptName, evidenceIsLimited }: {
  answers: string[];
  images: string[];
  imagePairs: Array<{ url: string; id: string }>;
  conceptName: string;
  evidenceIsLimited: boolean;
}) {
  const { user } = useAuth();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const adoptBrandKit = useAdoptBrandKit();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  if (images.length === 0) {
    return <p className="text-xs text-slate-500 italic">No concept visuals were attached to this test.</p>;
  }
  const tally = new Map<string, number>();
  answers.forEach(url => tally.set(url, (tally.get(url) ?? 0) + 1));
  const total = answers.length;
  const entries = images
    .map((url, index) => ({ url, index, count: tally.get(url) ?? 0 }))
    .sort((a, b) => b.count - a.count);
  const winner = entries[0];
  // Evidence loop: a panel-validated winner can be promoted straight into the
  // company brand kit, so the next concept starts from proven preference —
  // not from scratch. Only offered on solid evidence (min responses met).
  const winnerImageId = winner ? (imagePairs.find(pair => pair.url === winner.url)?.id ?? '') : '';
  const winnerIsBrandKit = Boolean(winnerImageId) && workspaceSettings?.brandKit?.sourceImageId === winnerImageId;
  const canAdoptWinner = Boolean(winner && winner.count > 0 && winnerImageId && !evidenceIsLimited);

  const handleExportBoard = async () => {
    setExporting(true);
    setExportError('');
    try {
      await downloadConceptBoardPdf({
        conceptName,
        organizationName: workspaceSettings?.organizationName ?? '',
        contextLine: evidenceIsLimited
          ? `Directional preference read from ${total} panel response${total === 1 ? '' : 's'} — below the confidence threshold for a client-facing claim.`
          : `Panel preference from ${total} response${total === 1 ? '' : 's'}.`,
        images: entries.map(entry => ({
          url: entry.url,
          label: `Option ${entry.index + 1}`,
          sublabel: total > 0 ? `${entry.count} of ${total} selections (${Math.round((entry.count / total) * 100)}%)` : undefined,
          highlight: winner ? entry.url === winner.url && entry.count > 0 : false,
        })),
      });
    } catch {
      setExportError('Could not build the concept board PDF. Try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {winner && winner.count > 0 ? (
          <LeadingOptionBadge
            label={evidenceIsLimited ? 'Current leading direction' : 'Leading visual'}
            detail={`Option ${winner.index + 1}, ${winner.count} of ${total} selections (${Math.round((winner.count / total) * 100)}%)`}
          />
        ) : <span />}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canAdoptWinner && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={adoptBrandKit.isPending || winnerIsBrandKit}
              onClick={() => adoptBrandKit.mutate({
                imageId: winnerImageId,
                sourceConceptName: conceptName,
                actorId: user?.id ?? null,
              })}
              className="h-8 w-fit text-xs"
              title={`Panel-validated winner (${Math.round((winner.count / total) * 100)}% of ${total} selections) becomes the company brand reference for future concepts`}
            >
              <Star className="mr-1 size-3" />
              {winnerIsBrandKit
                ? 'Company brand'
                : adoptBrandKit.isPending ? 'Saving...' : 'Set winner as company brand'}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={exporting}
            onClick={handleExportBoard}
            className="h-8 w-fit text-xs"
            title="Download a one-page concept board with these visuals and their panel evidence"
          >
            <FileDown className="mr-1 size-3" />
            {exporting ? 'Building...' : 'Export concept board'}
          </Button>
        </div>
      </div>
      {exportError && <p className="text-xs text-rose-700">{exportError}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {entries.map(({ url, index, count }) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isWinner = !!winner && url === winner.url && count > 0;
          return (
            <div key={`${url}-${index}`} className={`relative rounded-lg overflow-hidden border-2 ${isWinner ? 'border-blue-500 shadow-md' : 'border-slate-200'}`}>
              <img src={url} alt={`Concept test visual option ${index + 1}`} loading="lazy" decoding="async" className="w-full aspect-square object-cover" />
              {isWinner && (
                <span className="absolute top-1.5 right-1.5 flex items-center justify-center rounded-full bg-blue-600 p-1 text-white shadow-sm" aria-label="Leading visual">
                  <Trophy className="size-3" aria-hidden />
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-slate-950/75 px-1.5 py-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-white">
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
        <div key={i} className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 rounded-md px-2.5 py-1.5">
          <MessageSquare className="size-3 text-slate-500 mt-0.5 flex-shrink-0" />
          <span>{text}</span>
        </div>
      ))}
    </div>
  );
}
