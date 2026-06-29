import { useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import { AlertTriangle, Bell, CheckCircle2, Download, Package, PackageCheck, Printer, QrCode, RefreshCw, Send, ShieldCheck, XCircle } from 'lucide-react';
import type { Product } from '../data/survey-domain';
import type { GeneratedPanelistKit, PanelistKitRecord } from '../lib/database';
import {
  useCreateReplacementPanelistKit,
  useGeneratePanelistKits,
  usePanelistKits,
  useRecordPanelistKitReminder,
  useUpdatePanelistKitFulfillment,
  useVoidPanelistKit,
} from '../lib/hooks';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

function defaultInstructions(product: Product) {
  const sampleName = product.blinded
    ? product.isMultiSample ? 'the coded samples' : 'the coded sample'
    : product.name;
  return [
    `Keep ${sampleName} stored as instructed until you are ready to taste.`,
    'Scan the QR code when you can complete the evaluation in one sitting.',
    'Confirm the kit code shown in the app matches this insert.',
    'Do not taste if you have any allergy or safety concern.',
  ].join('\n');
}

function parseRecipients(input: string): Array<{ name: string; email?: string }> {
  return input
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const emailMatch = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      const email = emailMatch?.[0]?.toLowerCase();
      const name = line
        .replace(/[<>()]/g, ' ')
        .replace(email ?? '', '')
        .replace(/[,;]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return { name: name || email || 'Unnamed panelist', email };
    });
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
  return 'border-slate-300 text-slate-700';
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

function downloadKitsCsv(product: Product, kits: PanelistKitRecord[]) {
  const headers = [
    'Kit code',
    'Manual code',
    'Sample code',
    'Recipient name',
    'Recipient email',
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
    'Reminders',
  ];
  const rows = kits.map(kit => [
    kit.kitCode,
    kit.manualCode,
    kit.sampleCode,
    kit.recipientName,
    kit.recipientEmail,
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
  link.download = `${product.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'panelist-kits'}-fielding.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function KitInsertCard({ kit, product, instructions }: {
  kit: GeneratedPanelistKit;
  product: Product;
  instructions: string;
}) {
  const url = joinUrl(kit.token);
  const displayName = product.blinded ? 'Coded tasting sample' : product.name;
  const recipientLabel = kit.recipientName ?? 'Panelist';

  return (
    <article className="kit-insert-page rounded-lg border border-slate-300 bg-white p-6 text-slate-950">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">New Food Innovation</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">At-home tasting kit</h2>
          <p className="mt-1 text-sm text-slate-600">{displayName}</p>
          <p className="mt-3 text-sm text-slate-700">
            For: <span className="font-bold text-slate-950">{recipientLabel}</span>
            {kit.recipientEmail && <span className="ml-2 text-xs text-slate-500">{kit.recipientEmail}</span>}
          </p>
        </div>
        <div className="rounded-md border border-slate-300 px-3 py-2 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Kit code</p>
          <p className="font-mono text-lg font-bold tracking-wider">{kit.kitCode}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-[180px_1fr]">
        <div className="space-y-2">
          <div className="rounded-lg border border-slate-300 bg-white p-3">
            <QRCode value={url} size={150} level="M" />
          </div>
          <p className="break-all text-[11px] leading-4 text-slate-500">{url}</p>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-950">What to do</h3>
            <ol className="mt-2 space-y-2 text-sm leading-5 text-slate-700">
              <li>1. Keep the sample sealed until you are ready to taste.</li>
              <li>2. Scan the QR code with your phone camera.</li>
              <li>3. Sign in or create your panelist account.</li>
              <li>4. Confirm the kit code in the app matches this insert.</li>
              <li>5. Complete the tasting and ratings in one sitting.</li>
            </ol>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-sm font-bold text-slate-950">Handling notes</h3>
            <p className="mt-1 whitespace-pre-line text-sm leading-5 text-slate-700">{instructions}</p>
          </div>
          <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
            {kit.sampleCode && (
              <div className="rounded-md border border-slate-200 px-3 py-2">
                <span className="block font-semibold text-slate-500">Sample code</span>
                <span className="font-mono text-sm font-bold text-slate-950">{kit.sampleCode}</span>
              </div>
            )}
            {kit.responseDeadline && (
              <div className="rounded-md border border-slate-200 px-3 py-2">
                <span className="block font-semibold text-slate-500">Complete by</span>
                <span className="text-sm font-bold text-slate-950">{new Date(kit.responseDeadline).toLocaleDateString()}</span>
              </div>
            )}
            {kit.manualCode && (
              <div className="rounded-md border border-slate-200 px-3 py-2 sm:col-span-2">
                <span className="block font-semibold text-slate-500">Manual fallback code</span>
                <span className="font-mono text-sm font-bold text-slate-950">{kit.manualCode}</span>
                <span className="mt-1 block text-[11px] leading-4 text-slate-500">If the QR will not scan, go to {manualJoinUrl(kit.manualCode)} or enter this code on the join screen.</span>
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
  const [generatedKits, setGeneratedKits] = useState<GeneratedPanelistKit[]>([]);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const recipients = useMemo(() => parseRecipients(recipientText), [recipientText]);
  const effectiveKitCount = recipients.length > 0 ? recipients.length : kitCount;

  const statusCounts = useMemo(() => existingKits.reduce<Record<string, number>>((acc, kit) => {
    acc[kit.calculatedStatus] = (acc[kit.calculatedStatus] ?? 0) + 1;
    return acc;
  }, {}), [existingKits]);

  const handleGenerate = async () => {
    setError('');
    setActionMessage('');
    try {
      const kits = await generateKits.mutateAsync({
        productId: product.id,
        kitCount: effectiveKitCount,
        responseDeadline: responseDeadline || null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        handlingInstructions: instructions,
        recipients,
      });
      setGeneratedKits(kits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate kit QR codes.');
    }
  };

  const handleFulfillment = async (kit: PanelistKitRecord, status: 'printed' | 'packed' | 'shipped') => {
    setError('');
    setActionMessage('');
    const trackingNumber = status === 'shipped'
      ? window.prompt('Tracking number, if available', kit.trackingNumber ?? '')?.trim() ?? ''
      : null;
    try {
      await updateFulfillment.mutateAsync({ kitId: kit.id, status, trackingNumber });
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
      setActionMessage(`Reminder logged for ${kit.recipientName ?? kit.kitCode}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log reminder.');
    }
  };

  const handleVoid = async (kit: PanelistKitRecord) => {
    const reason = window.prompt(`Why void ${kit.kitCode}?`, kit.issueType ? `Issue: ${kit.issueType}` : '')?.trim();
    if (reason == null) return;
    setError('');
    setActionMessage('');
    try {
      await voidKit.mutateAsync({ kitId: kit.id, reason });
      setActionMessage(`${kit.kitCode} voided.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to void kit.');
    }
  };

  const handleReplacement = async (kit: PanelistKitRecord) => {
    const reason = window.prompt(`Reason for replacement kit for ${kit.recipientName ?? kit.kitCode}?`, kit.issueType ? `Issue: ${kit.issueType}` : 'Replacement issued')?.trim();
    if (reason == null) return;
    setError('');
    setActionMessage('');
    try {
      const replacements = await createReplacement.mutateAsync({ kitId: kit.id, reason });
      setGeneratedKits(previous => [...replacements, ...previous]);
      setActionMessage(`Replacement created for ${kit.recipientName ?? kit.kitCode}. Print the new insert before leaving this screen.`);
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
            Kit QR codes and package inserts
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Generate one QR-coded insert per shipped tasting kit. Paste a pack list first so every insert prints with the right panelist name.
          </p>
        </div>
        {generatedKits.length > 0 && (
          <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="size-3.5" aria-hidden />
            Print inserts
          </Button>
        )}
        {existingKits.length > 0 && (
          <Button type="button" size="sm" variant="outline" onClick={() => downloadKitsCsv(product, existingKits)}>
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
        <textarea
          id="kit-recipients"
          value={recipientText}
          onChange={event => setRecipientText(event.target.value)}
          placeholder={'One per line, for example:\nAvery Johnson, avery@example.com\nMina Patel <mina@example.com>\nChris Wong'}
          className="min-h-28 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-5 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
        />
        <p className="text-xs text-slate-500">
          Optional but recommended. Names print on the inserts and help packing, tracking, and handoff.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="handling-instructions">Package handling instructions</Label>
        <textarea
          id="handling-instructions"
          value={instructions}
          onChange={event => setInstructions(event.target.value)}
          className="min-h-28 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-5 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
        />
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
        <Button type="button" onClick={handleGenerate} disabled={generateKits.isPending} className="bg-slate-900 hover:bg-slate-800">
          {generateKits.isPending ? <RefreshCw className="size-4 animate-spin" aria-hidden /> : <Package className="size-4" aria-hidden />}
          {generateKits.isPending ? 'Generating...' : 'Generate QR inserts'}
        </Button>
        <span className="text-xs text-slate-500">
          {isLoading ? 'Loading kit status...' : `${existingKits.length} kit${existingKits.length === 1 ? '' : 's'} generated · next batch ${effectiveKitCount}`}
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
            Generated {generatedKits.length} kit insert{generatedKits.length === 1 ? '' : 's'}. Print or save this page now; the secure QR token cannot be recovered later.
          </AlertDescription>
        </Alert>
      )}

      {existingKits.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="hidden grid-cols-[1.2fr_1.1fr_1fr_1fr_1.4fr] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 lg:grid">
            <span>Kit</span>
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
                    {kit.sampleCode ? `Sample ${kit.sampleCode}` : 'No sample code'}
                    {kit.manualCode ? ` · ${kit.manualCode}` : ''}
                  </span>
                  {kit.replacementForKitId && <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wide text-amber-700">Replacement kit</span>}
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
                  <span>Reminders: <strong className="text-slate-700">{kit.reminderCount}</strong></span>
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
                  <Button type="button" size="sm" variant="outline" onClick={() => handleFulfillment(kit, 'shipped')} disabled={updateFulfillment.isPending || kit.calculatedStatus === 'void' || kit.calculatedStatus === 'submitted'}>
                    <Send className="size-3.5" aria-hidden />
                    Shipped
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => handleReminder(kit)} disabled={recordReminder.isPending || !kit.claimedBy || kit.calculatedStatus === 'submitted' || kit.calculatedStatus === 'void'}>
                    <Bell className="size-3.5" aria-hidden />
                    Reminder
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => handleReplacement(kit)} disabled={createReplacement.isPending || kit.calculatedStatus === 'void' || kit.calculatedStatus === 'submitted'}>
                    <RefreshCw className="size-3.5" aria-hidden />
                    Replace
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => handleVoid(kit)} disabled={voidKit.isPending || kit.calculatedStatus === 'void' || kit.calculatedStatus === 'submitted'} className="text-rose-700 hover:text-rose-800">
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
            <KitInsertCard key={kit.id} kit={kit} product={product} instructions={instructions} />
          ))}
        </div>
      )}
    </section>
  );
}
