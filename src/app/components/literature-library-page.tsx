import { AlertCircle, BookOpenText, ChevronDown, FolderSearch, Search, UploadCloud } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DEFAULT_LIBRARY_ID, type LibraryDocument, type LibraryRunReport } from '../lib/nfi-library';
import { openSourceViewer } from '../lib/tweak-intelligence';
import { useIngestLibrary, useLibraryDocuments, useLibraryStatus, useReviewLibraryDocument, useScanLibrary } from '../lib/hooks';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  primary: 'Primary research',
  review: 'Review',
  method: 'Method',
  formulation: 'Formulation',
  consumer: 'Consumer studies',
  unknown: 'Uncategorized',
};

function evidenceTypeLabel(evidenceType: string) {
  const key = evidenceType || 'unknown';
  return EVIDENCE_TYPE_LABELS[key] ?? key;
}

// The corpus has no dedicated "food type" field — topic tags are the
// closest real signal (plant-based meat, plant-based cheese, bread/starch,
// etc., alongside cross-cutting method tags like emulsions or fermentation),
// so filtering/sorting is organized around them instead of evidence type.
function topicTagCounts(documents: LibraryDocument[]) {
  const counts = new Map<string, number>();
  for (const document of documents) {
    for (const tag of document.topicTags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function matchesQuery(document: LibraryDocument, query: string) {
  if (!query) return true;
  const haystack = `${document.title} ${document.authors ?? ''} ${document.filename} ${document.topicTags.join(' ')}`.toLowerCase();
  return haystack.includes(query);
}

export function LiteratureLibraryPage() {
  const [lastReport, setLastReport] = useState<LibraryRunReport | null>(null);
  const [query, setQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const status = useLibraryStatus();
  const documents = useLibraryDocuments();
  const scan = useScanLibrary();
  const ingest = useIngestLibrary();

  const allDocuments = useMemo(() => documents.data?.documents ?? [], [documents.data?.documents]);
  const counts = useMemo(() => topicTagCounts(allDocuments), [allDocuments]);
  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allDocuments
      .filter(document => (!topicFilter || document.topicTags.includes(topicFilter)))
      .filter(document => matchesQuery(document, normalizedQuery))
      .sort((a, b) => (a.title || a.filename).localeCompare(b.title || b.filename));
  }, [allDocuments, topicFilter, query]);

  const offline = status.isError || documents.isError;
  const busy = scan.isPending || ingest.isPending;

  const runScan = () => {
    scan.mutate({ libraryId: DEFAULT_LIBRARY_ID }, { onSuccess: setLastReport });
  };
  const runIngest = () => {
    ingest.mutate({ libraryId: DEFAULT_LIBRARY_ID }, { onSuccess: setLastReport });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <BookOpenText className="size-4" />
          Literature Library
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-900">NFI Publications</h1>
        <p className="mt-1 text-sm text-slate-500">{allDocuments.length} paper{allDocuments.length === 1 ? '' : 's'} in the corpus.</p>
      </header>

      {offline && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">Research service unavailable</p>
              <p className="mt-1 text-amber-800">Check the configured Evidence Assist service and your session before managing the publication library.</p>
            </div>
          </div>
        </section>
      )}

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search by title, author, or topic…"
            className="h-11 pl-9 text-sm"
            aria-label="Search the library"
          />
        </div>

        {counts.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by food type or topic">
            <FilterChip active={topicFilter === null} onClick={() => setTopicFilter(null)}>
              All ({allDocuments.length})
            </FilterChip>
            {counts.map(([tag, count]) => (
              <FilterChip key={tag} active={topicFilter === tag} onClick={() => setTopicFilter(tag)}>
                {tag} ({count})
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {results.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-slate-500">
            {allDocuments.length === 0 ? 'No library documents indexed yet.' : 'No papers match this search.'}
          </li>
        ) : results.map(document => <PaperEntry key={document.documentId} document={document} />)}
      </ol>

      <Collapsible open={manageOpen} onOpenChange={setManageOpen} className="rounded-lg border border-slate-200 bg-white">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left">
          <div>
            <p className="text-sm font-semibold text-slate-900">Manage library</p>
            <p className="mt-0.5 text-xs text-slate-500">Scan a folder for new papers, ingest them, and review pipeline health.</p>
          </div>
          <ChevronDown className={`size-4 shrink-0 text-slate-500 transition-transform ${manageOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 border-t border-slate-200 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">Uses the publication source configured on the authenticated research server.</p>
            <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={runScan} disabled={busy}>
              <FolderSearch className="size-4" />{scan.isPending ? 'Scanning' : 'Scan'}
            </Button>
            <Button type="button" onClick={runIngest} disabled={busy}>
              <UploadCloud className="size-4" />{ingest.isPending ? 'Ingesting' : 'Ingest'}
            </Button>
            </div>
          </div>

          {ingest.isPending && (
            <p className="text-xs text-slate-500">
              Extracting text, chunking, and embedding every new paper in this folder — a full library can take several minutes. This page will update automatically when it finishes.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Total" value={status.isLoading ? '…' : status.data?.totalDocuments ?? 0} />
            <Metric label="Indexed" value={status.isLoading ? '…' : status.data?.indexedDocuments ?? 0} />
            <Metric label="Duplicates" value={status.isLoading ? '…' : status.data?.duplicateDocuments ?? 0} />
            <Metric label="Warnings" value={status.isLoading ? '…' : status.data?.warningCount ?? 0} />
          </div>

          {(lastReport ?? status.data?.lastRun) && (
            <p className="text-xs text-slate-500">
              Last run: {(lastReport ?? status.data?.lastRun)!.indexedDocuments} indexed, {(lastReport ?? status.data?.lastRun)!.duplicateFiles} duplicates,{' '}
              {(lastReport ?? status.data?.lastRun)!.skippedFiles} skipped, {(lastReport ?? status.data?.lastRun)!.pagesExtracted} pages extracted.
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

function PaperEntry({ document }: { document: LibraryDocument }) {
  const needsAttention = document.status !== 'indexed' || document.warnings.length > 0 || document.reviewStatus !== 'approved';
  const canView = Boolean(document.corpusPath || document.originalPath);
  const sourcePath = document.corpusPath || document.originalPath || '';
  return (
    <li className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {canView ? (
            <button
              type="button"
              onClick={() => void openSourceViewer({ sourcePath, title: document.title || document.filename })}
              className="text-left font-semibold leading-5 text-slate-900 hover:text-blue-700 hover:underline"
            >
              {document.title || document.filename}
            </button>
          ) : (
            <p className="font-semibold leading-5 text-slate-900">{document.title || document.filename}</p>
          )}
          {(document.authors || document.year) && (
            <p className="mt-0.5 text-sm text-slate-600">
              {document.authors}
              {document.authors && document.year ? ' · ' : ''}
              {document.year}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {document.doi && (
              <a
                href={`https://doi.org/${document.doi}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-700 hover:text-blue-900 hover:underline"
              >
                doi.org/{document.doi}
              </a>
            )}
            <span className="text-xs text-slate-400">{evidenceTypeLabel(document.evidenceType || 'unknown')}</span>
          </div>
          {document.topicTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {document.topicTags.slice(0, 5).map(tag => <Badge key={tag} variant="secondary" className="font-normal">{tag}</Badge>)}
            </div>
          )}
        </div>
        {needsAttention && (
          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
            {document.status !== 'indexed'
              ? document.status
              : document.reviewStatus !== 'approved'
                ? `Review ${document.reviewStatus}`
                : `${document.warnings.length} warning${document.warnings.length === 1 ? '' : 's'}`}
          </span>
        )}
      </div>
      {document.status === 'indexed' && <ReviewControls document={document} />}
    </li>
  );
}

function ReviewControls({ document }: { document: LibraryDocument }) {
  const review = useReviewLibraryDocument();
  const [peerReviewStatus, setPeerReviewStatus] = useState(document.peerReviewStatus);
  const [licenseStatus, setLicenseStatus] = useState(document.licenseStatus);
  const canApprove = peerReviewStatus !== 'unknown' && licenseStatus === 'cleared';

  const save = (reviewStatus: LibraryDocument['reviewStatus']) => {
    review.mutate({
      documentId: document.documentId,
      reviewStatus,
      peerReviewStatus,
      licenseStatus,
      notes: document.reviewNotes,
    });
  };

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center">
      <label className="text-xs text-slate-500">
        Scientific status
        <select
          value={peerReviewStatus}
          onChange={event => setPeerReviewStatus(event.target.value as LibraryDocument['peerReviewStatus'])}
          className="ml-2 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
        >
          <option value="unknown">Not checked</option>
          <option value="peer_reviewed">Peer reviewed</option>
          <option value="not_peer_reviewed">Not peer reviewed</option>
        </select>
      </label>
      <label className="text-xs text-slate-500">
        Usage rights
        <select
          value={licenseStatus}
          onChange={event => setLicenseStatus(event.target.value as LibraryDocument['licenseStatus'])}
          className="ml-2 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
        >
          <option value="unknown">Not checked</option>
          <option value="cleared">Cleared</option>
          <option value="restricted">Restricted</option>
        </select>
      </label>
      <div className="flex gap-2 sm:ml-auto">
        <Button type="button" size="sm" variant="outline" disabled={review.isPending} onClick={() => save('rejected')}>
          Reject
        </Button>
        <Button type="button" size="sm" disabled={review.isPending || !canApprove} onClick={() => save('approved')}>
          Approve source
        </Button>
      </div>
      {review.isError && <p className="text-xs text-red-700">Unable to save source review.</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
