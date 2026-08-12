import { supabase } from './supabase';
import { ragFetch } from './rag-client';
import type { Database } from './db/database.types';

type ImportRow = Database['public']['Tables']['literature_imports']['Row'];

export type LiteratureImport = ImportRow;

export async function fetchLiteratureImports(): Promise<LiteratureImport[]> {
  const { data, error } = await supabase.from('literature_imports').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data;
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function uploadLiterature(file: File): Promise<LiteratureImport> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Only PDF publications are supported.');
  if (file.size <= 0 || file.size > 50 * 1024 * 1024) throw new Error('Publication must be between 1 byte and 50 MB.');
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
  const { error: uploadError } = await supabase.storage.from('literature-imports').upload(row.storage_path, file, { contentType: 'application/pdf', upsert: false });
  if (uploadError) {
    await supabase.from('literature_imports').update({ status: 'failed', error_message: uploadError.message }).eq('id', row.id);
    throw uploadError;
  }
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

export async function openStoredLiteratureSource(sourcePath: string): Promise<void> {
  const prefix = 'supabase://literature-imports/';
  if (!sourcePath.startsWith(prefix)) throw new Error('This publication is not stored in the literature upload bucket.');
  const storagePath = sourcePath.slice(prefix.length);
  const { data, error } = await supabase.storage.from('literature-imports').createSignedUrl(storagePath, 300);
  if (error) throw error;
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}
