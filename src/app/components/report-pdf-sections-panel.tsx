import { Download } from 'lucide-react';
import { Button } from './ui/button';
import {
  downloadCommercializationReportPdf,
  type CommercializationReportPdfInput,
} from '../utils/commercialization-report-export';
import {
  buildAppendix,
  buildCommercialInsights,
  buildCommercializationPlan,
  buildConceptPackaging,
  buildDecisionSnapshot,
  buildExecutiveReadout,
  buildPerformanceDashboard,
  buildRisks,
} from '../utils/pdf/sections';

function PdfPageCard({ page, title, accent, children }: {
  page: number;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" style={{ borderTopColor: accent, borderTopWidth: 3 }}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-3">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">Page {page}</span>
      </div>
      <div className="space-y-4 p-6 text-sm text-slate-700">{children}</div>
    </div>
  );
}

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function DataTable({ head, rows }: { head?: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-xs">
        {head && (
          <thead className="bg-slate-100">
            <tr>{head.map(label => <th key={label} className="px-3 py-2 font-semibold text-slate-700">{label}</th>)}</tr>
          </thead>
        )}
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, columnIndex) => (
                <td key={columnIndex} className={`px-3 py-2 align-top ${columnIndex === 0 ? 'font-semibold text-slate-900' : ''}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportPdfSectionsPanel({ input }: { input: CommercializationReportPdfInput }) {
  const accent = input.accentColor || '#2563eb';
  const primary = input.primaryColor || '#0f172a';
  const cover = buildDecisionSnapshot(input);
  const executive = buildExecutiveReadout(input);
  const performance = buildPerformanceDashboard(input);
  const insights = buildCommercialInsights(input);
  const concept = buildConceptPackaging(input);
  const plan = buildCommercializationPlan(input);
  const risks = buildRisks(input);
  const appendix = buildAppendix(input);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-950">PDF sections</h2>
          <p className="text-sm text-slate-500">Nine decision-led pages, using the same content builders as the exported PDF.</p>
        </div>
        <Button variant="outline" onClick={() => downloadCommercializationReportPdf(input)}>
          <Download className="size-4" />Download PDF
        </Button>
      </div>

      <PdfPageCard page={1} title="Cover + Decision Snapshot" accent={accent}>
        <div className="rounded-lg p-5 text-white" style={{ backgroundColor: primary }}>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>{cover.category}</p>
          <h3 className="mt-2 text-2xl font-bold">{cover.productName}</h3>
          <p className="mt-1 text-sm text-slate-200">{cover.reportTitle}</p>
          <span className="mt-4 inline-flex rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold">{cover.decision}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <LabelValue label="Readiness stage" value={cover.readinessStage} />
          <LabelValue label="Core strength" value={cover.coreStrength} />
          <LabelValue label="Main watch point" value={cover.mainWatchPoint} />
          <LabelValue label="Recommended next action" value={cover.nextAction} />
        </div>
      </PdfPageCard>

      <PdfPageCard page={2} title="Executive Summary / Commercial Readout" accent={accent}>
        <div className="grid gap-3">
          <LabelValue label="Decision" value={executive.decision} />
          <LabelValue label="Rationale" value={executive.rationale} />
          <LabelValue label="Commercial implication" value={executive.commercialImplication} />
          <LabelValue label="Next move" value={executive.nextMove} />
        </div>
      </PdfPageCard>

      <PdfPageCard page={3} title="Product Performance Dashboard" accent={accent}>
        <p>{performance.intro}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {performance.metrics.map(metric => (
            <div key={metric.label} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <h4 className="font-semibold text-slate-900">{metric.label}</h4>
                <span className="text-lg font-bold" style={{ color: accent }}>{metric.value}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{metric.evidence}</p>
              <p className="mt-2 text-sm font-medium text-slate-800">{metric.implication}</p>
            </div>
          ))}
        </div>
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{performance.evidenceNote}</p>
      </PdfPageCard>

      <PdfPageCard page={4} title="Key Commercial Insights" accent={accent}>
        <p>{insights.intro}</p>
        <div className="space-y-3">
          {insights.insights.map((insight, index) => (
            <div key={insight.title} className="rounded-lg border border-slate-200 p-4">
              <h4 className="font-semibold text-slate-900">{index + 1}. {insight.title}</h4>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <LabelValue label="Evidence suggests" value={insight.evidence} />
                <LabelValue label="Commercial meaning" value={insight.commercialMeaning} />
                <LabelValue label="Recommended action" value={insight.action} />
              </div>
            </div>
          ))}
        </div>
      </PdfPageCard>

      <PdfPageCard page={5} title="Concept and Packaging Direction" accent={accent}>
        <div className="grid gap-3 sm:grid-cols-2">
          <LabelValue label="Concept name" value={concept.conceptName} />
          <LabelValue label="Positioning" value={concept.positioning} />
          <LabelValue label="Target consumer" value={concept.targetConsumer} />
          <LabelValue label="Price point" value={concept.pricePoint} />
          <LabelValue label="Packaging direction" value={concept.packagingDirection} />
          <LabelValue label="Core message" value={concept.coreMessage} />
        </div>
        <LabelValue label="Why this supports the product" value={concept.strategicFit} />
        <DataTable head={['Refine before external use']} rows={concept.refinements.map(item => [item])} />
      </PdfPageCard>

      <PdfPageCard page={6} title="Commercialization Plan" accent={accent}>
        <p>{plan.intro}</p>
        <DataTable
          head={['Workstream', 'Current read', 'Required action', 'Status / owner']}
          rows={plan.rows.map(row => [row.workstream, row.currentRead, row.requiredAction, row.statusOwner])}
        />
        <LabelValue label="Next decision gate" value={plan.decisionGate} />
      </PdfPageCard>

      <PdfPageCard page={7} title="Risks and Watch Points" accent={accent}>
        <p>{risks.intro}</p>
        <DataTable
          head={['Risk', 'Commercial impact', 'Mitigation', 'Next decision gate']}
          rows={risks.rows.map(row => [`${row.category}: ${row.risk}`, row.impact, row.mitigation, row.nextGate])}
        />
      </PdfPageCard>

      <PdfPageCard page={8} title="Appendix / Source Record" accent={accent}>
        <p>{appendix.intro}</p>
        <DataTable rows={appendix.rows} />
        <LabelValue label="Approval and distribution" value={appendix.approvalNote} />
      </PdfPageCard>
    </div>
  );
}
