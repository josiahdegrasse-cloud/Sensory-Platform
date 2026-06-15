import { describe, expect, it } from 'vitest';
import {
  buildCommercializationReportFilename,
  buildCommercializationReportPdf,
} from './commercialization-report-export';

describe('commercialization report filename', () => {
  it('builds a readable client, product, and decision filename', () => {
    expect(buildCommercializationReportFilename({
      clientName: 'New Food Innovation',
      productName: 'Coconut Cheddar v3.0',
      decision: 'GO',
      generatedAt: '2026-06-11T14:30:00.000Z',
      version: 1,
    })).toBe('new-food-innovation-coconut-cheddar-v3-commercialization-report-go-2026-06-11.pdf');
  });

  it('falls back to the food platform slug when no client name is available', () => {
    expect(buildCommercializationReportFilename({
      productName: 'Coconut Cheddar v3.0',
      decision: 'GO',
      generatedAt: '2026-06-11T14:30:00.000Z',
    })).toBe('food-platform-coconut-cheddar-v3-commercialization-report-go-2026-06-11.pdf');
  });

  it('retains meaningful later report revisions', () => {
    expect(buildCommercializationReportFilename({
      clientName: 'New Food Innovation',
      productName: 'Sample S4',
      decision: 'GO',
      generatedAt: new Date('2026-06-11T00:00:00.000Z'),
      version: 3,
    })).toBe('new-food-innovation-sample-s4-commercialization-report-go-2026-06-11-r3.pdf');
  });

  it('builds the complete nine-page commercialization readiness report', async () => {
    const { doc } = await buildCommercializationReportPdf({
      organizationName: 'New Food Innovation',
      workspaceName: 'Sensory Workspace',
      version: 2,
      status: 'review',
      snapshot: {
        product: { sampleId: 'sample-1', sampleName: 'Coconut Cheddar', foodType: 'Cheese' },
        decision: {
          recordId: 'decision-1',
          outcome: 'GO',
          issfScore: 82,
          confidence: 84,
          recommendation: 'Advance to buyer review.',
          dimensions: { hedonic: 84, texture: 78, cata: 81, emotional: 75 },
          prescriptions: [],
          methodVersion: 'issf-1.0',
          fingerprint: 'fingerprint-1',
        },
        concept: {
          id: 'concept-1',
          name: 'Everyday plant cheddar',
          description: 'A familiar everyday cheese alternative.',
          targetMarket: 'Flexitarian households',
          pricePoint: '$5.99',
          keyBenefits: 'Familiar flavor and versatile use',
          packagingImageId: null,
          packagingImageUrl: '',
        },
        evidence: {
          responseCount: 24,
          scaleMetrics: [],
          topSelections: [],
          comments: [],
          purchaseIntent: 6.8,
        },
        narrative: {
          executiveSummary: 'The tested product has a confirmed GO recommendation.',
          whyLiked: 'Panelists responded to the familiar flavor and texture.',
          packagingRationale: 'The selected direction communicates everyday versatility.',
          launchRecommendation: 'Advance the product and selected packaging to buyer review.',
          claimCaution: 'Treat panel findings as directional until broader validation is complete.',
        },
        generatedAt: '2026-06-11T14:30:00.000Z',
      },
    });

    expect(doc.getNumberOfPages()).toBe(9);
  });

  it('builds the editorial-sage masthead layout without error', async () => {
    const { doc } = await buildCommercializationReportPdf({
      organizationName: 'New Food Innovation',
      workspaceName: 'Sensory Workspace',
      version: 1,
      status: 'draft',
      reportTemplate: 'editorial-sage',
      snapshot: {
        product: { sampleId: 'sample-1', sampleName: 'Coconut Cheddar', foodType: 'Cheese' },
        decision: {
          recordId: 'decision-1',
          outcome: 'GO',
          issfScore: 82,
          confidence: 84,
          recommendation: 'Advance to buyer review.',
          dimensions: { hedonic: 84, texture: 78, cata: 81, emotional: 75 },
          prescriptions: [],
          methodVersion: 'issf-1.0',
          fingerprint: 'fingerprint-1',
        },
        concept: {
          id: 'concept-1',
          name: 'Everyday plant cheddar',
          description: 'A familiar everyday cheese alternative.',
          targetMarket: 'Flexitarian households',
          pricePoint: '$5.99',
          keyBenefits: 'Familiar flavor and versatile use',
          packagingImageId: null,
          packagingImageUrl: '',
        },
        evidence: {
          responseCount: 24,
          scaleMetrics: [],
          topSelections: [],
          comments: [],
          purchaseIntent: 6.8,
        },
        narrative: {
          executiveSummary: 'The tested product has a confirmed GO recommendation.',
          whyLiked: 'Panelists responded to the familiar flavor and texture.',
          packagingRationale: 'The selected direction communicates everyday versatility.',
          launchRecommendation: 'Advance the product and selected packaging to buyer review.',
          claimCaution: 'Treat panel findings as directional until broader validation is complete.',
        },
        generatedAt: '2026-06-11T14:30:00.000Z',
      },
    });

    expect(doc.getNumberOfPages()).toBe(9);
  });
});
