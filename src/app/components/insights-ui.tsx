import type { ElementType, ReactNode } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ArrowDown, ArrowRight, CheckCircle2, CircleHelp, Database, Radio, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { DataProvenanceBadge, type DataProvenance } from './data-provenance-badge';
import { ProjectStatusBadge, toneSolidClasses } from './project-status-badge';
import type { InsightsEvidenceStrength } from '../lib/insights';
import type { NextAction, SemanticTone } from '../lib/project-status';
import { cn } from './ui/utils';

const STRENGTH_TONE: Record<InsightsEvidenceStrength['level'], SemanticTone> = {
  Insufficient: 'critical',
  Limited: 'warning',
  Moderate: 'info',
  Strong: 'success',
};

export function InsightsSectionHeader({
  id,
  icon: Icon,
  title,
  description,
  action,
}: {
  id: string;
  icon: ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-28 flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          {description && <p className="mt-0.5 max-w-3xl text-sm text-slate-600">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function InsightsSectionNav({ sections }: {
  sections: Array<{ id: string; label: string }>;
}) {
  return (
    <nav aria-label="Insights sections" className="sticky top-[73px] z-20 -mx-1 overflow-x-auto border-y border-slate-200 bg-slate-50/95 px-1 py-2 backdrop-blur-sm">
      <div className="flex min-w-max gap-1">
        {sections.map(section => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function EvidenceStrengthCard({ strength }: { strength: InsightsEvidenceStrength }) {
  const tone = STRENGTH_TONE[strength.level];
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm">Evidence strength</CardTitle>
            <p className="mt-1 text-xs text-slate-500">A qualitative assessment of evidence completeness, not a model confidence percentage.</p>
          </div>
          <ProjectStatusBadge label={strength.level} tone={tone} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <p className="text-sm font-medium leading-relaxed text-slate-800">{strength.note}</p>
        <ul className="space-y-1.5 text-xs text-slate-600">
          {strength.factors.map(factor => (
            <li key={factor} className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-400" />
              <span>{factor}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

interface DataSourceItem {
  label: string;
  available: boolean;
  provenance?: DataProvenance;
  n?: number;
  detail: string;
}

export function DataSourceSummary({ sources }: { sources: DataSourceItem[] }) {
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Available evidence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {sources.map(source => (
          <div key={source.label} className="flex items-start justify-between gap-3 border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {source.available
                  ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
                  : <CircleHelp className="size-4 shrink-0 text-slate-400" aria-hidden />}
                <span className="text-sm font-semibold text-slate-800">{source.label}</span>
              </div>
              <p className="mt-1 pl-6 text-xs leading-relaxed text-slate-500">{source.detail}</p>
            </div>
            {source.available && source.provenance && (
              <DataProvenanceBadge provenance={source.provenance} n={source.n} />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function InsightsExecutiveSummary({
  sampleName,
  category,
  projectName,
  panelResponses,
  conceptResponses,
  strength,
  keyStrength,
  keyConcern,
  nextAction,
}: {
  sampleName: string;
  category: string;
  projectName: string;
  panelResponses: number;
  conceptResponses: number;
  strength: InsightsEvidenceStrength;
  keyStrength: string;
  keyConcern: string;
  nextAction: NextAction;
}) {
  return (
    <Card id="overview" className="scroll-mt-28 overflow-hidden border border-slate-200 bg-white">
      <CardHeader className="border-b border-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">{projectName} · {category}</p>
            <CardTitle className="mt-1 text-xl text-slate-950">{sampleName}</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              {panelResponses} panel response{panelResponses === 1 ? '' : 's'}
              {conceptResponses > 0 ? ` · ${conceptResponses} concept response${conceptResponses === 1 ? '' : 's'}` : ''}
            </p>
          </div>
          <ProjectStatusBadge label={`${strength.level} evidence`} tone={STRENGTH_TONE[strength.level]} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <h3 className="text-sm font-bold text-slate-950">What matters now</h3>
        <dl className="divide-y divide-slate-100">
          <SummaryFinding label="Strength" value={keyStrength} tone="success" />
          <SummaryFinding label="Watch" value={keyConcern} tone="warning" />
        </dl>
        <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Next: {nextAction.label}</p>
            <p className="mt-0.5 text-sm text-blue-950">{nextAction.description}</p>
          </div>
          <Link
            to={nextAction.path}
            className={cn('flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors hover:opacity-90', toneSolidClasses(nextAction.tone))}
          >
            Continue <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        {!strength.representative && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{strength.note}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryFinding({ label, value, tone }: {
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'info';
}) {
  const classes = {
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    info: 'text-blue-700',
  }[tone];
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[72px_minmax(0,1fr)]">
      <dt className={cn('text-xs font-bold uppercase tracking-wide', classes)}>{label}</dt>
      <dd className="text-sm font-medium leading-relaxed text-slate-800">{value}</dd>
    </div>
  );
}

export function InsightInterpretationBlock({
  finding,
  evidence,
  confidence,
  action,
  tone = 'info',
}: {
  finding: string;
  evidence: string;
  confidence: string;
  action: string;
  tone?: 'info' | 'warning' | 'success';
}) {
  const Icon = tone === 'warning' ? AlertTriangle : tone === 'success' ? ShieldCheck : ArrowDown;
  const classes = {
    info: 'border-blue-200 bg-blue-50 text-blue-950',
    warning: 'border-amber-200 bg-amber-50 text-amber-950',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  }[tone];
  return (
    <div className={cn('rounded-lg border p-4', classes)}>
      <div className="flex items-center gap-2">
        <Icon className="size-4" aria-hidden />
        <h3 className="text-sm font-bold">What this means</h3>
      </div>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <InterpretationItem label="Finding" value={finding} />
        <InterpretationItem label="Evidence" value={evidence} />
        <InterpretationItem label="Confidence" value={confidence} />
        <InterpretationItem label="Recommended action" value={action} />
      </dl>
    </div>
  );
}

function InterpretationItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold opacity-70">{label}</dt>
      <dd className="mt-0.5 leading-relaxed">{value}</dd>
    </div>
  );
}

export function RawDataAppendix({ children }: { children: ReactNode }) {
  return (
    <details id="appendix" className="scroll-mt-28 rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
        Appendix and raw data
        <span className="ml-2 text-xs font-normal text-slate-500">Method notes, provenance, and exports</span>
      </summary>
      <div className="border-t border-slate-100 px-5 py-4">{children}</div>
    </details>
  );
}

export const SOURCE_ICONS = {
  panel: Radio,
  instrument: Database,
};
