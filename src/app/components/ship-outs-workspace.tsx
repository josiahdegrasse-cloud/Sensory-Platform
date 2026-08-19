import { QrCode } from 'lucide-react';
import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useImportBatches, useProducts } from '../lib/hooks';
import { getBlindStudyDisplayName } from '../lib/blind-study';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { WorkflowPageHeader } from './workflow-page-header';
import { StudiesNavigation } from './studies-navigation';
import { PanelistKitInserts } from './panelist-kit-inserts';

export function ShipOutsWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: importBatches = [], isLoading: batchesLoading } = useImportBatches();

  const projectBatchIds = useMemo(() => new Set(
    importBatches
      .filter(batch => batch.id === projectId || batch.projectId === projectId)
      .map(batch => batch.id),
  ), [importBatches, projectId]);

  const projectProducts = useMemo(() => products
    .filter(product => product.status === 'active')
    .filter(product => (
      product.projectId === projectId
      || (product.sourceImportBatchId ? projectBatchIds.has(product.sourceImportBatchId) : false)
    ))
    .sort((a, b) => getBlindStudyDisplayName(a).localeCompare(getBlindStudyDisplayName(b), undefined, { numeric: true })),
  [products, projectBatchIds, projectId]);

  const requestedProductId = searchParams.get('study');
  const selectedProduct = projectProducts.find(product => product.id === requestedProductId)
    ?? projectProducts[0]
    ?? null;
  const loading = productsLoading || batchesLoading;

  const selectProduct = (productId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('study', productId);
    setSearchParams(next, { replace: true });
  };

  if (!projectId) return null;

  return (
    <div className="space-y-5">
      <WorkflowPageHeader
        title="Panelist shipments"
        description="Prepare physical tasting boxes, add tasks to each panelist’s account, provide an optional mobile QR pass, and track every box through fieldwork."
        status={<Badge variant="outline" className="border-slate-300 text-slate-700">Project scoped</Badge>}
      />

      <StudiesNavigation projectId={projectId} active="ship-outs" />

      {loading ? (
        <div className="space-y-3" aria-label="Loading shipment studies">
          <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-64 animate-pulse rounded-lg bg-slate-100" />
        </div>
      ) : projectProducts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <QrCode className="mx-auto size-9 text-slate-300" aria-hidden />
          <h2 className="mt-3 text-base font-bold text-slate-900">Create an active study first</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-slate-600">
            Ship-outs need at least one active product study in this project so every packed sample can map to a real panelist task.
          </p>
        </div>
      ) : selectedProduct ? (
        <>
          <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Shipment study</h2>
              <p className="mt-0.5 text-xs text-slate-600">Choose the primary study for this box batch. You can include other project tasks below.</p>
            </div>
            <Select value={selectedProduct.id} onValueChange={selectProduct}>
              <SelectTrigger className="w-full bg-white sm:w-80" aria-label="Select shipment study">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projectProducts.map(product => (
                  <SelectItem key={product.id} value={product.id}>
                    {getBlindStudyDisplayName(product)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <PanelistKitInserts
            key={selectedProduct.id}
            product={selectedProduct}
            availableProducts={projectProducts}
            standalone
          />
        </>
      ) : null}
    </div>
  );
}
