import { CalendarClock, Eye, ShieldCheck, TriangleAlert } from 'lucide-react';
import { ALLERGEN_LABELS } from '../lib/allergen-eligibility';
import type { PanelistInfo } from '../lib/database';
import { usePanelistSafetyDeclaration } from '../lib/hooks';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Skeleton } from './ui/skeleton';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PanelistSafetyDeclarationSheet({
  panelist,
  onOpenChange,
}: {
  panelist: PanelistInfo | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: declaration, isLoading, error, refetch } = usePanelistSafetyDeclaration(panelist?.id ?? null);
  const expired = declaration ? new Date(declaration.declarationExpiresAt) < new Date() : false;
  const regulated = declaration?.allergenAvoidances.map(code => ALLERGEN_LABELS[code] ?? code) ?? [];
  const hasAvoidances = regulated.length > 0 || Boolean(declaration?.otherAvoidances.length);

  return (
    <Sheet open={Boolean(panelist)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-slate-200 px-5 py-5 pr-12 sm:px-6">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600"><Eye className="size-3.5" aria-hidden />Sensitive health information · access logged</div>
          <SheetTitle className="mt-2 text-lg text-slate-950">Safety declaration</SheetTitle>
          <SheetDescription className="leading-5">{panelist?.name ?? 'Panelist'}{panelist?.panelistId ? ` · ${panelist.panelistId}` : ''}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {isLoading ? (
            <div className="space-y-5" aria-label="Loading safety declaration">
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-36 w-full rounded-md" />
              <Skeleton className="h-28 w-full rounded-md" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription className="space-y-3"><p>{error instanceof Error ? error.message : 'Unable to load this safety declaration.'}</p><Button type="button" size="sm" variant="outline" onClick={() => refetch()}>Try again</Button></AlertDescription>
            </Alert>
          ) : !declaration ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950">
              <strong className="block">Safety declaration not submitted</strong>
              This panelist cannot be assigned to sample studies until they complete the adult and allergen declaration.
            </div>
          ) : (
            <div className="space-y-6">
              <div className={`flex items-start justify-between gap-4 rounded-md border px-4 py-3 ${expired ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
                <div className="flex gap-2.5">
                  {expired ? <TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-700" aria-hidden /> : <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden />}
                  <div><p className={`text-sm font-semibold ${expired ? 'text-rose-950' : 'text-emerald-950'}`}>{expired ? 'Declaration expired' : 'Current safety declaration'}</p><p className={`mt-0.5 text-xs leading-5 ${expired ? 'text-rose-800' : 'text-emerald-800'}`}>{expired ? 'This panelist is excluded from every sample roster.' : 'Automatic sample matching is active.'}</p></div>
                </div>
                <Badge variant="outline" className={expired ? 'border-rose-300 text-rose-800' : 'border-emerald-300 text-emerald-800'}>{declaration.ageBand}</Badge>
              </div>

              <section aria-labelledby="declared-avoidances-heading">
                <h3 id="declared-avoidances-heading" className="text-sm font-semibold text-slate-950">Declared allergens and avoidances</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">Use this declaration when reviewing recipes, labels and precautionary “may contain” wording.</p>
                {hasAvoidances ? (
                  <div className="mt-3 space-y-4">
                    {regulated.length > 0 && <div><p className="mb-2 text-xs font-medium text-slate-500">Regulated allergens</p><div className="flex flex-wrap gap-2">{regulated.map(label => <Badge key={label} className="border border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-50">{label}</Badge>)}</div></div>}
                    {declaration.otherAvoidances.length > 0 && <div><p className="mb-2 text-xs font-medium text-slate-500">Other avoidances</p><ul className="divide-y divide-slate-100 border-y border-slate-200">{declaration.otherAvoidances.map(item => <li key={item} className="py-2.5 text-sm text-slate-800">{item}</li>)}</ul></div>}
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800"><ShieldCheck className="size-4 text-emerald-700" aria-hidden />No food allergens or additional avoidances declared.</div>
                )}
              </section>

              <section className="border-t border-slate-200 pt-5" aria-labelledby="declaration-record-heading">
                <h3 id="declaration-record-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-950"><CalendarClock className="size-4 text-slate-500" aria-hidden />Declaration record</h3>
                <dl className="mt-3 divide-y divide-slate-100 text-sm">
                  <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-slate-600">Confirmed</dt><dd className="font-medium text-slate-900">{formatDate(declaration.declarationConfirmedAt)}</dd></div>
                  <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-slate-600">Renew by</dt><dd className={`font-medium ${expired ? 'text-rose-700' : 'text-slate-900'}`}>{formatDate(declaration.declarationExpiresAt)}</dd></div>
                  <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-slate-600">Health-data consent</dt><dd className="font-medium text-slate-900">{formatDate(declaration.healthConsentAt)}</dd></div>
                  <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-slate-600">Adult status</dt><dd className="font-medium text-slate-900">18+ confirmed</dd></div>
                </dl>
              </section>

              <p className="border-t border-slate-200 pt-5 text-xs leading-5 text-slate-600">This record supports recipe and study planning. Survey and box selectors still enforce the exact-sample safety rules automatically; this view does not provide an override.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

