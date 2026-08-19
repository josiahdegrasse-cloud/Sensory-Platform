import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, CircleDotDashed, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { type CommercializationReportPdfInput } from '../utils/commercialization-report-export';
import {
  buildCommercializationPlan,
  buildClaimsMatrix,
  buildConceptPackaging,
  buildConsumerEvidence,
  buildDecisionBasis,
  buildDecisionSnapshot,
  buildPerformanceDashboard,
  buildProductReadiness,
  buildCommercialReadiness,
  buildRisks,
  buildScientificContext,
  type ReadinessRow,
  type ReadinessStatus,
} from '../utils/pdf/sections';

function PdfPageCard({ page, title, accent, children }: {
  page: number;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <article className="min-h-[640px] overflow-hidden rounded-lg border border-slate-200 bg-white" style={{ borderTopColor: accent, borderTopWidth: 3 }}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-3">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <span className="text-xs font-semibold text-slate-500">Page {page} of 8</span>
      </div>
      <div className="space-y-6 p-5 text-sm leading-relaxed text-slate-700 sm:p-7">{children}</div>
    </article>
  );
}

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-200 px-1 pb-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1.5 font-semibold leading-snug text-slate-900">{value}</p>
    </div>
  );
}

function DataTable({ head, rows }: { head?: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto border-y border-slate-200">
      <table className="w-full min-w-[680px] text-left text-xs leading-relaxed">
        {head && (
          <thead className="bg-slate-50">
            <tr>{head.map(label => <th key={label} className="px-3 py-2 font-semibold text-slate-700">{label}</th>)}</tr>
          </thead>
        )}
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
              {row.map((cell, columnIndex) => (
                <td key={columnIndex} className={`px-3 py-3 align-top ${columnIndex === 0 ? 'font-semibold text-slate-900' : ''}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const readinessTone: Record<ReadinessStatus, string> = {
  Ready: 'bg-emerald-100 text-emerald-800',
  'In progress': 'bg-cyan-100 text-cyan-900',
  Pending: 'bg-amber-100 text-amber-900',
  'Requires validation': 'bg-orange-100 text-orange-900',
  'Evidence gap': 'bg-slate-200 text-slate-800',
};

function ReadinessStatusBadge({ status }: { status: ReadinessStatus }) {
  const Icon = status === 'Ready' ? CheckCircle2 : status === 'Evidence gap' ? AlertTriangle : CircleDotDashed;
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${readinessTone[status]}`}>
      <Icon className="size-3.5" aria-hidden="true" />{status}
    </span>
  );
}

function ReadinessMatrix({ rows, showImpact = false }: { rows: ReadinessRow[]; showImpact?: boolean }) {
  const counts = rows.reduce<Record<ReadinessStatus, number>>((result, row) => {
    result[row.status] += 1;
    return result;
  }, { Ready: 0, 'In progress': 0, Pending: 0, 'Requires validation': 0, 'Evidence gap': 0 });
  const entries = (Object.entries(counts) as Array<[ReadinessStatus, number]>).filter(([, count]) => count > 0);

  return (
    <section className="border-y border-slate-200">
      <div className="flex flex-col gap-3 bg-slate-50 px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h4 className="font-semibold text-slate-900">Evidence coverage</h4>
          <p className="mt-0.5 text-xs text-slate-600">Every area is assessed against the evidence required for the next gate.</p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
          {entries.map(([status, count]) => <span key={status}><strong className="text-slate-900">{count}</strong> {status.toLowerCase()}</span>)}
        </div>
      </div>
      <div className="flex h-2 overflow-hidden bg-slate-100" aria-label="Readiness status distribution">
        {entries.map(([status, count]) => (
          <span key={status} className={readinessTone[status].split(' ')[0]} style={{ width: `${count / rows.length * 100}%` }} title={`${status}: ${count}`} />
        ))}
      </div>
      <div className="divide-y divide-slate-200">
        {rows.map(row => (
          <article key={row.area} className={`grid gap-4 px-4 py-5 ${showImpact ? 'lg:grid-cols-[180px_1fr_1fr_1fr]' : 'lg:grid-cols-[180px_1fr_1fr]'}`}>
            <div>
              <h5 className="font-semibold text-slate-950">{row.area}</h5>
              <div className="mt-2"><ReadinessStatusBadge status={row.status} /></div>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Current evidence</p>
              <p className="mt-1.5 text-sm text-slate-700">{row.currentEvidence}</p>
            </div>
            {showImpact && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Decision impact</p>
                <p className="mt-1.5 text-sm text-slate-700">{row.decisionImpact}</p>
              </div>
            )}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Required next evidence</p>
              <p className="mt-1.5 text-sm font-medium text-slate-900">{row.requiredEvidence}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ValidationRoadmap({ rows }: { rows: ReturnType<typeof buildCommercializationPlan>['rows'] }) {
  return (
    <div className="divide-y divide-slate-200 border-y border-slate-200">
      {rows.map((row, index) => (
        <article key={row.workstream} className="py-6 first:pt-4 last:pb-4">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{index + 1}</span>
            <h4 className="pt-1 text-base font-semibold text-slate-950">{row.workstream}</h4>
          </div>
          <div className="mt-5 grid gap-5 pl-11 lg:grid-cols-3">
            <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Why this work</p><p className="mt-1.5">{row.rationale}</p></div>
            <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Protocol</p><p className="mt-1.5">{row.protocol}</p></div>
            <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Pass / next gate</p><p className="mt-1.5">{row.passingCriteria} {row.sampleSizeRationale}</p></div>
          </div>
          <dl className="mt-5 grid gap-3 border-t border-slate-100 pt-4 pl-11 text-xs sm:grid-cols-3">
            <div><dt className="text-slate-500">Owner</dt><dd className="mt-0.5 font-semibold text-slate-900">{row.owner}</dd></div>
            <div><dt className="text-slate-500">Timing</dt><dd className="mt-0.5 font-semibold text-slate-900">{row.timing}</dd></div>
            <div><dt className="text-slate-500">Budget</dt><dd className="mt-0.5 font-semibold text-slate-900">{row.budget}</dd></div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function ClaimsReview({ rows }: { rows: ReturnType<typeof buildClaimsMatrix>['rows'] }) {
  return (
    <div className="divide-y divide-slate-200 border-y border-slate-200">
      {rows.map(row => {
        const tone = row.status === 'Supported'
          ? 'bg-emerald-100 text-emerald-800'
          : row.status === 'Blocked'
            ? 'bg-rose-100 text-rose-800'
            : 'bg-amber-100 text-amber-900';
        return (
          <article key={row.claim} className="py-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="font-semibold text-slate-950">{row.claim}</h4>
                <p className="mt-0.5 text-xs text-slate-500">{row.scope}</p>
              </div>
              <span className={`inline-flex min-h-7 w-fit items-center rounded-full px-2.5 text-xs font-semibold ${tone}`}>{row.status}</span>
            </div>
            <div className="mt-4 grid gap-5 lg:grid-cols-3">
              <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Evidence</p><p className="mt-1.5">{row.evidence}</p></div>
              <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Permitted wording</p><p className="mt-1.5 font-medium text-slate-900">{row.permittedWording}</p></div>
              <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Requirement</p><p className="mt-1.5">{row.requirement}</p></div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function ReportPdfSectionsPanel({ input }: { input: CommercializationReportPdfInput }) {
  const [activePage, setActivePage] = useState(1);
  const accent = input.accentColor || '#2563eb';
  const primary = input.primaryColor || '#0f172a';
  const cover = buildDecisionSnapshot(input);
  const basis = buildDecisionBasis(input);
  const performance = buildPerformanceDashboard(input);
  const scientific = buildScientificContext(input);
  const consumer = buildConsumerEvidence(input);
  const concept = buildConceptPackaging(input);
  const plan = buildCommercializationPlan(input);
  const claims = buildClaimsMatrix(input);
  const risks = buildRisks(input);
  const productReadiness = buildProductReadiness(input);
  const commercialReadiness = buildCommercialReadiness(input);
  const pages = [
    { number: 1, title: 'Executive decision', description: 'Recommendation and next action' },
    { number: 2, title: 'Decision basis', description: 'Quality, sensitivity, and authorization' },
    { number: 3, title: 'Sensory diagnostic', description: 'Scores, meaning, and study basis' },
    { number: 4, title: 'Triangulated evidence', description: 'Instrumental, risk, and scientific guidance' },
    { number: 5, title: 'Product readiness', description: 'Technical feasibility and release evidence' },
    { number: 6, title: 'Commercial case', description: 'Proposition, economics, channel, and demand' },
    { number: 7, title: 'Validation roadmap', description: 'Methods, ownership, budget, and gates' },
    { number: 8, title: 'Claims matrix', description: 'Permitted wording and approval decision' },
  ];

  const goToPage = (page: number) => setActivePage(Math.max(1, Math.min(pages.length, page)));

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-slate-200 bg-white p-2 lg:sticky lg:top-4">
        <div className="px-3 pb-3 pt-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileText className="size-4 text-slate-500" />Client report
          </div>
          <p className="mt-1 text-xs text-slate-500">Eight-page chart-led commercialization report</p>
        </div>
        <nav aria-label="Report pages" className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
          {pages.map(page => (
            <button
              key={page.number}
              type="button"
              onClick={() => goToPage(page.number)}
              aria-current={activePage === page.number ? 'page' : undefined}
              className={`flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${activePage === page.number ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${activePage === page.number ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'}`}>{page.number}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{page.title}</span>
                <span className={`block text-xs ${activePage === page.number ? 'text-slate-300' : 'text-slate-500'}`}>{page.description}</span>
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 space-y-3">
      {activePage === 1 && <PdfPageCard page={1} title="Executive Decision" accent={accent}>
        <div className="rounded-lg p-5 text-white" style={{ backgroundColor: primary }}>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>{cover.category}</p>
          <h3 className="mt-2 text-2xl font-bold">{cover.productName}</h3>
          <p className="mt-1 text-sm text-slate-200">{cover.reportTitle}</p>
          <span className="mt-4 inline-flex rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold">{cover.decision}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <LabelValue label="ISSF score" value={cover.issfScore} />
          <LabelValue label="Evidence strength" value={cover.modelConfidence} />
          <LabelValue label="Concept evidence" value={cover.conceptEvidence} />
          <LabelValue label="Readiness stage" value={cover.readinessStage} />
          <LabelValue label="Core strength" value={cover.coreStrength} />
          <LabelValue label="Main watch point" value={cover.mainWatchPoint} />
          <LabelValue label="Recommended next action" value={cover.nextAction} />
        </div>
      </PdfPageCard>}

      {activePage === 2 && <PdfPageCard page={2} title="Decision basis, evidence strength, and product gates" accent={accent}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LabelValue label="Decision" value={basis.decision} />
          <LabelValue label="ISSF / GO threshold" value={`${basis.issfScore} / ${basis.goThreshold}`} />
          <LabelValue label="Decision margin" value={basis.decisionMargin} />
          <LabelValue label="Evidence strength" value={basis.evidenceStrength} />
        </div>
        <DataTable head={['Evidence population', 'Sample / coverage', 'Provenance']} rows={basis.populations.map(item => [item.label, item.value, item.provenance])} />
        <DataTable head={['Decision gate', 'Status', 'Detail']} rows={basis.gates.map(item => [item.label, item.status, item.detail])} />
        <DataTable head={['What would change the decision']} rows={basis.sensitivity.map(item => [item])} />
        <LabelValue label={`Management decision · ${basis.reportStatus}`} value={basis.managementDecision} />
      </PdfPageCard>}

      {activePage === 3 && <PdfPageCard page={3} title="Sensory performance against the readiness line" accent={accent}>
        <p>{performance.intro}</p>
        <div className="space-y-4 rounded-lg border border-slate-200 p-4">
          {performance.metrics.map(metric => (
            metric.score !== null && <div key={metric.label}>
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-900">{metric.label}</h4>
                <span className="font-bold" style={{ color: accent }}>{metric.value}</span>
              </div>
              <div className="relative mt-2 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full" style={{ width: `${metric.score}%`, backgroundColor: accent }} />
                <span className="absolute -top-1 h-4 w-px bg-slate-900" style={{ left: `${performance.readinessThreshold}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">{metric.evidence}</p>
              {(metric.benchmark || metric.agreement) && (
                <p className="mt-1 text-xs text-slate-600">{[metric.benchmark, metric.agreement].filter(Boolean).join(' · ')}</p>
              )}
              <p className="mt-2 text-sm font-medium text-slate-700">{metric.implication}</p>
            </div>
          ))}
        </div>
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{performance.evidenceNote}</p>
      </PdfPageCard>}

      {activePage === 4 && <PdfPageCard page={4} title="Instrumental evidence, scientific guidance, and product risk" accent={accent}>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="font-semibold text-slate-900">{scientific.instrumentalAvailable ? 'Project instrumental evidence' : 'Instrumental evidence not available'}</p>
          <p className="mt-1 text-sm text-slate-600">{scientific.instrumentalNote}</p>
        </div>
        {scientific.findings.length > 0 && (
          <DataTable
            head={['Source', 'Finding', 'Benchmark', 'Decision effect']}
            rows={scientific.findings.map(finding => [finding.source, finding.finding, finding.benchmark, finding.decisionEffect])}
          />
        )}
        <DataTable head={['Risk', 'Impact', 'Control', 'Next gate']} rows={risks.rows.slice(0, 5).map(risk => [`${risk.category}: ${risk.risk}`, risk.impact, risk.mitigation, risk.nextGate])} />
        {scientific.guidance.length > 0 && (
          <DataTable head={['Source', 'Scientific guidance', 'Application']} rows={scientific.guidance.map(item => [item.citationIds.map(id => `[${id}]`).join(' '), item.title, item.guidance])} />
        )}
      </PdfPageCard>}

      {activePage === 6 && <PdfPageCard page={6} title="Commercial Proposition" accent={accent}>
        <div className="grid gap-3 sm:grid-cols-2">
          <LabelValue label="Positioning hypothesis" value={concept.positioning} />
          <LabelValue label="Target segment" value={concept.targetConsumer} />
          <LabelValue label="Consumer need" value={concept.consumerNeed} />
          <LabelValue label="Usage occasion" value={concept.usageOccasion} />
          <LabelValue label="Product promise" value={concept.productPromise} />
          <LabelValue label="Price hypothesis" value={concept.pricePoint} />
          <LabelValue label="Packaging hypothesis" value={concept.packagingDirection} />
        </div>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-950">Concept evidence boundary: n={consumer.responseCount}. {consumer.responseCount < 5 ? 'The observed response remains in the project record but is not interpreted as a consumer pattern.' : consumer.boundary}</p>
        <LabelValue label="Competitive frame" value={concept.competitiveFrame} />
        <LabelValue label="Differentiation boundary" value={concept.differentiation} />
        <DataTable head={['Evidence-supported reasons to believe']} rows={concept.reasonsToBelieve.map(item => [item])} />
        <ReadinessMatrix rows={commercialReadiness.rows} />
        <LabelValue label="Commercial conclusion" value={commercialReadiness.summary} />
      </PdfPageCard>}

      {activePage === 5 && <PdfPageCard page={5} title="Product Readiness and Technical Feasibility" accent={accent}>
        <p>{productReadiness.intro}</p>
        <ReadinessMatrix rows={productReadiness.rows} showImpact />
        <LabelValue label="Product readiness conclusion" value={productReadiness.summary} />
      </PdfPageCard>}

      {activePage === 7 && <PdfPageCard page={7} title="Validation and Investment Plan" accent={accent}>
        <p>{plan.intro}</p>
        <ValidationRoadmap rows={plan.rows} />
        <LabelValue label="Next decision gate" value={plan.decisionGate} />
      </PdfPageCard>}

      {activePage === 8 && <PdfPageCard page={8} title="Claims release status by evidence level" accent={accent}>
        <p>{claims.intro}</p>
        <ClaimsReview rows={claims.rows} />
        <LabelValue label={`Report status · ${claims.reportStatus}`} value={claims.releaseDecision} />
      </PdfPageCard>}

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => goToPage(activePage - 1)} disabled={activePage === 1}>
          <ChevronLeft className="size-4" />Previous
        </Button>
        <span className="text-xs font-medium text-slate-500">Page {activePage} of {pages.length}</span>
        <Button variant="outline" size="sm" onClick={() => goToPage(activePage + 1)} disabled={activePage === pages.length}>
          Next<ChevronRight className="size-4" />
        </Button>
      </div>
      </div>
    </div>
  );
}
