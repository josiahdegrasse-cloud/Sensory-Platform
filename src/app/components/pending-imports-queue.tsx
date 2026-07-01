import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload, Inbox, AlertCircle, CheckCircle2, HelpCircle,
  X, ArrowRight, ChevronDown, ChevronUp, Zap, HardDrive,
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { DriveSyncDialog } from './drive-sync-dialog';
import { useAuth } from '../contexts/auth-context';
import {
  usePendingImports,
  useUploadAndQueueImport,
  useRejectPendingImport,
  useImportBatches,
  useWorkspaceSettings,
  queryKeys,
  type PendingImportRecord,
} from '../lib/hooks';
import { downloadPendingImportFile, markPendingImportImported } from '../lib/database';
import { insertInstrumentalImport } from '../lib/database';
import { parseCSVLine, buildImportedDataset, validateImportedDataset } from './stage1-instrumental-data';
import { inferImportMappings, applyImportMappings } from '../lib/csv-import-mapping';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

type StatusMeta = {
  icon: React.ReactNode;
  label: string;
  color: string;
  bg: string;
  border: string;
};

function getStatusMeta(status: PendingImportRecord['status']): StatusMeta {
  switch (status) {
    case 'matched':
      return {
        icon: <CheckCircle2 className="size-3.5" />,
        label: 'Project matched',
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
      };
    case 'ambiguous':
      return {
        icon: <HelpCircle className="size-3.5" />,
        label: 'No project match',
        color: 'text-amber-700',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
      };
    case 'failed':
      return {
        icon: <AlertCircle className="size-3.5" />,
        label: 'Parse failed',
        color: 'text-rose-700',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
      };
    default:
      return {
        icon: <HelpCircle className="size-3.5" />,
        label: 'Pending',
        color: 'text-slate-500',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
      };
  }
}

async function runQuickConfirm(item: PendingImportRecord, userId: string): Promise<void> {
  const { text, fileName } = await downloadPendingImportFile(item.storagePath);

  const lines = text.split(/\r\n|\r|\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) throw new Error('File appears empty — nothing to import.');

  const headers = parseCSVLine(lines[0]);
  const rawRows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
    rawRows.push(row);
  }

  const mappings = inferImportMappings(headers);
  const previewData = applyImportMappings(rawRows, mappings);
  const parsed = buildImportedDataset(previewData, fileName);

  const colReport = {
    recognised: mappings.filter(m => m.target !== 'ignore').map(m => m.source),
    ignored: mappings.filter(m => m.target === 'ignore').map(m => m.source),
  };
  const validation = validateImportedDataset(previewData, parsed, colReport, parsed.detection);
  if (validation.errors.length > 0) throw new Error(validation.errors[0]);

  await insertInstrumentalImport({
    fileName: parsed.detection.label,
    rowCount: previewData.length,
    recognizedColumns: colReport.recognised,
    ignoredColumns: colReport.ignored,
    detection: parsed.detection,
    importedBy: userId,
    eTongueData: parsed.eTongueData,
    gcmsData: parsed.gcmsData,
    compositionData: parsed.compositionData,
  });

  await markPendingImportImported(item.id);
}

function ImportQueueItem({
  item,
  matchedBatchName,
  userId,
  onReview,
}: {
  item: PendingImportRecord;
  matchedBatchName?: string;
  userId: string;
  onReview: (item: PendingImportRecord, matchedBatchName?: string) => void;
}) {
  const qc = useQueryClient();
  const rejectMutation = useRejectPendingImport();
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const quickConfirmMutation = useMutation({
    mutationFn: () => runQuickConfirm(item, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pendingImports });
      qc.invalidateQueries({ queryKey: queryKeys.importBatches });
      qc.invalidateQueries({ queryKey: queryKeys.instrumentalDataset });
      qc.invalidateQueries({ queryKey: queryKeys.foodTypes });
    },
    onError: (err) => setConfirmError(err instanceof Error ? err.message : 'Quick confirm failed.'),
  });

  const meta = getStatusMeta(item.status);
  const preview = item.parsePreview;

  if (quickConfirmMutation.isSuccess) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2 text-sm text-emerald-700">
        <CheckCircle2 className="size-4 shrink-0" />
        <span><span className="font-semibold">{item.fileName}</span> imported successfully.</span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${meta.border} ${meta.bg} p-3 space-y-2`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${meta.color}`}>{meta.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900 truncate max-w-xs">
              {item.fileName}
            </span>
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${meta.bg} ${meta.color}`}>
              {meta.label}
            </span>
          </div>

          {matchedBatchName && (
            <p className="mt-0.5 text-xs text-emerald-700">
              Matches project: <span className="font-semibold">{matchedBatchName}</span>
            </p>
          )}

          {preview && (
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-700">
              <span>{preview.rowCount} rows</span>
              <span className="text-slate-300">·</span>
              <span className="text-emerald-700">{preview.recognized.length} recognised</span>
              {preview.ignored.length > 0 && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-amber-700">{preview.ignored.length} ignored</span>
                </>
              )}
            </div>
          )}

          {item.errorMessage && !rejecting && (
            <p className="mt-1 text-xs text-rose-700">{item.errorMessage}</p>
          )}

          {confirmError && (
            <p className="mt-1 text-xs text-rose-700">{confirmError}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {preview && (
            <button
              onClick={() => setExpanded(prev => !prev)}
              className="p-1 text-slate-500 hover:text-slate-700"
              title={expanded ? 'Collapse' : 'Show columns'}
            >
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          )}

          {item.status === 'matched' && (
            <Button
              size="sm"
              disabled={quickConfirmMutation.isPending}
              className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800"
              onClick={() => quickConfirmMutation.mutate()}
            >
              <Zap className="size-3 mr-1" />
              {quickConfirmMutation.isPending ? 'Importing…' : 'Confirm & import'}
            </Button>
          )}

          {item.status !== 'failed' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onReview(item, matchedBatchName)}
            >
              Review
              <ArrowRight className="size-3 ml-1" />
            </Button>
          )}

          <button
            onClick={() => { setRejecting(true); setConfirmError(null); }}
            className="p-1 text-slate-500 hover:text-rose-600"
            title="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Expanded column list */}
      {preview && expanded && (
        <div className="space-y-1.5 text-xs pl-6">
          {preview.recognized.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {preview.recognized.map(col => (
                <span key={col} className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-emerald-700">
                  {col}
                </span>
              ))}
            </div>
          )}
          {preview.ignored.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {preview.ignored.map(col => (
                <span key={col} className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-amber-700">
                  {col}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reject with reason */}
      {rejecting && (
        <div className="pl-6 space-y-2">
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: this input only renders when the admin clicks "dismiss", so focusing it is the expected next action
            autoFocus
            type="text"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Reason for dismissing (optional)"
            className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
              disabled={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate({ id: item.id, reason: rejectReason })}
            >
              {rejectMutation.isPending ? 'Dismissing…' : 'Dismiss'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => { setRejecting(false); setRejectReason(''); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PendingImportsQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);

  const pendingQuery = usePendingImports(user?.role === 'admin');
  const batchesQuery = useImportBatches(user?.role === 'admin');
  const { data: workspaceSettings } = useWorkspaceSettings();
  const uploadMutation = useUploadAndQueueImport();
  const driveConnected = Boolean(workspaceSettings?.driveFolderId);

  const items = pendingQuery.data ?? [];
  const batches = batchesQuery.data ?? [];

  if (user?.role !== 'admin') return null;

  const getMatchedBatchName = (item: PendingImportRecord) =>
    item.matchedBatchId
      ? batches.find(b => b.id === item.matchedBatchId)?.fileName
      : undefined;

  const handleFile = (file: File) => {
    setUploadError(null);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadError('Only .csv files are supported.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`);
      return;
    }
    uploadMutation.mutate(
      { file, userId: user.id },
      { onError: (err) => setUploadError(err instanceof Error ? err.message : 'Upload failed.') },
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleReview = (item: PendingImportRecord, matchedBatchName?: string) => {
    navigate('/stage1', {
      state: {
        pendingImportId: item.id,
        pendingStoragePath: item.storagePath,
        matchedBatchName,
      },
    });
  };

  const isEmpty = items.length === 0;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="size-4 text-slate-500" />
              Import Queue
            </CardTitle>
            {items.length > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                {items.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {driveConnected && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDriveOpen(true)}
                title="Pull CSV files and Google Sheets from the connected Google Drive folder"
              >
                <HardDrive className="size-3.5 mr-1.5" />
                Sync from Drive
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-3.5 mr-1.5" />
              {uploadMutation.isPending ? 'Uploading…' : 'Upload CSV'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {!isEmpty && (
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-lg border-2 border-dashed py-2 text-center text-xs text-slate-500 transition-colors ${
              isDragging ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-slate-200'
            }`}
          >
            {isDragging ? 'Drop to add to queue' : 'Drag a CSV here to add another file'}
          </div>
        )}

        {uploadError && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span className="flex-1">{uploadError}</span>
            <button onClick={() => setUploadError(null)}><X className="size-3.5" /></button>
          </div>
        )}

        {items.map(item => (
          <ImportQueueItem
            key={item.id}
            item={item}
            matchedBatchName={getMatchedBatchName(item)}
            userId={user.id}
            onReview={handleReview}
          />
        ))}
      </CardContent>

      <DriveSyncDialog open={driveOpen} onOpenChange={setDriveOpen} />
    </Card>
  );
}
