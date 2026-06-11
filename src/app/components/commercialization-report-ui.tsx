import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ProjectStatusBadge } from './project-status-badge';
import { DEFAULT_REPORT_ORGANIZATION_NAME } from '../lib/commercialization-report';
import type { SemanticTone } from '../lib/project-status';
import type { WorkspaceSettings } from '../lib/database';

export function ReportSection({ title, icon: Icon, tone = 'neutral', children }: {
  title: string;
  icon: React.ElementType;
  tone?: SemanticTone;
  children: React.ReactNode;
}) {
  const iconToneClass: Record<SemanticTone, string> = {
    neutral: 'bg-slate-100 text-slate-600',
    info: 'bg-blue-50 text-blue-600',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    critical: 'bg-rose-50 text-rose-600',
    creative: 'bg-purple-50 text-purple-600',
  };
  return (
    <Card className="break-inside-avoid border border-slate-200 bg-white">
      <CardHeader className="border-b border-slate-100 pb-3">
        <CardTitle className="flex items-center gap-2.5 text-base">
          <span className={`flex size-8 items-center justify-center rounded-lg ${iconToneClass[tone]}`}>
            <Icon className="size-4" />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3 text-sm text-slate-700">
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Branded strip showing the active client/tenant's logo and organization
 * name from WorkspaceSettings, with the platform default as a fallback.
 * The same WorkspaceSettings fields drive the PDF export header.
 */
export function ReportBrandStrip({ settings }: { settings?: WorkspaceSettings | null }) {
  const orgName = settings?.organizationName || DEFAULT_REPORT_ORGANIZATION_NAME;
  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-t-4 border-slate-200 bg-white px-4 py-2.5"
      style={settings?.accentColor ? { borderTopColor: settings.accentColor } : undefined}
    >
      {settings?.logoUrl && (
        <img src={settings.logoUrl} alt={`${orgName} logo`} className="h-7 w-auto object-contain" />
      )}
      <span className="text-sm font-semibold text-slate-700">{orgName}</span>
    </div>
  );
}

export function MetricTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="text-lg font-bold text-slate-900">{value}</div>
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

export function ScoreBars({ entries }: { entries: Array<{ label: string; value: number; max?: number }> }) {
  return (
    <div className="space-y-1.5">
      {entries.map(({ label, value, max = 10 }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 text-xs capitalize text-slate-600">{label}</span>
          <div className="h-2 flex-1 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-semibold text-slate-700">{value.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

/** Qualitative framing for a 0-100 decision confidence score, aligned with the GO confidence gate (>=72). */
export function confidenceLevel(confidence: number): 'High' | 'Moderate' | 'Low' {
  if (confidence >= 80) return 'High';
  if (confidence >= 60) return 'Moderate';
  return 'Low';
}

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = confidenceLevel(confidence);
  const tone: SemanticTone = level === 'High' ? 'success' : level === 'Moderate' ? 'warning' : 'critical';
  return <ProjectStatusBadge label={`${level} confidence (${confidence.toFixed(0)}%)`} tone={tone} />;
}

/**
 * Report cover banner: branding, sample/category, and the headline decision,
 * score, and confidence — replaces the previous title + dashboard-tile header
 * so the report opens with a single scannable cover rather than a metrics grid.
 */
export function ReportCoverHeader({ settings, sampleName, foodTypeLabel, decision, issfScore, confidence, decisionTone, timestamp, draftLabel }: {
  settings?: WorkspaceSettings | null;
  sampleName: string;
  foodTypeLabel: string;
  decision: string;
  issfScore: number;
  confidence: number;
  decisionTone: SemanticTone;
  timestamp: string;
  draftLabel?: string;
}) {
  const orgName = settings?.organizationName || DEFAULT_REPORT_ORGANIZATION_NAME;
  return (
    <div
      className="break-inside-avoid overflow-hidden rounded-xl border border-t-4 border-slate-200 bg-white px-6 py-5"
      style={settings?.accentColor ? { borderTopColor: settings.accentColor } : undefined}
    >
      <div className="flex items-center gap-3">
        {settings?.logoUrl && (
          <img src={settings.logoUrl} alt={`${orgName} logo`} className="h-7 w-auto object-contain" />
        )}
        <span className="text-sm font-semibold text-slate-500">{orgName}</span>
      </div>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Commercialization Report</h1>
      <p className="mt-1 text-sm text-slate-500">{sampleName} · {foodTypeLabel}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ProjectStatusBadge label={`${decision} · ISSF ${issfScore.toFixed(0)}`} tone={decisionTone} />
        <ConfidenceBadge confidence={confidence} />
        {draftLabel && <ProjectStatusBadge label={draftLabel} tone="info" />}
        <span className="text-xs text-slate-400">{new Date(timestamp).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
