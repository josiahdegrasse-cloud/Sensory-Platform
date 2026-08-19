import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { AlertCircle, FlaskConical, RefreshCw } from 'lucide-react';
import type { EnhancedSensoryProfile } from '../data/enhanced-sensory';
import {
  buildTweakDiagnosisRequest,
  buildTweakEvidenceChain,
  filterTweakDisplayWarnings,
  type TweakDiagnosisResponse,
  type TweakEvidenceChain,
} from '../lib/tweak-intelligence';
import {
  useDecisionRecords,
  useFormulationVersions,
  useMarkDecisionResearchRefreshed,
  useTweakDiagnosis,
} from '../lib/hooks';
import { decisionRecordMatchesEvidence } from '../lib/decision-governance';
import type { GoStopTweakDecision } from '../utils/go-stop-tweak-engine';
import { CitationsList, type CitationListItem } from './shared/citations-list';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

type Props = {
  decision: GoStopTweakDecision;
  profile: EnhancedSensoryProfile | undefined;
  foodType: string;
  goThreshold?: number;
  embedded?: boolean;
};

type DecisionConnection = {
  focusLabel: string;
};

export function TweakIntelligencePanel({ decision, profile, foodType, goThreshold = 75, embedded = false }: Props) {
  const { projectId } = useParams<{ projectId?: string }>();
  const { data: formulationVersions = [] } = useFormulationVersions();
  const { data: decisionRecords = [] } = useDecisionRecords();
  const markResearchRefreshed = useMarkDecisionResearchRefreshed();
  const persistedDecision = decisionRecords.find(record => decisionRecordMatchesEvidence(record, {
    sampleId: decision.sampleId,
    decisionFingerprint: decision.decisionFingerprint,
    projectId: projectId ?? null,
  })) ?? null;
  const formulation = formulationVersions.find(version => (
    version.sampleId === decision.sampleId && version.isCurrent && version.reviewStatus === 'reviewed'
  )) ?? null;
  const request = useMemo(() => (
    profile ? buildTweakDiagnosisRequest({
      decision,
      profile,
      foodType,
      formulation,
      projectId,
      decisionRecordId: persistedDecision?.id,
      evidenceBundleId: persistedDecision?.evidenceBundleId,
      formulationVersionId: persistedDecision?.formulationVersionId,
    }) : null
  ), [decision, foodType, formulation, persistedDecision?.evidenceBundleId, persistedDecision?.formulationVersionId, persistedDecision?.id, profile, projectId]);
  const diagnosis = useTweakDiagnosis(request);
  const data = diagnosis.data;
  const visibleWarnings = filterTweakDisplayWarnings(data?.warnings ?? []);
  const connection = profile ? buildDecisionConnection(decision) : null;
  const evidenceChain = useMemo(() => (
    profile ? buildTweakEvidenceChain({ decision, profile, foodType, goThreshold }) : null
  ), [decision, foodType, goThreshold, profile]);
  const refreshResearch = async () => {
    const result = await diagnosis.refetch();
    if (result.data && persistedDecision?.id) {
      await markResearchRefreshed.mutateAsync({
        decisionRecordId: persistedDecision.id,
        researchFingerprint: `${result.data.metadata.generatedAt}:${result.data.metadata.sourceCount}`,
      });
    }
  };

  if (!profile || !request) {
    return (
      <section className={panelShellClass(embedded)}>
        <PanelHeader
          loading={false}
          focusLabel={connection?.focusLabel ?? decision.decision}
          onRefresh={undefined}
        />
        <EmptyState message="Tweak Intelligence needs the selected sample's sensory profile before it can build literature-backed guidance." />
      </section>
    );
  }

  return (
    <section className={panelShellClass(embedded)}>
      <PanelHeader
        loading={diagnosis.isFetching}
        focusLabel={connection?.focusLabel ?? decision.decision}
        onRefresh={() => void refreshResearch()}
        experimentPath={
          projectId && persistedDecision && decision.decision !== 'GO'
            ? `/project/${projectId}/decision/experiments?decision=${encodeURIComponent(persistedDecision.id)}`
            : undefined
        }
      />

      <div>
        {diagnosis.isError ? (
          <OfflineState onRetry={() => void diagnosis.refetch()} />
        ) : diagnosis.isLoading || !data ? (
          <LoadingState />
        ) : (
          <div className="divide-y divide-slate-200">
            {visibleWarnings.length > 0 && (
              <div className="bg-amber-50 px-5 py-4 text-sm text-amber-900">
                <div className="flex gap-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p>{visibleWarnings[0]}</p>
                </div>
              </div>
            )}

            {evidenceChain && <EvidenceChainSection chain={evidenceChain} />}
            <RecommendationAndDiagnosis data={data} connection={connection} />
            {evidenceChain && <ActionFirstSection data={data} chain={evidenceChain} />}
            <CitationsOnly data={data} />
          </div>
        )}
      </div>
    </section>
  );
}

function panelShellClass(embedded: boolean) {
  return embedded
    ? 'overflow-hidden rounded-lg border border-slate-200 bg-white'
    : 'overflow-hidden rounded-xl border border-slate-200 bg-white';
}

function PanelHeader({
  loading,
  focusLabel,
  onRefresh,
  experimentPath,
}: {
  loading: boolean;
  focusLabel: string;
  onRefresh: (() => void) | undefined;
  experimentPath?: string;
}) {
  return (
    <header className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FlaskConical className="size-4 text-slate-700" />
            Literature-backed workplan
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">Separates measured evidence from literature-backed hypotheses for {focusLabel.toLowerCase()}.</p>
        </div>
        <div className="flex items-center gap-2">
          {experimentPath && (
            <Button asChild type="button" variant="outline" size="sm">
              <Link to={experimentPath}>
                <FlaskConical className="size-4" />
                Build experiment
              </Link>
            </Button>
          )}
          {onRefresh && (
            <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Updating' : 'Refresh'}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="m-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">{message}</p>;
}

function OfflineState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="m-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-700" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-950">Literature guidance is temporarily unavailable.</p>
          <p className="mt-1 text-sm leading-6 text-amber-900">
            The measured GO / TWEAK / STOP decision remains available. Retry the cited workplan or review the research-service status in the Literature workspace.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" className="border-amber-300 bg-white" onClick={onRetry}>
              <RefreshCw className="size-4" />
              Retry guidance
            </Button>
            <Button asChild type="button" size="sm" variant="ghost" className="text-amber-900 hover:bg-amber-100">
              <Link to="/literature">Open Literature status</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="px-5 py-5" role="status" aria-label="Building literature-backed recommendations">
      <span className="sr-only">Building literature-backed recommendations.</span>
      <div className="space-y-5" aria-hidden="true">
        <div className="space-y-2">
          <div className="h-3 w-32 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
          <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
          <div className="h-4 w-4/5 max-w-xl animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
        </div>
        <div className="divide-y divide-slate-100 border-y border-slate-200">
          {[0, 1, 2].map((item) => (
            <div key={item} className="space-y-2 py-4">
              <div className="h-4 w-2/5 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
              <div className="h-3 w-full max-w-3xl animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
              <div className="h-3 w-3/4 max-w-2xl animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionFirstSection({ data, chain }: { data: TweakDiagnosisResponse; chain: TweakEvidenceChain }) {
  const candidateInterventions = data.recommendations.slice(0, 3);
  return (
    <section className="px-5 py-4">
      <div className="max-w-5xl">
        <h3 className="text-sm font-semibold text-slate-900">Gated workplan</h3>
        <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
          <article className="flex gap-3 py-4">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">1</span>
            <div className="min-w-0 max-w-3xl">
              <h4 className="text-sm font-semibold leading-6 text-slate-900">Verify the driver before changing the formula</h4>
              <p className="mt-1 text-sm leading-6 text-slate-600">{chain.verification}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600"><span className="font-medium text-slate-700">Advance if:</span> the diagnostic links a specific measured cue to the failing decision dimension.</p>
            </div>
          </article>
          <article className="flex gap-3 py-4">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">2</span>
            <div className="min-w-0 max-w-3xl">
              <h4 className="text-sm font-semibold leading-6 text-slate-900">Run a scoped control-plus-variant screen</h4>
              <p className="mt-1 text-sm leading-6 text-slate-600">{chain.experimentScope}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600"><span className="font-medium text-slate-700">Measure:</span> use the same serving protocol and scorecard for every sample; predeclare the primary outcome, uncertainty margin, process records, and storage checkpoints.</p>
            </div>
          </article>
          <article className="flex gap-3 py-4">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">3</span>
            <div className="min-w-0 max-w-3xl">
              <h4 className="text-sm font-semibold leading-6 text-slate-900">Confirm the winner against explicit gates</h4>
              <ul className="mt-1 space-y-1 text-sm leading-6 text-slate-600">
                {chain.advancementGates.map(gate => <li key={gate}>• {gate}</li>)}
              </ul>
            </div>
          </article>
        </div>

        {candidateInterventions.length > 0 && (
          <div className="mt-5">
            <h4 className="text-sm font-semibold text-slate-900">Candidate mechanisms from the literature</h4>
            <p className="mt-1 text-xs leading-5 text-slate-500">These are options to test after Step 1, not established causes of the product result.</p>
            <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {candidateInterventions.map(recommendation => (
                <article key={`${recommendation.priority}-${recommendation.action}`} className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-0 bg-amber-50 text-amber-800">Hypothesis</Badge>
                    <p className="text-sm font-semibold text-slate-900">{recommendation.action}</p>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{recommendation.rationale}</p>
                  {recommendation.citationIds.length > 0 && (
                    <p className="mt-1 text-xs font-semibold text-slate-500">Evidence: {recommendation.citationIds.join(', ')}</p>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function EvidenceChainSection({ chain }: { chain: TweakEvidenceChain }) {
  return (
    <section className="px-5 py-4">
      <div className="max-w-5xl">
        <h3 className="text-sm font-semibold text-slate-900">Decision evidence chain</h3>
        <div className="mt-3 grid overflow-hidden rounded-lg border border-slate-200 md:grid-cols-3 md:divide-x md:divide-slate-200">
          <div className="p-3">
            <p className="text-xs font-semibold text-slate-500">Measured blocker</p>
            <p className="mt-1 text-sm leading-6 text-slate-800">{chain.observation}</p>
          </div>
          <div className="border-t border-slate-200 p-3 md:border-t-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-500">Mechanism</p>
              <Badge className={`border-0 ${chain.hypothesisStatus === 'supported' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                {chain.hypothesisStatus === 'supported' ? 'Supported' : 'Needs confirmation'}
              </Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-800">{chain.hypothesis}</p>
          </div>
          <div className="border-t border-slate-200 p-3 md:border-t-0">
            <p className="text-xs font-semibold text-slate-500">Evidence boundary</p>
            <p className="mt-1 text-sm leading-6 text-slate-800">{chain.evidenceBoundary}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function RecommendationAndDiagnosis({ data, connection }: { data: TweakDiagnosisResponse; connection: DecisionConnection | null }) {
  return (
    <section className="px-5 py-4">
      <div className="max-w-5xl">
        <h3 className="text-sm font-semibold text-slate-900">Literature synthesis</h3>
        <p className="mt-1 text-xs text-slate-500">Use this to select hypotheses after the measured driver is verified.</p>
        <p className="mt-2 text-base leading-7 text-slate-800">{data.summary}</p>
        {data.diagnosis[0] && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">Evidence rationale</p>
            <p className="mt-1 text-sm leading-6 text-slate-700">{data.diagnosis[0].body}</p>
            {data.diagnosis[0].citationIds.length > 0 && (
              <p className="mt-1 text-xs font-semibold text-slate-500">Evidence: {data.diagnosis[0].citationIds.join(', ')}</p>
            )}
          </div>
        )}
        {connection && <p className="mt-3 text-xs text-slate-500">Decision signal: {connection.focusLabel}</p>}
      </div>
    </section>
  );
}

function buildDecisionConnection(decision: GoStopTweakDecision): DecisionConnection {
  const weakest = Object.entries(decision.dimensionScores)
    .sort((a, b) => a[1] - b[1])[0] ?? ['overall', decision.issfScore];
  const focus = decision.prescriptions[0];
  const focusLabel = focus?.target || `${humanizeSignal(weakest[0])} rebuild`;
  return {
    focusLabel,
  };
}

function humanizeSignal(value: string) {
  return value
    .replace(/(?<!^)([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/^\w/, char => char.toUpperCase());
}

function CitationsOnly({ data }: { data: TweakDiagnosisResponse }) {
  const excerptById = new Map(data.appendix.map(item => [item.id, item.excerpt]));
  const citations = data.citations.filter(isScientificCitation);
  const items: CitationListItem[] = citations.map(item => ({
    id: item.id,
    title: item.title,
    sourcePath: item.sourcePath,
    page: item.page,
    excerpt: excerptById.get(item.id),
    roleLabel: item.evidenceRole ? evidenceRoleLabel(item.evidenceRole) : undefined,
  }));
  return (
    <section className="bg-slate-50 px-5 py-4">
      <CitationsList
        items={items}
        emptyLabel="No matching citations returned."
        countLabel={`${citations.length} source${citations.length === 1 ? '' : 's'} used for this workplan`}
      />
    </section>
  );
}

function isScientificCitation(citation: TweakDiagnosisResponse['citations'][number]) {
  const source = `${citation.title} ${citation.sourcePath}`.toLowerCase();
  return ![
    'coverage summary',
    'coverage_summary',
    'category_readmes',
    'category readme',
    'source inventory',
    'paper list',
    'bibliography',
    'corpus manifest',
  ].some(term => source.includes(term));
}

function evidenceRoleLabel(role?: string) {
  switch (role) {
    case 'direct_product':
      return 'Direct product';
    case 'supporting_mechanism':
      return 'Texture mechanism';
    case 'method':
      return 'Method';
    default:
      return 'Evidence';
  }
}
