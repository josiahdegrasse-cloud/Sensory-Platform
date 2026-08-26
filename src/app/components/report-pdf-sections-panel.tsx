import { useState } from 'react';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { type CommercializationReportPdfInput } from '../utils/commercialization-report-export';
import { buildClientReportV2, CLIENT_REPORT_V2_PAGES } from '../utils/pdf/report-v2';

function PreviewPage({ page, title, accent, children }: {
  page: number;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <article className="min-h-[720px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm" style={{ borderTopColor: accent, borderTopWidth: 4 }}>
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-3">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        <span className="text-xs font-semibold text-slate-500">Page {page} of {CLIENT_REPORT_V2_PAGES.length}</span>
      </header>
      <div className="space-y-5 p-5 text-sm leading-relaxed text-slate-700 sm:p-7">{children}</div>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 font-semibold leading-snug text-slate-950">{value}</p>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="border-b border-slate-200 pb-2 text-base font-semibold text-slate-950">{children}</h4>;
}

function Status({ status }: { status: string }) {
  const tone = /supported|ready|pass|go/i.test(status)
    ? 'bg-emerald-100 text-emerald-800'
    : /blocked|fail|stop/i.test(status)
      ? 'bg-rose-100 text-rose-800'
      : 'bg-amber-100 text-amber-900';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{status}</span>;
}

export function ReportPdfSectionsPanel({ input }: { input: CommercializationReportPdfInput }) {
  const [activePage, setActivePage] = useState(1);
  const report = buildClientReportV2(input);
  const accent = input.accentColor || '#2563eb';
  const primary = input.primaryColor || '#0f172a';
  const imageUrl = input.snapshot.concept.reportCoverApprovedForExternalUse
    ? input.snapshot.concept.reportCoverImageUrl
    : input.snapshot.concept.packagingImageUrl;
  const page = CLIENT_REPORT_V2_PAGES[activePage - 1];
  const goToPage = (nextPage: number) => setActivePage(Math.max(1, Math.min(CLIENT_REPORT_V2_PAGES.length, nextPage)));

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-slate-200 bg-white p-2 lg:sticky lg:top-4">
        <div className="px-3 pb-3 pt-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FileText className="size-4 text-slate-500" />Client report</div>
          <p className="mt-1 text-xs text-slate-500">Eight-page executive, R&amp;D, and marketing report</p>
        </div>
        <nav aria-label="Report pages" className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
          {CLIENT_REPORT_V2_PAGES.map(item => (
            <button
              key={item.number}
              type="button"
              onClick={() => goToPage(item.number)}
              aria-current={activePage === item.number ? 'page' : undefined}
              className={`flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${activePage === item.number ? 'bg-slate-950 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${activePage === item.number ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'}`}>{item.number}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{item.title}</span>
                <span className={`line-clamp-1 block text-xs ${activePage === item.number ? 'text-slate-300' : 'text-slate-500'}`}>{item.purpose}</span>
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 space-y-3">
        {activePage === 1 && (
          <PreviewPage page={1} title={page.title} accent={accent}>
            <div className="grid min-h-[600px] overflow-hidden rounded-lg text-white md:grid-cols-[minmax(0,1fr)_42%]" style={{ backgroundColor: primary }}>
              <div className="flex flex-col justify-between p-7 sm:p-10">
                <div>
                  {input.logoUrl ? <img src={input.logoUrl} alt={`${input.organizationName} logo`} className="h-12 max-w-40 rounded bg-white object-contain p-1.5" /> : <p className="text-xs font-bold uppercase tracking-widest">{input.organizationName}</p>}
                  <p className="mt-16 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>Client product decision report</p>
                  <h2 className="mt-4 text-4xl font-bold leading-tight">{report.cover.productName}</h2>
                  <p className="mt-3 text-lg text-white/70">{report.cover.category}</p>
                  <div className="mt-8"><Status status={report.cover.decision} /></div>
                  <p className="mt-5 max-w-sm text-base font-semibold">{report.cover.readinessStage}</p>
                </div>
                <dl className="grid gap-4 border-t border-white/20 pt-6 text-sm sm:grid-cols-2">
                  <Field label="Prepared for" value={report.cover.organizationName} />
                  <Field label="Report date" value={report.cover.generatedLabel} />
                  <Field label="Version" value={String(report.cover.version)} />
                  <Field label="Status" value={report.cover.status} />
                </dl>
              </div>
              <div className="min-h-80 bg-white/10 p-5">
                {imageUrl ? <img src={imageUrl} alt={`${report.cover.productName} report cover`} className="h-full min-h-[560px] w-full rounded-md bg-white object-contain" /> : <div className="flex h-full min-h-[560px] items-center justify-center rounded-md border border-white/20 text-xs font-bold uppercase tracking-wider text-white/60">Product visual</div>}
              </div>
            </div>
          </PreviewPage>
        )}

        {activePage === 2 && (
          <PreviewPage page={2} title={page.title} accent={accent}>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-4"><p className="text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>Recommendation</p><Status status={report.cover.decision} /></div>
              <h4 className="mt-3 text-xl font-semibold text-slate-950">{report.executive.decision}</h4>
              <p className="mt-2">{report.executive.commercialImplication}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-slate-200 p-4"><Field label="ISSF" value={report.basis.issfScore} /></div>
              <div className="rounded-lg border border-slate-200 p-4"><Field label="GO threshold" value={report.basis.goThreshold} /></div>
              <div className="rounded-lg border border-slate-200 p-4"><Field label="Decision margin" value={report.basis.decisionMargin} /></div>
              <div className="rounded-lg border border-slate-200 p-4"><Field label="Evidence strength" value={report.basis.evidenceStrength} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><Field label="Protect" value={report.cover.coreStrength} /></div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><Field label="Watch" value={report.cover.mainWatchPoint} /></div>
            </div>
            <SectionHeading>What this means by audience</SectionHeading>
            <div className="divide-y divide-slate-200 border-y border-slate-200">
              <div className="grid gap-2 py-4 sm:grid-cols-[100px_1fr]"><strong className="text-slate-950">Executive</strong><span>{report.basis.managementDecision}</span></div>
              <div className="grid gap-2 py-4 sm:grid-cols-[100px_1fr]"><strong className="text-slate-950">R&amp;D</strong><span>{report.cover.nextAction}</span></div>
              <div className="grid gap-2 py-4 sm:grid-cols-[100px_1fr]"><strong className="text-slate-950">Marketing</strong><span>Use supported product strengths now. Consumer preference, demand, price acceptance, packaging preference, and purchase intent remain inside the validation boundary.</span></div>
            </div>
            <SectionHeading>Immediate priorities</SectionHeading>
            <div className="grid gap-3 md:grid-cols-3">{report.plan.rows.slice(0, 3).map((row, index) => <div key={row.workstream} className="rounded-lg border border-slate-200 p-4"><p className="text-xs font-bold" style={{ color: accent }}>0{index + 1}</p><p className="mt-2 font-semibold text-slate-950">{row.workstream}</p></div>)}</div>
          </PreviewPage>
        )}

        {activePage === 3 && (
          <PreviewPage page={3} title={page.title} accent={accent}>
            <div className="flex items-end justify-between gap-4"><SectionHeading>Deterministic sensory decision factors</SectionHeading><p className="pb-2 text-xs text-slate-500">Readiness line {report.performance.readinessThreshold}/100</p></div>
            <div className="space-y-3">{report.performance.metrics.filter(metric => metric.score !== null).slice(0, 4).map(metric => <div key={metric.label} className="rounded-lg border border-slate-200 p-4"><div className="flex items-center justify-between"><strong className="text-slate-950">{metric.label}</strong><strong style={{ color: accent }}>{metric.value}</strong></div><div className="relative mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><span className="absolute h-full rounded-full" style={{ width: `${metric.score}%`, backgroundColor: accent }} /><span className="absolute -top-1 h-4 w-px bg-slate-950" style={{ left: `${report.performance.readinessThreshold}%` }} /></div><p className="mt-2 text-xs text-slate-500">{[metric.evidence, metric.benchmark, metric.agreement].filter(Boolean).join(' · ')}</p><p className="mt-2 font-medium">{metric.implication}</p></div>)}</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><Field label="Instrumental context" value={report.scientific.instrumentalAvailable ? 'Project evidence attached' : 'No project dataset attached'} /><p className="mt-3 text-sm">{report.scientific.findings[0] ? `${report.scientific.findings[0].source}: ${report.scientific.findings[0].finding}` : report.scientific.instrumentalNote}</p></div>
              <div className="rounded-lg border p-4" style={{ borderColor: accent }}><Field label="Literature strengthens the next study" value={report.scientific.guidance[0]?.title || 'No approved guidance attached'} /><p className="mt-3 text-sm">{report.scientific.guidance[0]?.guidance || 'Attach approved literature before using external scientific context.'}</p></div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4"><Field label="Study basis and definitions" value={report.performance.definitions} /></div>
          </PreviewPage>
        )}

        {activePage === 4 && (
          <PreviewPage page={4} title={page.title} accent={accent}>
            <div className="grid gap-5 rounded-lg border border-slate-200 bg-slate-50 p-5 md:grid-cols-[1fr_190px]">
              <div><Field label="Working proposition" value={report.concept.conceptName} /><p className="mt-3">{report.concept.positioning}</p><div className="mt-5"><Field label="Priority consumer" value={report.concept.targetConsumer} /></div></div>
              {imageUrl ? <img src={imageUrl} alt="Concept stimulus" className="h-48 w-full rounded-md bg-white object-contain" /> : <div className="flex h-48 items-center justify-center rounded-md border bg-white text-xs text-slate-500">No visual attached</div>}
            </div>
            <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border p-4"><Field label="Responses" value={`n=${report.consumer.responseCount}`} /></div><div className="rounded-lg border p-4"><Field label="Evidence strength" value={report.consumer.evidenceStrength} /></div><div className="rounded-lg border p-4"><Field label="Purchase intent" value={report.consumer.purchaseIntent === null ? 'Not measured' : report.consumer.purchaseIntent.toFixed(1)} /></div></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4 rounded-lg border border-slate-200 p-4"><Field label="Observed response" value={report.consumer.responseCount >= 5 ? 'Top selected descriptors' : 'Directional response log'} />{report.consumer.responseCount >= 5 ? report.consumer.descriptors.slice(0, 4).map(item => <div key={item.label}><div className="flex justify-between text-xs"><span>{item.label}</span><span>{item.percentage.toFixed(0)}% · {item.count}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.min(100, item.percentage)}%`, backgroundColor: accent }} /></div></div>) : <p className="text-sm">Individual responses are retained in the project record but are not presented as a consumer pattern.</p>}</div>
              <div className="space-y-5 rounded-lg border p-4" style={{ borderColor: accent }}><Field label="Product promise" value={report.concept.productPromise} /><Field label="Price hypothesis" value={report.concept.pricePoint} /><Field label="Commercial meaning" value={report.commercialReadiness.summary} /></div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><Field label="Concept evidence boundary" value={`Concept test n=${report.consumer.responseCount}. ${report.consumer.boundary}`} /></div>
          </PreviewPage>
        )}

        {activePage === 5 && (
          <PreviewPage page={5} title={page.title} accent={accent}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 p-4"><Field label="Sensory population" value={report.panel.sensoryPopulation} /></div>
              <div className="rounded-lg border border-slate-200 p-4"><Field label="Concept population" value={report.panel.conceptPopulation} /></div>
              <div className="rounded-lg border border-slate-200 p-4"><Field label="Profile coverage" value={report.panel.profileCoverage} /><div className="mt-3"><Status status={report.panel.profileStatus} /></div></div>
            </div>
            <SectionHeading>Participant profile</SectionHeading>
            {report.panel.dimensions.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {report.panel.dimensions.map(dimension => (
                  <article key={dimension.key} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3"><h4 className="font-semibold text-slate-950">{dimension.label}</h4><span className="text-xs text-slate-500">Known n={dimension.knownCount}</span></div>
                    <div className="mt-3 space-y-2">{dimension.groups.slice(0, 6).map(group => <div key={group.label} className="flex items-center justify-between gap-3 text-xs"><span>{group.label}</span><strong className="text-slate-950">{group.percentage.toFixed(0)}% · {group.count}</strong></div>)}</div>
                    {dimension.suppressedCount > 0 && <p className="mt-3 text-xs text-slate-500">{dimension.suppressedCount} response(s) suppressed by the disclosure rule.</p>}
                  </article>
                ))}
              </div>
            ) : <p className="rounded-lg border border-amber-200 bg-amber-50 p-4">No reportable demographic profile is available for this study.</p>}
            <div className="grid gap-4 rounded-lg bg-slate-50 p-4 md:grid-cols-2"><Field label="Sampling boundary" value={report.panel.samplingBoundary} /><Field label="Disclosure rule" value={report.panel.disclosureRule} /></div>
            <div className="rounded-lg border border-slate-200 p-4"><Field label="Provenance" value={report.panel.provenance} /></div>
          </PreviewPage>
        )}

        {activePage === 6 && (
          <PreviewPage page={6} title={page.title} accent={accent}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 p-4"><Field label="Instrumental dataset" value={report.scientific.instrumentalAvailable ? 'Available' : 'Not attached'} /></div>
              <div className="rounded-lg border border-slate-200 p-4"><Field label="Decision use" value={report.scientific.instrumentalIncludedInDecision ? 'Included in decision' : 'Context only / not included'} /></div>
              <div className="rounded-lg border border-slate-200 p-4"><Field label="Parameters" value={`${report.scientific.benchmarkedParameterCount} of ${report.scientific.parameterCount} benchmarked`} /></div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><Field label="Evidence boundary" value={report.scientific.instrumentalNote} /></div>
            <SectionHeading>Project evidence map</SectionHeading>
            {report.scientific.findings.length > 0 ? <div className="space-y-3">{report.scientific.findings.slice(0, 5).map((finding, index) => <article key={`${finding.source}-${index}`} className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-[150px_1fr]"><div><Status status={finding.decisionEffect} /><p className="mt-2 text-xs font-semibold text-slate-950">{finding.source}</p></div><div><p>{finding.finding}</p><p className="mt-2 text-xs text-slate-500">{finding.benchmark}{finding.replicateCount !== null ? ` · replicates n=${finding.replicateCount}` : ''}</p></div></article>)}</div> : <p className="rounded-lg border border-amber-200 bg-amber-50 p-4">No approved project-level instrumental findings are attached.</p>}
            <SectionHeading>Literature-guided study design</SectionHeading>
            {report.scientific.guidance.length > 0 ? <div className="grid gap-3 md:grid-cols-2">{report.scientific.guidance.slice(0, 4).map(guidance => <article key={guidance.title} className="rounded-lg border p-4" style={{ borderColor: accent }}><h4 className="font-semibold text-slate-950">{guidance.title}</h4><p className="mt-2">{guidance.guidance}</p><p className="mt-3 text-xs text-slate-500">Sources: {guidance.citationIds.join(', ') || 'No approved citation linked'}</p></article>)}</div> : <p className="rounded-lg border border-amber-200 bg-amber-50 p-4">No approved literature guidance is attached. Literature must inform validation design, not substitute for project evidence.</p>}
          </PreviewPage>
        )}

        {activePage === 7 && (
          <PreviewPage page={7} title={page.title} accent={accent}>
            <p>{report.plan.intro}</p>
            <div className="space-y-4">{report.plan.rows.slice(0, 3).map((row, index) => <article key={row.workstream} className="rounded-lg border border-slate-200 p-5"><div className="flex flex-wrap items-center gap-3"><Status status={['Protect', 'Improve', 'Validate'][index]} /><h4 className="font-semibold text-slate-950">{row.workstream}</h4></div><div className="mt-5 grid gap-5 md:grid-cols-3"><Field label="Why / protocol" value={`${row.rationale} ${row.protocol}`} /><Field label="Passing evidence" value={`${row.completionEvidence} Pass: ${row.passingCriteria}`} /><Field label="Owner / gate" value={`Owner: ${row.owner}. Timing: ${row.timing}. Next gate: ${row.nextGate}.`} /></div></article>)}</div>
            <div className="grid gap-4 rounded-lg bg-slate-50 p-4 md:grid-cols-2"><Field label="Next decision gate" value={report.plan.decisionGate} /><Field label="Lead controlled risk" value={report.risks.rows[0] ? `${report.risks.rows[0].risk} Control: ${report.risks.rows[0].mitigation}` : report.risks.claimsNote} /></div>
          </PreviewPage>
        )}

        {activePage === 8 && (
          <PreviewPage page={8} title={page.title} accent={accent}>
            <SectionHeading>Claim-to-evidence register</SectionHeading>
            <div className="divide-y divide-slate-200 border-y border-slate-200">{report.claims.rows.slice(0, 5).map((row, index) => <article key={row.claim} className="grid gap-4 py-4 lg:grid-cols-[170px_1fr_1fr]"><div><div className="flex items-center gap-2"><span className="text-xs font-bold" style={{ color: accent }}>E{index + 1}</span><Status status={row.status} /></div><p className="mt-2 font-semibold text-slate-950">{row.claim}</p><p className="mt-1 text-xs text-slate-500">{row.scope}</p></div><Field label="Evidence" value={row.evidence} /><Field label="Permitted wording / requirement" value={`${row.permittedWording} Requirement: ${row.requirement}`} /></article>)}</div>
            <div className="grid gap-4 md:grid-cols-2"><div className="rounded-lg border p-4" style={{ borderColor: accent }}><Field label="Approved literature guidance" value={report.scientific.sources.length ? 'References used for context and study design' : 'No approved references attached'} /><ul className="mt-3 space-y-2 text-xs">{report.scientific.sources.slice(0, 3).map(source => <li key={source.id}>[{source.id}] {source.authors} {source.year && `(${source.year}).`} {source.title}{source.doi && `. DOI ${source.doi}`}</li>)}</ul></div><div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><Field label="Material limitations" value={report.basis.limitations.join(' ') || 'No material limitations recorded.'} /><div className="mt-5"><Field label="Evidence populations" value={report.basis.populations.map(item => `${item.label}: ${item.value} (${item.provenance}).`).join(' ')} /></div></div></div>
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-4"><Field label={`Release decision / ${report.claims.reportStatus}`} value={report.claims.releaseDecision} /></div>
          </PreviewPage>
        )}

        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => goToPage(activePage - 1)} disabled={activePage === 1}><ChevronLeft className="size-4" />Previous</Button>
          <span className="text-xs font-medium text-slate-500">Page {activePage} of {CLIENT_REPORT_V2_PAGES.length}</span>
          <Button variant="outline" size="sm" onClick={() => goToPage(activePage + 1)} disabled={activePage === CLIENT_REPORT_V2_PAGES.length}>Next<ChevronRight className="size-4" /></Button>
        </div>
      </div>
    </div>
  );
}
