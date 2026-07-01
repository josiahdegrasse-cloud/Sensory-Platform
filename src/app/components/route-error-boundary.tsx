import { AlertTriangle, RefreshCw } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from './ui/button';

function getErrorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`;
  if (error instanceof Error) return error.message;
  return 'The app could not finish loading this page.';
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const message = getErrorMessage(error);
  const isChunkLoadError = /dynamically imported module|loading chunk|failed to fetch/i.test(message);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-slate-50 text-slate-700">
          <AlertTriangle className="size-5" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">
          {isChunkLoadError ? 'The app was updated' : 'Something went wrong'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {isChunkLoadError
            ? 'A fresh version is available. Reload once and the page should open normally.'
            : 'Reload the page and try again. If it keeps happening, contact the workspace administrator.'}
        </p>
        {!isChunkLoadError && (
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-left text-xs text-slate-500">
            {message}
          </p>
        )}
        <Button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 w-full bg-slate-900 hover:bg-slate-700"
        >
          <RefreshCw className="size-4" />
          Reload app
        </Button>
      </div>
    </div>
  );
}
