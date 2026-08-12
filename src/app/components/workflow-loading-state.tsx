import { Skeleton } from './ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Shared loading treatment for project-scoped workflow pages. Keeping the
 * page frame visible prevents an unresolved query from masquerading as an
 * evidence-backed empty state.
 */
export function WorkflowLoadingState({
  title = 'Loading project evidence',
  detail = 'Resolving the selected project and its linked records before showing a conclusion.',
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <section
      className="space-y-5"
      aria-busy="true"
      aria-live="polite"
      aria-label={title}
      data-testid="workflow-loading-state"
    >
      <div>
        <Skeleton className="h-7 w-52" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            <p className="max-w-2xl text-xs leading-5 text-slate-600">{detail}</p>
          </div>
          <span className="size-5 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700 motion-reduce:animate-none" aria-hidden />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3" aria-hidden>
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>
    </section>
  );
}

export function WorkflowQueryErrorState({
  projectName,
  checked,
  onRetry,
}: {
  projectName: string;
  checked: string;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-lg border border-rose-200 bg-rose-50 p-5" role="alert">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-rose-950">Project evidence could not be loaded</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-rose-800">
            We could not verify {checked} for <strong>{projectName}</strong>. No empty-state or scientific conclusion has been inferred from this failed request.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={onRetry} className="mt-3 border-rose-300 bg-white text-rose-800 hover:bg-rose-100">
            <RefreshCw className="size-4" aria-hidden /> Retry evidence check
          </Button>
        </div>
      </div>
    </section>
  );
}
