import { Clock3, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import { useMyAdminAccessRequest, useRequestAdminAccess } from '../lib/hooks';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';

export function PendingAdminAccessPage() {
  const { user, logout } = useAuth();
  const { data: request, isLoading, refetch } = useMyAdminAccessRequest(Boolean(user));
  const requestAccess = useRequestAdminAccess();
  const isRejected = request?.status === 'rejected';

  const submitRequest = async () => {
    await requestAccess.mutateAsync();
    await refetch();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
            <ShieldCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-900">Admin access pending</h1>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {isRejected
                ? 'An admin declined the last request for this account. You can send the request again if this was a mistake.'
                : 'Your company email is recognized. An existing workspace admin needs to approve your access before you can enter the platform.'}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{user?.email}</p>
              <p className="mt-1 text-xs text-slate-500">
                {isLoading
                  ? 'Checking request status...'
                  : request
                    ? `Request ${request.status}${request.requestedAt ? ` · ${new Date(request.requestedAt).toLocaleDateString()}` : ''}`
                    : 'No request has been sent yet.'}
              </p>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              isRejected ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
            }`}>
              <Clock3 className="size-3.5" />
              {isRejected ? 'Rejected' : 'Pending'}
            </span>
          </div>
        </div>

        {requestAccess.error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{requestAccess.error instanceof Error ? requestAccess.error.message : 'Unable to request access.'}</AlertDescription>
          </Alert>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="size-4" />
            Refresh status
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            {(!request || isRejected) && (
              <Button type="button" onClick={submitRequest} disabled={requestAccess.isPending} className="bg-slate-900 hover:bg-slate-700">
                {requestAccess.isPending ? 'Sending...' : 'Request access'}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={logout}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
