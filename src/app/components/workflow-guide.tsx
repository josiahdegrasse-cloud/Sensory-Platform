import type { ElementType } from 'react';
import { Link } from 'react-router';
import { Card, CardContent } from './ui/card';
import { FlaskConical, ClipboardList, BarChart3, GitMerge, Megaphone, FileText, ChevronRight } from 'lucide-react';

export type WorkflowStageKey = 'import' | 'survey' | 'insights' | 'decide' | 'concept' | 'report';

interface Stage {
  key: WorkflowStageKey;
  label: string;
  blurb: string;
  path: string;
  icon: ElementType;
}

const STAGES: Stage[] = [
  { key: 'import', label: 'Import data', blurb: 'Bring in your CSV / machine results', path: '/stage1', icon: FlaskConical },
  { key: 'survey', label: 'Survey your panel', blurb: 'Turn samples into questionnaires for panelists', path: '/admin', icon: ClipboardList },
  { key: 'insights', label: 'Review insights', blurb: 'See CATA, hedonic, and concept results', path: '/survey-analysis', icon: BarChart3 },
  { key: 'decide', label: 'Make the call', blurb: 'Get a GO / TWEAK / STOP recommendation', path: '/decision', icon: GitMerge },
  { key: 'concept', label: 'Test a concept', blurb: 'Send an AI-built concept to consumers', path: '/concept-testing', icon: Megaphone },
  { key: 'report', label: 'Write the report', blurb: 'Build the launch / commercialization report', path: '/decision', icon: FileText },
];

export function WorkflowGuide({ current }: { current: WorkflowStageKey }) {
  const currentIndex = STAGES.findIndex(s => s.key === current);
  const next = STAGES[currentIndex + 1];

  return (
    <Card className="border border-slate-200 bg-white">
      <CardContent className="py-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STAGES.map((stage, i) => {
            const isCurrent = stage.key === current;
            const isPast = i < currentIndex;
            const Icon = stage.icon;
            return (
              <div key={stage.key} className="flex items-center flex-shrink-0">
                <Link
                  to={stage.path}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isPast
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="size-3.5" />
                  {stage.label}
                </Link>
                {i < STAGES.length - 1 && (
                  <ChevronRight className="size-3.5 text-slate-300 mx-1 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
        {next && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
            <p className="text-xs text-blue-800">
              <span className="font-semibold">Up next — {next.label}:</span> {next.blurb}
            </p>
            <Link to={next.path} className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 flex-shrink-0">
              Go <ChevronRight className="size-3.5" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
