import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { toneSolidClasses } from './project-status-badge';
import type { NextAction } from '../lib/project-status';

interface NextActionCardProps {
  projectName: string;
  action: NextAction;
  /** When set, the "Next for …" kicker links to the project's Command Center. */
  projectPath?: string;
  onNavigate?: () => void;
}

/** Single, prominent "what should I click next" callout for a project. */
export function NextActionCard({ projectName, action, projectPath, onNavigate }: NextActionCardProps) {
  return (
    <Card className="border-slate-200 bg-white">
      <CardContent className="flex items-center justify-between gap-4 py-5">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {projectPath ? (
              <Link to={projectPath} onClick={onNavigate} className="hover:text-slate-700 transition-colors">
                Next for {projectName}
              </Link>
            ) : <>Next for {projectName}</>}
          </div>
          <div className="mt-1 text-base font-bold text-slate-900">{action.label}</div>
          <p className="mt-1 text-sm text-slate-700">{action.description}</p>
        </div>
        <Link
          to={action.path}
          onClick={onNavigate}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors hover:opacity-90 ${toneSolidClasses(action.tone)}`}
        >
          Continue <ArrowRight className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
