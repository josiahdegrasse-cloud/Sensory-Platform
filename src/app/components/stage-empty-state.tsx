import type { ElementType } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Lock } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';

interface StageEmptyStateLinkCta {
  label: string;
  to: string;
  onClick?: never;
}

interface StageEmptyStateActionCta {
  label: string;
  onClick: () => void;
  to?: never;
}

type StageEmptyStateCta = StageEmptyStateLinkCta | StageEmptyStateActionCta;

/**
 * The platform's one empty-state pattern: what's missing, why it matters in
 * the journey, and the path forward. A locked state always names its unlock
 * condition — "nothing here" with no next step is treated as a bug.
 */
export function StageEmptyState({ icon: Icon, headline, body, cta, secondaryCta, locked, className }: {
  icon: ElementType;
  headline: string;
  /** One or two sentences: why this matters in the journey + what to do. */
  body: string;
  /** Primary path forward. Omit only when `locked` explains the unlock condition. */
  cta?: StageEmptyStateCta;
  secondaryCta?: StageEmptyStateLinkCta;
  /** Renders the lock treatment: the body should state the unlock condition. */
  locked?: boolean;
  className?: string;
}) {
  return (
    <Card className={`border border-dashed border-slate-200 bg-slate-50 ${className ?? ''}`}>
      <CardContent className="py-10 text-center">
        <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-lg bg-white border border-slate-200">
          {locked
            ? <Lock className="size-5 text-slate-300" aria-hidden />
            : <Icon className="size-5 text-slate-500" aria-hidden />}
        </span>
        <p className="text-sm font-semibold text-slate-700">{headline}</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{body}</p>
        {(cta || secondaryCta) && (
          <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
            {cta && (
              cta.to ? (
                <Button asChild size="sm">
                  <Link to={cta.to}>
                    {cta.label} <ChevronRight className="size-3.5" aria-hidden />
                  </Link>
                </Button>
              ) : (
                <Button type="button" size="sm" onClick={cta.onClick}>
                  {cta.label} <ChevronRight className="size-3.5" aria-hidden />
                </Button>
              )
            )}
            {secondaryCta && (
              <Link
                to={secondaryCta.to}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900"
              >
                {secondaryCta.label} <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
