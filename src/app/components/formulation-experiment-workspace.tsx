import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  Check,
  ClipboardCheck,
  FlaskConical,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  useAddFormulationExperimentArm,
  useAdvanceFormulationExperiment,
  useCreateFormulationExperiment,
  useDecisionRecords,
  useDeleteFormulationExperimentArm,
  useFormulationExperiments,
  useLockFormulationExperiment,
  useRecordFormulationEvaluation,
  useSaveFormulationExperimentLearning,
  useUpdateFormulationExperimentDraft,
} from '../lib/hooks';
import {
  analyzeFormulationExperiment,
  type ExperimentAnalysisMode,
} from '../lib/experiment-analysis';
import type {
  FormulationExperiment,
  FormulationExperimentLifecycle,
} from '../lib/database';
import { projectPath } from '../lib/project-journey-routes';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { WorkflowPageHeader } from './workflow-page-header';

const LIFECYCLE_STEPS: Array<{ id: FormulationExperimentLifecycle; label: string }> = [
  { id: 'draft', label: 'Design' },
  { id: 'locked', label: 'Locked' },
  { id: 'fielding', label: 'Fielding' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'confirmation', label: 'Confirmation' },
  { id: 'complete', label: 'Complete' },
];

const DEFAULT_GATES = [
  'Primary outcome improves versus C0 beyond the predeclared uncertainty margin.',
  'Overall liking does not decline and protected attributes remain intact.',
  'No new defect, category-fit, or quality gate opens.',
  'The selected winner repeats on a fresh confirmation batch.',
];

function parseLines(value: string) {
  return value.split('\n').map(line => line.trim()).filter(Boolean);
}

function parseTags(value: string) {
  return value.split(',').map(tag => tag.trim()).filter(Boolean);
}

function formatNumber(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function lifecycleIndex(lifecycle: FormulationExperimentLifecycle) {
  const index = LIFECYCLE_STEPS.findIndex(step => step.id === lifecycle);
  return index < 0 ? 0 : index;
}

function LifecyclePath({ experiment }: { experiment: FormulationExperiment }) {
  const activeIndex = lifecycleIndex(experiment.lifecycle);
  return (
    <ol className="flex min-w-[42rem] items-start" aria-label="Experiment lifecycle">
      {LIFECYCLE_STEPS.map((step, index) => {
        const complete = index < activeIndex || experiment.lifecycle === 'complete';
        const current = index === activeIndex && experiment.lifecycle !== 'complete';
        return (
          <li key={step.id} className="relative flex flex-1 flex-col items-center text-center">
            {index < LIFECYCLE_STEPS.length - 1 && (
              <span className={`absolute left-1/2 right-[-50%] top-3 h-px ${complete ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
            <span className={`relative z-10 flex size-6 items-center justify-center rounded-full border text-xs font-bold ${
              complete
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : current
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-300 bg-white text-slate-500'
            }`}>
              {complete ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span className={`mt-1 text-xs ${current ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function FormulationExperimentWorkspace() {
  const { projectId } = useParams<{ projectId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: decisions = [] } = useDecisionRecords();
  const experimentsQuery = useFormulationExperiments(projectId);
  const experiments = useMemo(() => experimentsQuery.data ?? [], [experimentsQuery.data]);
  const projectDecisions = useMemo(() => decisions.filter(decision =>
    decision.projectId === projectId
    && (decision.decision === 'TWEAK' || decision.decision === 'STOP')
    && Boolean(decision.evidenceBundleId)
  ), [decisions, projectId]);
  const requestedDecisionId = searchParams.get('decision');
  const requestedExperimentId = searchParams.get('experiment');
  const selectedDecision = projectDecisions.find(decision => decision.id === requestedDecisionId)
    ?? projectDecisions[0]
    ?? null;
  const selectedExperiment = experiments.find(experiment => experiment.id === requestedExperimentId)
    ?? experiments.find(experiment => experiment.decisionRecordId === selectedDecision?.id)
    ?? experiments[0]
    ?? null;

  const createExperiment = useCreateFormulationExperiment(projectId);
  const updateDraft = useUpdateFormulationExperimentDraft(projectId);
  const addArm = useAddFormulationExperimentArm(projectId);
  const deleteArm = useDeleteFormulationExperimentArm(projectId);
  const lockExperiment = useLockFormulationExperiment(projectId);
  const advanceExperiment = useAdvanceFormulationExperiment(projectId);
  const recordEvaluation = useRecordFormulationEvaluation(projectId);
  const saveLearning = useSaveFormulationExperimentLearning(projectId);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [measuredDriver, setMeasuredDriver] = useState('Texture / weakest measured dimension');
  const [hypothesis, setHypothesis] = useState('The measured blocker identifies where performance is weak; the responsible formulation or process mechanism still requires a controlled test.');
  const [primaryOutcome, setPrimaryOutcome] = useState('Focused decision dimension score (0–100)');
  const [analysisMode, setAnalysisMode] = useState<ExperimentAnalysisMode>('independent');
  const [minimumN, setMinimumN] = useState(12);
  const [uncertaintyMargin, setUncertaintyMargin] = useState(1);
  const [servingProtocol, setServingProtocol] = useState('');
  const [storageCheckpoints, setStorageCheckpoints] = useState('Day 0\nDay 7\nDay 14');
  const [advancementGates, setAdvancementGates] = useState(DEFAULT_GATES.join('\n'));
  const [variantLabel, setVariantLabel] = useState('');
  const [variantMechanism, setVariantMechanism] = useState('');
  const [variantChange, setVariantChange] = useState('');
  const [participantKey, setParticipantKey] = useState('');
  const [sessionKey, setSessionKey] = useState('1');
  const [evaluationArmId, setEvaluationArmId] = useState('');
  const [primaryScore, setPrimaryScore] = useState('');
  const [overallLiking, setOverallLiking] = useState('');
  const [categoryFit, setCategoryFit] = useState('');
  const [learningSummary, setLearningSummary] = useState('');
  const [learningTags, setLearningTags] = useState('');
  const [learningAppliesTo, setLearningAppliesTo] = useState('');
  const [learningLimitations, setLearningLimitations] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (!selectedExperiment) {
        setName(selectedDecision ? `${selectedDecision.sampleName} focused optimization` : '');
        return;
      }
      setName(selectedExperiment.name);
      setMeasuredDriver(selectedExperiment.measuredDriver);
      setHypothesis(selectedExperiment.hypothesis);
      setPrimaryOutcome(selectedExperiment.primaryOutcome);
      setAnalysisMode(selectedExperiment.analysisMode);
      setMinimumN(selectedExperiment.minimumN);
      setUncertaintyMargin(selectedExperiment.uncertaintyMargin);
      setServingProtocol(selectedExperiment.servingProtocol);
      setStorageCheckpoints(selectedExperiment.storageCheckpoints.join('\n'));
      setAdvancementGates(selectedExperiment.advancementGates.join('\n'));
      setEvaluationArmId(selectedExperiment.arms[0]?.id ?? '');
      setLearningSummary(selectedExperiment.learningSummary ?? '');
      setLearningTags(selectedExperiment.learningTags.join(', '));
      setLearningAppliesTo(selectedExperiment.learningAppliesTo.join('\n'));
      setLearningLimitations(selectedExperiment.learningLimitations.join('\n'));
    });
    return () => {
      active = false;
    };
  }, [selectedDecision, selectedExperiment]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The action could not be completed.');
    }
  };

  const saveDraft = async () => {
    if (!selectedExperiment) return;
    await updateDraft.mutateAsync({
      id: selectedExperiment.id,
      name,
      measuredDriver,
      hypothesis,
      primaryOutcome,
      analysisMode,
      minimumN,
      uncertaintyMargin,
      servingProtocol,
      storageCheckpoints: parseLines(storageCheckpoints),
      advancementGates: parseLines(advancementGates),
    });
  };

  const analysis = useMemo(() => {
    if (!selectedExperiment || selectedExperiment.evaluations.length === 0) return null;
    const trialById = new Map(selectedExperiment.trials.map(trial => [trial.id, trial]));
    return analyzeFormulationExperiment({
      arms: selectedExperiment.arms.map(arm => ({
        id: arm.id,
        code: arm.code,
        label: arm.label,
        armType: arm.armType,
      })),
      evaluations: selectedExperiment.evaluations.map(evaluation => ({
        armId: evaluation.armId,
        participantKey: trialById.get(evaluation.trialId)?.participantKey ?? evaluation.trialId,
        primaryScore: evaluation.primaryScore,
      })),
      mode: selectedExperiment.analysisMode,
      iterations: selectedExperiment.bootstrapIterations,
      confidenceLevel: selectedExperiment.confidenceLevel,
      seed: selectedExperiment.deterministicSeed,
      minimumN: selectedExperiment.minimumN,
      uncertaintyMargin: selectedExperiment.uncertaintyMargin,
    });
  }, [selectedExperiment]);

  if (!projectId) return null;

  if (!selectedDecision && experiments.length === 0) {
    return (
      <div className="space-y-6">
        <WorkflowPageHeader
          title="Formulation experiments"
          description="Translate a confirmed TWEAK or STOP decision into a controlled C0-plus-variant screen."
          actions={<Button asChild variant="outline"><Link to={projectPath(projectId, 'decision')}><ArrowLeft className="size-4" />Decision</Link></Button>}
        />
        <section className="border-y border-slate-200 bg-white py-10 text-center">
          <FlaskConical className="mx-auto size-8 text-slate-400" />
          <h2 className="mt-3 text-lg font-semibold text-slate-900">Confirm a TWEAK decision first</h2>
          <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">The experiment workspace requires a project-scoped decision linked to the exact product evidence and formulation.</p>
          <Button asChild className="mt-4"><Link to={projectPath(projectId, 'decision')}>Open Decision review</Link></Button>
        </section>
      </div>
    );
  }

  if (!selectedExperiment || showCreate) {
    return (
      <div className="space-y-6">
        <WorkflowPageHeader
          title="Create controlled experiment"
          description="Start with the current control and add no more than three single-mechanism variants."
          actions={<Button asChild variant="outline"><Link to={projectPath(projectId, 'decision')}><ArrowLeft className="size-4" />Decision</Link></Button>}
        />
        <section className="border border-slate-200 bg-white p-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <Label>Source decision</Label>
                <Select
                  value={selectedDecision?.id ?? ''}
                  onValueChange={value => setSearchParams({ decision: value })}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Choose TWEAK decision" /></SelectTrigger>
                  <SelectContent>
                    {projectDecisions.map(decision => (
                      <SelectItem key={decision.id} value={decision.id}>
                        {decision.sampleName} · {decision.decision} · ISSF {decision.issfScore.toFixed(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="experiment-name">Experiment name</Label><Input id="experiment-name" className="mt-1" value={name} onChange={event => setName(event.target.value)} /></div>
              <div><Label htmlFor="measured-driver">Measured driver</Label><Input id="measured-driver" className="mt-1" value={measuredDriver} onChange={event => setMeasuredDriver(event.target.value)} /></div>
              <div><Label htmlFor="primary-outcome">Primary outcome</Label><Input id="primary-outcome" className="mt-1" value={primaryOutcome} onChange={event => setPrimaryOutcome(event.target.value)} /></div>
            </div>
            <div className="space-y-4">
              <div><Label htmlFor="experiment-hypothesis">Hypothesis boundary</Label><Textarea id="experiment-hypothesis" className="mt-1 min-h-28" value={hypothesis} onChange={event => setHypothesis(event.target.value)} /></div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Analysis</Label>
                  <Select value={analysisMode} onValueChange={value => setAnalysisMode(value as ExperimentAnalysisMode)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="independent">Independent</SelectItem><SelectItem value="paired">Paired</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label htmlFor="minimum-n">Minimum n</Label><Input id="minimum-n" className="mt-1" type="number" min={2} value={minimumN} onChange={event => setMinimumN(Number(event.target.value))} /></div>
                <div><Label htmlFor="margin">Uncertainty margin</Label><Input id="margin" className="mt-1" type="number" min={0} step="0.1" value={uncertaintyMargin} onChange={event => setUncertaintyMargin(Number(event.target.value))} /></div>
              </div>
              <div><Label htmlFor="initial-gates">Advancement gates</Label><Textarea id="initial-gates" className="mt-1 min-h-32" value={advancementGates} onChange={event => setAdvancementGates(event.target.value)} /></div>
            </div>
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {experiments.length > 0 && <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>}
            <Button
              disabled={!selectedDecision || createExperiment.isPending}
              onClick={() => void run(async () => {
                if (!selectedDecision) return;
                const id = await createExperiment.mutateAsync({
                  projectId,
                  decisionRecordId: selectedDecision.id,
                  name,
                  measuredDriver,
                  hypothesis,
                  primaryOutcome,
                  analysisMode,
                  minimumN,
                  uncertaintyMargin,
                  advancementGates: parseLines(advancementGates),
                });
                setSearchParams({ decision: selectedDecision.id, experiment: id });
                setShowCreate(false);
              }, 'Experiment draft created.')}
            >
              <Plus className="size-4" />Create experiment
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const isDraft = selectedExperiment.lifecycle === 'draft';
  const canRecord = ['fielding', 'analysis'].includes(selectedExperiment.lifecycle);
  const winner = analysis?.arms.find(arm => arm.armId === analysis.recommendedWinnerArmId) ?? null;

  return (
    <div className="space-y-6">
      <WorkflowPageHeader
        title={selectedExperiment.name}
        description={`${selectedExperiment.measuredDriver} · ${selectedExperiment.analysisMode} deterministic bootstrap`}
        status={<Badge variant="outline">{selectedExperiment.lifecycle.replace('_', ' ')}</Badge>}
        actions={(
          <>
            <Button asChild variant="outline"><Link to={projectPath(projectId, 'decision')}><ArrowLeft className="size-4" />Decision</Link></Button>
            <Button variant="outline" onClick={() => setShowCreate(true)}><Plus className="size-4" />New experiment</Button>
          </>
        )}
      />

      <div className="overflow-x-auto border-y border-slate-200 bg-white py-4">
        <LifecyclePath experiment={selectedExperiment} />
      </div>

      {(error || notice) && (
        <p role={error ? 'alert' : 'status'} className={`border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {error || notice}
        </p>
      )}

      <section className="border border-slate-200 bg-white">
        <header className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Predeclared design</h2>
              <p className="mt-1 text-sm text-slate-600">Locking freezes the hypothesis, protocol, arms, sample size, and advancement gates.</p>
            </div>
            {isDraft && <Badge className="bg-amber-50 text-amber-800">Needs lock</Badge>}
          </div>
        </header>
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <div className="space-y-4">
            <div><Label>Name</Label><Input className="mt-1" disabled={!isDraft} value={name} onChange={event => setName(event.target.value)} /></div>
            <div><Label>Measured driver</Label><Input className="mt-1" disabled={!isDraft} value={measuredDriver} onChange={event => setMeasuredDriver(event.target.value)} /></div>
            <div><Label>Hypothesis boundary</Label><Textarea className="mt-1 min-h-24" disabled={!isDraft} value={hypothesis} onChange={event => setHypothesis(event.target.value)} /></div>
            <div><Label>Serving protocol</Label><Textarea className="mt-1 min-h-24" disabled={!isDraft} value={servingProtocol} onChange={event => setServingProtocol(event.target.value)} placeholder="Temperature, preparation, serving order, hold time, and blinding." /></div>
          </div>
          <div className="space-y-4">
            <div><Label>Primary outcome</Label><Input className="mt-1" disabled={!isDraft} value={primaryOutcome} onChange={event => setPrimaryOutcome(event.target.value)} /></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label>Analysis</Label><Select disabled={!isDraft} value={analysisMode} onValueChange={value => setAnalysisMode(value as ExperimentAnalysisMode)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="independent">Independent</SelectItem><SelectItem value="paired">Paired</SelectItem></SelectContent></Select></div>
              <div><Label>Minimum n</Label><Input className="mt-1" disabled={!isDraft} type="number" min={2} value={minimumN} onChange={event => setMinimumN(Number(event.target.value))} /></div>
              <div><Label>Margin</Label><Input className="mt-1" disabled={!isDraft} type="number" min={0} step="0.1" value={uncertaintyMargin} onChange={event => setUncertaintyMargin(Number(event.target.value))} /></div>
            </div>
            <div><Label>Storage checkpoints</Label><Textarea className="mt-1 min-h-20" disabled={!isDraft} value={storageCheckpoints} onChange={event => setStorageCheckpoints(event.target.value)} /></div>
            <div><Label>Advancement gates</Label><Textarea className="mt-1 min-h-32" disabled={!isDraft} value={advancementGates} onChange={event => setAdvancementGates(event.target.value)} /></div>
          </div>
        </div>
      </section>

      <section className="border border-slate-200 bg-white">
        <header className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Control and variants</h2>
          <p className="mt-1 text-sm text-slate-600">C0 stays unchanged. Each variant names one mechanism and one intentional change.</p>
        </header>
        <div className="divide-y divide-slate-200">
          {selectedExperiment.arms.map(arm => (
            <article key={arm.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-bold ${arm.armType === 'control' ? 'bg-slate-900 text-white' : 'bg-blue-50 text-blue-800'}`}>{arm.code}</span>
                <div>
                  <h3 className="font-semibold text-slate-900">{arm.label}</h3>
                  <p className="mt-1 text-sm text-slate-700">{arm.mechanism}</p>
                  <p className="mt-1 text-sm text-slate-500">{arm.changeDescription}</p>
                </div>
              </div>
              {isDraft && arm.armType === 'variant' && (
                <Button variant="ghost" size="sm" onClick={() => void run(() => deleteArm.mutateAsync(arm.id), `${arm.code} removed.`)}>
                  <Trash2 className="size-4" />Remove
                </Button>
              )}
            </article>
          ))}
        </div>
        {isDraft && selectedExperiment.arms.length < 4 && (
          <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-5 lg:grid-cols-[1fr_1fr_1.4fr_auto]">
            <Input aria-label="Variant label" placeholder="Variant label" value={variantLabel} onChange={event => setVariantLabel(event.target.value)} />
            <Input aria-label="Named mechanism" placeholder="One named mechanism" value={variantMechanism} onChange={event => setVariantMechanism(event.target.value)} />
            <Input aria-label="Intentional change" placeholder="Exact intentional change" value={variantChange} onChange={event => setVariantChange(event.target.value)} />
            <Button
              variant="outline"
              onClick={() => void run(async () => {
                await addArm.mutateAsync({
                  experimentId: selectedExperiment.id,
                  label: variantLabel,
                  mechanism: variantMechanism,
                  changeDescription: variantChange,
                });
                setVariantLabel('');
                setVariantMechanism('');
                setVariantChange('');
              }, 'Variant added.')}
            >
              <Plus className="size-4" />Add
            </Button>
          </div>
        )}
        {isDraft && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <Button variant="outline" onClick={() => void run(saveDraft, 'Draft saved.')}>Save design</Button>
            <Button onClick={() => void run(async () => { await saveDraft(); await lockExperiment.mutateAsync(selectedExperiment.id); }, 'Design locked.')}>
              <Lock className="size-4" />Lock design
            </Button>
          </div>
        )}
      </section>

      {selectedExperiment.lifecycle === 'locked' && (
        <section className="flex flex-col gap-4 border border-blue-200 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold text-blue-950">Design is locked</h2><p className="mt-1 text-sm text-blue-800">Start fielding when coded samples and the serving protocol are ready.</p></div>
          <Button onClick={() => void run(() => advanceExperiment.mutateAsync({ experimentId: selectedExperiment.id, lifecycle: 'fielding' }), 'Fielding started.')}>Start fielding</Button>
        </section>
      )}

      {canRecord && (
        <section className="border border-slate-200 bg-white">
          <header className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Record primary outcome</h2>
            <p className="mt-1 text-sm text-slate-600">Use the same participant key across arms for paired analysis.</p>
          </header>
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-[1fr_0.7fr_1fr_0.7fr_0.7fr_0.7fr_auto]">
            <Input aria-label="Participant key" placeholder="Participant key" value={participantKey} onChange={event => setParticipantKey(event.target.value)} />
            <Input aria-label="Session" placeholder="Session" value={sessionKey} onChange={event => setSessionKey(event.target.value)} />
            <Select value={evaluationArmId} onValueChange={setEvaluationArmId}><SelectTrigger><SelectValue placeholder="Arm" /></SelectTrigger><SelectContent>{selectedExperiment.arms.map(arm => <SelectItem key={arm.id} value={arm.id}>{arm.code} · {arm.label}</SelectItem>)}</SelectContent></Select>
            <Input aria-label="Primary score" type="number" placeholder="Primary" value={primaryScore} onChange={event => setPrimaryScore(event.target.value)} />
            <Input aria-label="Overall liking" type="number" step="0.1" placeholder="Liking" value={overallLiking} onChange={event => setOverallLiking(event.target.value)} />
            <Input aria-label="Category fit" type="number" placeholder="Fit" value={categoryFit} onChange={event => setCategoryFit(event.target.value)} />
            <Button
              disabled={!participantKey.trim() || !evaluationArmId || !primaryScore}
              onClick={() => void run(async () => {
                await recordEvaluation.mutateAsync({
                  experimentId: selectedExperiment.id,
                  participantKey,
                  sessionKey,
                  armId: evaluationArmId,
                  primaryScore: Number(primaryScore),
                  overallLiking: overallLiking ? Number(overallLiking) : null,
                  categoryFitScore: categoryFit ? Number(categoryFit) : null,
                });
                setPrimaryScore('');
                setOverallLiking('');
                setCategoryFit('');
              }, 'Evaluation recorded.')}
            >
              Record
            </Button>
          </div>
          <div className="border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
            {selectedExperiment.trials.length} participant session{selectedExperiment.trials.length === 1 ? '' : 's'} · {selectedExperiment.evaluations.length} arm evaluation{selectedExperiment.evaluations.length === 1 ? '' : 's'}
          </div>
        </section>
      )}

      {analysis && (
        <section className="border border-slate-200 bg-white">
          <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="flex items-center gap-2 font-semibold text-slate-900"><BarChart3 className="size-4" />Uncertainty analysis</h2><p className="mt-1 text-sm text-slate-600">{analysis.iterations.toLocaleString()} deterministic bootstrap iterations · {(analysis.confidenceLevel * 100).toFixed(0)}% interval</p></div>
            {winner ? <Badge className="bg-emerald-50 text-emerald-800">Recommended: {winner.code}</Badge> : <Badge className="bg-amber-50 text-amber-800">No arm clears gates</Badge>}
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-5 py-3">Arm</th><th className="px-4 py-3">n</th><th className="px-4 py-3">Mean</th><th className="px-4 py-3">Lift vs C0</th><th className="px-4 py-3">95% interval</th><th className="px-4 py-3">Gate</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {analysis.arms.map(arm => (
                  <tr key={arm.armId}>
                    <td className="px-5 py-3 font-semibold text-slate-900">{arm.code} · {arm.label}</td>
                    <td className="px-4 py-3 text-slate-700">{arm.n}</td>
                    <td className="px-4 py-3 text-slate-700">{formatNumber(arm.mean)}</td>
                    <td className="px-4 py-3 text-slate-700">{arm.armId === analysis.controlArmId ? '—' : formatNumber(arm.liftVersusControl)}</td>
                    <td className="px-4 py-3 text-slate-700">{arm.armId === analysis.controlArmId ? 'Reference' : `${formatNumber(arm.confidenceInterval[0])} to ${formatNumber(arm.confidenceInterval[1])}`}</td>
                    <td className="px-4 py-3">{arm.armId === analysis.controlArmId ? <Badge variant="outline">Control</Badge> : arm.minimumNMet && arm.clearsUncertaintyMargin ? <Badge className="bg-emerald-50 text-emerald-800">Pass</Badge> : <Badge className="bg-amber-50 text-amber-800">Hold</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {analysis.warnings.length > 0 && (
            <div className="border-t border-slate-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              <div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><ul className="space-y-1">{analysis.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>
            </div>
          )}
          {selectedExperiment.lifecycle === 'fielding' && (
            <div className="flex justify-end border-t border-slate-200 px-5 py-4">
              <Button
                disabled={!analysis.recommendedWinnerArmId}
                onClick={() => void run(async () => {
                  await advanceExperiment.mutateAsync({ experimentId: selectedExperiment.id, lifecycle: 'analysis' });
                  await advanceExperiment.mutateAsync({
                    experimentId: selectedExperiment.id,
                    lifecycle: 'confirmation',
                    analysisSnapshot: analysis,
                    winnerArmId: analysis.recommendedWinnerArmId,
                  });
                }, 'Winner selected for confirmation.')}
              >
                <ClipboardCheck className="size-4" />Select winner for confirmation
              </Button>
            </div>
          )}
        </section>
      )}

      {selectedExperiment.lifecycle === 'confirmation' && (
        <section className="flex flex-col gap-4 border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold text-emerald-950">Fresh confirmation batch required</h2><p className="mt-1 text-sm text-emerald-800">Complete only after the selected winner repeats under the locked protocol and storage checkpoints.</p></div>
          <Button
            className="bg-emerald-700 text-white hover:bg-emerald-800"
            onClick={() => void run(() => advanceExperiment.mutateAsync({
              experimentId: selectedExperiment.id,
              lifecycle: 'complete',
              analysisSnapshot: selectedExperiment.analysisSnapshot ?? analysis,
              winnerArmId: selectedExperiment.winnerArmId,
            }), 'Experiment completed. Import the confirmation batch and re-run the GO/TWEAK/STOP decision.')}
          >
            <ClipboardCheck className="size-4" />Confirm repeat batch
          </Button>
        </section>
      )}

      {selectedExperiment.lifecycle === 'complete' && (
        <section className="border border-slate-200 bg-white">
          <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <BookOpenCheck className="size-4" />
                Reusable learning record
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Capture what the completed experiment established, where it may apply, and the boundaries that must travel with it.
                Only approved learning can inform other projects.
              </p>
            </div>
            <Badge className={selectedExperiment.learningStatus === 'approved'
              ? 'bg-emerald-50 text-emerald-800'
              : selectedExperiment.learningStatus === 'draft'
                ? 'bg-amber-50 text-amber-800'
                : 'bg-slate-100 text-slate-700'}>
              {selectedExperiment.learningStatus === 'approved'
                ? 'Approved for reuse'
                : selectedExperiment.learningStatus === 'draft'
                  ? 'Draft learning'
                  : 'Not captured'}
            </Badge>
          </header>
          <div className="grid gap-5 p-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div>
                <Label htmlFor="learning-summary">What did this experiment establish?</Label>
                <Textarea
                  id="learning-summary"
                  className="mt-1 min-h-32"
                  value={learningSummary}
                  onChange={event => setLearningSummary(event.target.value)}
                  placeholder="State the observed result and named mechanism without extending beyond the completed experiment."
                />
              </div>
              <div>
                <Label htmlFor="learning-limitations">Limitations and non-transferable conditions</Label>
                <Textarea
                  id="learning-limitations"
                  className="mt-1 min-h-28"
                  value={learningLimitations}
                  onChange={event => setLearningLimitations(event.target.value)}
                  placeholder={'One boundary per line\nExample: Tested only in chilled samples at day 7'}
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="learning-applies-to">May apply to</Label>
                <Textarea
                  id="learning-applies-to"
                  className="mt-1 min-h-28"
                  value={learningAppliesTo}
                  onChange={event => setLearningAppliesTo(event.target.value)}
                  placeholder={'One context per line\nExample: Mango lassi with the same stabiliser system'}
                />
              </div>
              <div>
                <Label htmlFor="learning-tags">Search tags</Label>
                <Input
                  id="learning-tags"
                  className="mt-1"
                  value={learningTags}
                  onChange={event => setLearningTags(event.target.value)}
                  placeholder="texture, stabiliser, chilled beverage"
                />
              </div>
              <div className="border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
                The source decision, formulation, evidence bundle, control, variants, participant-level outcomes, and analysis snapshot remain linked to this record.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <Button
              variant="outline"
              disabled={!learningSummary.trim() || saveLearning.isPending}
              onClick={() => void run(() => saveLearning.mutateAsync({
                experimentId: selectedExperiment.id,
                summary: learningSummary,
                tags: parseTags(learningTags),
                appliesTo: parseLines(learningAppliesTo),
                limitations: parseLines(learningLimitations),
                status: 'draft',
              }), 'Learning saved as a draft.')}
            >
              Save draft
            </Button>
            <Button
              disabled={!learningSummary.trim() || saveLearning.isPending}
              onClick={() => void run(() => saveLearning.mutateAsync({
                experimentId: selectedExperiment.id,
                summary: learningSummary,
                tags: parseTags(learningTags),
                appliesTo: parseLines(learningAppliesTo),
                limitations: parseLines(learningLimitations),
                status: 'approved',
              }), 'Learning approved for reuse.')}
            >
              <BookOpenCheck className="size-4" />
              Approve learning
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
