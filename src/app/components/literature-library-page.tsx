import { AlertCircle, BookOpenText, ChevronDown, ChevronLeft, ChevronRight, FileCheck2, RefreshCw, Search, Settings, UploadCloud } from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router';
import type { LibraryDocument } from '../lib/nfi-library';
import { openSourceViewer } from '../lib/tweak-intelligence';
import { useLibraryDocuments, useLibraryStatus, useLiteratureImports, useResumeLiteratureImports, useReviewLibraryDocument, useReviewLibraryDocuments, useUploadLiterature } from '../lib/hooks';
import { openStoredLiteratureSource, type LiteratureUploadProgress } from '../lib/literature-imports';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

const PAGE_SIZE = 25;
const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  primary: 'Primary research', review: 'Review', method: 'Method', formulation: 'Formulation',
  consumer: 'Consumer studies', unknown: 'Uncategorized',
};

type GovernanceFilter = 'all' | 'approved' | 'pending' | 'rejected' | 'restricted';

export function paginateDocuments(documents: LibraryDocument[], page: number, pageSize = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(documents.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  return { page: safePage, pageCount, items: documents.slice((safePage - 1) * pageSize, safePage * pageSize) };
}

function topicTagCounts(documents: LibraryDocument[]) {
  const counts = new Map<string, number>();
  for (const document of documents) for (const tag of document.topicTags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function matchesQuery(document: LibraryDocument, query: string) {
  if (!query) return true;
  return `${document.title} ${document.authors ?? ''} ${document.filename} ${document.topicTags.join(' ')}`.toLowerCase().includes(query);
}

function matchesGovernance(document: LibraryDocument, filter: GovernanceFilter) {
  if (filter === 'restricted') return document.licenseStatus === 'restricted';
  return filter === 'all' || document.reviewStatus === filter;
}

export type LibraryUnavailableReason = 'session' | 'unconfigured' | 'temporary';
export function classifyLibraryUnavailableReason(errors: unknown[]): LibraryUnavailableReason {
  const message = errors.map(error => error instanceof Error ? error.message : String(error ?? '')).join(' ').toLowerCase();
  if (/session|auth|unauthori[sz]ed|jwt|401|403/.test(message)) return 'session';
  if (/vite_nfi_rag_url|required for production|not configured|configuration/.test(message)) return 'unconfigured';
  return 'temporary';
}

const unavailableCopy = {
  session: ['Research session needs to be refreshed', 'Your project work is still available. Sign in again if retrying does not restore the publication library.'],
  unconfigured: ['Research service is not configured', 'The core sensory workflow remains available. A workspace administrator can connect Evidence Assist in Operations.'],
  temporary: ['Research service is temporarily unavailable', 'The core sensory workflow remains available. Retry the library check or continue working without literature.'],
} satisfies Record<LibraryUnavailableReason, [string, string]>;

export function LiteratureLibraryPage() {
  const [query, setQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [governanceFilter, setGovernanceFilter] = useState<GovernanceFilter>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manageOpen, setManageOpen] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<LiteratureUploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const status = useLibraryStatus();
  const documents = useLibraryDocuments();
  const imports = useLiteratureImports();
  const upload = useUploadLiterature();
  const resumeImports = useResumeLiteratureImports();
  const bulkReview = useReviewLibraryDocuments();
  const allDocuments = useMemo(() => documents.data?.documents ?? [], [documents.data?.documents]);
  const counts = useMemo(() => topicTagCounts(allDocuments), [allDocuments]);
  const governanceCounts = useMemo(() => ({
    approved: allDocuments.filter(item => item.reviewStatus === 'approved').length,
    pending: allDocuments.filter(item => item.reviewStatus === 'pending').length,
    rejected: allDocuments.filter(item => item.reviewStatus === 'rejected').length,
    restricted: allDocuments.filter(item => item.licenseStatus === 'restricted').length,
  }), [allDocuments]);
  const recoverableImports = (imports.data ?? []).filter(item => item.status === 'processing' || item.status === 'failed');
  const results = useMemo(() => allDocuments
    .filter(document => !topicFilter || document.topicTags.includes(topicFilter))
    .filter(document => matchesGovernance(document, governanceFilter))
    .filter(document => matchesQuery(document, query.trim().toLowerCase()))
    .sort((a, b) => (a.title || a.filename).localeCompare(b.title || b.filename)),
  [allDocuments, governanceFilter, query, topicFilter]);
  const paged = useMemo(() => paginateDocuments(results, page), [page, results]);

  const offline = status.isError || documents.isError;
  const [unavailableTitle, unavailableDetail] = unavailableCopy[classifyLibraryUnavailableReason([status.error, documents.error])];
  const selectedOnPage = paged.items.filter(item => selected.has(item.documentId)).length;
  const allPageSelected = paged.items.length > 0 && selectedOnPage === paged.items.length;
  const updatePageSelection = (checked: boolean) => setSelected(current => {
    const next = new Set(current);
    for (const item of paged.items) {
      if (checked) next.add(item.documentId);
      else next.delete(item.documentId);
    }
    return next;
  });
  const runBulkReview = (reviewStatus: 'approved' | 'rejected') => {
    bulkReview.mutate({
      documentIds: [...selected], reviewStatus,
      peerReviewStatus: reviewStatus === 'approved' ? 'not_peer_reviewed' : 'unknown',
      licenseStatus: reviewStatus === 'approved' ? 'cleared' : 'restricted',
      notes: reviewStatus === 'approved' ? 'Approved through the library bulk-review workflow.' : 'Rejected through the library bulk-review workflow.',
    }, { onSuccess: () => setSelected(new Set()) });
  };
  const selectPublication = (file?: File) => {
    if (file && !upload.isPending) upload.mutate({ file, onProgress: setUploadProgress });
  };
  const openPublicationPicker = () => {
    const input = fileInputRef.current;
    if (!input || upload.isPending) return;
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.click();
  };
  const dropPublication = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    selectPublication(event.dataTransfer.files?.[0]);
  };

  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><BookOpenText className="size-4" />Literature Library</div>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">NFI Publications</h1>
        <p className="mt-1 text-sm text-slate-600">{documents.isLoading ? 'Checking the publication corpus…' : offline && !allDocuments.length ? 'Publication count could not be verified.' : `${allDocuments.length} unique papers · ${governanceCounts.approved} approved for Evidence Assist`}</p>
      </div>
      <p className="max-w-md text-xs leading-5 text-slate-600">Scientific status and usage rights are separate controls. Corpus attestation permits internal use; it does not claim every source is peer reviewed.</p>
    </header>

    {offline && <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 size-4 shrink-0" /><div><p className="font-semibold">{unavailableTitle}</p><p className="mt-1">{unavailableDetail}</p><div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => { void status.refetch(); void documents.refetch(); }}><RefreshCw className="size-4" />Retry</Button>
        <Button asChild size="sm" variant="outline"><Link to="/settings?tab=operations"><Settings className="size-4" />Open Operations</Link></Button>
      </div></div></div>
    </section>}

    <Collapsible open={manageOpen} onOpenChange={setManageOpen} className="rounded-lg border border-slate-300 bg-white">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"><div><p className="text-sm font-semibold text-slate-900">Upload publications</p><p className="mt-0.5 text-xs text-slate-600">Add one PDF or a ZIP containing multiple PDF articles. Every paper is checked and enters review separately.</p></div><ChevronDown className={`size-4 text-slate-500 transition-transform ${manageOpen ? 'rotate-180' : ''}`} /></CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 border-t border-slate-200 px-4 py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium text-slate-900">Private publication upload</p><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">PDFs can be up to 50 MB each. ZIPs can contain up to 100 PDFs and expand to 500 MB. Exact duplicates are skipped, and new sources remain unavailable to Evidence Assist until reviewed.</p></div></div>
        <div onDragEnter={event => { event.preventDefault(); setDragActive(true); }} onDragOver={event => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={dropPublication} className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center transition-colors ${dragActive ? 'border-slate-900 bg-slate-100' : 'border-dashed border-slate-300 bg-slate-50'}`}>
          <UploadCloud className="size-5 text-slate-600" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-900">Drop a PDF or ZIP here</p>
          <p className="text-xs text-slate-600">or choose it from your computer</p>
          <Button type="button" size="sm" disabled={upload.isPending} onClick={openPublicationPicker}>{upload.isPending ? 'Processing batch…' : 'Browse files'}</Button>
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf,application/zip,.zip" className="sr-only" disabled={upload.isPending} aria-label="Choose PDF or ZIP publications" onChange={event => { selectPublication(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        </div>
        {uploadProgress && <UploadProgressPanel progress={uploadProgress} active={upload.isPending} />}
        {upload.isError && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{upload.error instanceof Error ? upload.error.message : 'The publication batch could not be processed.'}</p>}
        {upload.isSuccess && <div className={`rounded-lg border px-3 py-2 text-xs ${upload.data.failed > 0 ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><p className="font-medium">{upload.data.indexed} of {upload.data.total} publication{upload.data.total === 1 ? '' : 's'} indexed for review.</p>{upload.data.failed > 0 && <ul className="mt-1 list-disc pl-4">{upload.data.failures.slice(0, 5).map(item => <li key={`${item.fileName}-${item.message}`}>{item.fileName}: {item.message}</li>)}{upload.data.failures.length > 5 && <li>{upload.data.failures.length - 5} more failures are recorded in Recent uploads.</li>}</ul>}</div>}
        {recoverableImports.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"><div><p className="text-xs font-semibold text-amber-950">{recoverableImports.length} incomplete upload{recoverableImports.length === 1 ? '' : 's'} can be resumed</p><p className="mt-0.5 text-xs text-amber-900">The stored files will be reprocessed without uploading them again.</p></div><Button size="sm" variant="outline" disabled={resumeImports.isPending || upload.isPending} onClick={() => resumeImports.mutate(recoverableImports)}>{resumeImports.isPending ? 'Resuming…' : 'Resume incomplete'}</Button></div>}
        {resumeImports.isSuccess && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Recovered {resumeImports.data.indexed} of {resumeImports.data.total} stored publication{resumeImports.data.total === 1 ? '' : 's'}.</p>}
        {(imports.data?.length ?? 0) > 0 && <Collapsible open={recentOpen} onOpenChange={setRecentOpen} className="overflow-hidden rounded-lg border border-slate-200"><CollapsibleTrigger className="flex w-full items-center justify-between gap-3 bg-slate-50 px-3 py-2 text-left"><span className="text-xs font-semibold text-slate-700">Recent uploads · {imports.data!.filter(item => item.status === 'indexed').length} indexed{recoverableImports.length > 0 ? ` · ${recoverableImports.length} incomplete` : ''}</span><ChevronDown className={`size-4 text-slate-500 transition-transform ${recentOpen ? 'rotate-180' : ''}`} /></CollapsibleTrigger><CollapsibleContent><ol className="max-h-64 divide-y divide-slate-200 overflow-y-auto">{imports.data!.slice(0, 8).map(item => <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{item.title || item.file_name}</p><p className="mt-0.5 text-xs text-slate-600">{item.status}{item.source_quality_score != null ? ` · quality ${item.source_quality_score}/100` : ''}{item.publication_year ? ` · ${item.publication_year}` : ''}{item.doi ? ` · DOI ${item.doi}` : ''}</p>{item.error_message && <p className="mt-1 text-xs text-rose-700">{item.error_message}</p>}</div><FileCheck2 className={`mt-0.5 size-4 shrink-0 ${item.status === 'indexed' ? 'text-emerald-700' : item.status === 'failed' ? 'text-rose-700' : 'text-amber-700'}`} /></li>)}</ol></CollapsibleContent></Collapsible>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Total" value={status.data?.totalDocuments ?? 0} /><Metric label="Indexed" value={status.data?.indexedDocuments ?? 0} /><Metric label="Duplicates" value={status.data?.duplicateDocuments ?? 0} /><Metric label="Warnings" value={status.data?.warningCount ?? 0} /></div>
      </CollapsibleContent>
    </Collapsible>

    {(!offline || allDocuments.length > 0 || documents.isLoading) && <>
      <section className="space-y-3" aria-label="Library filters">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input value={query} onChange={event => { setQuery(event.target.value); setPage(1); setSelected(new Set()); }} placeholder="Search title, author, filename, or topic…" className="h-10 pl-9" aria-label="Search the library" /></div>
          <select value={governanceFilter} onChange={event => { setGovernanceFilter(event.target.value as GovernanceFilter); setPage(1); setSelected(new Set()); }} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800" aria-label="Filter by governance status">
            <option value="all">All governance states</option><option value="approved">Approved ({governanceCounts.approved})</option><option value="pending">Pending ({governanceCounts.pending})</option><option value="rejected">Rejected ({governanceCounts.rejected})</option><option value="restricted">Rights restricted ({governanceCounts.restricted})</option>
          </select>
        </div>
        {counts.length > 0 && <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter by topic"><FilterChip active={!topicFilter} onClick={() => { setTopicFilter(null); setPage(1); setSelected(new Set()); }}>All topics</FilterChip>{counts.map(([tag, count]) => <FilterChip key={tag} active={topicFilter === tag} onClick={() => { setTopicFilter(tag); setPage(1); setSelected(new Set()); }}>{tag} ({count})</FilterChip>)}</div>}
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-label="Publication review queue">
        <div className="flex min-h-12 flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={allPageSelected} onChange={event => updatePageSelection(event.target.checked)} aria-label="Select all papers on this page" />Select page</label>
          <span className="text-xs text-slate-600">{results.length} result{results.length === 1 ? '' : 's'} · {selected.size} selected</span>
          {selected.size > 0 && <div className="ml-auto flex gap-2"><Button size="sm" variant="outline" disabled={bulkReview.isPending} onClick={() => runBulkReview('rejected')}>Reject selected</Button><Button size="sm" disabled={bulkReview.isPending} onClick={() => runBulkReview('approved')}>Approve selected</Button></div>}
        </div>
        <ol className="divide-y divide-slate-200">
          {documents.isLoading ? <li className="px-4 py-10 text-center text-sm text-slate-600">Checking indexed publications…</li> : !results.length ? <li className="px-4 py-10 text-center text-sm text-slate-600">No papers match the current filters.</li> : paged.items.map(document => <PaperEntry key={document.documentId} document={document} selected={selected.has(document.documentId)} onSelectedChange={checked => setSelected(current => { const next = new Set(current); if (checked) next.add(document.documentId); else next.delete(document.documentId); return next; })} />)}
        </ol>
        {results.length > 0 && <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3"><p className="text-xs text-slate-600">Page {paged.page} of {paged.pageCount} · showing {(paged.page - 1) * PAGE_SIZE + 1}–{Math.min(paged.page * PAGE_SIZE, results.length)}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={paged.page === 1} onClick={() => setPage(value => value - 1)}><ChevronLeft className="size-4" />Previous</Button><Button size="sm" variant="outline" disabled={paged.page === paged.pageCount} onClick={() => setPage(value => value + 1)}>Next<ChevronRight className="size-4" /></Button></div></div>}
      </section>
    </>}

  </div>;
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'}`}>{children}</button>;
}

function PaperEntry({ document, selected, onSelectedChange }: { document: LibraryDocument; selected: boolean; onSelectedChange: (checked: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const sourcePath = document.corpusPath || document.originalPath || '';
  const openSource = () => sourcePath.startsWith('supabase://literature-imports/')
    ? openStoredLiteratureSource(sourcePath)
    : openSourceViewer({ sourcePath, title: document.title || document.filename });
  const statusTone = document.reviewStatus === 'approved' && document.licenseStatus === 'cleared' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : document.reviewStatus === 'rejected' || document.licenseStatus === 'restricted' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-900';
  return <li className="px-4 py-3"><div className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={selected} onChange={event => onSelectedChange(event.target.checked)} aria-label={`Select ${document.title || document.filename}`} /><div className="min-w-0 flex-1"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0">{sourcePath ? <button type="button" onClick={() => void openSource()} className="text-left text-sm font-semibold leading-5 text-slate-900 hover:text-blue-700 hover:underline">{document.title || document.filename}</button> : <p className="text-sm font-semibold text-slate-900">{document.title || document.filename}</p>}<p className="mt-1 text-xs text-slate-600">{[document.authors, document.year, document.doi ? `DOI ${document.doi}` : '', EVIDENCE_TYPE_LABELS[document.evidenceType || 'unknown'] ?? document.evidenceType, `${document.pageCount} page${document.pageCount === 1 ? '' : 's'}`, document.sourceQualityScore != null ? `quality ${document.sourceQualityScore}/100` : '', document.reviewBasis === 'nfi_corpus_attestation' ? 'NFI corpus attestation' : ''].filter(Boolean).join(' · ')}</p></div><div className="flex shrink-0 items-center gap-2"><span className={`rounded-lg border px-2 py-0.5 text-xs font-medium ${statusTone}`}>{document.reviewStatus === 'approved' ? 'Approved' : document.reviewStatus === 'rejected' ? 'Rejected' : 'Needs review'} · {document.licenseStatus === 'cleared' ? 'rights cleared' : document.licenseStatus}</span><Button size="sm" variant="ghost" onClick={() => setOpen(value => !value)} aria-expanded={open}>Review<ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} /></Button></div></div>{document.topicTags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{document.topicTags.slice(0, 4).map(tag => <Badge key={tag} variant="secondary" className="font-normal">{tag}</Badge>)}</div>}{open && <ReviewControls document={document} onSaved={() => setOpen(false)} />}</div></div></li>;
}

function ReviewControls({ document, onSaved }: { document: LibraryDocument; onSaved: () => void }) {
  const review = useReviewLibraryDocument();
  const [peerReviewStatus, setPeerReviewStatus] = useState(document.peerReviewStatus);
  const [licenseStatus, setLicenseStatus] = useState(document.licenseStatus);
  const pendingStatus = review.isPending ? review.variables?.reviewStatus : null;
  const save = (reviewStatus: LibraryDocument['reviewStatus']) => review.mutate(
    { documentId: document.documentId, reviewStatus, peerReviewStatus, licenseStatus, notes: document.reviewNotes },
    { onSuccess: onSaved },
  );
  return <div className="mt-3 flex flex-col gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-end"><label className="text-xs font-medium text-slate-700">Scientific status<select value={peerReviewStatus} onChange={event => setPeerReviewStatus(event.target.value as LibraryDocument['peerReviewStatus'])} className="mt-1 block h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs"><option value="unknown">Not checked</option><option value="peer_reviewed">Peer reviewed</option><option value="not_peer_reviewed">Not peer reviewed</option></select></label><label className="text-xs font-medium text-slate-700">Usage rights<select value={licenseStatus} onChange={event => setLicenseStatus(event.target.value as LibraryDocument['licenseStatus'])} className="mt-1 block h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs"><option value="unknown">Not checked</option><option value="cleared">Cleared</option><option value="restricted">Restricted</option></select></label><div className="flex gap-2 sm:ml-auto"><Button size="sm" variant="outline" disabled={review.isPending} onClick={() => save('rejected')}>{pendingStatus === 'rejected' ? 'Rejecting…' : 'Reject'}</Button><Button size="sm" disabled={review.isPending || peerReviewStatus === 'unknown' || licenseStatus !== 'cleared'} onClick={() => save('approved')}>{pendingStatus === 'approved' ? 'Approving…' : 'Approve source'}</Button></div>{review.isError && <p className="max-w-sm text-xs text-rose-700">{review.error instanceof Error ? review.error.message : 'Unable to save this review.'}</p>}</div>;
}

function Metric({ label, value }: { label: string; value: number | string }) { return <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-xs font-medium text-slate-600">{label}</p><p className="mt-1 text-lg font-semibold text-slate-900">{value}</p></div>; }

function UploadProgressPanel({ progress, active }: { progress: LiteratureUploadProgress; active: boolean }) {
  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 5;
  const stageLabel = progress.stage === 'preparing' ? 'Preparing' : progress.stage === 'checking' ? 'Checking' : progress.stage === 'uploading' ? 'Uploading' : progress.stage === 'indexing' ? 'Indexing' : progress.stage === 'failed' ? 'Failed' : 'Complete';
  return <section aria-label="Publication upload progress" aria-live="polite" className="rounded-lg border border-slate-300 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-slate-900">{stageLabel}: <span className="font-medium">{progress.currentFile}</span></p><p className="mt-1 text-xs text-slate-600">{progress.message}</p></div><p className="text-xs font-medium text-slate-700">{progress.total > 0 ? `${progress.completed}/${progress.total} finished` : 'Reading files'}{progress.failed > 0 ? ` · ${progress.failed} failed` : ''}</p></div>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Overall upload progress"><div className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${progress.stage === 'complete' ? 'bg-emerald-600' : 'bg-slate-900'}`} style={{ width: `${percent}%` }} /></div>
    <p className="mt-2 text-xs text-slate-600">{active ? 'Keep this page open while the batch is being processed. Completed papers are saved even if a later paper fails.' : progress.stage === 'failed' ? 'Nothing was uploaded. Check the archive and try again.' : 'Processing finished. New papers are now in the review queue.'}</p>
  </section>;
}
