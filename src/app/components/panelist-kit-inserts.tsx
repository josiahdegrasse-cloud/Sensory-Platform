import { useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Download, FileCheck2, Package, PackageCheck, Printer, QrCode, RefreshCw, Send, ShieldCheck, XCircle } from 'lucide-react';
import type { Product } from '../data/survey-domain';
import type { GeneratedPanelistKit, PanelistKitRecord } from '../lib/database';
import {
  useCreateReplacementPanelistKit,
  useActiveProducts,
  useGeneratePanelistKits,
  usePanelistKits,
  useRecordPanelistKitReminder,
  useUpdatePanelistKitFulfillment,
  useVoidPanelistKit,
} from '../lib/hooks';
import { getBlindStudyDisplayName } from '../lib/blind-study';
import { analyzePackList, recipientInputs, taskSummariesForIds, type BoxTaskSummary } from '../lib/panelist-box-workflow';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

function defaultInstructions(product: Product) {
  const sampleName = product.blinded
    ? 'the coded food samples'
    : product.name;
  return [
    `Keep ${sampleName} and any other samples in this box stored as instructed until you are ready to taste.`,
    'Scan the QR code once to create or sign in to your panelist account.',
    'After sign-up, your account will show every tasting task assigned from this box.',
    'Complete each task only when you are ready to taste that sample.',
    'Do not taste if you have any allergy or safety concern.',
  ].join('\n');
}

function joinUrl(token: string) {
  const origin = typeof window !== 'undefined'
    ? window.location.origin
    : (import.meta.env.VITE_APP_URL ?? '');
  return `${origin}/join/${token}`;
}

function manualJoinUrl(manualCode: string) {
  const origin = typeof window !== 'undefined'
    ? window.location.origin
    : (import.meta.env.VITE_APP_URL ?? '');
  return `${origin}/join?code=${encodeURIComponent(manualCode)}`;
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
    'Recipient email',
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
    kit.recipientEmail,
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

function KitInsertCard({ kit, product, instructions, assignedTasks }: {
  kit: GeneratedPanelistKit;
  product: Product;
  instructions: string;
  assignedTasks: BoxTaskSummary[];
}) {
  const url = joinUrl(kit.token);
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
            {kit.recipientEmail && <span className="ml-2 text-xs text-slate-500">{kit.recipientEmail}</span>}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 px-3 py-2 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Box code</p>
          <p className="font-mono text-lg font-bold tracking-wider">{kit.kitCode}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-[180px_1fr]">
        <div className="space-y-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <QRCode value={url} size={150} level="M" />
          </div>
          <p className="break-all text-[11px] leading-4 text-slate-500">{url}</p>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">What to do</h3>
            <ol className="mt-2 space-y-2 text-sm leading-5 text-slate-700">
              <li>1. Keep the food sealed until you are ready to taste.</li>
              <li>2. Scan this QR code once with your phone camera.</li>
              <li>3. Create your panelist account or sign in.</li>
              <li>4. Confirm this box code in the app.</li>
              <li>5. Open your task list and complete the assigned tastings.</li>
            </ol>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-sm font-bold text-slate-900">Tasks assigned from this box</h3>
            <ul className="mt-2 space-y-1 text-sm leading-5 text-slate-700">
              {assignedTasks.map((task, index) => (
                <li key={task.id}>
                  {index + 1}. {task.label} - {task.sampleCue}
                </li>
              ))}
            </ul>
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
            {kit.manualCode && (
              <div className="rounded-md border border-slate-200 px-3 py-2 sm:col-span-2">
                <span className="block font-semibold text-slate-500">Manual fallback code</span>
                <span className="font-mono text-sm font-bold text-slate-900">{kit.manualCode}</span>
                <span className="mt-1 block text-[12px] leading-5 text-slate-700">If the QR will not scan, go to {manualJoinUrl(kit.manualCode)} or enter this code on the join screen.</span>
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

export function PanelistKitInserts({ product }: { product: Product }) {
  const { data: existingKits = [], isLoading } = usePanelistKits(product.id);
  const { data: activeProducts = [] } = useActiveProducts();
  const generateKits = useGeneratePanelistKits();
  const updateFulfillment = useUpdatePanelistKitFulfillment(product.id);
  const recordReminder = useRecordPanelistKitReminder(product.id);
  const voidKit = useVoidPanelistKit(product.id);
  const createReplacement = useCreateReplacementPanelistKit(product.id);
  const [kitCount, setKitCount] = useState(12);
  const [responseDeadline, setResponseDeadline] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [instructions, setInstructions] = useState(() => defaultInstructions(product));
  const [recipientText, setRecipientText] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([product.id]);
  const [generatedKits, setGeneratedKits] = useState<GeneratedPanelistKit[]>([]);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [confirmedReviewSignature, setConfirmedReviewSignature] = useState('');
  const [shippingKit, setShippingKit] = useState<PanelistKitRecord | null>(null);
  const [trackingDraft, setTrackingDraft] = useState('');
  const [replacementKit, setReplacementKit] = useState<PanelistKitRecord | null>(null);
  const [replacementReason, setReplacementReason] = useState('');
  const [voidingKit, setVoidingKit] = useState<PanelistKitRecord | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const packList = useMemo(() => analyzePackList(recipientText), [recipientText]);
  const recipients = useMemo(() => recipientInputs(packList.recipients), [packList.recipients]);
  const effectiveKitCount = recipients.length > 0 ? recipients.length : kitCount;
  const taskOptions = useMemo(() => {
    const currentIncluded = activeProducts.some(item => item.id === product.id)
      ? activeProducts
      : [product, ...activeProducts];
    return currentIncluded.filter(item => item.status === 'active');
  }, [activeProducts, product]);
  const selectedTaskSummaries = useMemo(
    () => taskSummariesForIds(taskOptions, selectedProductIds, product),
    [product, selectedProductIds, taskOptions],
  );
  const reviewSignature = JSON.stringify({
    effectiveKitCount,
    expiresAt,
    instructions,
    recipientText,
    responseDeadline,
    selectedProductIds,
  });
  const reviewConfirmed = confirmedReviewSignature === reviewSignature;
  const canGenerate = reviewConfirmed && !packList.hasErrors && selectedProductIds.length > 0 && instructions.trim().length > 0 && effectiveKitCount > 0 && !generateKits.isPending;

  const statusCounts = useMemo(() => existingKits.reduce<Record<string, number>>((acc, kit) => {
    acc[kit.calculatedStatus] = (acc[kit.calculatedStatus] ?? 0) + 1;
    return acc;
  }, {}), [existingKits]);

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
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        handlingInstructions: instructions,
        recipients,
        assignedProductIds: selectedProductIds.length ? selectedProductIds : [product.id],
      });
      setGeneratedKits(kits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate kit QR codes.');
    }
  };

  const toggleSelectedProduct = (productId: string, checked: boolean) => {
    setSelectedProductIds(previous => {
      const next = checked
        ? Array.from(new Set([...previous, productId]))
        : previous.filter(id => id !== productId);
      return next.length > 0 ? next : [product.id];
    });
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
      setError('Add a reason before voiding this box.');
      return;
    }
    setError('');
    setActionMessage('');
    try {
      await voidKit.mutateAsync({ kitId: voidingKit.id, reason });
      setActionMessage(`${voidingKit.kitCode} voided.`);
      setVoidingKit(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to void kit.');
    }
  };

  const handleReplacement = async () => {
    if (!replacementKit) return;
    const reason = replacementReason.trim() || 'Replacement issued';
    setError('');
    setActionMessage('');
    try {
      const replacements = await createReplacement.mutateAsync({ kitId: replacementKit.id, reason });
      setGeneratedKits(previous => [...replacements, ...previous]);
      setActionMessage(`Replacement created for ${replacementKit.recipientName ?? replacementKit.kitCode}. Print the new insert before leaving this screen.`);
      setReplacementKit(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create replacement kit.');
    }
  };

  return (
    <section className="space-y-4 border-t border-slate-200 pt-5" aria-labelledby="kit-inserts-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="kit-inserts-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <QrCode className="size-4 text-slate-700" aria-hidden />
            Box QR codes and package inserts
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            Generate one QR-coded box pass per panelist. The QR takes them through sign-up, claims the box, and opens their account with the selected tasting tasks waiting.
          </p>
        </div>
        {generatedKits.length > 0 && (
          <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="size-3.5" aria-hidden />
            Print inserts
          </Button>
        )}
        {existingKits.length > 0 && (
          <Button type="button" size="sm" variant="outline" onClick={() => downloadKitsCsv(product, existingKits, taskOptions)}>
            <Download className="size-3.5" aria-hidden />
            Export fielding CSV
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="kit-count">Number of kits</Label>
          <Input
            id="kit-count"
            type="number"
            min={1}
            max={250}
            value={kitCount}
            disabled={recipients.length > 0}
            onChange={event => setKitCount(Math.min(250, Math.max(1, Number(event.target.value) || 1)))}
          />
          {recipients.length > 0 && <p className="text-xs text-slate-500">Using {recipients.length} recipient name{recipients.length === 1 ? '' : 's'} from the pack list.</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="response-deadline">Response deadline</Label>
          <Input id="response-deadline" type="date" value={responseDeadline} onChange={event => setResponseDeadline(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qr-expires-at">QR expires</Label>
          <Input id="qr-expires-at" type="datetime-local" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="kit-recipients">Pack list names</Label>
        <Textarea
          id="kit-recipients"
          value={recipientText}
          onChange={event => setRecipientText(event.target.value)}
          placeholder={'One per line, for example:\nAvery Johnson, avery@example.com\nMina Patel <mina@example.com>\nChris Wong'}
          className="min-h-28 bg-white text-sm leading-5"
        />
        <p className="text-xs text-slate-500">
          Optional but recommended. Names print on the inserts and help packing, tracking, and handoff.
        </p>
        {packList.issues.length > 0 && (
          <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
            {packList.issues.map(issue => (
              <p key={issue.message} className={issue.severity === 'error' ? 'text-rose-700' : 'text-amber-700'}>
                {issue.severity === 'error' ? 'Fix: ' : 'Check: '}{issue.message}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Tasting tasks included in this box</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {taskOptions.map(task => (
            <label key={task.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                aria-label={`Include ${getBlindStudyDisplayName(task)} in this box`}
                checked={selectedProductIds.includes(task.id)}
                onChange={event => toggleSelectedProduct(task.id, event.target.checked)}
                className="mt-1 accent-slate-900"
              />
              <span className="min-w-0">
                <span className="block font-semibold text-slate-900">{getBlindStudyDisplayName(task)}</span>
                <span className="block text-xs text-slate-500">{task.isMultiSample ? 'Multi-sample comparison' : 'Single product evaluation'}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Select every food evaluation represented by the physical samples in this shipment. Panelists scan once and see these tasks on their dashboard.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="handling-instructions">Package handling instructions</Label>
        <Textarea
          id="handling-instructions"
          value={instructions}
          onChange={event => setInstructions(event.target.value)}
          className="min-h-28 bg-white text-sm leading-5"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileCheck2 className="size-4 text-slate-700" aria-hidden />
              Review before generating
            </h4>
            <p className="mt-1 text-xs leading-5 text-slate-700">
              Use this as the packing checkpoint. The QR passes should only be generated once these details match the physical boxes.
            </p>
          </div>
          <Badge variant="outline" className={packList.hasErrors ? 'border-rose-300 text-rose-700' : 'border-emerald-300 text-emerald-700'}>
            {packList.hasErrors ? 'Needs fixes' : 'Ready to review'}
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <span className="block text-xs font-semibold text-slate-500">Boxes in next batch</span>
            <span className="mt-1 block text-lg font-bold text-slate-900">{effectiveKitCount}</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <span className="block text-xs font-semibold text-slate-500">Named recipients</span>
            <span className="mt-1 block text-lg font-bold text-slate-900">{recipients.length || 'None'}</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <span className="block text-xs font-semibold text-slate-500">Tasks per box</span>
            <span className="mt-1 block text-lg font-bold text-slate-900">{selectedTaskSummaries.length}</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <span className="block text-xs font-semibold text-slate-500">Deadline</span>
            <span className="mt-1 block text-sm font-bold text-slate-900">{responseDeadline ? new Date(responseDeadline).toLocaleDateString() : 'Not set'}</span>
          </div>
        </div>
        <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
          <span className="block text-xs font-semibold text-slate-500">Task/sample match</span>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {selectedTaskSummaries.map((task, index) => (
              <li key={task.id}>{index + 1}. {task.label} - {task.sampleCue} - {task.estimate}</li>
            ))}
          </ul>
        </div>
        <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={reviewConfirmed}
            onChange={event => setConfirmedReviewSignature(event.target.checked ? reviewSignature : '')}
            disabled={packList.hasErrors}
            className="mt-1 accent-slate-900"
          />
          <span>I reviewed the pack list, tasks, deadline, and handling instructions against the physical boxes.</span>
        </label>
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

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={handleGenerate} disabled={!canGenerate} className="bg-slate-900 hover:bg-slate-800">
          {generateKits.isPending ? <RefreshCw className="size-4 animate-spin" aria-hidden /> : <Package className="size-4" aria-hidden />}
          {generateKits.isPending ? 'Generating...' : 'Generate box passes'}
        </Button>
        <span className="text-xs text-slate-500">
          {isLoading ? 'Loading box status...' : `${existingKits.length} box pass${existingKits.length === 1 ? '' : 'es'} generated - ${selectedProductIds.length} task${selectedProductIds.length === 1 ? '' : 's'} per box - next batch ${effectiveKitCount}`}
        </span>
        {Object.entries(statusCounts).map(([status, count]) => (
          <Badge key={status} variant="outline" className={statusClass(status as PanelistKitRecord['calculatedStatus'])}>
            {count} {status}
          </Badge>
        ))}
      </div>

      {generatedKits.length > 0 && (
        <Alert className="border-emerald-300 bg-emerald-50">
          <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
          <AlertDescription className="text-emerald-800">
            Generated {generatedKits.length} box pass{generatedKits.length === 1 ? '' : 'es'}. Print or save this page now; the secure QR token cannot be recovered later.
          </AlertDescription>
        </Alert>
      )}

      {existingKits.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="hidden grid-cols-[1.2fr_1.1fr_1fr_1fr_1.4fr] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 lg:grid">
            <span>Box</span>
            <span>Recipient</span>
            <span>Status</span>
            <span>Fielding</span>
            <span>Actions</span>
          </div>
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto bg-white">
            {existingKits.map(kit => (
              <div key={kit.id} className="grid gap-3 px-3 py-3 text-sm lg:grid-cols-[1.2fr_1.1fr_1fr_1fr_1.4fr] lg:items-center">
                <div className="min-w-0">
                  <span className="block font-mono font-semibold text-slate-900">{kit.kitCode}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {kit.assignedProductCount} task{kit.assignedProductCount === 1 ? '' : 's'}
                    {kit.manualCode ? ` · ${kit.manualCode}` : ''}
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-slate-500">
                    {taskSummariesForIds(taskOptions, kit.assignedProductIds, product).map(task => task.label).join(', ')}
                  </span>
                  {kit.replacementForKitId && <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wide text-amber-700">Replacement box</span>}
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-slate-700">{kit.recipientName ?? 'Unassigned'}</span>
                  {kit.recipientEmail && <span className="block truncate text-[11px] text-slate-500">{kit.recipientEmail}</span>}
                  <span className="mt-1 block truncate text-[11px] text-slate-500">{kit.claimedPanelistName ? `Claimed by ${kit.claimedPanelistName}` : 'Unclaimed'}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={statusClass(kit.calculatedStatus)}>{kit.calculatedStatus}</Badge>
                  {kit.issueStatus !== 'none' && (
                    <Badge variant="outline" className={issueClass(kit.issueStatus)}>
                      <AlertTriangle className="size-3" aria-hidden />
                      {kit.issueStatus}
                    </Badge>
                  )}
                  {kit.issueType && <span className="basis-full text-[11px] text-slate-500">{kit.issueType.replace(/_/g, ' ')}</span>}
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500">
                  <span>Printed: <strong className="text-slate-700">{formatShortDate(kit.printedAt)}</strong></span>
                  <span>Packed: <strong className="text-slate-700">{formatShortDate(kit.packedAt)}</strong></span>
                  <span>Shipped: <strong className="text-slate-700">{formatShortDate(kit.shippedAt)}</strong></span>
                  <span>Follow-ups: <strong className="text-slate-700">{kit.reminderCount}</strong></span>
                  <span className="col-span-2">Completed: <strong className="text-slate-700">{kit.completedProductCount}/{kit.assignedProductCount}</strong></span>
                  {kit.trackingNumber && <span className="col-span-2 truncate">Tracking: <strong className="text-slate-700">{kit.trackingNumber}</strong></span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" size="sm" variant="outline" onClick={() => handleFulfillment(kit, 'printed')} disabled={updateFulfillment.isPending || kit.calculatedStatus === 'void' || kit.calculatedStatus === 'submitted'}>
                    <Printer className="size-3.5" aria-hidden />
                    Printed
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => handleFulfillment(kit, 'packed')} disabled={updateFulfillment.isPending || kit.calculatedStatus === 'void' || kit.calculatedStatus === 'submitted'}>
                    <PackageCheck className="size-3.5" aria-hidden />
                    Packed
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => openShippingDialog(kit)} disabled={updateFulfillment.isPending || kit.calculatedStatus === 'void' || kit.calculatedStatus === 'submitted'}>
                    <Send className="size-3.5" aria-hidden />
                    Shipped
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => handleReminder(kit)} disabled={recordReminder.isPending || !kit.claimedBy || kit.calculatedStatus === 'submitted' || kit.calculatedStatus === 'void'}>
                    <ClipboardCheck className="size-3.5" aria-hidden />
                    Log follow-up
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => openReplacementDialog(kit)} disabled={createReplacement.isPending || kit.calculatedStatus === 'void' || kit.calculatedStatus === 'submitted'}>
                    <RefreshCw className="size-3.5" aria-hidden />
                    Replace
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => openVoidDialog(kit)} disabled={voidKit.isPending || kit.calculatedStatus === 'void' || kit.calculatedStatus === 'submitted'} className="text-rose-700 hover:text-rose-800">
                    <XCircle className="size-3.5" aria-hidden />
                    Void
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {generatedKits.length > 0 && (
        <div className="kit-print-area grid gap-4">
          {generatedKits.map(kit => (
            <KitInsertCard key={kit.id} kit={kit} product={product} instructions={instructions} assignedTasks={taskSummariesForIds(taskOptions, kit.assignedProductIds, product)} />
          ))}
        </div>
      )}

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
              A new QR token will be generated. Print the replacement insert before leaving this screen.
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
            <DialogTitle>Void this box pass?</DialogTitle>
            <DialogDescription>
              Voided box passes cannot be claimed by panelists. Add an audit reason before continuing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="void-reason">Reason</Label>
            <Textarea id="void-reason" value={voidReason} onChange={event => setVoidReason(event.target.value)} className="min-h-24 bg-white text-sm" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setVoidingKit(null)}>Cancel</Button>
            <Button type="button" onClick={handleVoid} disabled={voidKit.isPending || !voidReason.trim()} className="bg-rose-700 text-white hover:bg-rose-800">
              {voidKit.isPending ? 'Voiding...' : 'Void box'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
