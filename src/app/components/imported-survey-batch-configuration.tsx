import { useState } from 'react';
import { ShieldCheck, Users } from 'lucide-react';
import type { Product } from '../data/survey-domain';
import {
  useEligiblePanelistsForProducts,
  useSampleAllergenDeclarationsForProducts,
  useUpdateProductAssignments,
} from '../lib/hooks';
import { EligiblePanelSummary } from './eligible-panel-summary';
import { BatchSampleAllergenDeclarationEditor } from './sample-allergen-declaration';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';

export function ImportedSurveyBatchConfiguration({
  batchName,
  products,
  onClose,
  onAssigned,
}: {
  batchName: string;
  products: Product[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const productIds = products.map(product => product.id);
  const declarationsQuery = useSampleAllergenDeclarationsForProducts(productIds);
  const verifiedIds = new Set((declarationsQuery.data ?? [])
    .filter(declaration => declaration.status === 'verified' && declaration.productId)
    .map(declaration => declaration.productId as string));
  const allVerified = products.length > 0 && products.every(product => verifiedIds.has(product.id));
  const eligibleQuery = useEligiblePanelistsForProducts(productIds, allVerified);
  const assignPanelists = useUpdateProductAssignments();
  const [selectedPanelistIds, setSelectedPanelistIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const eligiblePanelists = eligibleQuery.data ?? [];
  const eligibleIds = new Set(eligiblePanelists.map(panelist => panelist.id));
  const safeSelectedIds = selectedPanelistIds.filter(id => eligibleIds.has(id));

  const assignAll = async () => {
    if (!allVerified) {
      setError('Verify the shared allergen declaration before assigning panelists.');
      return;
    }
    if (safeSelectedIds.length === 0) {
      setError('Choose at least one panelist who is eligible for this sample.');
      return;
    }
    setError('');
    try {
      await assignPanelists.mutateAsync({ productIds, assignedPanelistIds: safeSelectedIds });
      onAssigned();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to assign the surveys.');
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="h-[min(94vh,960px)] w-[calc(100vw-2rem)] max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle>Configure all imported surveys</DialogTitle>
          <DialogDescription className="text-slate-600">
            {batchName} · {products.length} survey{products.length === 1 ? '' : 's'}. Check allergens once, then assign one eligible panel to the whole set.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-7 overflow-y-auto px-6 py-5">
          <section aria-labelledby="batch-allergens-heading">
            <h2 id="batch-allergens-heading" className="sr-only">Shared allergen declaration</h2>
            <BatchSampleAllergenDeclarationEditor productIds={productIds} sampleName={batchName} />
          </section>

          <section className="border-t border-slate-200 pt-6" aria-labelledby="batch-panel-heading">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 id="batch-panel-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Users className="size-4 text-blue-700" />Assign every survey</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Only panelists eligible for the verified sample can be selected.</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setSelectedPanelistIds(eligiblePanelists.map(panelist => panelist.id))} disabled={!allVerified || eligiblePanelists.length === 0}>Select all eligible</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setSelectedPanelistIds([])} disabled={safeSelectedIds.length === 0}>Clear</Button>
              </div>
            </div>

            {!allVerified ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                Verify the sample allergen declaration to calculate the eligible panel.
              </div>
            ) : eligibleQuery.isLoading ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">Calculating eligibility across all surveys…</div>
            ) : eligiblePanelists.length === 0 ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">No shared eligible panelists</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">No completed panelist profile is currently safe for every food in this import.</p>
              </div>
            ) : (
              <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2 lg:grid-cols-3">
                {eligiblePanelists.map(panelist => {
                  const selected = safeSelectedIds.includes(panelist.id);
                  return (
                    <div key={panelist.id} className={`flex items-start gap-2 rounded-md border px-3 py-2.5 ${selected ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                      <Checkbox
                        id={`batch-panelist-${panelist.id}`}
                        checked={selected}
                        onCheckedChange={() => setSelectedPanelistIds(current => selected ? current.filter(id => id !== panelist.id) : [...current, panelist.id])}
                      />
                      <Label htmlFor={`batch-panelist-${panelist.id}`} className="min-w-0 flex-1 cursor-pointer font-normal">
                        <span className="block truncate text-sm font-medium text-slate-950">{panelist.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{[panelist.panelistId, panelist.ageBand, panelist.region].filter(Boolean).join(' · ')}</span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{panelist.dietaryPattern?.replace(/_/g, ' ') || 'Dietary profile recorded'}</span>
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}
            {allVerified && <div className="mt-4"><EligiblePanelSummary panelists={eligiblePanelists} selectedIds={safeSelectedIds} /></div>}
          </section>

          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </div>

        <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={assignPanelists.isPending}>Close</Button>
          <Button type="button" onClick={assignAll} disabled={!allVerified || safeSelectedIds.length === 0 || assignPanelists.isPending} className="bg-slate-900 hover:bg-slate-800">
            <ShieldCheck className="size-4" />
            {assignPanelists.isPending ? 'Assigning…' : `Assign ${safeSelectedIds.length} panelist${safeSelectedIds.length === 1 ? '' : 's'} to all ${products.length} surveys`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
