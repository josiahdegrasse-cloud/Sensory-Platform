import { FileText, FlaskConical, GitMerge, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import type { ProductTimeline, ProductHistoryEvent } from '../lib/product-history';

const EVENT_ICON: Record<string, typeof FlaskConical> = {
  import: FlaskConical,
  decision: GitMerge,
  concept: Lightbulb,
  report: FileText,
};

const EVENT_ACCENT: Record<string, string> = {
  import: 'border-blue-200 bg-blue-50 text-blue-700',
  concept: 'border-slate-200 bg-slate-50 text-slate-700',
  report: 'border-slate-200 bg-slate-50 text-slate-700',
};

const DECISION_ACCENT: Record<string, string> = {
  GO: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  TWEAK: 'border-amber-200 bg-amber-50 text-amber-700',
  STOP: 'border-rose-200 bg-rose-50 text-rose-700',
};

const DECISION_BADGE: Record<string, string> = {
  GO: 'bg-emerald-600 text-white',
  TWEAK: 'bg-amber-500 text-white',
  STOP: 'bg-rose-600 text-white',
};

function eventAccent(event: ProductHistoryEvent): string {
  if (event.type === 'decision') {
    const dec = event.metadata.decision as string | undefined;
    return dec ? (DECISION_ACCENT[dec] ?? EVENT_ACCENT.import) : EVENT_ACCENT.import;
  }
  return EVENT_ACCENT[event.type] ?? 'border-slate-200 bg-slate-50 text-slate-700';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function ReformulationConnector({ notes }: { notes: string }) {
  return (
    <div className="relative flex items-center gap-3 py-1 pl-9">
      <div className="absolute left-[1.3125rem] top-0 bottom-0 w-px bg-amber-200" />
      <div className="relative z-10 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
        Reformulation: {notes}
      </div>
    </div>
  );
}

function TimelineNode({ event, showConnector }: { event: ProductHistoryEvent; showConnector: boolean }) {
  const Icon = EVENT_ICON[event.type] ?? FileText;
  const accent = eventAccent(event);
  const decisionOutcome = event.type === 'decision' ? (event.metadata.decision as string) : null;

  return (
    <div className="relative flex gap-4">
      {showConnector && (
        <div className="absolute left-[1.3125rem] top-10 bottom-0 w-px bg-slate-200" />
      )}
      <div className={`relative z-10 mt-1 flex size-[2.625rem] shrink-0 items-center justify-center rounded-full border ${accent}`}>
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="flex-1 pb-6 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{event.label}</span>
          {decisionOutcome && (
            <Badge className={`text-xs ${DECISION_BADGE[decisionOutcome] ?? 'bg-slate-500 text-white'}`}>
              {decisionOutcome}
            </Badge>
          )}
          <span className="ml-auto text-xs text-slate-500 shrink-0">{formatDate(event.timestamp)}</span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{event.detail}</p>
        {event.type === 'decision' && typeof event.metadata.issfScore === 'number' && (
          <p className="mt-1 text-xs font-medium text-slate-700">
            ISSF {(event.metadata.issfScore as number).toFixed(1)}
            {typeof event.metadata.confidence === 'number' && ` · ${Math.round((event.metadata.confidence as number) * 100)}% confidence`}
          </p>
        )}
      </div>
    </div>
  );
}

export function ProductHistoryTimeline({ timeline }: { timeline: ProductTimeline }) {
  if (timeline.events.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-slate-500">
        No history events found for this product yet.
      </div>
    );
  }

  const events = timeline.events;

  return (
    <Card className="border border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="size-4 text-slate-500" aria-hidden />
          Development history: {timeline.sampleName}
        </CardTitle>
        {timeline.issfProgression.length > 1 && (
          <p className="text-sm text-slate-500">
            ISSF progression: {timeline.issfProgression.map(s => s.score.toFixed(1)).join(' → ')}
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-5">
        <div>
          {events.map((event, i) => {
            const next = events[i + 1];
            const showConnector = i < events.length - 1;
            const isDecisionTweakOrStop =
              event.type === 'decision' &&
              (event.metadata.decision === 'TWEAK' || event.metadata.decision === 'STOP');
            const nextIsImport = next?.type === 'import';
            const reformulationNotes = nextIsImport
              ? (next.metadata.reformulationNotes as string | null)
              : null;

            return (
              <div key={event.id}>
                <TimelineNode event={event} showConnector={showConnector} />
                {isDecisionTweakOrStop && nextIsImport && reformulationNotes && (
                  <ReformulationConnector notes={reformulationNotes} />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
