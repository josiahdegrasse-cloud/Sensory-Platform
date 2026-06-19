// ════════════════════════════════════════════════════════════════════════════
// Language lint (section 13). Flags copy that reads like raw system output,
// undefined acronyms, vague unsupported praise, malformed sentences, and
// duplicated paragraphs. Deterministic — operates on the rendered section text.
// ════════════════════════════════════════════════════════════════════════════

export interface LintFinding {
  code: string;
  message: string;
  excerpt: string;
}

// Raw system / pipeline phrases that must never reach a client.
const RAW_SYSTEM_PATTERNS: Array<{ code: string; re: RegExp }> = [
  { code: 'raw-deterministic', re: /\bdeterministic candidate decision\b/i },
  { code: 'raw-evidence-bundle', re: /\b(?:the )?evidence bundle\b/i },
  { code: 'raw-saved-model', re: /\bsaved sensory decision model\b/i },
  { code: 'raw-snapshot', re: /\breport snapshot\b/i },
  { code: 'raw-scoreimpl', re: /\bscoreImplication|dimensionScores|candidateDecision\b/ },
];

// Unsupported praise — only flagged when no evidence marker is nearby.
const VAGUE_PRAISE_RE = /\b(strong|credible|market[- ]ready|consumer[- ]approved|world[- ]class|exceptional|outstanding)\b/i;
const EVIDENCE_MARKER_RE = /\b(\d{1,3}\/100|\d{1,3}%|n\s*=\s*\d+|ISSF|threshold|score)\b/i;

const KNOWN_ACRONYMS = new Set(['ISSF', 'GO', 'STOP', 'AI', 'R&D', 'NFI', 'CATA', 'GST', 'PDF', 'ID', 'GC', 'GCMS']);

export function lintText(label: string, text: string): LintFinding[] {
  const findings: LintFinding[] = [];
  const trimmed = (text ?? '').trim();
  if (!trimmed) return findings;

  for (const { code, re } of RAW_SYSTEM_PATTERNS) {
    const match = trimmed.match(re);
    if (match) findings.push({ code, message: `${label}: raw system phrase "${match[0]}".`, excerpt: match[0] });
  }

  // Vague praise without any nearby evidence marker in the same section.
  if (VAGUE_PRAISE_RE.test(trimmed) && !EVIDENCE_MARKER_RE.test(trimmed)) {
    const word = (trimmed.match(VAGUE_PRAISE_RE) ?? [''])[0];
    findings.push({ code: 'vague-praise', message: `${label}: unsupported praise "${word}" with no named evidence.`, excerpt: word });
  }

  // Malformed sentence: an obvious double-verb / broken concatenation seam.
  if (/\b(?:lead with|leads? with)\s+[A-Z][^.]*\bsupport(?:s)?\b/i.test(trimmed)) {
    findings.push({ code: 'malformed-sentence', message: `${label}: malformed core-message concatenation.`, excerpt: trimmed.slice(0, 60) });
  }

  // Unresolved placeholders.
  const placeholder = trimmed.match(/\{\{?\s*\w+\s*\}?\}|\bTODO\b|\bTBD\b|\bundefined\b|\bNaN\b/);
  if (placeholder) findings.push({ code: 'placeholder', message: `${label}: unresolved placeholder "${placeholder[0]}".`, excerpt: placeholder[0] });

  // Undefined acronym: an all-caps token (3+ letters) not in the known set and
  // not defined inline with parentheses.
  const acronyms = trimmed.match(/\b[A-Z]{3,}\b/g) ?? [];
  for (const acro of acronyms) {
    if (KNOWN_ACRONYMS.has(acro)) continue;
    const definedInline = new RegExp(`\\b\\w[\\w ]+\\(${acro}\\)`).test(trimmed) || new RegExp(`${acro}\\s*[=(]`).test(trimmed);
    if (!definedInline) {
      findings.push({ code: 'undefined-acronym', message: `${label}: undefined acronym "${acro}".`, excerpt: acro });
      break;
    }
  }

  return findings;
}

// Detects duplicated paragraphs across the whole report.
export function findDuplicateParagraphs(sections: Array<{ label: string; text: string }>): LintFinding[] {
  const seen = new Map<string, string>();
  const findings: LintFinding[] = [];
  for (const section of sections) {
    const norm = section.text.trim().toLowerCase().replace(/\s+/g, ' ');
    if (norm.length < 40) continue;
    const prior = seen.get(norm);
    if (prior) {
      findings.push({
        code: 'duplicate-paragraph',
        message: `Duplicated paragraph between "${prior}" and "${section.label}".`,
        excerpt: section.text.slice(0, 60),
      });
    } else {
      seen.set(norm, section.label);
    }
  }
  return findings;
}
