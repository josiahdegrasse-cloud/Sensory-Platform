import { Link } from 'react-router';
import {
  FileText, FileSpreadsheet, Presentation, Sparkles, GitMerge, FlaskConical,
  Users, AlertTriangle, ListChecks, Target, Lightbulb, Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { ProjectStatusBadge, toneSolidClasses } from './project-status-badge';
import { DataProvenanceBadge } from './data-provenance-badge';
import {
  formatDecisionDimension, type CommercializationReportSnapshot, type ConceptEvidenceSummary,
} from '../lib/commercialization-report';
import type {
  ChemicalCompositionRecord, CommercializationReportRecord,
  ConceptTest, DecisionRecord, ETongueMeasurementRecord, GCMSCompoundRecord,
} from '../lib/database';
import type { EnhancedSensoryProfile } from '../data/enhanced-sensory';
import type { LiveAggregation } from '../lib/use-survey-data';
import type { SemanticTone } from '../lib/project-status';
import { ReportSection, MetricTile, ScoreBars } from './commercialization-report-ui';

interface ReportOverviewPanelProps {
  snapshot: CommercializationReportSnapshot | null;
  focusDecision: DecisionRecord;
  decisionTone: SemanticTone;
  foodTypeLabel: string;
  sensoryProvenance: 'live' | 'reference' | 'none';
  matchingLiveSensory: LiveAggregation | undefined;
  sample: ETongueMeasurementRecord | undefined;
  evidence: ConceptEvidenceSummary | null;
  projectConcept: ConceptTest | null;
  sensoryProfile: EnhancedSensoryProfile | undefined;
  composition: ChemicalCompositionRecord | undefined;
  compounds: GCMSCompoundRecord[];
  executiveSummary: string;
  executiveHighlights: string[];
  whyLiked: string;
  launchRecommendation: string;
  claimCaution: string;
  risks: string[];
  nextSteps: string[];
  savedReport: CommercializationReportRecord | null;
  exportPdf: () => void;
  exporting: 'pdf' | null;
  exportError: string;
}

/**
 * The "Overview" tab body for the Commercialization Report: live/saved data-source
 * badges, executive summary, sensory/instrumental/concept summaries, narrative,
 * risks, next steps, an appendix accordion, and export actions.
 */
export function ReportOverviewPanel({
  snapshot,
  focusDecision,
  decisionTone,
  foodTypeLabel,
  sensoryProvenance,
  matchingLiveSensory,
  sample,
  evidence,
  projectConcept,
  sensoryProfile,
  composition,
  compounds,
  executiveSummary,
  executiveHighlights,
  whyLiked,
  launchRecommendation,
  claimCaution,
  risks,
  nextSteps,
  savedReport,
  exportPdf,
  exporting,
  exportError,
}: ReportOverviewPanelProps) {
  const appendixIntensity = matchingLiveSensory && Object.keys(matchingLiveSensory.intensity).length > 0
    ? { scale: 5, entries: Object.entries(matchingLiveSensory.intensity).slice(0, 5).map(([label, value]) => ({ label, value: value as number, max: 5 })) }
    : !matchingLiveSensory && sensoryProfile
    ? { scale: 10, entries: Object.entries(sensoryProfile.intensity).slice(0, 5).map(([label, value]) => ({ label, value: value as number })) }
    : null;
  const topCompounds = [...compounds].sort((a, b) => b.concentration - a.concentration).slice(0, 5);

  return (
    <>
      {!snapshot && (
        <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <Sparkles className="mt-0.5 size-4 shrink-0" />
          <p>
            This is a live view assembled from the project's current decision, instrumental data, and concept evidence.
            {focusDecision.decision === 'GO' && (
              <> Open <Link to="/decision" className="font-semibold underline underline-offset-2">Decision review</Link> to generate and save a formal branded draft.</>
            )}
          </p>
        </div>
      )}

      {/* Data sources */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Data sources</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="mb-1.5 text-xs font-semibold text-slate-600">Sensory profile</div>
            {sensoryProvenance === 'live' && <DataProvenanceBadge provenance="live" n={matchingLiveSensory?.n} />}
            {sensoryProvenance === 'reference' && <DataProvenanceBadge provenance="reference" />}
            {sensoryProvenance === 'none' && <span className="text-xs text-slate-400">Not available</span>}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="mb-1.5 text-xs font-semibold text-slate-600">Instrumental data</div>
            {sample ? <DataProvenanceBadge provenance="imported" /> : <span className="text-xs text-slate-400">Not linked</span>}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="mb-1.5 text-xs font-semibold text-slate-600">Concept evidence</div>
            {evidence && evidence.responseCount > 0
              ? <DataProvenanceBadge provenance="live" n={evidence.responseCount} />
              : <span className="text-xs text-slate-400">{projectConcept ? 'No responses yet' : 'No concept linked'}</span>}
          </div>
          <MetricTile label="Purchase intent" value={evidence?.purchaseIntent ? evidence.purchaseIntent.toFixed(1) : 'N/A'} sub="1–9 scale" />
        </div>
      </div>

      {/* Executive Summary */}
      <ReportSection title="Executive Summary" icon={Target} tone={decisionTone}>
        <p>{executiveSummary}</p>
        <ul className="space-y-1.5 border-t border-slate-100 pt-3 text-xs">
          {executiveHighlights.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </ReportSection>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Product Snapshot */}
        <ReportSection title="Product Snapshot" icon={FlaskConical} tone="info">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div><dt className="font-semibold text-slate-500">Sample</dt><dd className="text-slate-900">{focusDecision.sampleName}</dd></div>
            <div><dt className="font-semibold text-slate-500">Category</dt><dd className="text-slate-900">{foodTypeLabel}</dd></div>
            <div><dt className="font-semibold text-slate-500">Concept</dt><dd className="text-slate-900">{projectConcept?.name ?? '— not yet built —'}</dd></div>
            <div><dt className="font-semibold text-slate-500">Target market</dt><dd className="text-slate-900">{projectConcept?.targetMarket || '—'}</dd></div>
            <div><dt className="font-semibold text-slate-500">Price point</dt><dd className="text-slate-900">{projectConcept?.pricePoint || '—'}</dd></div>
            <div><dt className="font-semibold text-slate-500">Method</dt><dd className="font-mono text-slate-900">{focusDecision.methodVersion}</dd></div>
          </dl>
          {projectConcept?.description && <p className="text-xs text-slate-600 border-t border-slate-100 pt-3">{projectConcept.description}</p>}
        </ReportSection>

        {/* Decision Rationale */}
        <ReportSection title="Decision Rationale" icon={GitMerge} tone={decisionTone}>
          <div className="flex items-center gap-2">
            <ProjectStatusBadge label={focusDecision.decision} tone={decisionTone} />
            <span className="text-xs text-slate-500">Recorded {new Date(focusDecision.timestamp).toLocaleString()} by {focusDecision.user}</span>
          </div>
          <p>{focusDecision.note || 'No additional rationale note was recorded with this decision.'}</p>
          {snapshot ? (
            <>
              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-4">
                {Object.entries(snapshot.decision.dimensions).map(([dimension, score]) => (
                  <div key={dimension} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <div className="text-sm font-bold text-slate-900">{(score as number).toFixed(0)}</div>
                    <div className="text-[11px] text-slate-500">{formatDecisionDimension(dimension as Parameters<typeof formatDecisionDimension>[0])}</div>
                  </div>
                ))}
              </div>
              {snapshot.decision.prescriptions.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="mb-1.5 text-xs font-semibold text-slate-500">Formulation watch points</p>
                  <ul className="space-y-1">
                    {snapshot.decision.prescriptions.slice(0, 3).map((prescription, i) => (
                      <li key={i} className="text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">{prescription.target}: </span>
                        {prescription.action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
              A breakdown of sensory acceptance, texture, descriptor, and emotional-response scores, plus formulation watch points, will appear here once a branded report draft is saved from the Decision page.
            </p>
          )}
        </ReportSection>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sensory Summary */}
        <ReportSection title="Sensory Summary" icon={Sparkles} tone="creative">
          {matchingLiveSensory ? (
            <>
              <DataProvenanceBadge provenance="live" n={matchingLiveSensory.n} className="mb-1" />
              <p className="text-xs text-slate-500">Hedonic averages (1–9 scale)</p>
              <ScoreBars entries={[
                { label: 'overall', value: matchingLiveSensory.hedonic.overall ?? 0, max: 9 },
                { label: 'appearance', value: matchingLiveSensory.hedonic.appearance ?? 0, max: 9 },
                { label: 'aroma', value: matchingLiveSensory.hedonic.aroma ?? 0, max: 9 },
                { label: 'flavor', value: matchingLiveSensory.hedonic.flavor ?? 0, max: 9 },
                { label: 'texture', value: matchingLiveSensory.hedonic.texture ?? 0, max: 9 },
              ]} />
            </>
          ) : sensoryProfile ? (
            <>
              <DataProvenanceBadge provenance="reference" className="mb-1" />
              <p className="text-xs text-slate-500">Hedonic averages (1–9 scale)</p>
              <ScoreBars entries={Object.entries(sensoryProfile.hedonic).map(([label, value]) => ({ label, value: value as number, max: 9 }))} />
              <p className="border-t border-slate-100 pt-2 text-xs text-amber-700">
                This section uses reference/demo data and should not be presented as client evidence. Collect live panelist responses for this sample to replace it.
              </p>
            </>
          ) : (
            <p className="text-slate-500">No panel sensory profile is available for this sample yet.</p>
          )}
        </ReportSection>

        {/* Instrumental Summary */}
        <ReportSection title="Instrumental Summary" icon={ListChecks} tone="neutral">
          {sample ? (
            <>
              <p className="text-xs text-slate-500">E-tongue taste signals (0–10 scale)</p>
              <ScoreBars entries={[
                { label: 'sourness', value: sample.sourness },
                { label: 'bitterness', value: sample.bitterness },
                { label: 'saltiness', value: sample.saltiness },
                { label: 'umami', value: sample.umami },
                { label: 'sweetness', value: sample.sweetness },
              ]} />
              {composition && (
                <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                  <MetricTile label="Fat" value={`${composition.fat.toFixed(1)}%`} />
                  <MetricTile label="Protein" value={`${composition.protein.toFixed(1)}%`} />
                  <MetricTile label="Salt" value={`${composition.saltContent.toFixed(2)}%`} />
                </div>
              )}
              <p className="text-xs text-slate-500">{compounds.length} GC-MS compound{compounds.length === 1 ? '' : 's'} identified.</p>
            </>
          ) : (
            <p className="text-slate-500">No instrumental dataset is linked to this sample yet.</p>
          )}
        </ReportSection>
      </div>

      {/* Consumer Feedback */}
      <ReportSection title="Consumer Feedback" icon={Users} tone="info">
        {projectConcept && (
          <div className="flex items-center gap-2 text-xs">
            <ProjectStatusBadge label="Tested concept" tone="info" showIcon={false} />
            <span className="font-semibold text-slate-700">{projectConcept.name}</span>
          </div>
        )}
        {evidence && evidence.responseCount > 0 ? (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              <MetricTile label="Responses" value={String(evidence.responseCount)} />
              <MetricTile label="Purchase intent" value={evidence.purchaseIntent ? evidence.purchaseIntent.toFixed(1) : 'N/A'} sub="1–9 scale" />
              <MetricTile label="Top selection" value={evidence.topSelections[0]?.option ?? '—'} sub={evidence.topSelections[0] ? `${evidence.topSelections[0].percentage.toFixed(0)}% of panel` : undefined} />
            </div>
            {evidence.comments.length > 0 && (
              <ul className="space-y-1.5 border-t border-slate-100 pt-3">
                {evidence.comments.slice(0, 3).map((comment, i) => (
                  <li key={i} className="text-xs italic text-slate-600">"{comment}"</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-slate-500 pt-1">{whyLiked}</p>
          </>
        ) : (
          <p className="text-slate-500">
            {projectConcept ? 'No panelist responses have been collected for this concept yet.' : 'No concept test has been linked to this project — launch one from Concept Lab to gather consumer evidence.'}
          </p>
        )}
      </ReportSection>

      {/* Commercialization Narrative */}
      <ReportSection title="Commercialization Narrative" icon={Lightbulb} tone="creative">
        <p><strong className="text-slate-900">Why it resonates: </strong>{whyLiked}</p>
        <p><strong className="text-slate-900">Launch recommendation: </strong>{launchRecommendation}</p>
        {snapshot?.narrative.packagingRationale && (
          <p><strong className="text-slate-900">Packaging rationale: </strong>{snapshot.narrative.packagingRationale}</p>
        )}
      </ReportSection>

      {/* Risks */}
      <ReportSection title="Risks" icon={AlertTriangle} tone={risks.length > 0 ? 'warning' : 'success'}>
        {risks.length > 0 ? (
          <ul className="space-y-1.5">
            {risks.map((risk, i) => (
              <li key={i} className="flex items-start gap-2 text-amber-800">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-emerald-700">No outstanding risks were detected for this project.</p>
        )}
        <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">{claimCaution}</p>
      </ReportSection>

      {/* Recommended Next Steps */}
      <ReportSection title="Recommended Next Steps" icon={ListChecks} tone="info">
        {nextSteps.length > 0 ? (
          <ol className="space-y-1.5 list-decimal pl-4">
            {nextSteps.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
        ) : (
          <p className="text-slate-500">No further actions are required — this project is ready for launch handoff.</p>
        )}
      </ReportSection>

      {/* Appendix */}
      <Card className="break-inside-avoid border border-slate-200 bg-white">
        <Accordion type="single" collapsible>
          <AccordionItem value="appendix" className="border-b-0">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <span className="flex items-center gap-2.5 text-base font-semibold text-slate-900">
                <span className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <ListChecks className="size-4" />
                </span>
                Appendix: Detailed Data
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 px-6 text-sm text-slate-700">
              {appendixIntensity && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-slate-500">Intensity ratings ({appendixIntensity.scale === 5 ? '0–5' : '0–10'} scale)</p>
                  <ScoreBars entries={appendixIntensity.entries} />
                </div>
              )}
              {composition && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="mb-1.5 text-xs font-semibold text-slate-500">Additional composition</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <MetricTile label="Moisture" value={`${composition.moisture.toFixed(1)}%`} />
                    <MetricTile label="pH" value={composition.pH.toFixed(2)} />
                    <MetricTile label="Calcium" value={`${composition.calciumMg.toFixed(0)} mg`} />
                  </div>
                </div>
              )}
              {topCompounds.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="mb-1.5 text-xs font-semibold text-slate-500">Top GC-MS compounds by concentration</p>
                  <ul className="space-y-1 text-xs">
                    {topCompounds.map(compound => (
                      <li key={compound.name} className="flex items-center justify-between gap-2">
                        <span className="text-slate-700">{compound.name} <span className="text-slate-400">({compound.aroma})</span></span>
                        <span className="font-mono text-slate-500">{compound.concentration.toFixed(1)} ppm</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="border-t border-slate-100 pt-3">
                <p className="mb-1.5 text-xs font-semibold text-slate-500">Report metadata</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div><dt className="text-slate-500">Decision record</dt><dd className="font-mono text-slate-700">{snapshot?.decision.recordId ?? focusDecision.id}</dd></div>
                  <div><dt className="text-slate-500">Method version</dt><dd className="font-mono text-slate-700">{snapshot?.decision.methodVersion ?? focusDecision.methodVersion}</dd></div>
                  {savedReport && (
                    <div><dt className="text-slate-500">Report version</dt><dd className="text-slate-700">v{savedReport.version} · {savedReport.status}</dd></div>
                  )}
                  <div><dt className="text-slate-500">Generated</dt><dd className="text-slate-700">{new Date(snapshot?.generatedAt ?? focusDecision.timestamp).toLocaleString()}</dd></div>
                  <div className="col-span-2"><dt className="text-slate-500">Decision fingerprint</dt><dd className="break-all font-mono text-slate-700">{snapshot?.decision.fingerprint ?? focusDecision.decisionFingerprint}</dd></div>
                </dl>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      {/* Export */}
      <Card className="break-inside-avoid border border-slate-200 bg-white print:hidden">
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Download className="size-4" /></span>
            Export
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {exportError && <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{exportError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportPdf} disabled={!snapshot || exporting === 'pdf'} className={toneSolidClasses('info')}>
              <FileText className="size-4" />
              {exporting === 'pdf' ? 'Preparing PDF…' : 'Export PDF'}
            </Button>
            <Button variant="outline" disabled title="Excel export is coming soon">
              <FileSpreadsheet className="size-4" />
              Export Excel
            </Button>
            <Button variant="outline" disabled title="Slide deck export is coming soon">
              <Presentation className="size-4" />
              Export PPT
            </Button>
          </div>
          {!snapshot && (
            <p className="mt-2 text-xs text-slate-500">
              PDF export is available once a branded draft has been saved from the Decision page's commercialization report builder.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
