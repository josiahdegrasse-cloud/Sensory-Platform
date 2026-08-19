import { useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, Download, MoreHorizontal, Package, PackageCheck, Plus, Printer, QrCode, RefreshCw, Search, Send, ShieldCheck, Trash2 } from 'lucide-react';
import type { Product } from '../data/survey-domain';
import { panelistShippingAddress, type GeneratedPanelistKit, type PanelistInfo, type PanelistKitRecord } from '../lib/database';
import {
  useCreateReplacementPanelistKit,
  useGeneratePanelistKits,
  usePanelists,
  usePanelistKits,
  useRecordPanelistKitReminder,
  useUpdatePanelistKitFulfillment,
  useVoidPanelistKit,
  useFormulationVersions,
  useEligiblePanelistsForProducts,
} from '../lib/hooks';
import { verifiedAllergenTags } from '../lib/formulation-profile';
import { getBlindStudyDisplayName } from '../lib/blind-study';
import { taskSummariesForIds, type BoxTaskSummary } from '../lib/panelist-box-workflow';
import {
  panelistKitJoinUrl,
  panelistKitManualJoinUrl,
  panelistKitPassStorageKey,
  parsePanelistKitPassTokens,
  serializePanelistKitPassTokens,
} from '../lib/panelist-kit-pass';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { SampleAllergenDeclarationEditor } from './sample-allergen-declaration';

type KitWorkspaceView = 'fielding' | 'create' | 'print';

function defaultInstructions() {
  return [
    'Keep everything sealed and stored exactly as labelled until you are ready.',
    'Open your task inbox on any signed-in device. On a phone, the QR code is a quick shortcut to this box.',
    'Complete one task at a time. Do not use anything damaged or connected to an allergy or safety concern.',
  ].join('\n');
}

function statusClass(status: PanelistKitRecord['calculatedStatus']) {
  if (status === 'submitted') return 'border-emerald-300 text-emerald-700';
  if (status === 'started' || status === 'claimed') return 'border-blue-300 text-blue-700';
  if (status === 'printed' || status === 'packed' || status === 'shipped') return 'border-amber-300 text-amber-700';
  if (status === 'expired' || status === 'void') return 'border-rose-300 text-rose-700';
  return 'border-slate-200 text-slate-700';
}

function issueClass(status: PanelistKitRecord['issueStatus']) {
  if (status === 'open') return 'border-rose-300 bg-rose-50 text-rose-700';
  if (status === 'reviewed') return 'border-amber-300 bg-amber-50 text-amber-700';
  if (status === 'resolved') return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  return 'border-slate-200 text-slate-500';
}

function formatShortDate(value: string | null) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadKitsCsv(product: Product, kits: PanelistKitRecord[], taskOptions: Product[]) {
  const headers = [
    'Box code',
    'Manual code',
    'Sample code',
    'Recipient name',
    'Delivery address',
    'Assigned task count',
    'Completed task count',
    'Assigned tasks',
    'Status',
    'Panelist',
    'Deadline',
    'Printed',
    'Packed',
    'Shipped',
    'Tracking',
    'Issue status',
    'Issue type',
    'Issue note',
    'Follow-ups logged',
  ];
  const rows = kits.map(kit => [
    kit.kitCode,
    kit.manualCode,
    kit.sampleCode,
    kit.recipientName,
    kit.recipientAddress,
    kit.assignedProductCount,
    kit.completedProductCount,
    taskSummariesForIds(taskOptions, kit.assignedProductIds, product).map(task => task.label).join('; '),
    kit.calculatedStatus,
    kit.claimedPanelistName,
    kit.responseDeadline,
    kit.printedAt,
    kit.packedAt,
    kit.shippedAt,
    kit.trackingNumber,
    kit.issueStatus,
    kit.issueType,
    kit.issueNote,
    kit.reminderCount,
  ]);
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${product.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'panelist-boxes'}-fielding.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadPackingSheet(product: Product, kits: GeneratedPanelistKit[], taskOptions: Product[], verifiedAllergens: string[]) {
  const headers = ['Packed', 'Box code', 'Recipient name', 'Delivery address', 'Assigned tasks', 'Verified allergen note'];
  const rows = kits.map(kit => [
    '',
    kit.kitCode,
    kit.recipientName,
    kit.recipientAddress,
    taskSummariesForIds(taskOptions, kit.assignedProductIds, product).map(task => task.label).join('; '),
    verifiedAllergens.join('; ') || 'None recorded',
  ]);
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${product.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'panelist-boxes'}-packing-sheet.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function printableKitFromRecord(kit: PanelistKitRecord, token: string): GeneratedPanelistKit {
  return {
    id: kit.id,
    token,
    kitCode: kit.kitCode,
    manualCode: kit.manualCode,
    sampleCode: kit.sampleCode,
    productId: kit.productId,
    assignedProductIds: kit.assignedProductIds,
    status: kit.calculatedStatus,
    expiresAt: kit.expiresAt,
    responseDeadline: kit.responseDeadline,
    handlingInstructions: kit.handlingInstructions,
    recipientName: kit.recipientName,
    recipientEmail: kit.recipientEmail,
    recipientAddress: kit.recipientAddress,
    assignedPanelistId: kit.claimedBy,
    createdAt: kit.createdAt,
  };
}

function KitInsertCard({ kit, product, instructions, assignedTasks, verifiedAllergens }: {
  kit: GeneratedPanelistKit;
  product: Product;
  instructions: string;
  assignedTasks: BoxTaskSummary[];
  verifiedAllergens: string[];
}) {
  const url = panelistKitJoinUrl(kit.token);
  const manualUrl = panelistKitManualJoinUrl();
  const displayName = product.blinded ? 'Coded at-home tasting box' : `${product.name} tasting box`;
  const recipientLabel = kit.recipientName ?? 'Panelist';

  return (
    <article className="kit-insert-page rounded-lg border border-slate-200 bg-white p-6 text-slate-900">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">New Food Innovation</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Panelist box pass</h2>
          <p className="mt-1 text-sm text-slate-700">{displayName}</p>
          <p className="mt-3 text-sm text-slate-700">
            For: <span className="font-bold text-slate-900">{recipientLabel}</span>
          </p>
        </div>
        <div className="rounded-md border border-slate-200 px-3 py-2 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Box code</p>
          <p className="font-mono text-lg font-bold tracking-wider">{kit.kitCode}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-6 sm:grid-cols-[210px_1fr]">
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-300 bg-white p-4 text-center">
            <p className="mb-3 text-base font-bold text-slate-900">Open on your phone</p>
            <div aria-label={`Unique QR pass for box ${kit.kitCode}`}>
              <QRCode value={url} size={176} level="M" className="mx-auto" />
            </div>
          </div>
          <p className="text-center text-xs leading-5 text-slate-600">Optional phone shortcut. Your assigned tasks are also waiting in your account on a laptop or tablet.</p>
          {kit.manualCode && (
            <div className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Use the box code instead</p>
              <p className="mt-1 font-mono text-base font-bold tracking-wider text-slate-950">{kit.manualCode}</p>
              <p className="mt-1 break-all text-[11px] leading-4 text-slate-600">{manualUrl}</p>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">What to do</h3>
            <ol className="mt-2 space-y-2 text-sm leading-5 text-slate-700">
              <li><strong className="text-slate-900">1.</strong> Keep everything sealed and stored exactly as labelled.</li>
              <li><strong className="text-slate-900">2.</strong> On a phone, scan the QR code. On a laptop or tablet, sign in normally and open your task inbox.</li>
              <li><strong className="text-slate-900">3.</strong> Match each task to its item code, then complete one task at a time.</li>
            </ol>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-sm font-bold text-slate-900">Tasks assigned from this box</h3>
            <ul className="mt-2 space-y-1 text-sm leading-5 text-slate-700">
              {assignedTasks.map((task, index) => (
                <li key={task.id}>
                  {index + 1}. <strong className="text-slate-900">{task.label}</strong> — {task.sampleCue} · {task.estimate}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <h3 className="text-sm font-bold text-amber-950">Verified allergen information</h3>
            <p className="mt-1 text-sm leading-5 text-amber-900">{verifiedAllergens.join(', ') || 'No allergens are recorded in the reviewed formulation. Always check the physical product label before tasting.'}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-sm font-bold text-slate-900">Handling notes</h3>
            <p className="mt-1 whitespace-pre-line text-sm leading-5 text-slate-700">{instructions}</p>
          </div>
          <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
            <div className="rounded-md border border-slate-200 px-3 py-2">
              <span className="block font-semibold text-slate-500">Assigned tasks</span>
              <span className="text-sm font-bold text-slate-900">{kit.assignedProductIds.length}</span>
            </div>
            {kit.responseDeadline && (
              <div className="rounded-md border border-slate-200 px-3 py-2">
                <span className="block font-semibold text-slate-500">Complete by</span>
                <span className="text-sm font-bold text-slate-900">{new Date(kit.responseDeadline).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>If the package looks damaged, smells unusual before opening, or contains anything you may be allergic to, do not taste it. Contact the study administrator.</p>
      </div>
    </article>
  );
}

function BatchPackingSheet({ product, kits, taskOptions, verifiedAllergens }: {
  product: Product;
  kits: GeneratedPanelistKit[];
  taskOptions: Product[];
  verifiedAllergens: string[];
}) {
  return (
    <section className="kit-manifest-page rounded-lg border border-slate-200 bg-white p-6 text-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">New Food Innovation</p>
      <div className="mt-1 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Batch packing sheet</h2>
          <p className="mt-1 text-sm text-slate-600">{product.name} · {kits.length} box{kits.length === 1 ? '' : 'es'}</p>
        </div>
        <p className="text-xs text-slate-500">Printed {new Date().toLocaleDateString()}</p>
      </div>
      <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">Pack one row at a time. Match the box code to its insert, confirm the recipient details, then tick the row when sealed.</p>
      <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"><strong>Reviewed formulation allergens:</strong> {verifiedAllergens.join(', ') || 'None recorded'} · Confirm against the physical label before sealing.</p>
      <div className="mt-4 overflow-hidden rounded-md border border-slate-300">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-slate-100 text-slate-700">
            <tr><th className="p-2 font-bold">Done</th><th className="p-2 font-bold">Box</th><th className="p-2 font-bold">Recipient</th><th className="p-2 font-bold">Delivery address</th><th className="p-2 font-bold">Tasks</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {kits.map(kit => (
              <tr key={kit.id} className="align-top">
                <td className="p-2 text-lg">□</td>
                <td className="p-2 font-mono font-bold">{kit.kitCode}</td>
                <td className="p-2"><strong className="block">{kit.recipientName ?? 'Unassigned'}</strong></td>
                <td className="whitespace-pre-line p-2 leading-5">{kit.recipientAddress ?? '—'}</td>
                <td className="p-2 leading-5">{taskSummariesForIds(taskOptions, kit.assignedProductIds, product).map(task => task.label).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PanelistKitInserts({
  product,
  availableProducts,
  standalone = false,
}: {
  product: Product;
  availableProducts: Product[];
  standalone?: boolean;
}) {
  const { data: existingKits = [] } = usePanelistKits(product.id);
  const { data: formulationVersions = [] } = useFormulationVersions();
  const { data: panelists = [], isLoading: panelistsLoading } = usePanelists();
  const generateKits = useGeneratePanelistKits();
  const updateFulfillment = useUpdatePanelistKitFulfillment(product.id);
  const recordReminder = useRecordPanelistKitReminder(product.id);
  const voidKit = useVoidPanelistKit(product.id);
  const createReplacement = useCreateReplacementPanelistKit(product.id);
  const reviewedFormulation = formulationVersions.find(version => (
    version.sampleId === product.sourceSampleId
    && version.isCurrent
    && version.reviewStatus === 'reviewed'
  ));
  const verifiedAllergens = verifiedAllergenTags(reviewedFormulation);
  const [responseDeadline, setResponseDeadline] = useState('');
  const [instructions, setInstructions] = useState(defaultInstructions);
  const [selectedPanelistIds, setSelectedPanelistIds] = useState<string[]>([]);
  const [panelistSearch, setPanelistSearch] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([product.id]);
  const [workspaceView, setWorkspaceView] = useState<KitWorkspaceView>('fielding');
  const [generatedKits, setGeneratedKits] = useState<GeneratedPanelistKit[]>([]);
  const [passTokens, setPassTokens] = useState<Record<string, string>>(() => (
    typeof window === 'undefined'
      ? {}
      : parsePanelistKitPassTokens(window.sessionStorage.getItem(panelistKitPassStorageKey(product.id)))
  ));
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [confirmedReviewSignature, setConfirmedReviewSignature] = useState('');
  const [shippingKit, setShippingKit] = useState<PanelistKitRecord | null>(null);
  const [trackingDraft, setTrackingDraft] = useState('');
  const [replacementKit, setReplacementKit] = useState<PanelistKitRecord | null>(null);
  const [replacementReason, setReplacementReason] = useState('');
  const [voidingKit, setVoidingKit] = useState<PanelistKitRecord | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const { data: safePanelists = [], isLoading: eligibilityLoading } = useEligiblePanelistsForProducts(selectedProductIds);
  const safePanelistIds = useMemo(() => new Set(safePanelists.map(panelist => panelist.id)), [safePanelists]);
  const eligiblePanelists = useMemo(() => panelists.filter(panelist => safePanelistIds.has(panelist.id)), [panelists, safePanelistIds]);
  const safeSelectedPanelistIds = useMemo(() => selectedPanelistIds.filter(id => safePanelistIds.has(id)), [safePanelistIds, selectedPanelistIds]);
  const visiblePanelists = useMemo(() => {
    const query = panelistSearch.trim().toLowerCase();
    if (!query) return eligiblePanelists;
    return eligiblePanelists.filter(panelist => [panelist.name, panelist.postalCode].some(value => value?.toLowerCase().includes(query)));
  }, [eligiblePanelists, panelistSearch]);
  const selectedPanelists = useMemo(() => safeSelectedPanelistIds.map(id => eligiblePanelists.find(panelist => panelist.id === id)).filter((panelist): panelist is PanelistInfo => Boolean(panelist)), [eligiblePanelists, safeSelectedPanelistIds]);
  const effectiveKitCount = selectedPanelists.length;
  const taskOptions = useMemo(() => {
    const currentIncluded = availableProducts.some(item => item.id === product.id)
      ? availableProducts
      : [product, ...availableProducts];
    return currentIncluded.filter(item => item.status === 'active');
  }, [availableProducts, product]);
  const selectedTaskSummaries = useMemo(
    () => taskSummariesForIds(taskOptions, selectedProductIds, product),
    [product, selectedProductIds, taskOptions],
  );
  const reviewSignature = JSON.stringify({
    effectiveKitCount,
    instructions,
    selectedPanelistIds: safeSelectedPanelistIds,
    responseDeadline,
    selectedProductIds,
  });
  const reviewConfirmed = confirmedReviewSignature === reviewSignature;
  const canGenerate = reviewConfirmed && selectedProductIds.length > 0 && instructions.trim().length > 0 && effectiveKitCount > 0 && !generateKits.isPending;

  const printableKits = useMemo(() => {
    const currentIds = new Set(generatedKits.map(kit => kit.id));
    const recoveredKits = existingKits
      .filter(kit => passTokens[kit.id] && !['expired', 'submitted', 'void'].includes(kit.calculatedStatus))
      .filter(kit => !currentIds.has(kit.id))
      .map(kit => printableKitFromRecord(kit, passTokens[kit.id]));
    return [...generatedKits, ...recoveredKits];
  }, [existingKits, generatedKits, passTokens]);
  const recoveredAfterRefresh = generatedKits.length === 0 && printableKits.length > 0;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storageKey = panelistKitPassStorageKey(product.id);
    if (Object.keys(passTokens).length === 0) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }
    window.sessionStorage.setItem(storageKey, serializePanelistKitPassTokens(passTokens));
  }, [passTokens, product.id]);

  const activeKits = useMemo(() => existingKits.filter(kit => kit.calculatedStatus !== 'void'), [existingKits]);
  const statusCounts = useMemo(() => activeKits.reduce<Record<string, number>>((acc, kit) => {
    acc[kit.calculatedStatus] = (acc[kit.calculatedStatus] ?? 0) + 1;
    return acc;
  }, {}), [activeKits]);

  const handleGenerate = async () => {
    setError('');
    setActionMessage('');
    if (!canGenerate) {
      setError('Review the box setup and resolve any pack-list errors before generating QR passes.');
      return;
    }
    try {
      const kits = await generateKits.mutateAsync({
        productId: product.id,
        kitCount: effectiveKitCount,
        responseDeadline: responseDeadline || null,
        expiresAt: null,
        handlingInstructions: instructions,
        recipients: [],
        assignedProductIds: selectedProductIds.length ? selectedProductIds : [product.id],
        panelistIds: safeSelectedPanelistIds,
      });
      setGeneratedKits(kits);
      setPassTokens(Object.fromEntries(kits.filter(kit => kit.token).map(kit => [kit.id, kit.token])));
      setWorkspaceView('print');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate kit QR codes.');
    }
  };

  const toggleSelectedProduct = (productId: string) => {
    if (productId === product.id) return;
    setSelectedProductIds(previous => previous.includes(productId)
      ? previous.filter(id => id !== productId)
      : [...previous, productId]);
  };

  const togglePanelist = (panelistId: string) => {
    setSelectedPanelistIds(previous => previous.includes(panelistId) ? previous.filter(id => id !== panelistId) : [...previous, panelistId]);
  };

  const handleFulfillment = async (kit: PanelistKitRecord, status: 'printed' | 'packed' | 'shipped', trackingNumber?: string | null) => {
    setError('');
    setActionMessage('');
    try {
      await updateFulfillment.mutateAsync({ kitId: kit.id, status, trackingNumber: status === 'shipped' ? trackingNumber ?? '' : null });
      setActionMessage(`${kit.kitCode} marked ${status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to mark ${kit.kitCode} ${status}.`);
    }
  };

  const handleReminder = async (kit: PanelistKitRecord) => {
    setError('');
    setActionMessage('');
    try {
      await recordReminder.mutateAsync({ kitId: kit.id, reason: 'manual_follow_up' });
      setActionMessage(`Follow-up logged for ${kit.recipientName ?? kit.kitCode}. No email or SMS was sent.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log follow-up.');
    }
  };

  const openShippingDialog = (kit: PanelistKitRecord) => {
    setShippingKit(kit);
    setTrackingDraft(kit.trackingNumber ?? '');
  };

  const openReplacementDialog = (kit: PanelistKitRecord) => {
    setReplacementKit(kit);
    setReplacementReason(kit.issueType ? `Issue: ${kit.issueType.replace(/_/g, ' ')}` : 'Replacement issued');
  };

  const openVoidDialog = (kit: PanelistKitRecord) => {
    setVoidingKit(kit);
    setVoidReason(kit.issueType ? `Issue: ${kit.issueType.replace(/_/g, ' ')}` : '');
  };

  const handleShipSubmit = async () => {
    if (!shippingKit) return;
    await handleFulfillment(shippingKit, 'shipped', trackingDraft.trim());
    setShippingKit(null);
  };

  const handleVoid = async () => {
    if (!voidingKit) return;
    const reason = voidReason.trim();
    if (!reason) {
      setError('Add a reason before deleting this box.');
      return;
    }
    setError('');
    setActionMessage('');
    try {
      await voidKit.mutateAsync({ kitId: voidingKit.id, reason });
      setGeneratedKits(previous => previous.filter(kit => kit.id !== voidingKit.id));
      setPassTokens(previous => {
        const next = { ...previous };
        delete next[voidingKit.id];
        return next;
      });
      setActionMessage(`${voidingKit.kitCode} deleted from active fielding. Its audit history has been retained.`);
      setVoidingKit(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete this box.');
    }
  };

  const handleReplacement = async () => {
    if (!replacementKit) return;
    const reason = replacementReason.trim() || 'Replacement issued';
    setError('');
    setActionMessage('');
    try {
      const replacements = await createReplacement.mutateAsync({ kitId: replacementKit.id, reason });
      setGeneratedKits(previous => [
        ...replacements.map(kit => ({ ...kit, recipientAddress: replacementKit.recipientAddress, assignedPanelistId: replacementKit.claimedBy })),
        ...previous.filter(kit => kit.id !== replacementKit.id),
      ]);
      setPassTokens(previous => {
        const next = { ...previous };
        delete next[replacementKit.id];
        replacements.forEach(kit => {
          if (kit.token) next[kit.id] = kit.token;
        });
        return next;
      });
      setActionMessage(`Replacement created for ${replacementKit.recipientName ?? replacementKit.kitCode}. Its print pass is available below for the rest of this browser session.`);
      setReplacementKit(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create replacement kit.');
    }
  };

  return (
    <section className={standalone ? 'space-y-4' : 'space-y-4 border-t border-slate-200 pt-5'} aria-labelledby="kit-inserts-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h3 id="kit-inserts-heading" className="flex items-center gap-2 text-lg font-bold text-slate-900">
            {workspaceView === 'create' ? <Package className="size-5 text-slate-700" aria-hidden /> : workspaceView === 'print' ? <Printer className="size-5 text-slate-700" aria-hidden /> : <QrCode className="size-5 text-slate-700" aria-hidden />}
            {workspaceView === 'create' ? 'Create a new box' : workspaceView === 'print' ? 'Box print materials' : 'Fielding'}
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {workspaceView === 'create'
              ? 'Select ready panelist accounts, choose what goes in each box, verify allergens, then generate the print batch.'
              : workspaceView === 'print'
                ? 'Review the packing sheet and every panelist insert, then download or print the complete batch.'
              : 'Track every prepared box from printing through completed panelist tasks.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {workspaceView !== 'fielding' ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setWorkspaceView('fielding')}>
              <ArrowLeft className="size-3.5" aria-hidden />
              Back to fielding
            </Button>
          ) : (
            <>
              <Button type="button" size="sm" onClick={() => setWorkspaceView('create')} className="bg-slate-900 hover:bg-slate-800">
                <Plus className="size-3.5" aria-hidden />
                Create new box
              </Button>
              {printableKits.length > 0 && (
                <Button type="button" size="sm" variant="outline" onClick={() => setWorkspaceView('print')}>
                  <Printer className="size-3.5" aria-hidden />
                  View print sheets
                </Button>
              )}
            </>
          )}
          {workspaceView === 'fielding' && activeKits.length > 0 && (
            <Button type="button" size="sm" variant="outline" onClick={() => downloadKitsCsv(product, activeKits, taskOptions)}>
              <Download className="size-3.5" aria-hidden />
              Export fielding CSV
            </Button>
          )}
        </div>
      </div>

      <div hidden={workspaceView !== 'create'} className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <section className="grid gap-4 border-b border-slate-200 p-4 lg:grid-cols-[180px_1fr]" aria-labelledby="box-recipients-heading">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">1</span>
              <h4 id="box-recipients-heading" className="text-sm font-bold text-slate-900">Recipients</h4>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Only completed, eligible panelist profiles appear here.</p>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="text-sm font-semibold text-slate-950">Choose ready panelists</p><p className="mt-0.5 text-xs text-slate-600">One named box is created for every selected account. Delivery and demographic details come from the completed profile.</p></div>
                <div className="flex gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setSelectedPanelistIds(eligiblePanelists.map(panelist => panelist.id))} disabled={eligiblePanelists.length === 0}>Select all</Button><Button type="button" size="sm" variant="ghost" onClick={() => setSelectedPanelistIds([])} disabled={selectedPanelistIds.length === 0}>Clear</Button></div>
              </div>
              <div className="relative mt-3"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden /><Input value={panelistSearch} onChange={event => setPanelistSearch(event.target.value)} placeholder="Search by name or postcode" className="pl-9" aria-label="Search ready panelists" /></div>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {panelistsLoading || eligibilityLoading ? <p className="p-5 text-sm text-slate-600">Finding eligible panelists…</p> : visiblePanelists.length === 0 ? <div className="p-5"><p className="text-sm font-semibold text-slate-900">No eligible panelists found</p><p className="mt-1 text-xs leading-5 text-slate-600">Completed accounts appear automatically when their safety profile has no conflict with the selected box contents.</p></div> : <ul className="divide-y divide-slate-200">{visiblePanelists.map(panelist => {
                const selected = selectedPanelistIds.includes(panelist.id);
                return <li key={panelist.id}><label aria-label={`Select ${panelist.name}`} className={`flex cursor-pointer items-start gap-3 p-3 transition-colors ${selected ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'}`}><input type="checkbox" checked={selected} onChange={() => togglePanelist(panelist.id)} className="mt-1 size-4 accent-slate-900" /><span className="min-w-0 flex-1"><strong className="text-sm text-slate-950">{panelist.name}</strong><span className="mt-1 block whitespace-pre-line text-xs leading-5 text-slate-500">{panelistShippingAddress(panelist)}</span></span></label></li>;
              })}</ul>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-slate-600">{eligiblePanelists.length} eligible for every selected box item. Conflicting profiles are excluded automatically.</span><strong className={selectedPanelists.length ? 'text-emerald-700' : 'text-slate-600'}>{selectedPanelists.length} selected</strong></div>
          </div>
        </section>

        <section className="grid gap-4 border-b border-slate-200 p-4 lg:grid-cols-[180px_1fr]" aria-labelledby="box-contents-heading">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">2</span>
              <h4 id="box-contents-heading" className="text-sm font-bold text-slate-900">Box contents</h4>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Every task must have its matching physical sample in each box.</p>
          </div>
          <div className="space-y-5">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-slate-700">{selectedProductIds.length} of {taskOptions.length} project task{taskOptions.length === 1 ? '' : 's'} selected</p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedProductIds(taskOptions.map(task => task.id))}>Select all</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedProductIds([product.id])} disabled={selectedProductIds.length === 1}>Primary only</Button>
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {taskOptions.map(task => {
                  const selected = selectedProductIds.includes(task.id);
                  const summary = taskSummariesForIds(taskOptions, [task.id], product)[0];
                  return (
                    <li key={task.id}>
                      <label className={`flex cursor-pointer items-start gap-3 px-3 py-3 transition-colors ${selected ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={selected} disabled={task.id === product.id} onChange={() => toggleSelectedProduct(task.id)} className="mt-1 size-4 accent-slate-900" />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5"><span className="text-sm font-semibold text-slate-900">{summary?.label ?? getBlindStudyDisplayName(task)}</span>{task.id === product.id && <Badge variant="outline" className="border-slate-300 text-[10px] text-slate-600">Primary</Badge>}</span>
                          {summary && <span className="mt-0.5 block text-xs text-slate-500">{summary.sampleCue} · {summary.estimate}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="space-y-6 border-t border-slate-200 pt-5">
              {selectedTaskSummaries.map(task => (
                <SampleAllergenDeclarationEditor key={task.id} target={{ productId: task.id }} sampleName={task.label} compact />
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-b border-slate-200 p-4 lg:grid-cols-[180px_1fr]" aria-labelledby="box-timing-heading">
          <div>
            <div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">3</span><h4 id="box-timing-heading" className="text-sm font-bold text-slate-900">Timing & handling</h4></div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Give panelists one clear deadline and only the handling details they need.</p>
          </div>
          <div className="space-y-4">
            <div className="max-w-sm space-y-1.5"><Label htmlFor="response-deadline">Complete tastings by</Label><Input id="response-deadline" type="date" value={responseDeadline} onChange={event => setResponseDeadline(event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="handling-instructions">Storage and safety instructions</Label><Textarea id="handling-instructions" value={instructions} onChange={event => setInstructions(event.target.value)} className="min-h-24 bg-white text-sm leading-5" /></div>
            <p className={`rounded-md border px-3 py-2.5 text-xs leading-5 ${reviewedFormulation ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <strong>{reviewedFormulation ? `Formulation v${reviewedFormulation.versionNumber} reviewed.` : 'Formulation review required.'}</strong>{' '}
              {reviewedFormulation
                ? `Verified allergen note for inserts: ${verifiedAllergens.join(', ') || 'none recorded'}. Confirm against the physical label.`
                : 'Suggested ingredient flags are not inserted into participant materials.'}
            </p>
            <p className="rounded-md bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">Generating the box adds these tasks to each selected panelist’s account immediately. The QR and box code are optional shortcuts for opening the same work on a phone.</p>
          </div>
        </section>

        <section className="grid gap-4 bg-slate-50 p-4 lg:grid-cols-[180px_1fr]" aria-labelledby="box-review-heading">
          <div>
            <div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">4</span><h4 id="box-review-heading" className="text-sm font-bold text-slate-900">Final check</h4></div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Match this summary to the boxes in front of you.</p>
          </div>
          <div className="space-y-3">
            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white px-3">
              <div className="flex items-center justify-between gap-4 py-2.5 text-sm"><span className="text-slate-600">Next batch</span><strong className="text-slate-900">{effectiveKitCount} assigned box{effectiveKitCount === 1 ? '' : 'es'}</strong></div>
              <div className="flex items-center justify-between gap-4 py-2.5 text-sm"><span className="text-slate-600">In every box</span><strong className="text-right text-slate-900">{selectedTaskSummaries.length} task{selectedTaskSummaries.length === 1 ? '' : 's'}</strong></div>
              <div className="flex items-center justify-between gap-4 py-2.5 text-sm"><span className="text-slate-600">Deadline</span><strong className="text-slate-900">{responseDeadline ? new Date(responseDeadline).toLocaleDateString() : 'Not set'}</strong></div>
            </div>
            <ul className="space-y-1 text-xs leading-5 text-slate-600">{selectedTaskSummaries.map((task, index) => <li key={task.id}><strong className="text-slate-900">{index + 1}. {task.label}</strong> — {task.sampleCue}</li>)}</ul>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-700">
              <input type="checkbox" checked={reviewConfirmed} onChange={event => setConfirmedReviewSignature(event.target.checked ? reviewSignature : '')} disabled={effectiveKitCount === 0} className="mt-1 size-4 accent-slate-900" />
              <span><strong className="block text-slate-900">Pack list checked against the physical boxes</strong>The recipients, samples, deadline, and handling notes above are correct.</span>
            </label>
            {selectedPanelists.length === 0 && <p className="text-sm font-medium text-amber-800">Select at least one completed panelist account to generate this batch.</p>}
          </div>
        </section>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {actionMessage && (
        <Alert className="border-blue-300 bg-blue-50">
          <AlertDescription className="text-blue-900">{actionMessage}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" onClick={handleGenerate} disabled={!canGenerate} className="bg-slate-900 hover:bg-slate-800">
          {generateKits.isPending ? <RefreshCw className="size-4 animate-spin" aria-hidden /> : <Package className="size-4" aria-hidden />}
          {generateKits.isPending ? 'Generating...' : 'Generate box passes'}
        </Button>
        <span className="text-xs leading-5 text-slate-500">Creates {effectiveKitCount || 0} assigned box{effectiveKitCount === 1 ? '' : 'es'} and immediately adds the selected tasks to each panelist’s task inbox.</span>
      </div>
      </div>

      <div hidden={workspaceView !== 'print'} className="space-y-4">
      {printableKits.length > 0 && <section className="rounded-lg border border-emerald-300 bg-emerald-50 p-4" aria-labelledby="generated-boxes-heading"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden /><div><h4 id="generated-boxes-heading" className="font-bold text-emerald-950">{recoveredAfterRefresh ? 'Your print batch was recovered' : 'The complete batch is ready'}</h4><p className="mt-0.5 text-sm text-emerald-900">{recoveredAfterRefresh ? 'These unique QR passes were restored for this browser session. Print or save them before closing the tab.' : 'Print one packing sheet followed by every unique QR insert, or download the recipient sheet for your shipping workflow.'}</p></div></div><div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" onClick={() => downloadPackingSheet(product, printableKits, taskOptions, verifiedAllergens)} className="border-emerald-700 bg-white text-emerald-900 hover:bg-emerald-100"><Download className="size-4" aria-hidden />Download packing sheet</Button><Button type="button" onClick={() => window.print()} className="bg-emerald-800 text-white hover:bg-emerald-900"><Printer className="size-4" aria-hidden />Print / save full batch</Button></div></div></section>}

      {printableKits.length > 0 && <div className="kit-print-area grid gap-4"><BatchPackingSheet product={product} kits={printableKits} taskOptions={taskOptions} verifiedAllergens={verifiedAllergens} />{printableKits.map(kit => <KitInsertCard key={kit.id} kit={kit} product={product} instructions={kit.handlingInstructions} assignedTasks={taskSummariesForIds(taskOptions, kit.assignedProductIds, product)} verifiedAllergens={verifiedAllergens} />)}</div>}
      </div>

      <div hidden={workspaceView !== 'fielding'}>
      {activeKits.length > 0 ? (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-labelledby="fielding-heading">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 id="fielding-heading" className="text-sm font-bold text-slate-900">Fielding</h4>
              <p className="mt-0.5 text-xs text-slate-500">Each row shows the next physical handoff. More actions stay available when needed.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">{Object.entries(statusCounts).map(([status, count]) => <Badge key={status} variant="outline" className={statusClass(status as PanelistKitRecord['calculatedStatus'])}>{count} {status}</Badge>)}</div>
          </div>
          <div className="divide-y divide-slate-100">
            {activeKits.map(kit => (
              <article key={kit.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold text-slate-900">{kit.kitCode}</span><Badge variant="outline" className={statusClass(kit.calculatedStatus)}>{kit.calculatedStatus}</Badge>{kit.issueStatus !== 'none' && <Badge variant="outline" className={issueClass(kit.issueStatus)}><AlertTriangle className="size-3" aria-hidden />{kit.issueStatus}</Badge>}{kit.replacementForKitId && <Badge variant="outline" className="border-amber-300 text-amber-800">Replacement</Badge>}</div>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{kit.recipientName ?? 'Legacy unassigned box'}{kit.claimedPanelistName && kit.claimedPanelistName !== kit.recipientName ? <span className="font-normal text-slate-500"> · account {kit.claimedPanelistName}</span> : null}</p>
                    {kit.recipientAddress && <div className="mt-2 text-xs text-slate-600"><span className="block font-semibold text-slate-500">Delivery address</span><span className="whitespace-pre-line leading-5">{kit.recipientAddress}</span></div>}
                    <p className="mt-1 text-xs leading-5 text-slate-500">{taskSummariesForIds(taskOptions, kit.assignedProductIds, product).map(task => task.label).join(', ')}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {!kit.printedAt ? <Button type="button" size="sm" onClick={() => handleFulfillment(kit, 'printed')} disabled={updateFulfillment.isPending || kit.calculatedStatus === 'void' || kit.calculatedStatus === 'submitted'} className="bg-slate-900 hover:bg-slate-800"><Printer className="size-3.5" aria-hidden />Mark printed</Button>
                      : !kit.packedAt ? <Button type="button" size="sm" onClick={() => handleFulfillment(kit, 'packed')} disabled={updateFulfillment.isPending || kit.calculatedStatus === 'void' || kit.calculatedStatus === 'submitted'} className="bg-slate-900 hover:bg-slate-800"><PackageCheck className="size-3.5" aria-hidden />Mark packed</Button>
                      : !kit.shippedAt ? <Button type="button" size="sm" onClick={() => openShippingDialog(kit)} disabled={updateFulfillment.isPending || kit.calculatedStatus === 'void' || kit.calculatedStatus === 'submitted'} className="bg-slate-900 hover:bg-slate-800"><Send className="size-3.5" aria-hidden />Mark shipped</Button>
                      : kit.claimedBy && kit.calculatedStatus !== 'submitted' && kit.calculatedStatus !== 'void' ? <Button type="button" size="sm" variant="outline" onClick={() => handleReminder(kit)} disabled={recordReminder.isPending}><ClipboardCheck className="size-3.5" aria-hidden />Log follow-up</Button>
                      : null}
                    <Button type="button" size="sm" variant="destructive" onClick={() => openVoidDialog(kit)} disabled={voidKit.isPending || kit.calculatedStatus === 'submitted'}>
                      <Trash2 className="size-3.5" aria-hidden />
                      Delete
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button type="button" size="icon" variant="outline" aria-label={`More actions for ${kit.kitCode}`}><MoreHorizontal className="size-4" aria-hidden /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {kit.claimedBy && <DropdownMenuItem onSelect={() => handleReminder(kit)} disabled={recordReminder.isPending || kit.calculatedStatus === 'submitted' || kit.calculatedStatus === 'void'}><ClipboardCheck />Log follow-up</DropdownMenuItem>}
                        <DropdownMenuItem onSelect={() => openReplacementDialog(kit)} disabled={createReplacement.isPending || kit.calculatedStatus === 'void' || kit.calculatedStatus === 'submitted'}><RefreshCw />Create replacement</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500"><span>Printed <strong className="text-slate-700">{formatShortDate(kit.printedAt)}</strong></span><span>Packed <strong className="text-slate-700">{formatShortDate(kit.packedAt)}</strong></span><span>Shipped <strong className="text-slate-700">{formatShortDate(kit.shippedAt)}</strong></span><span>Completed <strong className="text-slate-700">{kit.completedProductCount}/{kit.assignedProductCount}</strong></span>{kit.trackingNumber && <span>Tracking <strong className="text-slate-700">{kit.trackingNumber}</strong></span>}{kit.issueType && <span className="text-rose-700">Issue: {kit.issueType.replace(/_/g, ' ')}</span>}</div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center" aria-labelledby="empty-fielding-heading">
          <Package className="mx-auto size-8 text-slate-400" aria-hidden />
          <h4 id="empty-fielding-heading" className="mt-3 text-sm font-bold text-slate-900">No boxes in fielding yet</h4>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-600">Create the first box batch from completed panelist accounts, then track printing, packing, shipping, and responses here.</p>
          <Button type="button" size="sm" onClick={() => setWorkspaceView('create')} className="mt-4 bg-slate-900 hover:bg-slate-800">
            <Plus className="size-3.5" aria-hidden />
            Create new box
          </Button>
        </section>
      )}
      </div>

      <Dialog open={!!shippingKit} onOpenChange={open => !open && setShippingKit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark box shipped</DialogTitle>
            <DialogDescription>
              Add tracking if available. This updates fielding status but does not message the panelist.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="shipping-tracking">Tracking number</Label>
            <Input id="shipping-tracking" value={trackingDraft} onChange={event => setTrackingDraft(event.target.value)} placeholder="Optional" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShippingKit(null)}>Cancel</Button>
            <Button type="button" onClick={handleShipSubmit} disabled={updateFulfillment.isPending} className="bg-slate-900 hover:bg-slate-800">
              {updateFulfillment.isPending ? 'Saving...' : 'Mark shipped'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!replacementKit} onOpenChange={open => !open && setReplacementKit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create replacement box</DialogTitle>
            <DialogDescription>
              A replacement box record and account QR insert will be created for the same panelist.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="replacement-reason">Reason</Label>
            <Textarea id="replacement-reason" value={replacementReason} onChange={event => setReplacementReason(event.target.value)} className="min-h-24 bg-white text-sm" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReplacementKit(null)}>Cancel</Button>
            <Button type="button" onClick={handleReplacement} disabled={createReplacement.isPending} className="bg-slate-900 hover:bg-slate-800">
              {createReplacement.isPending ? 'Creating...' : 'Create replacement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!voidingKit} onOpenChange={open => !open && setVoidingKit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this box?</DialogTitle>
            <DialogDescription>
              This removes the box from active fielding and disables its QR pass. Its audit history is retained.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="void-reason">Reason for deletion</Label>
            <Textarea id="void-reason" value={voidReason} onChange={event => setVoidReason(event.target.value)} placeholder="For example: Created in error" className="min-h-24 bg-white text-sm" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setVoidingKit(null)}>Cancel</Button>
            <Button type="button" onClick={handleVoid} disabled={voidKit.isPending || !voidReason.trim()} className="bg-rose-700 text-white hover:bg-rose-800">
              {voidKit.isPending ? 'Deleting...' : 'Delete box'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
