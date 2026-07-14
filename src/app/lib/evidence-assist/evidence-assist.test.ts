import { describe, expect, it } from 'vitest';
import {
  assertReportWriterInputSafe,
  claimPermissionAllows,
  excerptAppearsInClientCopy,
  parseEvidenceAssistResult,
  scanClientFacingText,
  toReportSafeEvidenceCard,
  validateEvidenceCard,
} from './policy';
import type { EvidenceCard } from './types';

function card(overrides: Partial<EvidenceCard> = {}): EvidenceCard {
  return {
    id: 'ea-literature-1',
    sourceTitle: 'Texture review',
    sourceType: 'literature',
    sourcePath: '/internal/papers/texture.pdf',
    citationLabel: 'L1',
    productCategory: 'yogurt',
    topic: 'texture stability',
    evidenceUse: 'validation_guidance',
    appliesTo: ['texture'],
    supports: ['controlled texture validation'],
    doesNotSupport: ['consumer preference', 'product superiority'],
    safeReportLanguage: 'Confirm texture stability with controlled bench measurements before scale-up.',
    claimPermission: 'context_only',
    confidence: 'high',
    limitations: ['External literature is not product-specific proof.'],
    retrievedExcerpt: 'A long internal source excerpt that stays in traceability only.',
    internalNotes: 'Reviewer-only note.',
    chunkId: 'chunk-1',
    contentFingerprint: 'sha256:abc',
    classifierVersion: 'evidence-assist.rules.v1',
    ...overrides,
  };
}

describe('Evidence Assist permissions', () => {
  it('never allows literature to become product-specific evidence', () => {
    const issues = validateEvidenceCard(card({ claimPermission: 'product_specific' }));
    expect(issues.join(' ')).toMatch(/literature.*product_specific/i);
  });

  it('blocks internal-only evidence from exposing report language', () => {
    const internal = card({ claimPermission: 'not_for_external_claims' });
    expect(toReportSafeEvidenceCard(internal)).toBeNull();
  });

  it('projects only the report-safe allowlist', () => {
    const safe = toReportSafeEvidenceCard(card());
    expect(safe).not.toBeNull();
    expect(safe).not.toHaveProperty('sourcePath');
    expect(safe).not.toHaveProperty('sourceTitle');
    expect(safe).not.toHaveProperty('retrievedExcerpt');
    expect(safe).not.toHaveProperty('internalNotes');
    expect(safe?.safeReportLanguage).toMatch(/controlled bench measurements/i);
  });

  it('allows context literature for scientific context but never product claims', () => {
    expect(claimPermissionAllows('context_only', 'scientific_context')).toBe(true);
    expect(claimPermissionAllows('context_only', 'product_claim')).toBe(false);
  });

  it('fails closed when an API response escalates literature to a product claim', () => {
    expect(() => parseEvidenceAssistResult({
      schemaVersion: 'evidence-assist.v1',
      cards: [card({ claimPermission: 'product_specific' })],
    })).toThrow(/literature.*product_specific/i);
  });

  it('fails closed on an unknown classifier enum value', () => {
    expect(() => parseEvidenceAssistResult({
      schemaVersion: 'evidence-assist.v1',
      cards: [{ ...card(), claimPermission: 'unreviewed' }],
    })).toThrow(/invalid card/i);
  });
});

describe('Evidence Assist leakage guards', () => {
  it('rejects internal fields anywhere in a writer packet', () => {
    expect(() => assertReportWriterInputSafe({ evidence: [{ safeReportLanguage: 'Safe.' }] })).not.toThrow();
    expect(() => assertReportWriterInputSafe({ nested: { sourcePath: '/private/source.pdf' } })).toThrow(/sourcePath/);
  });

  it('detects paths, backend language and raw floats', () => {
    const text = 'Retrieved chunk /Users/example/private.pdf from rag_food with value 78.123456.';
    const codes = scanClientFacingText(text).map(finding => finding.code);
    expect(codes).toEqual(expect.arrayContaining(['absolute-file-path', 'raw-rag-language', 'backend-name', 'raw-float']));
  });

  it('detects a pasted source excerpt using a ten-word window', () => {
    const excerpt = 'Protein hydration and cooling rate changed the gel network and reduced the measured grainy texture response.';
    expect(excerptAppearsInClientCopy(`Recommendation: ${excerpt}`, [excerpt])).toBe(true);
    expect(excerptAppearsInClientCopy('Use a controlled texture screen before scale-up.', [excerpt])).toBe(false);
  });
});
