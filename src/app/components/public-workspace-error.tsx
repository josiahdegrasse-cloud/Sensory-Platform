import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  workspaceSlug: string;
  retrying: boolean;
  onRetry: () => void;
}

export function PublicWorkspaceError({ workspaceSlug, retrying, onRetry }: Props) {
  return (
    <main className="flex min-h-screen items-start justify-center bg-slate-50 px-6 pb-10 pt-20 sm:items-center sm:py-12">
      <div className="w-full max-w-md" role="alert" aria-live="assertive">
        <div className="flex size-11 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.01em] text-slate-950">
          Workspace sign-in is temporarily unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          We could not load the verified branding and sign-in settings for{' '}
          <span className="font-semibold text-slate-950">{workspaceSlug}</span>. To avoid showing the wrong company identity, sign-in is paused until the workspace configuration is available.
        </p>
        <Button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-6 h-11 bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <RefreshCw className={`size-4 ${retrying ? 'animate-spin' : ''}`} aria-hidden="true" />
          {retrying ? 'Trying again…' : 'Try again'}
        </Button>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          If this continues, contact your workspace administrator and include the workspace address you used.
        </p>
      </div>
    </main>
  );
}
