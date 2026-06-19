import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, HardDrive, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { useDriveFiles, useImportDriveFiles } from '../lib/hooks';
import type { DriveImportResult } from '../lib/database';

function formatSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DriveSyncDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const filesQuery = useDriveFiles(open);
  const importMutation = useImportDriveFiles();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<DriveImportResult | null>(null);

  // Reset transient state each time the dialog opens.
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setResult(null);
    }
  }, [open]);

  const files = filesQuery.data?.files ?? [];
  const serviceAccountEmail = filesQuery.data?.serviceAccountEmail ?? '';
  const selectable = files.filter(f => !f.alreadyImported);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev =>
      prev.size === selectable.length ? new Set() : new Set(selectable.map(f => f.id)),
    );
  };

  const handleImport = () => {
    if (selected.size === 0) return;
    importMutation.mutate([...selected], {
      onSuccess: (res) => setResult(res),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="size-5 text-slate-500" />
            Sync from Google Drive
          </DialogTitle>
          <DialogDescription>
            {serviceAccountEmail
              ? <>Files in your connected folder. Share the folder with <span className="font-mono text-slate-700">{serviceAccountEmail}</span> if any are missing.</>
              : 'Files in your connected Drive folder.'}
          </DialogDescription>
        </DialogHeader>

        {/* Loading */}
        {filesQuery.isLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Loading files from Drive…
          </div>
        )}

        {/* Error */}
        {filesQuery.isError && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{filesQuery.error instanceof Error ? filesQuery.error.message : 'Failed to load Drive files.'}</span>
          </div>
        )}

        {/* Result summary (after an import run) */}
        {result && (
          <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="size-4" />
              {result.queued} file{result.queued === 1 ? '' : 's'} queued
              {result.skipped > 0 && ` · ${result.skipped} already imported`}
            </div>
            {result.errors.length > 0 && (
              <ul className="space-y-0.5 text-xs text-rose-700">
                {result.errors.map((e, i) => (
                  <li key={i}><span className="font-medium">{e.name}:</span> {e.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* File list */}
        {!filesQuery.isLoading && !filesQuery.isError && !result && (
          files.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No CSV files found in the connected folder.
            </div>
          ) : (
            <div className="space-y-1">
              {selectable.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="px-1 pb-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  {selected.size === selectable.length ? 'Clear selection' : `Select all (${selectable.length})`}
                </button>
              )}
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {files.map(file => (
                  <label
                    key={file.id}
                    className={`flex items-center gap-3 rounded-lg border p-2.5 text-sm ${
                      file.alreadyImported
                        ? 'border-slate-100 bg-slate-50 text-slate-400'
                        : 'cursor-pointer border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Checkbox
                      checked={selected.has(file.id)}
                      disabled={file.alreadyImported}
                      onCheckedChange={() => toggle(file.id)}
                    />
                    <FileText className="size-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    {file.size != null && <span className="text-xs text-slate-400">{formatSize(file.size)}</span>}
                    {file.alreadyImported && (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                        Imported
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                disabled={selected.size === 0 || importMutation.isPending}
                onClick={handleImport}
              >
                {importMutation.isPending
                  ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" />Importing…</>
                  : `Import selected${selected.size > 0 ? ` (${selected.size})` : ''}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
