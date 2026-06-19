import {
  Beaker, CircleAlert, ClipboardCheck, FlaskConical, PackageSearch, Target, Users,
} from 'lucide-react';
import type { CommercializationProjectProfile } from '../lib/report-evidence-types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

function DetailList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm leading-5 text-slate-700">
      {items.map(item => (
        <li key={item} className="flex gap-2.5">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-slate-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-b-0">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm leading-5 text-slate-900">{value}</dd>
    </div>
  );
}

export function CommercializationProductDossier({ profile }: { profile: CommercializationProjectProfile }) {
  return (
    <Card className="break-inside-avoid border border-slate-200 bg-white">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2.5 text-base">
              <span className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <PackageSearch className="size-4" />
              </span>
              Product development dossier
            </CardTitle>
            <p className="mt-2 max-w-3xl text-sm leading-5 text-slate-600">
              The product, study, technical, market-hypothesis, claims, and execution context available to the report.
            </p>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            Reference/demo evidence
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">
          {profile.evidenceLabel}
        </div>

        <dl className="mt-4 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Category" value={profile.product.category} />
          <Fact label="Base system" value={profile.product.baseSystem} />
          <Fact label="Development stage" value={profile.product.developmentStage} />
          <Fact label="Format hypothesis" value={profile.product.formatHypothesis} />
          <Fact label="Sensory population" value={profile.studyDesign.sensoryPopulation} />
          <Fact label="Concept population" value={profile.studyDesign.conceptPopulation} />
        </dl>

        <Accordion type="multiple" defaultValue={['development', 'study', 'concept', 'actions']} className="mt-5">
          <AccordionItem value="development">
            <AccordionTrigger>
              <span className="flex items-center gap-2"><Beaker className="size-4 text-slate-500" />Product development and formulation</span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="mb-4 max-w-4xl text-sm leading-6 text-slate-700">{profile.development.objective}</p>
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-950">Documented strengths</h4>
                  <DetailList items={profile.development.strengths} />
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-950">Technical risks</h4>
                  <DetailList items={profile.development.technicalRisks} />
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-950">Known formulation context</h4>
                  <DetailList items={profile.development.formulationKnown} />
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-950">Information still required</h4>
                  <DetailList items={profile.development.formulationUnknown} />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="study">
            <AccordionTrigger>
              <span className="flex items-center gap-2"><FlaskConical className="size-4 text-slate-500" />Study design and instrumental evidence</span>
            </AccordionTrigger>
            <AccordionContent>
              <dl className="grid gap-x-6 sm:grid-cols-2">
                <Fact label="Sensory method" value={profile.studyDesign.sensoryMethod} />
                <Fact label="Instrumental method" value={profile.studyDesign.instrumentalMethod} />
                <Fact label="Instrument population" value={profile.studyDesign.instrumentalPopulation} />
                <Fact label="Evidence boundary" value={profile.studyDesign.collectionBoundary} />
              </dl>
              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Finding</th>
                      <th className="px-4 py-3">Benchmark</th>
                      <th className="px-4 py-3">Effect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profile.instrumentalSummary.map(item => (
                      <tr key={item.source}>
                        <td className="px-4 py-3 font-medium text-slate-900">{item.source}</td>
                        <td className="px-4 py-3 text-slate-700">{item.finding}</td>
                        <td className="px-4 py-3 text-slate-700">{item.benchmark}</td>
                        <td className="px-4 py-3 capitalize text-slate-700">{item.effect}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="concept">
            <AccordionTrigger>
              <span className="flex items-center gap-2"><Target className="size-4 text-slate-500" />Concept and market hypothesis</span>
            </AccordionTrigger>
            <AccordionContent>
              <dl className="grid gap-x-6 lg:grid-cols-2">
                <Fact label="Positioning hypothesis" value={profile.conceptHypothesis.positioning} />
                <Fact label="Target segment" value={profile.conceptHypothesis.targetSegment} />
                <Fact label="Consumer need" value={profile.conceptHypothesis.consumerNeed} />
                <Fact label="Usage occasion" value={profile.conceptHypothesis.usageOccasion} />
                <Fact label="Product promise" value={profile.conceptHypothesis.productPromise} />
                <Fact label="Price hypothesis" value={profile.conceptHypothesis.priceHypothesis} />
                <Fact label="Packaging hypothesis" value={profile.conceptHypothesis.packagingHypothesis} />
              </dl>
              <div className="mt-5 grid gap-6 lg:grid-cols-2">
                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950"><ClipboardCheck className="size-4" />Reasons to believe</h4>
                  <DetailList items={profile.conceptHypothesis.reasonsToBelieve} />
                </div>
                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950"><Users className="size-4" />Validation questions</h4>
                  <DetailList items={profile.conceptHypothesis.validationQuestions} />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="claims">
            <AccordionTrigger>
              <span className="flex items-center gap-2"><CircleAlert className="size-4 text-slate-500" />Claims boundary</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-6 lg:grid-cols-3">
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-950">Supported internal language</h4>
                  <DetailList items={profile.claimsBoundary.supportedInternalLanguage} />
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-950">Prohibited until validated</h4>
                  <DetailList items={profile.claimsBoundary.prohibitedUntilValidated} />
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-950">Required reviews</h4>
                  <DetailList items={profile.claimsBoundary.requiredReviews} />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="actions">
            <AccordionTrigger>
              <span className="flex items-center gap-2"><ClipboardCheck className="size-4 text-slate-500" />Operational action plan</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[980px] text-left text-xs">
                  <thead className="bg-slate-50 font-semibold text-slate-600">
                    <tr>
                      <th className="px-3 py-3">Workstream</th>
                      <th className="px-3 py-3">Owner / due</th>
                      <th className="px-3 py-3">Required action</th>
                      <th className="px-3 py-3">Completion and pass</th>
                      <th className="px-3 py-3">Next gate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profile.actionPlan.map(item => (
                      <tr key={item.workstream}>
                        <td className="px-3 py-3 align-top font-semibold text-slate-900">{item.workstream}<span className="mt-1 block font-normal capitalize text-slate-500">{item.priority} priority</span></td>
                        <td className="px-3 py-3 align-top text-slate-700">{item.owner}<span className="mt-1 block text-slate-500">{item.dueDate ?? 'Not scheduled'} · {item.team}</span></td>
                        <td className="px-3 py-3 align-top text-slate-700">{item.action}</td>
                        <td className="px-3 py-3 align-top text-slate-700"><strong>Evidence:</strong> {item.completionEvidence}<br /><strong>Pass:</strong> {item.passingCriteria}</td>
                        <td className="px-3 py-3 align-top text-slate-700">{item.nextGate}<span className="mt-1 block text-slate-500">Depends on: {item.dependencies.join(', ')}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
