import type {
  ClaimPermission,
  ClientFacingLeakageFinding,
  EvidenceCard,
  EvidenceAssistResult,
  EvidenceSourceType,
  ReportSafeEvidenceCard,
} from './types';
import { EVIDENCE_ASSIST_SCHEMA_VERSION } from './types';

const INTERNAL_ONLY_FIELDS = new Set([
  'sourcePath',
  'retrievedExcerpt',
  'internalNotes',
  'sourceId',
  'chunkId',
  'retrievalScore',
  'rawEvidence',
  'rawChunk',
  'evidenceBundle',
]);

const PRODUCT_SPECIFIC_SOURCES = new Set<EvidenceSourceType>([
  'project_evidence',
  'instrumental',
]);

const VALID_SOURCE_TYPES = new Set(['project_evidence', 'literature', 'method', 'instrumental', 'claims_guidance']);
const VALID_EVIDENCE_USES = new Set(['decision_evidence', 'scientific_context', 'method_guidance', 'claims_support', 'validation_guidance']);
const VALID_CLAIM_PERMISSIONS = new Set(['product_specific', 'context_only', 'method_only', 'not_for_external_claims']);
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);

const CLIENT_LEAKAGE_PATTERNS: Array<{ code: string; pattern: RegExp; message: string }> = [
  { code: 'absolute-file-path', pattern: /(?:file:\/\/|\/(?:Users|home|var|tmp)\/[^\s]+|[A-Z]:\\[^\s]+)/i, message: 'Client copy contains an absolute file path.' },
  { code: 'raw-rag-language', pattern: /\b(?:retrieved chunk|raw (?:rag|source) (?:chunk|excerpt)|vector search result)\b/i, message: 'Client copy contains raw retrieval language.' },
  { code: 'internal-evidence-language', pattern: /\b(?:evidence bundle|internal notes?|backend source|sourcePath|chunkId)\b/i, message: 'Client copy contains internal evidence-system language.' },
  { code: 'backend-name', pattern: /\b(?:rag_food|postgres_store|grounded_generation|agentdb\.rvf)\b/i, message: 'Client copy contains a backend implementation name.' },
];

export function claimPermissionAllows(
  permission: ClaimPermission,
  use: 'product_claim' | 'scientific_context' | 'method_guidance' | 'internal',
) {
  if (use === 'internal') return true;
  if (permission === 'not_for_external_claims') return false;
  if (use === 'product_claim') return permission === 'product_specific';
  if (use === 'method_guidance') return permission === 'method_only' || permission === 'context_only';
  return permission === 'context_only' || permission === 'method_only' || permission === 'product_specific';
}

export function validateEvidenceCard(card: EvidenceCard): string[] {
  const issues: string[] = [];
  if (!card.id.trim()) issues.push('Evidence card id is required.');
  if (!card.contentFingerprint.trim()) issues.push(`${card.id || 'Evidence card'} is missing a content fingerprint.`);
  if (!card.classifierVersion.trim()) issues.push(`${card.id || 'Evidence card'} is missing a classifier version.`);
  if (card.claimPermission === 'product_specific' && !PRODUCT_SPECIFIC_SOURCES.has(card.sourceType)) {
    issues.push(`${card.id}: ${card.sourceType} evidence cannot receive product_specific permission.`);
  }
  if (card.claimPermission === 'not_for_external_claims' && card.safeReportLanguage?.trim()) {
    issues.push(`${card.id}: internal-only evidence must not expose safeReportLanguage.`);
  }
  if (card.safeReportLanguage && scanClientFacingText(card.safeReportLanguage).length > 0) {
    issues.push(`${card.id}: safeReportLanguage contains client-facing leakage.`);
  }
  return issues;
}

export function toReportSafeEvidenceCard(card: EvidenceCard): ReportSafeEvidenceCard | null {
  if (validateEvidenceCard(card).length > 0) return null;
  if (card.claimPermission === 'not_for_external_claims' || !card.safeReportLanguage?.trim()) return null;
  return {
    id: card.id,
    citationLabel: card.citationLabel,
    topic: card.topic,
    evidenceUse: card.evidenceUse,
    appliesTo: [...card.appliesTo],
    supports: [...card.supports],
    doesNotSupport: [...card.doesNotSupport],
    safeReportLanguage: card.safeReportLanguage.trim(),
    claimPermission: card.claimPermission,
    confidence: card.confidence,
    limitations: [...card.limitations],
    contentFingerprint: card.contentFingerprint,
  };
}

export function toReportSafeEvidenceCards(cards: EvidenceCard[]): ReportSafeEvidenceCard[] {
  return cards.map(toReportSafeEvidenceCard).filter((card): card is ReportSafeEvidenceCard => card !== null);
}

export function findForbiddenWriterInput(value: unknown, path = 'packet'): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => findForbiddenWriterInput(item, `${path}[${index}]`));
  if (!value || typeof value !== 'object') return [];
  const findings: string[] = [];
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = `${path}.${key}`;
    if (INTERNAL_ONLY_FIELDS.has(key)) findings.push(nextPath);
    findings.push(...findForbiddenWriterInput(nested, nextPath));
  }
  return findings;
}

export function assertReportWriterInputSafe(value: unknown): void {
  const forbidden = findForbiddenWriterInput(value);
  if (forbidden.length > 0) {
    throw new Error(`Report writer input contains internal evidence field(s): ${forbidden.join(', ')}.`);
  }
}

export function scanClientFacingText(text: string): ClientFacingLeakageFinding[] {
  const findings: ClientFacingLeakageFinding[] = [];
  for (const rule of CLIENT_LEAKAGE_PATTERNS) {
    const match = text.match(rule.pattern);
    if (match) findings.push({ code: rule.code, message: rule.message, excerpt: match[0] });
  }
  const rawFloat = findRawFloatOutsideDoi(text);
  if (rawFloat) {
    findings.push({
      code: 'raw-float',
      message: 'Client copy contains an unformatted floating-point value.',
      excerpt: rawFloat,
    });
  }
  return findings;
}

function findRawFloatOutsideDoi(text: string): string | null {
  for (const match of text.matchAll(/\b-?\d+\.\d{5,}\b/g)) {
    const offset = match.index ?? 0;
    const tokenStart = text.lastIndexOf(' ', offset) + 1;
    const nextSpace = text.indexOf(' ', offset + match[0].length);
    const tokenEnd = nextSpace === -1 ? text.length : nextSpace;
    const token = text.slice(tokenStart, tokenEnd).replace(/^[([{'"`]+|[)\]},;'"`]+$/g, '');
    if (/^(?:doi:?)?10\.\d{4,9}\//i.test(token)
      || /^https?:\/\/(?:dx\.)?doi\.org\/10\.\d{4,9}\//i.test(token)) continue;
    return match[0];
  }
  return null;
}

export function excerptAppearsInClientCopy(text: string, excerpts: string[]): boolean {
  const normalizedText = normalizeWords(text);
  return excerpts.some(excerpt => {
    const words = normalizeWords(excerpt).split(' ').filter(Boolean);
    if (words.length < 10) return false;
    for (let start = 0; start <= words.length - 10; start += 6) {
      if (normalizedText.includes(words.slice(start, start + 10).join(' '))) return true;
    }
    return false;
  });
}

function normalizeWords(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseEvidenceAssistResult(value: unknown): EvidenceAssistResult {
  if (!isRecord(value) || value.schemaVersion !== EVIDENCE_ASSIST_SCHEMA_VERSION || !Array.isArray(value.cards)) {
    throw new Error('Evidence Assist returned an invalid response envelope.');
  }
  for (const [index, rawCard] of value.cards.entries()) {
    if (!isRecord(rawCard)
      || !requiredStrings(rawCard, ['id', 'sourceTitle', 'sourceType', 'topic', 'evidenceUse', 'claimPermission', 'confidence', 'contentFingerprint', 'classifierVersion'])
      || !requiredArrays(rawCard, ['appliesTo', 'supports', 'doesNotSupport', 'limitations'])
      || !VALID_SOURCE_TYPES.has(String(rawCard.sourceType))
      || !VALID_EVIDENCE_USES.has(String(rawCard.evidenceUse))
      || !VALID_CLAIM_PERMISSIONS.has(String(rawCard.claimPermission))
      || !VALID_CONFIDENCE.has(String(rawCard.confidence))
      || !(typeof rawCard.safeReportLanguage === 'string' || rawCard.safeReportLanguage === null)) {
      throw new Error(`Evidence Assist returned an invalid card at index ${index}.`);
    }
    const issues = validateEvidenceCard(rawCard as unknown as EvidenceCard);
    if (issues.length > 0) throw new Error(`Evidence Assist rejected card ${rawCard.id}: ${issues.join(' ')}`);
  }
  return value as unknown as EvidenceAssistResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredStrings(value: Record<string, unknown>, keys: string[]) {
  return keys.every(key => typeof value[key] === 'string' && Boolean((value[key] as string).trim()));
}

function requiredArrays(value: Record<string, unknown>, keys: string[]) {
  return keys.every(key => Array.isArray(value[key]));
}
