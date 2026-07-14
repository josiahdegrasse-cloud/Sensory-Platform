import { ragFetch } from './rag-client';

export const DEFAULT_NFI_PUBLICATIONS_PATH = '';
export const DEFAULT_LIBRARY_ID = 'nfi_publications';

export type LibraryRunReport = {
  runId: string;
  libraryId: string;
  sourcePath: string;
  startedAt: string;
  finishedAt: string;
  persisted: boolean;
  scannedFiles: number;
  copiedFiles: number;
  skippedFiles: number;
  duplicateFiles: number;
  indexedDocuments: number;
  pagesExtracted: number;
  chunksCreated: number;
  warningCount: number;
  errorCount: number;
  extractionQuality: Record<string, number>;
  documents: LibraryDocument[];
};

export type LibraryStatus = {
  totalDocuments: number;
  indexedDocuments: number;
  duplicateDocuments: number;
  skippedDocuments: number;
  errorDocuments: number;
  warningCount: number;
  lastRun: LibraryRunReport | null;
  databasePath: string;
};

export type LibraryDocument = {
  documentId: string;
  libraryId?: string;
  originalPath?: string;
  corpusPath?: string;
  filename: string;
  title: string;
  authors?: string;
  year?: string;
  doi?: string;
  pageCount: number;
  charCount: number;
  textQuality: string;
  status: string;
  duplicateOf: string;
  topicTags: string[];
  methodTags: string[];
  evidenceType: string;
  warningCount?: number;
  warnings: Array<{ code: string; message: string }>;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  peerReviewStatus: 'peer_reviewed' | 'not_peer_reviewed' | 'unknown';
  licenseStatus: 'cleared' | 'restricted' | 'unknown';
  reviewedBy: string;
  reviewedAt: string;
  lastCheckedAt: string;
  reviewNotes: string;
};

export type LibraryDocumentReview = {
  documentId: string;
  reviewStatus: LibraryDocument['reviewStatus'];
  peerReviewStatus: LibraryDocument['peerReviewStatus'];
  licenseStatus: LibraryDocument['licenseStatus'];
  notes?: string;
};

export type LibraryRequest = {
  libraryId?: string;
  force?: boolean;
};

export async function fetchLibraryStatus(): Promise<LibraryStatus> {
  const response = await ragFetch('/api/library/status');
  if (!response.ok) throw new Error(`Library status unavailable (${response.status})`);
  return response.json() as Promise<LibraryStatus>;
}

export async function fetchLibraryDocuments(): Promise<{ documents: LibraryDocument[] }> {
  const response = await ragFetch('/api/library/documents');
  if (!response.ok) throw new Error(`Library documents unavailable (${response.status})`);
  return response.json() as Promise<{ documents: LibraryDocument[] }>;
}

export async function scanLibrary(input: LibraryRequest = {}): Promise<LibraryRunReport> {
  return postLibrary('/api/library/scan', input);
}

export async function ingestLibrary(input: LibraryRequest = {}): Promise<LibraryRunReport> {
  return postLibrary('/api/library/ingest', input);
}

export async function reviewLibraryDocument(input: LibraryDocumentReview): Promise<void> {
  const response = await ragFetch(`/api/library/documents/${encodeURIComponent(input.documentId)}/review`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reviewStatus: input.reviewStatus,
      peerReviewStatus: input.peerReviewStatus,
      licenseStatus: input.licenseStatus,
      notes: input.notes ?? '',
    }),
  });
  if (!response.ok) throw new Error(`Library review update failed (${response.status})`);
}

async function postLibrary(path: string, input: LibraryRequest): Promise<LibraryRunReport> {
  const response = await ragFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      libraryId: input.libraryId || DEFAULT_LIBRARY_ID,
      force: Boolean(input.force),
    }),
  });
  if (!response.ok) throw new Error(`Library request failed (${response.status})`);
  return response.json() as Promise<LibraryRunReport>;
}
