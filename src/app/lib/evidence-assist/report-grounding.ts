import type { LiteratureCitation } from '../report-agents/types';
import type { ReportContext } from '../report-qc';
import { fetchEvidenceAssist } from './client';
import { buildEvidenceAssistRequest } from './context';
import { scanClientFacingText, toReportSafeEvidenceCard } from './policy';
import type {
  EvidenceAssistResult,
  EvidenceCard,
  ReportSafeEvidenceCard,
} from './types';

const REPORT_EVIDENCE_USES = new Set([
  'scientific_context',
  'method_guidance',
  'validation_guidance',
]);

const REPORT_SOURCE_TYPES = new Set([
  'literature',
  'method',
  'claims_guidance',
]);

const REPORT_SOURCE_LIMIT = 5;

export type ReportGroundingStatus = 'included' | 'no_match';

export interface ReportGrounding {
  status: ReportGroundingStatus;
  evidenceCards: ReportSafeEvidenceCard[];
  literatureCitations: LiteratureCitation[];
  warnings: string[];
  metadata: {
    retrievedCount: number;
    acceptedCount: number;
    generatedAt: string;
  };
}

function displayTitle(card: EvidenceCard, index: number) {
  const leaf = card.sourceTitle.split(/[\\/]/).pop() ?? '';
  const cleaned = leaf
    .replace(/\.(?:pdf|docx?|txt)$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || scanClientFacingText(cleaned).length > 0) {
    return `Approved literature source ${index + 1}`;
  }
  return cleaned.slice(0, 180);
}

function citationId(card: EvidenceCard, index: number) {
  const preferred = card.citationLabel?.trim() || `L${index + 1}`;
  const safe = preferred.replace(/[^a-z0-9_.-]/gi, '').slice(0, 32);
  return safe || `L${index + 1}`;
}

function reportEligible(card: EvidenceCard) {
  return REPORT_SOURCE_TYPES.has(card.sourceType)
    && REPORT_EVIDENCE_USES.has(card.evidenceUse)
    && (card.claimPermission === 'context_only' || card.claimPermission === 'method_only');
}

/**
 * Converts the server's traceability-rich cards into the only two shapes that
 * may be saved with or shown in a client report: report-safe guidance and a
 * minimal approved-source citation. Raw excerpts and retrieval metadata are
 * intentionally discarded here. The protected source locator is retained so
 * an authenticated administrator can open the approved article.
 */
export function buildReportGrounding(result: EvidenceAssistResult): ReportGrounding {
  const selected: Array<{ source: EvidenceCard; safe: ReportSafeEvidenceCard }> = [];
  const fingerprints = new Set<string>();
  const sourceFingerprints = new Set<string>();

  for (const card of result.cards) {
    if (!reportEligible(card) || fingerprints.has(card.contentFingerprint)) continue;
    const sourceFingerprint = `${card.sourceType}:${card.sourcePath || card.sourceTitle}`.trim().toLowerCase();
    if (sourceFingerprints.has(sourceFingerprint)) continue;
    const safe = toReportSafeEvidenceCard(card);
    if (!safe) continue;
    fingerprints.add(card.contentFingerprint);
    sourceFingerprints.add(sourceFingerprint);
    selected.push({ source: card, safe });
    if (selected.length >= REPORT_SOURCE_LIMIT) break;
  }

  const usedIds = new Set<string>();
  const evidenceCards = selected.map(({ source, safe }, index) => {
    let id = citationId(source, index);
    while (usedIds.has(id)) id = `${id}-${index + 1}`;
    usedIds.add(id);
    return { ...safe, citationLabel: id };
  });
  const literatureCitations = selected.map(({ source }, index) => ({
    id: evidenceCards[index].citationLabel ?? evidenceCards[index].id,
    title: displayTitle(source, index),
    // Evidence Assist guidance is authored and bounded, not a quotation. Do
    // not persist the retrieved source excerpt in a client report snapshot.
    excerpt: '',
    source: 'Approved NFI literature library',
    sourcePath: source.sourcePath ?? 'Approved NFI literature library',
  }));

  return {
    status: evidenceCards.length > 0 ? 'included' : 'no_match',
    evidenceCards,
    literatureCitations,
    warnings: [...result.qcWarnings],
    metadata: {
      retrievedCount: result.metadata.retrievedCount,
      acceptedCount: evidenceCards.length,
      generatedAt: result.metadata.generatedAt,
    },
  };
}

export async function fetchReportGrounding(
  context: ReportContext,
  options?: { signal?: AbortSignal },
): Promise<ReportGrounding> {
  const request = buildEvidenceAssistRequest(context, 'commercialization_report');
  request.options = {
    // Retrieve a wider candidate set so governance and source-diversity
    // filters can still produce a balanced, concise final evidence map.
    maxCards: 8,
    minimumRelevance: 0.45,
    evidenceUses: ['scientific_context', 'method_guidance', 'validation_guidance'],
  };
  const result = await fetchEvidenceAssist(request, {
    signal: options?.signal,
    timeoutMs: 45_000,
  });
  return buildReportGrounding(result);
}
