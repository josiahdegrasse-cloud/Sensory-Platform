import { supabase } from '../supabase';
import { dbError, edgeFunctionErrorMessage, fromJson } from './shared';
import type { Database } from './database.types';

type Tables = Database['public']['Tables'];

export interface PendingImportParsePreview {
  headers: string[];
  recognized: string[];
  ignored: string[];
  rowCount: number;
  sampleRows: Record<string, string>[];
}

export interface PendingImportRecord {
  id: string;
  storagePath: string;
  fileName: string;
  status: 'pending' | 'matched' | 'ambiguous' | 'failed' | 'imported' | 'dismissed';
  matchedBatchId: string | null;
  parsePreview: PendingImportParsePreview | null;
  errorMessage: string | null;
  uploadedBy: string | null;
  source: 'upload' | 'google_drive';
  sourceFileId: string | null;
  createdAt: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string | null;
  importKind: 'csv' | 'google_sheet';
  size: number | null;
  modifiedTime: string | null;
  alreadyImported: boolean;
}

export interface DriveImportResult {
  queued: number;
  skipped: number;
  errors: { name: string; message: string }[];
}

function toPendingImport(row: Tables['pending_imports']['Row']): PendingImportRecord {
  return {
    id: row.id,
    storagePath: row.storage_path,
    fileName: row.file_name,
    status: row.status as PendingImportRecord['status'],
    matchedBatchId: row.matched_batch_id ?? null,
    parsePreview: fromJson<PendingImportParsePreview>(row.parse_preview) ?? null,
    errorMessage: row.error_message ?? null,
    uploadedBy: row.uploaded_by ?? null,
    source: (row.source as PendingImportRecord['source']) ?? 'upload',
    sourceFileId: row.source_file_id ?? null,
    createdAt: row.created_at as string,
  };
}

export async function fetchPendingImports(): Promise<PendingImportRecord[]> {
  const { data, error } = await supabase
    .from('pending_imports')
    .select('*')
    .not('status', 'in', '("imported","dismissed")')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw dbError(error);
  return (data ?? []).map(toPendingImport);
}

export async function dismissPendingImport(id: string): Promise<void> {
  const { error } = await supabase
    .from('pending_imports')
    .update({ status: 'dismissed', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw dbError(error);
}

export async function markPendingImportImported(id: string): Promise<void> {
  const { error } = await supabase
    .from('pending_imports')
    .update({ status: 'imported', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw dbError(error);
}

export async function downloadPendingImportFile(
  storagePath: string,
): Promise<{ text: string; fileName: string }> {
  const { data, error } = await supabase.storage
    .from('instrument-imports')
    .download(storagePath);
  if (error || !data) throw new Error(`Download failed: ${error?.message ?? 'unknown'}`);
  const text = await data.text();
  const fileName = storagePath.split('/').pop() ?? storagePath;
  return { text, fileName };
}

export async function rejectPendingImport(id: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('pending_imports')
    .update({
      status: 'dismissed',
      error_message: reason.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw dbError(error);
}

export async function uploadAndQueueImport(
  file: File,
  userId: string,
): Promise<PendingImportRecord> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('instrument-imports')
    .upload(storagePath, file, { contentType: 'text/csv', upsert: false });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data, error: invokeError } = await supabase.functions.invoke('process-import', {
    body: { storagePath },
  });
  if (invokeError) throw new Error(`Processing failed: ${await edgeFunctionErrorMessage(invokeError, invokeError.message)}`);
  // Edge-function responses aren't schema-typed; assert the row shape it returns.
  return toPendingImport(data as Tables['pending_imports']['Row']);
}

// Lists supported instrument files in the org's connected Google Drive folder via the drive-sync
// Edge Function (which authenticates as the service account, not the user).
export async function listDriveFiles(): Promise<{ files: DriveFile[]; serviceAccountEmail: string }> {
  const { data, error } = await supabase.functions.invoke('drive-sync', {
    body: { mode: 'list' },
  });
  if (error) throw new Error(await edgeFunctionErrorMessage(error, 'Failed to list Drive files.'));
  const payload = data as { files?: DriveFile[]; serviceAccountEmail?: string };
  return { files: payload.files ?? [], serviceAccountEmail: payload.serviceAccountEmail ?? '' };
}

// Downloads the selected Drive files and pushes them through process-import.
export async function importDriveFiles(fileIds: string[]): Promise<DriveImportResult> {
  const { data, error } = await supabase.functions.invoke('drive-sync', {
    body: { mode: 'import', fileIds },
  });
  if (error) throw new Error(await edgeFunctionErrorMessage(error, 'Drive import failed.'));
  const payload = data as Partial<DriveImportResult>;
  return {
    queued: payload.queued ?? 0,
    skipped: payload.skipped ?? 0,
    errors: payload.errors ?? [],
  };
}
