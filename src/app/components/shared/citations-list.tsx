import { openSourceViewer } from '../../lib/tweak-intelligence';
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
// clickable title linking to the RAG service's /source viewer. Extracted
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
        ) : items.map(item => (
          <div key={item.id} className="rounded-md border border-slate-100 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-slate-500">{item.id}{item.page ? ` · Page ${item.page}` : ''}</p>
              {item.roleLabel && (
                <Badge className="border-0 bg-white text-slate-600 shadow-sm">
                  {item.roleLabel}
                </Badge>
              )}
            </div>
            <button
              type="button"
              onClick={() => void openSourceViewer({
                sourcePath: item.sourcePath,
                title: item.title,
                excerpt: item.excerpt,
              })}
              className="mt-1 block text-left text-sm font-semibold leading-5 text-blue-800 hover:text-blue-950 hover:underline"
            >
              {item.title}
            </button>
          </div>
        ))}
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
        return (
          <sup key={index} className="ml-0.5">
            <button
              type="button"
              onClick={() => void openSourceViewer({ sourcePath: citation.source, title: citation.title, excerpt: citation.excerpt })}
              title={citation.title}
              className="rounded border border-slate-300 bg-slate-50 px-1 text-[10px] font-semibold text-blue-800 no-underline hover:bg-slate-100 hover:text-blue-950"
            >
              {match[1].trim()}
            </button>
          </sup>
        );
      })}
    </>
  );
}
