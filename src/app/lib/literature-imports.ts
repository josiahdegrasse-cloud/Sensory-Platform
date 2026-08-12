import { supabase } from './supabase';
import { ragFetch } from './rag-client';
import type { Database } from './db/database.types';

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MAX_ZIP_BYTES = 100 * 1024 * 1024;
const MAX_BATCH_FILES = 100;
const MAX_BATCH_EXPANDED_BYTES = 500 * 1024 * 1024;

type ImportRow = Database['public']['Tables']['literature_imports']['Row'];

export type LiteratureImport = ImportRow;

export type LiteratureBatchResult = {
  total: number;
  indexed: number;
  failed: number;
  failures: Array<{ fileName: string; message: string }>;
};

export type LiteratureUploadStage = 'preparing' | 'checking' | 'uploading' | 'indexing' | 'complete' | 'failed';
export type LiteratureUploadProgress = {
  stage: LiteratureUploadStage;
  total: number;
  completed: number;
  failed: number;
  currentFile: string;
  message: string;
};
export type LiteratureUploadProgressHandler = (progress: LiteratureUploadProgress) => void;

export async function fetchLiteratureImports(): Promise<LiteratureImport[]> {
  const { data, error } = await supabase.from('literature_imports').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data;
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function uploadLiterature(file: File, onStage?: (stage: LiteratureUploadStage) => void): Promise<LiteratureImport> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Only PDF publications are supported.');
  if (file.size <= 0 || file.size > MAX_PDF_BYTES) throw new Error('Publication must be between 1 byte and 50 MB.');
  onStage?.('checking');
  const digest = await sha256(file);
  const { data: created, error: createError } = await supabase.rpc('create_literature_import', {
    target_file_name: file.name,
    target_file_size: file.size,
    target_sha256: digest,
  });
  if (createError) {
    if (/duplicate|unique/i.test(createError.message)) throw new Error('This exact publication is already in the upload queue or corpus.');
    throw createError;
  }
  const row = created as LiteratureImport;
  onStage?.('uploading');
  const { error: uploadError } = await supabase.storage.from('literature-imports').upload(row.storage_path, file, { contentType: 'application/pdf', upsert: false });
  if (uploadError) {
    await supabase.from('literature_imports').update({ status: 'failed', error_message: uploadError.message }).eq('id', row.id);
    throw uploadError;
  }
  const { data: signed, error: signedError } = await supabase.storage.from('literature-imports').createSignedUrl(row.storage_path, 600);
  if (signedError) throw signedError;
  await supabase.from('literature_imports').update({ status: 'processing', error_message: null }).eq('id', row.id);
  onStage?.('indexing');
  const response = await ragFetch('/api/library/imports/process', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, timeoutMs: 300_000,
    body: JSON.stringify({ importId: row.id, signedUrl: signed.signedUrl, fileName: row.file_name, sha256: row.sha256 }),
  });
  const result = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const message = String(result.detail || `Research ingestion failed (${response.status})`);
    await supabase.from('literature_imports').update({ status: 'failed', error_message: message }).eq('id', row.id);
    throw new Error(message);
  }
  const status = result.status === 'duplicate' ? 'duplicate' : 'indexed';
  const { data: completed, error: updateError } = await supabase.from('literature_imports').update({
    status,
    document_id: String(result.documentId || ''), duplicate_of: String(result.duplicateOf || '') || null,
    title: String(result.title || row.file_name), authors: String(result.authors || ''), publication_year: String(result.year || ''),
    doi: String(result.doi || ''), page_count: Number(result.pageCount || 0), text_quality: String(result.textQuality || ''),
    evidence_type: String(result.evidenceType || ''), source_quality_score: Number(result.sourceQualityScore || 0),
    source_quality_reasons: Array.isArray(result.sourceQualityReasons) ? result.sourceQualityReasons : [], error_message: null,
  }).eq('id', row.id).select('*').single();
  if (updateError) throw updateError;
  return completed;
}

export async function resumeLiteratureImport(row: LiteratureImport): Promise<LiteratureImport> {
  const { data: signed, error: signedError } = await supabase.storage.from('literature-imports').createSignedUrl(row.storage_path, 600);
  if (signedError) throw signedError;
  await supabase.from('literature_imports').update({ status: 'processing', error_message: null }).eq('id', row.id);
  const response = await ragFetch('/api/library/imports/process', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, timeoutMs: 300_000,
    body: JSON.stringify({ importId: row.id, signedUrl: signed.signedUrl, fileName: row.file_name, sha256: row.sha256 }),
  });
  const result = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const message = String(result.detail || `Research ingestion failed (${response.status})`);
    await supabase.from('literature_imports').update({ status: 'failed', error_message: message }).eq('id', row.id);
    throw new Error(message);
  }
  const status = result.status === 'duplicate' ? 'duplicate' : 'indexed';
  const { data: completed, error: updateError } = await supabase.from('literature_imports').update({
    status, document_id: String(result.documentId || ''), duplicate_of: String(result.duplicateOf || '') || null,
    title: String(result.title || row.file_name), authors: String(result.authors || ''), publication_year: String(result.year || ''),
    doi: String(result.doi || ''), page_count: Number(result.pageCount || 0), text_quality: String(result.textQuality || ''),
    evidence_type: String(result.evidenceType || ''), source_quality_score: Number(result.sourceQualityScore || 0),
    source_quality_reasons: Array.isArray(result.sourceQualityReasons) ? result.sourceQualityReasons : [], error_message: null,
  }).eq('id', row.id).select('*').single();
  if (updateError) throw updateError;
  return completed;
}

export async function resumeLiteratureImports(rows: LiteratureImport[]): Promise<LiteratureBatchResult> {
  const failures: LiteratureBatchResult['failures'] = [];
  let indexed = 0;
  for (const row of rows) {
    try { await resumeLiteratureImport(row); indexed += 1; }
    catch (error) { failures.push({ fileName: row.file_name, message: error instanceof Error ? error.message : 'Resume failed.' }); }
  }
  return { total: rows.length, indexed, failed: failures.length, failures };
}

export async function extractLiteratureFiles(file: File): Promise<File[]> {
  if (!file.name.toLowerCase().endsWith('.zip')) return [file];
  if (file.size <= 0 || file.size > MAX_ZIP_BYTES) throw new Error('ZIP archive must be between 1 byte and 100 MB.');
  const { unzipSync } = await import('fflate');
  const archive = new Uint8Array(await file.arrayBuffer());
  const entries = unzipSync(archive, {
    filter: entry => {
      if (entry.name.endsWith('/') || entry.name.startsWith('__MACOSX/') || entry.name.split('/').some(part => part.startsWith('.'))) return false;
      if (!entry.name.toLowerCase().endsWith('.pdf')) return false;
      if (entry.originalSize > MAX_PDF_BYTES) throw new Error(`${entry.name} is larger than the 50 MB per-paper limit.`);
      return true;
    },
  });
  const files = Object.entries(entries);
  if (!files.length) throw new Error('This ZIP does not contain any PDF articles.');
  if (files.length > MAX_BATCH_FILES) throw new Error(`A ZIP can contain at most ${MAX_BATCH_FILES} PDF articles.`);
  const expandedBytes = files.reduce((total, [, bytes]) => total + bytes.byteLength, 0);
  if (expandedBytes > MAX_BATCH_EXPANDED_BYTES) throw new Error('The PDFs in this ZIP exceed the 500 MB expanded-size limit.');
  return files.map(([path, bytes]) => new File([new Uint8Array(bytes).buffer], path.split('/').pop() || 'publication.pdf', { type: 'application/pdf' }));
}

export async function uploadLiteratureBatch(file: File, onProgress?: LiteratureUploadProgressHandler): Promise<LiteratureBatchResult> {
  onProgress?.({ stage: 'preparing', total: 0, completed: 0, failed: 0, currentFile: file.name, message: file.name.toLowerCase().endsWith('.zip') ? 'Opening ZIP and validating its PDF articles…' : 'Validating publication…' });
  await new Promise(resolve => setTimeout(resolve, 0));
  let files: File[];
  try {
    files = await extractLiteratureFiles(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The selected archive could not be opened.';
    onProgress?.({ stage: 'failed', total: 0, completed: 0, failed: 1, currentFile: file.name, message });
    throw error;
  }
  const failures: LiteratureBatchResult['failures'] = [];
  let indexed = 0;
  for (const [index, publication] of files.entries()) {
    try {
      await uploadLiterature(publication, stage => onProgress?.({
        stage, total: files.length, completed: index, failed: failures.length, currentFile: publication.name,
        message: stage === 'checking' ? 'Checking checksum and duplicates…' : stage === 'uploading' ? 'Uploading securely…' : 'Extracting metadata and indexing for search…',
      }));
      indexed += 1;
    } catch (error) {
      failures.push({ fileName: publication.name, message: error instanceof Error ? error.message : 'Upload failed.' });
    }
    onProgress?.({ stage: failures.length + indexed === files.length ? 'complete' : 'preparing', total: files.length, completed: index + 1, failed: failures.length, currentFile: publication.name, message: failures.length + indexed === files.length ? 'Batch processing complete.' : 'Moving to the next publication…' });
  }
  return { total: files.length, indexed, failed: failures.length, failures };
}

export async function openStoredLiteratureSource(sourcePath: string): Promise<void> {
  const prefix = 'supabase://literature-imports/';
  if (!sourcePath.startsWith(prefix)) throw new Error('This publication is not stored in the literature upload bucket.');
  const storagePath = sourcePath.slice(prefix.length);
  const { data, error } = await supabase.storage.from('literature-imports').createSignedUrl(storagePath, 300);
  if (error) throw error;
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}
