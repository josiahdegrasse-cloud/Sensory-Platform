import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { toneSolidClasses } from './project-status-badge';
import type { NextAction } from '../lib/project-status';

interface NextActionCardProps {
  projectName: string;
  action: NextAction;
  onNavigate?: () => void;
}

/** Single, prominent "what should I click next" callout for a project. */
export function NextActionCard({ projectName, action, onNavigate }: NextActionCardProps) {
  return (
    <Card className="border border-slate-200 bg-white">
      <CardContent className="py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Next for {projectName}</div>
          <div className="text-sm font-bold text-slate-900 mt-0.5">{action.label}</div>
          <p className="text-xs text-slate-500 mt-0.5">{action.description}</p>
        </div>
        <Link
          to={action.path}
          onClick={onNavigate}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors hover:opacity-90 ${toneSolidClasses(action.tone)}`}
        >
          Go <ArrowRight className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
