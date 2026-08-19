import { beforeEach, describe, expect, it, vi } from 'vitest';
import { coconutCheddarContext } from '../report-qc/fixtures';
import type { EvidenceAssistResult, EvidenceCard } from './types';

const { fetchEvidenceAssist } = vi.hoisted(() => ({ fetchEvidenceAssist: vi.fn() }));
vi.mock('./client', () => ({ fetchEvidenceAssist }));

import { buildReportGrounding, fetchReportGrounding } from './report-grounding';

function card(overrides: Partial<EvidenceCard> = {}): EvidenceCard {
  return {
    id: 'ea-literature-1',
    sourceTitle: '/private/library/Texture_review.pdf',
    sourceType: 'literature',
    sourcePath: '/private/library/Texture_review.pdf',
    citationLabel: 'L1',
    productCategory: 'cheese',
    topic: 'texture confirmation',
    evidenceUse: 'validation_guidance',
    appliesTo: ['texture'],
    supports: ['pilot-scale texture confirmation'],
    doesNotSupport: ['product preference', 'product superiority'],
    safeReportLanguage: 'Confirm texture at pilot scale using the same controlled sensory measures.',
    claimPermission: 'context_only',
    confidence: 'high',
    limitations: ['External literature is not product-specific proof.'],
    retrievedExcerpt: 'Raw source wording must not enter the saved report.',
    internalNotes: 'Reviewer only.',
    sourceId: 'source-internal-1',
    chunkId: 'chunk-internal-1',
    retrievalScore: 0.91,
    contentFingerprint: 'sha256:texture',
    classifierVersion: 'evidence-assist.rules.v1',
    ...overrides,
  };
}

function result(cards: EvidenceCard[]): EvidenceAssistResult {
  return {
    schemaVersion: 'evidence-assist.v1',
    queryContext: 'cheese texture validation',
    cards,
    rejectedSources: [],
    qcWarnings: [],
    metadata: {
      engineMode: 'enforce',
      retrievedCount: cards.length,
      acceptedCount: cards.length,
      generatedAt: '2026-08-13T12:00:00.000Z',
    },
  };
}

describe('report literature grounding', () => {
  beforeEach(() => fetchEvidenceAssist.mockReset());

  it('persists only report-safe guidance and minimal approved-source citations', () => {
    const grounding = buildReportGrounding(result([card()]));

    expect(grounding.status).toBe('included');
    expect(grounding.evidenceCards).toHaveLength(1);
    expect(grounding.evidenceCards[0]).toMatchObject({
      citationLabel: 'L1',
      claimPermission: 'context_only',
      safeReportLanguage: expect.stringMatching(/pilot scale/i),
    });
    expect(grounding.literatureCitations).toEqual([{
      id: 'L1',
      title: 'Texture review',
      excerpt: '',
      source: 'Approved NFI literature library',
      sourcePath: '/private/library/Texture_review.pdf',
    }]);
    expect(JSON.stringify(grounding.evidenceCards)).not.toMatch(/private\/library|retrievedExcerpt|internalNotes|source-internal|chunk-internal|Raw source wording/i);
    expect(JSON.stringify(grounding.literatureCitations)).not.toMatch(/retrievedExcerpt|internalNotes|source-internal|chunk-internal|Raw source wording/i);
  });

  it('excludes project records, product-specific permissions, and duplicate content', () => {
    const grounding = buildReportGrounding(result([
      card({ id: 'project-1', sourceType: 'project_evidence', claimPermission: 'product_specific' }),
      card({ id: 'unsafe-literature', claimPermission: 'product_specific', contentFingerprint: 'sha256:unsafe' }),
      card(),
      card({ id: 'duplicate', citationLabel: 'L2' }),
    ]));

    expect(grounding.evidenceCards.map(item => item.id)).toEqual(['ea-literature-1']);
    expect(grounding.metadata.acceptedCount).toBe(1);
  });

  it('returns a transparent no-match result when no approved guidance is eligible', () => {
    const grounding = buildReportGrounding(result([
      card({ sourceType: 'project_evidence', claimPermission: 'product_specific' }),
    ]));

    expect(grounding.status).toBe('no_match');
    expect(grounding.evidenceCards).toEqual([]);
    expect(grounding.literatureCitations).toEqual([]);
  });

  it('requests only bounded scientific, method, and validation guidance', async () => {
    fetchEvidenceAssist.mockResolvedValue(result([card()]));
    const controller = new AbortController();

    await fetchReportGrounding(coconutCheddarContext(), { signal: controller.signal });

    expect(fetchEvidenceAssist).toHaveBeenCalledWith(
      expect.objectContaining({
        productContext: expect.objectContaining({ intendedReportSection: 'commercialization_report' }),
        options: {
          maxCards: 3,
          minimumRelevance: 0.55,
          evidenceUses: ['scientific_context', 'method_guidance', 'validation_guidance'],
        },
      }),
      { signal: controller.signal, timeoutMs: 45_000 },
    );
  });
});
