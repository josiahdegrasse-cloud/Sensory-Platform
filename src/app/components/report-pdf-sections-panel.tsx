import { Download } from 'lucide-react';
import { Button } from './ui/button';
import { MetricTile, ScoreBars } from './commercialization-report-ui';
import {
  downloadCommercializationReportPdf,
  type CommercializationReportPdfInput,
} from '../utils/commercialization-report-export';
import {
  TOC_ENTRIES,
  buildClosingSection,
  buildConceptPackagingSection,
  buildCoverData,
  buildExecutiveSummarySection,
  buildProductEvidenceSection,
  buildRisksNextStepsSection,
  type EvidenceStrengthTone,
} from '../utils/pdf/sections';

const STRENGTH_BADGE: Record<EvidenceStrengthTone, string> = {
  established: 'bg-emerald-600 text-white',
  limited: 'bg-amber-500 text-white',
  accent: 'bg-blue-600 text-white',
};

/** Approximate PDF page numbers for each TOC entry, matching the chapter layout in commercialization-report-export.ts. */
const TOC_PAGE_NUMBERS = [3, 4, 5, 6, 6];

function PdfPageCard({ page, eyebrow, title, accent, children }: {
  page: number;
  eyebrow: string;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>{eyebrow}</p>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">Page {page}</span>
      </div>
      <div className="space-y-4 p-6 text-sm text-slate-700">{children}</div>
    </div>
  );
}

function SubHeading({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
      <span className="size-1.5 rounded-full" style={{ backgroundColor: accent }} />
      {children}
    </h4>
  );
}

function BulletList({ items, accent }: { items: string[]; accent: string }) {
  return (
    <ul className="space-y-1.5 text-sm text-slate-700">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function DataTable({ head, rows }: { head?: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-xs">
        {head && (
          <thead className="bg-slate-50">
            <tr>{head.map(label => <th key={label} className="px-3 py-2 font-semibold text-slate-600">{label}</th>)}</tr>
          </thead>
        )}
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-2 align-top ${j === 0 ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Renders each chapter of the commercialization report PDF as a styled HTML
 * card, using the same `pdf/sections.ts` data builders as the jsPDF export —
 * so this preview stays in sync with the downloaded document.
 */
export function ReportPdfSectionsPanel({ input }: { input: CommercializationReportPdfInput }) {
  const primary = input.primaryColor || '#020617';
  const accent = input.accentColor || '#2563eb';
  const { snapshot } = input;
  const packagingUrl = snapshot.concept.packagingImageUrl || null;

  const cover = buildCoverData(input);
  const executive = buildExecutiveSummarySection(input);
  const productEvidence = buildProductEvidenceSection(input);
  const conceptPackaging = buildConceptPackagingSection(input);
  const risksNextSteps = buildRisksNextStepsSection(input);
  const closing = buildClosingSection(input);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-950">PDF sections</h2>
          <p className="text-sm text-slate-500">Each card mirrors a page of the exported PDF — review the content here before downloading.</p>
        </div>
        <Button variant="outline" onClick={() => downloadCommercializationReportPdf(input)}>
          <Download className="size-4" />Download PDF
        </Button>
      </div>

      {/* Cover */}
      <PdfPageCard page={1} eyebrow="Cover" title="Commercialization report cover" accent={accent}>
        <div className="rounded-lg p-5 text-white" style={{ backgroundColor: primary }}>
          <p className="text-xs font-semibold">{cover.organizationName}</p>
          <h3 className="mt-2 text-2xl font-bold">Commercialization Report</h3>
          <p className="mt-1 text-sm text-slate-200">{cover.sampleName}</p>
          <p className="text-xs text-slate-300">{cover.foodType} | {cover.workspaceName}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold">{cover.decisionOutcome}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${STRENGTH_BADGE[cover.strengthTone]}`}>{cover.strengthLabel}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Recommended path</p>
            <p className="mt-1 text-base font-bold text-slate-900">{cover.recommendedPath}</p>
          </div>
          {packagingUrl && (
            <div className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
              <img src={packagingUrl} alt="Selected packaging direction" className="size-28 rounded object-cover" />
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Selected direction</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-4">
          <MetricTile label="Generated" value={cover.generatedLabel} />
          <MetricTile label="Report status" value={cover.status.toUpperCase()} />
          <MetricTile label="Report version" value={String(cover.version)} />
          <MetricTile label="Decision record" value="Saved and traceable" />
        </div>
        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: STRENGTH_BADGE[cover.strengthTone].includes('emerald') ? '#059669' : STRENGTH_BADGE[cover.strengthTone].includes('amber') ? '#d97706' : accent }}>
            Evidence strength note
          </p>
          <p className="mt-1 text-xs text-slate-600">{cover.evidenceStrengthNote}</p>
        </div>
      </PdfPageCard>

      {/* Table of contents */}
      <PdfPageCard page={2} eyebrow="Contents" title="Contents and reading guide" accent={accent}>
        <ul className="divide-y divide-slate-100">
          {TOC_ENTRIES.map((entry, i) => (
            <li key={entry.number} className="flex items-start justify-between gap-3 py-2.5">
              <div className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: accent }}>{entry.number}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{entry.title}</p>
                  <p className="text-xs text-slate-500">{entry.detail}</p>
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold text-slate-400">p. {TOC_PAGE_NUMBERS[i]}</span>
            </li>
          ))}
        </ul>
      </PdfPageCard>

      {/* Chapter 1: Executive summary */}
      <PdfPageCard page={3} eyebrow="Chapter 1" title="Executive summary and evidence confidence" accent={accent}>
        <p>{executive.executiveSummary}</p>
        <BulletList items={executive.highlights} accent={accent} />
        <SubHeading accent={accent}>Product snapshot</SubHeading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {executive.snapshotTiles.map(([label, value]) => (
            <MetricTile key={label} label={label} value={value} />
          ))}
        </div>
        <SubHeading accent={accent}>Evidence strength &amp; data provenance</SubHeading>
        <DataTable head={['Evidence source', 'Status', 'Client-facing interpretation']} rows={executive.provenanceRows} />
      </PdfPageCard>

      {/* Chapter 2: Product evidence */}
      <PdfPageCard page={4} eyebrow="Chapter 2" title="Product evidence and decision rationale" accent={accent}>
        <p>{productEvidence.intro}</p>
        <ScoreBars entries={productEvidence.dimensionBars.map(d => ({ label: d.label, value: d.value, max: 100 }))} />
        <ul className="space-y-1 text-xs text-slate-500">
          {productEvidence.dimensionBars.map(d => (
            <li key={d.label}><span className="font-semibold text-slate-600">{d.label}: </span>{d.interpretation}</li>
          ))}
        </ul>
        <SubHeading accent={accent}>Key strengths</SubHeading>
        <p>{productEvidence.keyStrengths}</p>
        <SubHeading accent={accent}>Formulation watch points</SubHeading>
        {productEvidence.watchPoints
          ? <BulletList items={productEvidence.watchPoints} accent={accent} />
          : <p className="text-slate-500">{productEvidence.watchPointsFallback}</p>}
        <SubHeading accent={accent}>Instrumental evidence</SubHeading>
        <p className="text-slate-500">{productEvidence.instrumentalNote}</p>
        <SubHeading accent={accent}>Decision rationale</SubHeading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {productEvidence.decisionTiles.map(([label, value]) => (
            <MetricTile key={label} label={label} value={value} />
          ))}
        </div>
        <p className="font-bold text-slate-900">{productEvidence.decisionRecommendation}</p>
        {productEvidence.gates.length > 0
          ? <DataTable head={['Decision gate', 'Result', 'What it means']} rows={productEvidence.gates.map(gate => [gate.label, gate.status.toUpperCase(), gate.detail])} />
          : <p className="text-slate-500">Detailed hard-gate results are not stored in this report version. The recommendation remains tied to the saved decision record.</p>}
      </PdfPageCard>

      {/* Chapter 3: Concept and packaging */}
      <PdfPageCard page={5} eyebrow="Chapter 3" title="Concept, packaging, and market direction" accent={accent}>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">{conceptPackaging.conceptName}</h3>
              <p className="mt-1 text-slate-600">{conceptPackaging.conceptDescription}</p>
            </div>
            <dl className="space-y-1.5 text-xs">
              <div><dt className="inline font-semibold text-slate-500">Positioning: </dt><dd className="inline text-slate-700">{conceptPackaging.positioning}</dd></div>
              <div><dt className="inline font-semibold text-slate-500">Target consumer: </dt><dd className="inline text-slate-700">{conceptPackaging.targetConsumer}</dd></div>
              <div><dt className="inline font-semibold text-slate-500">Price point: </dt><dd className="inline text-slate-700">{conceptPackaging.pricePoint}</dd></div>
            </dl>
          </div>
          {packagingUrl && (
            <div className="max-w-36 shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
              <img src={packagingUrl} alt="Selected packaging direction" className="size-28 rounded object-cover" />
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Selected direction</p>
              {conceptPackaging.packagingProvenance && (
                <p className="mt-0.5 text-[10px] text-slate-500">{conceptPackaging.packagingProvenance}</p>
              )}
              {conceptPackaging.packagingDisclaimer && (
                <p className="mt-1 text-[9px] leading-snug text-slate-400">{conceptPackaging.packagingDisclaimer}</p>
              )}
            </div>
          )}
        </div>
        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <p className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${STRENGTH_BADGE[conceptPackaging.strengthTone]}`}>{conceptPackaging.evidenceStrengthLabel}</p>
          <p className="mt-2 text-xs text-slate-600">{conceptPackaging.evidenceStrengthNote}</p>
        </div>
        <SubHeading accent={accent}>Final commercialization recommendation</SubHeading>
        <BulletList items={conceptPackaging.recommendationItems} accent={accent} />
      </PdfPageCard>

      {/* Chapter 4: Risks and next steps */}
      <PdfPageCard page={6} eyebrow="Chapter 4" title="Commercialization risks and next actions" accent={accent}>
        <SubHeading accent={accent}>Risks &amp; watch-outs</SubHeading>
        <DataTable head={['Risk', 'Why it matters', 'Recommended mitigation']} rows={risksNextSteps.risks.map(risk => [risk.risk, risk.why, risk.mitigation])} />
        <SubHeading accent={accent}>Recommended next steps</SubHeading>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
          {risksNextSteps.nextSteps.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
        <SubHeading accent={accent}>Appendix &amp; metadata</SubHeading>
        <DataTable rows={risksNextSteps.appendixRows} />
      </PdfPageCard>

      {/* Closing */}
      <PdfPageCard page={7} eyebrow="Closing note" title="A report built for review, decision, and handoff" accent={accent}>
        <h3 className="text-base font-bold text-slate-900">{closing.organizationName}</h3>
        <p className="text-slate-600">{closing.intro}</p>
        <SubHeading accent={accent}>Evidence and source notes</SubHeading>
        <BulletList items={closing.sourceNotes} accent={accent} />
        <div className="rounded-lg p-4 text-white" style={{ backgroundColor: primary }}>
          <p className="text-sm font-bold">Final distribution check</p>
          <p className="mt-2 text-xs text-slate-200">{closing.distributionMessage}</p>
        </div>
      </PdfPageCard>
    </div>
  );
}
