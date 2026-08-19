import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { openResearchSource } from '../../lib/rag-client';
import type { LiteratureCitation } from '../../lib/report-agents/types';
import { Badge } from '../ui/badge';

const LIT_TOKEN_SPLIT_RE = /(\[lit:[^\]]+\])/g;
const LIT_TOKEN_MATCH_RE = /^\[lit:([^\]]+)\]$/;

export interface CitationListItem {
  id: string;
  title: string;
  excerpt?: string;
  sourcePath: string;
  page?: number | null;
  roleLabel?: string;
}

// Shared citation card: a source id (+ optional page/role badge) and a
// clickable title linking to the authenticated article viewer. Extracted
// from the Tweak Intelligence panel's CitationsOnly component so report
// literature citations render identically rather than reinventing the UI.
export function CitationsList({
  items,
  emptyLabel,
  countLabel,
}: {
  items: CitationListItem[];
  emptyLabel: string;
  countLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Citations</h3>
        {countLabel && <p className="mt-0.5 text-xs text-slate-500">{countLabel}</p>}
      </div>
      <div className="grid gap-2 p-4 md:grid-cols-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">{emptyLabel}</p>
        ) : items.map(item => <CitationItem key={item.id} item={item} />)}
      </div>
    </div>
  );
}

// Renders body text containing inline [lit:Lx] citation tokens, replacing
// each known one with a small clickable superscript badge linking to the
// source viewer. An id not present in `citations` (the client-side guard
// should already have stripped these upstream — this is defense-in-depth)
// renders as plain text rather than a dead link.
export function TextWithLiteratureCitations({ text, citations }: { text: string; citations: LiteratureCitation[] }) {
  const byId = new Map(citations.map(citation => [citation.id, citation]));
  const parts = text.split(LIT_TOKEN_SPLIT_RE);
  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(LIT_TOKEN_MATCH_RE);
        if (!match) return <span key={index}>{part}</span>;
        const citation = byId.get(match[1].trim());
        if (!citation) return null;
        return <CitationMarker key={index} citation={citation} label={match[1].trim()} />;
      })}
    </>
  );
}

function CitationItem({ item }: { item: CitationListItem }) {
  const [error, setError] = useState('');
  const open = async () => {
    setError('');
    try {
      await openResearchSource({ sourcePath: item.sourcePath, title: item.title, excerpt: item.excerpt });
    } catch {
      setError('This article is not available from its saved source. Try again, or re-index it in the Literature Library.');
    }
  };
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold text-slate-500">{item.id}{item.page ? ` · Page ${item.page}` : ''}</p>
        {item.roleLabel && <Badge className="border-0 bg-white text-slate-600 shadow-sm">{item.roleLabel}</Badge>}
      </div>
      <button
        type="button"
        onClick={() => void open()}
        className="mt-1 inline-flex items-start gap-1.5 text-left text-sm font-semibold leading-5 text-blue-800 hover:text-blue-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        <span>{item.title}</span><ExternalLink className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      </button>
      {error && <p role="alert" className="mt-2 text-xs leading-5 text-rose-700">{error}</p>}
    </div>
  );
}

function CitationMarker({ citation, label }: { citation: LiteratureCitation; label: string }) {
  const [failed, setFailed] = useState(false);
  const open = async () => {
    setFailed(false);
    try {
      await openResearchSource({
        sourcePath: citation.sourcePath ?? citation.source,
        title: citation.title,
        excerpt: citation.excerpt,
      });
    } catch {
      setFailed(true);
    }
  };
  return (
    <sup className="ml-0.5">
      <button
        type="button"
        onClick={() => void open()}
        aria-label={`Open source ${label}: ${citation.title}`}
        title={failed ? 'Article unavailable. Check the citations list for details.' : citation.title}
        className={`rounded border px-1 text-[10px] font-semibold no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${failed ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-slate-300 bg-slate-50 text-blue-800 hover:bg-slate-100 hover:text-blue-950'}`}
      >
        {label}
      </button>
    </sup>
  );
}
