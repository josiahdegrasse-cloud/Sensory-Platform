import type { ElementType } from 'react';
import { CheckCircle2, Info, AlertTriangle, AlertOctagon, Sparkles, Circle } from 'lucide-react';
import { cn } from './ui/utils';
import type { SemanticTone } from '../lib/project-status';

/**
 * Shared semantic palette: gray = neutral, blue = info/current,
 * green = success/GO/complete, amber = warning/TWEAK, red = critical/STOP,
 * purple = AI / creative / concept generation only.
 */
const TONE_STYLES: Record<SemanticTone, { className: string; icon: ElementType }> = {
  neutral:  { className: 'bg-slate-100 text-slate-600 border-slate-200', icon: Circle },
  info:     { className: 'bg-blue-50 text-blue-700 border-blue-200', icon: Info },
  success:  { className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  warning:  { className: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle },
  critical: { className: 'bg-rose-50 text-rose-700 border-rose-200', icon: AlertOctagon },
  creative: { className: 'bg-purple-50 text-purple-700 border-purple-200', icon: Sparkles },
};

export function toneClasses(toneValue: SemanticTone) {
  return TONE_STYLES[toneValue].className;
}

export function toneSolidClasses(toneValue: SemanticTone) {
  switch (toneValue) {
    case 'success': return 'bg-emerald-600 text-white';
    case 'info': return 'bg-blue-600 text-white';
    case 'warning': return 'bg-amber-500 text-white';
    case 'critical': return 'bg-rose-600 text-white';
    case 'creative': return 'bg-purple-600 text-white';
    default: return 'bg-slate-500 text-white';
  }
}

interface ProjectStatusBadgeProps {
  label: string;
  tone: SemanticTone;
  showIcon?: boolean;
  className?: string;
}

export function ProjectStatusBadge({ label, tone: toneValue, showIcon = true, className }: ProjectStatusBadgeProps) {
  const { className: toneClassName, icon: Icon } = TONE_STYLES[toneValue];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', toneClassName, className)}>
      {showIcon && <Icon className="size-3.5" />}
      {label}
    </span>
  );
}
