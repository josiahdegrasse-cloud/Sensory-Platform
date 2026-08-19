import { useMemo, useState } from 'react';
import { Archive, Download, MapPinCheck, RotateCcw, Search, ShieldCheck, UserRoundCheck, Users } from 'lucide-react';
import type { PanelistInfo } from '../lib/database';
import { useUpdatePanelistStatus } from '../lib/hooks';
import { ethnicityLabel, nationalityOptions } from '../lib/panelist-demographics';
import { panelistDeliveryReady, panelistReadiness, panelistReadinessLabel, panelistValueLabel, type PanelistReadiness } from '../lib/panelist-profile';
import { buildPanelistDirectoryCsv, downloadPanelistDirectoryCsv } from '../lib/panelist-directory-export';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { PanelistSafetyDeclarationSheet } from './panelist-safety-declaration-sheet';

type DirectoryFilter = 'all' | 'ready' | 'action_required' | 'inactive';
const NATIONALITY_LABELS = new Map(nationalityOptions().map(option => [option.value, option.label]));

function readinessStyle(readiness: PanelistReadiness) {
  if (readiness === 'ready') return 'border-emerald-300 bg-emerald-50 text-emerald-800';
  if (readiness === 'expired') return 'border-rose-300 bg-rose-50 text-rose-800';
  if (readiness === 'inactive') return 'border-slate-300 bg-slate-50 text-slate-700';
  return 'border-amber-300 bg-amber-50 text-amber-900';
}

function matchesFilter(readiness: PanelistReadiness, filter: DirectoryFilter) {
  if (filter === 'all') return true;
  if (filter === 'ready') return readiness === 'ready';
  if (filter === 'inactive') return readiness === 'inactive';
  return readiness !== 'ready' && readiness !== 'inactive';
}

function formatDate(value: string | null) {
  if (!value) return 'No activity yet';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function householdLabel(panelist: PanelistInfo) {
  return panelist.householdSizePreferNotToSay
    ? 'Prefer not to say'
    : panelist.householdSize
    ? `${panelist.householdSize}-person household`
    : 'Household size not provided';
}

export function PanelistDirectory({ panelists }: { panelists: PanelistInfo[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DirectoryFilter>('all');
  const [selectedSafety, setSelectedSafety] = useState<PanelistInfo | null>(null);
  const [statusTarget, setStatusTarget] = useState<PanelistInfo | null>(null);
  const updateStatus = useUpdatePanelistStatus();
  const normalizedQuery = query.trim().toLowerCase();

  const rows = useMemo(() => panelists.filter(panelist => {
    const readiness = panelistReadiness(panelist);
    if (!matchesFilter(readiness, filter)) return false;
    if (!normalizedQuery) return true;
    return [
      panelist.name,
      panelist.email,
      panelist.panelistId,
      panelist.region,
      panelist.ageBand,
      panelist.dietaryPattern,
      panelist.nationalityCode,
      panelist.ethnicity,
      panelist.occupationGroup,
      panelist.annualIncomeRange,
    ].some(value => value?.toLowerCase().includes(normalizedQuery));
  }), [filter, normalizedQuery, panelists]);

  const summary = panelists.reduce((counts, panelist) => {
    const readiness = panelistReadiness(panelist);
    counts.total += 1;
    if (readiness === 'ready') counts.ready += 1;
    else if (readiness === 'inactive') counts.inactive += 1;
    else counts.action += 1;
    return counts;
  }, { total: 0, ready: 0, action: 0, inactive: 0 });

  const changeStatus = async () => {
    if (!statusTarget) return;
    await updateStatus.mutateAsync({
      userId: statusTarget.id,
      status: statusTarget.status === 'active' ? 'archived' : 'active',
    });
    setStatusTarget(null);
  };

  const exportDirectory = () => {
    const date = new Date().toISOString().slice(0, 10);
    const scope = filter === 'all' ? 'all' : filter.replace('_', '-');
    downloadPanelistDirectoryCsv(
      buildPanelistDirectoryCsv(rows),
      `panelist-directory-${scope}-${date}.csv`,
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="gap-4 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Users className="size-4 text-slate-500" aria-hidden />Panelist directory</CardTitle>
              <p className="mt-1 max-w-[70ch] text-sm leading-6 text-slate-600">Review onboarding, research demographics, delivery readiness, and participation. Exact allergy declarations remain behind logged access.</p>
            </div>
            <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <div><dt className="text-xs text-slate-500">Total</dt><dd className="font-semibold text-slate-950">{summary.total}</dd></div>
              <div><dt className="text-xs text-slate-500">Ready</dt><dd className="font-semibold text-emerald-700">{summary.ready}</dd></div>
              <div><dt className="text-xs text-slate-500">Needs action</dt><dd className="font-semibold text-amber-800">{summary.action}</dd></div>
              <div><dt className="text-xs text-slate-500">Inactive</dt><dd className="font-semibold text-slate-700">{summary.inactive}</dd></div>
            </dl>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
              <Input value={query} onChange={event => setQuery(event.target.value)} className="pl-9" placeholder="Search name, ID, region, or dietary pattern" aria-label="Search panelists" />
            </div>
            <Select value={filter} onValueChange={value => setFilter(value as DirectoryFilter)}>
              <SelectTrigger className="w-full sm:w-52" aria-label="Filter panelists by readiness"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All panelists</SelectItem>
                <SelectItem value="ready">Ready for matching</SelectItem>
                <SelectItem value="action_required">Needs action</SelectItem>
                <SelectItem value="inactive">Inactive or archived</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={exportDirectory}
              disabled={rows.length === 0}
              aria-label={`Export ${rows.length} visible panelist${rows.length === 1 ? '' : 's'} as CSV`}
              className="shrink-0"
            >
              <Download className="size-4" aria-hidden />
              Export CSV ({rows.length})
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {updateStatus.error && (
            <Alert variant="destructive" className="mb-4"><AlertDescription>{updateStatus.error instanceof Error ? updateStatus.error.message : 'Unable to update this panelist.'}</AlertDescription></Alert>
          )}
          {rows.length === 0 ? (
            <div className="border-y border-slate-200 py-10 text-center">
              <Users className="mx-auto size-8 text-slate-300" aria-hidden />
              <p className="mt-2 text-sm font-medium text-slate-800">No panelists match these filters</p>
              <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {rows.map(panelist => {
                const readiness = panelistReadiness(panelist);
                return (
                  <article key={panelist.id} className="py-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-950">{panelist.name}</h3>
                          <Badge variant="outline" className={readinessStyle(readiness)}>{panelistReadinessLabel(readiness)}</Badge>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">{[panelist.panelistId ?? 'No panelist ID', panelist.email].filter(Boolean).join(' · ')}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setSelectedSafety(panelist)}><ShieldCheck className="size-3.5 text-emerald-700" aria-hidden />Safety declaration</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setStatusTarget(panelist)}>
                          {panelist.status === 'active' ? <Archive className="size-3.5" aria-hidden /> : <RotateCcw className="size-3.5" aria-hidden />}
                          {panelist.status === 'active' ? 'Archive' : 'Restore'}
                        </Button>
                      </div>
                    </div>

                    <dl className="mt-4 grid gap-x-6 gap-y-3 border-t border-slate-100 pt-4 text-xs sm:grid-cols-2 xl:grid-cols-5">
                      <div><dt className="font-medium text-slate-500">Demographics</dt><dd className="mt-1 leading-5 text-slate-900">Age {panelist.ageYears ?? 'not provided'} · {panelist.gender === 'self_describe' ? panelist.genderSelfDescription ?? 'Self-described' : panelistValueLabel(panelist.gender)} · {NATIONALITY_LABELS.get(panelist.nationalityCode ?? '') ?? 'Nationality not provided'} · {ethnicityLabel(panelist.ethnicity)}</dd></div>
                      <div><dt className="font-medium text-slate-500">Lifestyle</dt><dd className="mt-1 leading-5 text-slate-900">{panelist.dietaryPattern === 'other' ? panelist.dietaryOther ?? 'Other diet' : panelistValueLabel(panelist.dietaryPattern)} · {panelistValueLabel(panelist.smokerStatus)} · {panelistValueLabel(panelist.weeklyFoodSpend)} per person/week</dd></div>
                      <div><dt className="font-medium text-slate-500">Household</dt><dd className="mt-1 leading-5 text-slate-900">{householdLabel(panelist)}</dd></div>
                      <div><dt className="font-medium text-slate-500">Work and income</dt><dd className="mt-1 leading-5 text-slate-900">{panelistValueLabel(panelist.occupationGroup)} · {panelistValueLabel(panelist.annualIncomeRange)}</dd></div>
                      <div><dt className="font-medium text-slate-500">Recruitment and activity</dt><dd className="mt-1 leading-5 text-slate-900">{panelistValueLabel(panelist.groceryRole)} · {panelist.completedCount} completed · Last active {formatDate(panelist.lastActivityAt)}</dd></div>
                    </dl>

                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
                      <span className="flex items-center gap-1.5"><MapPinCheck className={`size-3.5 ${panelistDeliveryReady(panelist) ? 'text-emerald-700' : 'text-amber-700'}`} aria-hidden />{panelistDeliveryReady(panelist) ? `Delivery ready · ${[panelist.city, panelist.postalCode].filter(Boolean).join(' ')}` : 'Delivery details incomplete'}</span>
                      <span>Safety renewal: {panelist.declarationExpiresAt ? formatDate(panelist.declarationExpiresAt) : 'Not completed'}</span>
                    </div>

                    {statusTarget?.id === panelist.id && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                        <p className="w-full text-sm text-slate-700">{panelist.status === 'active' ? 'Archive this account and prevent new study access?' : 'Restore this panelist to active status?'}</p>
                        <Button type="button" size="sm" disabled={updateStatus.isPending} onClick={() => void changeStatus()} className={panelist.status === 'active' ? 'bg-rose-700 hover:bg-rose-800' : 'bg-slate-900 hover:bg-slate-800'}>{updateStatus.isPending ? 'Saving…' : 'Confirm'}</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setStatusTarget(null)}>Cancel</Button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500"><UserRoundCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />Study and box selectors still recalculate exact-sample eligibility. Directory readiness never overrides the safety gate.</p>
        </CardContent>
      </Card>

      <PanelistSafetyDeclarationSheet panelist={selectedSafety} onOpenChange={open => { if (!open) setSelectedSafety(null); }} />
    </>
  );
}
