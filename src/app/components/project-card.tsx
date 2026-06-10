import { Link } from 'react-router';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { ProjectStatusBadge, toneSolidClasses } from './project-status-badge';
import { ProjectWorkflowProgress } from './project-workflow-progress';
import { ProjectMetrics } from './project-metrics';
import type { ProjectStatusSummary } from '../lib/project-status';

interface ProjectCardProps {
  status: ProjectStatusSummary;
  onOpen?: () => void;
}

/**
 * Action-oriented summary of a single project / import batch. Answers:
 * what is this, where is it in the workflow, what needs attention, what's next.
 */
export function ProjectCard({ status, onOpen }: ProjectCardProps) {
  return (
    <Card className="border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 truncate">{status.projectName}</h3>
              <ProjectStatusBadge label={status.statusLabel} tone={status.statusTone} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{status.foodTypeLabel}</p>
          </div>
        </div>

        <ProjectWorkflowProgress stages={status.stages} variant="compact" />

        <ProjectMetrics status={status} />

        {status.warnings.length > 0 && (
          <div className="space-y-1">
            {status.warnings.map(warning => (
              <div key={warning} className="flex items-start gap-1.5 text-xs text-amber-700">
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
          <p className="text-xs text-slate-600 min-w-0">
            <span className="font-semibold text-slate-900">Next: </span>
            {status.nextAction.label}
          </p>
          <Link
            to={status.nextAction.path}
            onClick={onOpen}
            className={`flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors hover:opacity-90 ${toneSolidClasses(status.nextAction.tone)}`}
          >
            Go <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
