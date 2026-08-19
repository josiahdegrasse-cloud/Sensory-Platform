import type { ReactNode } from 'react';
import { cn } from './ui/utils';

export function ProductListPanel({
  title,
  description,
  actions,
  controls,
  children,
  footer,
  className,
  listLabel,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  listLabel?: string;
}) {
  return (
    <aside className={cn('flex flex-col self-start overflow-hidden rounded-lg border border-slate-200 bg-white', className)}>
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>}
          </div>
          {actions}
        </div>
        {controls && <div className="mt-3 space-y-2">{controls}</div>}
      </div>
      <div aria-label={listLabel ?? title} className="min-h-0 flex-1 space-y-1 p-2">
        {children}
      </div>
      {footer && <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">{footer}</div>}
    </aside>
  );
}

export function ProductListItem({
  active,
  title,
  meta,
  metric,
  metricLabel,
  badge,
  signal,
  signalTone = 'neutral',
  trailing,
  disabled = false,
  onClick,
}: {
  active?: boolean;
  title: string;
  meta?: ReactNode;
  metric?: ReactNode;
  metricLabel?: string;
  badge?: ReactNode;
  signal?: ReactNode;
  signalTone?: 'neutral' | 'success' | 'warning' | 'critical';
  trailing?: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'true' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'relative block w-full rounded-md px-3 py-2.5 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-45',
        active ? 'bg-slate-50 ring-1 ring-inset ring-slate-300' : 'hover:bg-slate-50',
      )}
    >
      <span className="flex min-w-0 items-start justify-between gap-2">
        <span className="min-w-0">
          <span className={cn('block truncate text-sm font-semibold', active ? 'text-slate-900' : 'text-slate-900')}>
            {title}
          </span>
          {meta && <span className="mt-0.5 block truncate text-xs text-slate-500">{meta}</span>}
        </span>
        <span className="flex shrink-0 items-start gap-1.5">
          {badge}
          {metric && (
            <span className="text-right">
              <span className="block text-sm font-bold tabular-nums text-slate-900">{metric}</span>
              {metricLabel && <span className="block text-[11px] font-semibold uppercase text-slate-500">{metricLabel}</span>}
            </span>
          )}
          {trailing}
        </span>
      </span>
      {signal && (
        <span
          className={cn(
            'mt-2 block truncate text-[11px] font-semibold',
            signalTone === 'success' && 'text-emerald-700',
            signalTone === 'warning' && 'text-amber-700',
            signalTone === 'critical' && 'text-rose-700',
            signalTone === 'neutral' && 'text-slate-500',
          )}
        >
          {signal}
        </span>
      )}
    </button>
  );
}
