// Client-side defense-in-depth for [lit:Lx] literature citation tokens,
// mirroring report-evaluator.ts's handling of [evidence:id] tokens: never
// trust the server's own citation-id gate blindly, re-verify here too.
const LIT_CITATION_RE = /\[lit:([^\]]+)\]/g;

export function literatureCitationsIn(text: string): string[] {
  const out: string[] = [];
  let match: RegExpExecArray | null;
  LIT_CITATION_RE.lastIndex = 0;
  while ((match = LIT_CITATION_RE.exec(text)) !== null) {
    out.push(match[1].trim());
  }
  return out;
}

// Unlike stripEvidenceCitations (which always removes internal-evidence
// tokens before display), [lit:Lx] tokens are meant to stay visible and
// clickable on screen — this only removes a token whose id isn't in the
// known-good set, e.g. if the server's own gate somehow let one through.
export function sanitizeLiteratureCitations(text: string, knownIds: Set<string>): string {
  return text
    .replace(LIT_CITATION_RE, (full, id: string) => (knownIds.has(id.trim()) ? full : ''))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,;:)])/g, '$1')
    .trim();
}

// Removes all [lit:Lx] tokens outright — used for surfaces that can't
// render a clickable marker (the plain-text narrative editor, PDF export).
export function stripLiteratureCitations(text: string): string {
  return text
    .replace(/\s*\[lit:[^\]]+\]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,;:)])/g, '$1')
    .replace(/[ \t]+$/gm, '')
    .trim();
}
