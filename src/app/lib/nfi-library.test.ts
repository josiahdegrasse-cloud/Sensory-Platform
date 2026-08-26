import { describe, expect, it } from 'vitest';
import { applyLibraryReviewToDocuments, type LibraryDocument } from './nfi-library';

function document(documentId: string): LibraryDocument {
  return {
    documentId,
    filename: `${documentId}.pdf`,
    title: documentId,
    pageCount: 1,
    charCount: 100,
    textQuality: 'good',
    status: 'indexed',
    duplicateOf: '',
    topicTags: [],
    methodTags: [],
    evidenceType: 'primary',
    warnings: [],
    reviewStatus: 'pending',
    peerReviewStatus: 'unknown',
    licenseStatus: 'unknown',
    reviewedBy: '',
    reviewedAt: '',
    lastCheckedAt: '',
    reviewNotes: '',
  };
}

describe('applyLibraryReviewToDocuments', () => {
  it('updates a single cached source immediately without changing other papers', () => {
    const current = { documents: [document('paper-1'), document('paper-2')] };
    const next = applyLibraryReviewToDocuments(current, {
      documentId: 'paper-1',
      reviewStatus: 'approved',
      peerReviewStatus: 'peer_reviewed',
      licenseStatus: 'cleared',
      notes: 'Checked by NFI.',
    });

    expect(next.documents[0]).toMatchObject({
      reviewStatus: 'approved',
      peerReviewStatus: 'peer_reviewed',
      licenseStatus: 'cleared',
      reviewBasis: 'individual_review',
      reviewNotes: 'Checked by NFI.',
    });
    expect(next.documents[1]).toEqual(current.documents[1]);
  });

  it('updates only the selected papers during a bulk review', () => {
    const current = { documents: [document('paper-1'), document('paper-2'), document('paper-3')] };
    const next = applyLibraryReviewToDocuments(current, {
      documentIds: ['paper-1', 'paper-3'],
      reviewStatus: 'rejected',
      peerReviewStatus: 'unknown',
      licenseStatus: 'restricted',
    });

    expect(next.documents.map(item => item.reviewStatus)).toEqual(['rejected', 'pending', 'rejected']);
    expect(next.documents[0].reviewBasis).toBe('bulk_review');
    expect(next.documents[2].licenseStatus).toBe('restricted');
  });
});
