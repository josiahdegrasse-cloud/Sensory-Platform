import { describe, expect, it } from 'vitest';
import { coconutCheddarSnapshot } from '../../lib/report-qc/fixtures';
import {
  buildCommercialInsights,
  buildClaimsMatrix,
  buildCommercializationPlan,
  buildConsumerEvidence,
  buildConceptPackaging,
  buildCommercialReadiness,
  buildDecisionSnapshot,
  buildProductReadiness,
  buildRisks,
  buildScientificContext,
  type CommercializationReportPdfInput,
} from './sections';

function inputWith(overrides: Parameters<typeof coconutCheddarSnapshot>[0]): CommercializationReportPdfInput {
  return {
    snapshot: coconutCheddarSnapshot(overrides),
    organizationName: 'New Food Innovation',
    workspaceName: 'Sensory Workspace',
    version: 1,
    status: 'draft',
  };
}

describe('commercialization report section safety', () => {
  it('does not interpret concept descriptors from one response', () => {
    const input = inputWith({
      evidence: {
        responseCount: 1,
        scaleMetrics: [],
        topSelections: [{ option: '$5-$8', count: 1, percentage: 100 }, { option: 'Texture', count: 1, percentage: 100 }],
        comments: [],
        purchaseIntent: 6,
      },
    });

    const result = buildCommercialInsights(input);
    const conceptInsight = result.insights.find(item => /not yet interpretable/i.test(item.title));

    expect(conceptInsight).toBeTruthy();
    expect(conceptInsight!.evidence).not.toContain('$5-$8');
    expect(conceptInsight!.commercialMeaning).toMatch(/do not use/i);
  });

  it('keeps saved narrative and literature passages out of deterministic client sections', () => {
    const excerpt = 'Most likely due to their high oil content. Therefore, we decided not to include these products in the experiment.';
    const input = inputWith({
      narrative: {
        ...coconutCheddarSnapshot().narrative,
        launchRecommendation: `Advance to pilot review. ${excerpt}`,
        packagingRationale: `Use the selected pack direction. ${excerpt}`,
      },
      literatureCitations: [{ id: 'L1', title: 'Source paper', excerpt, source: 'source.pdf' }],
    });

    expect(buildDecisionSnapshot(input).nextAction).not.toContain(excerpt);
    expect(buildDecisionSnapshot(input).nextAction).not.toContain('Advance to pilot review');
    expect(buildConceptPackaging(input).packagingDirection).not.toContain(excerpt);
    expect(buildConceptPackaging(input).packagingDirection).not.toContain('Use the selected pack direction');
    expect(input.snapshot.literatureCitations).toHaveLength(1);
    const scientific = buildScientificContext(input);
    expect(scientific.sources).toEqual([{
      id: 'L1',
      title: 'Source paper',
      authors: 'Not captured',
      studyType: 'Study type not captured',
      year: 'Not captured',
      doi: 'Not captured',
      evidenceRole: 'Method context',
    }]);
    expect(scientific.guidance).toEqual([{
      title: 'Method context for the next round',
      guidance: 'Use this source to shape the next validation round; it provides methodological context and is not product-specific proof.',
      citationIds: ['L1'],
    }]);
    expect(JSON.stringify(scientific)).not.toContain('source.pdf');
  });

  it('turns verified literature into cited guidance without exposing RAG storage metadata', () => {
    const input = inputWith({
      literatureCitations: [{
        id: 'L1',
        title: 'Sensory Evaluation Practices in Plant-Based Cheese (1).pdf',
        source: 'nfi_publications/sensory_rag_bulk_pack__07_open_text.txt',
        excerpt: 'Methodological flaws include small sample sizes and incomplete reporting of panel design.',
      }],
    });

    const scientific = buildScientificContext(input);

    expect(scientific.guidance[0]).toEqual({
      title: 'Study design and reporting',
      guidance: 'Document sample size, panel composition, and the sensory method before comparing results across studies.',
      citationIds: ['L1'],
    });
    expect(scientific.sources).toEqual([{
      id: 'L1',
      title: 'Sensory Evaluation Practices in Plant-Based Cheese',
      authors: 'Not captured',
      studyType: 'Study type not captured',
      year: 'Not captured',
      doi: 'Not captured',
      evidenceRole: 'Method context',
    }]);
    expect(JSON.stringify(scientific)).not.toMatch(/nfi_publications|sensory_rag_bulk_pack|\.pdf|\.txt/i);
  });

  it('discloses missing instrumental evidence and preserves real concept counts', () => {
    const input = inputWith({
      evidence: {
        responseCount: 12,
        scaleMetrics: [{ question: 'Concept appeal', average: 6.4, count: 12 }],
        topSelections: [{ option: 'Creamy', count: 8, percentage: 66.7 }],
        comments: ['Easy to understand.'],
        purchaseIntent: 6.1,
      },
    });

    const scientific = buildScientificContext(input);
    const consumer = buildConsumerEvidence(input);

    expect(scientific.instrumentalAvailable).toBe(false);
    expect(scientific.findings).toEqual([]);
    expect(consumer.responseCount).toBe(12);
    expect(consumer.descriptors).toEqual([{ label: 'Creamy', count: 8, percentage: 66.7 }]);
    expect(consumer.boundary).toMatch(/12 panelist responses/i);
  });

  it('separates a Cashew Cream Cheese product GO from directional claims evidence', () => {
    const input = inputWith({
      product: { sampleId: 'S2', sampleName: 'Cashew Cream Cheese v2.0', foodType: 'Plant-based soft cheese' },
      decision: {
        ...coconutCheddarSnapshot().decision,
        outcome: 'GO',
        issfScore: 78.7,
        confidence: 92,
        dimensions: { hedonic: 78, texture: 76, cata: 84, emotional: 71 },
        gates: [{ id: 'off-note', label: 'Off-note', status: 'pass', detail: 'No critical off-note.', impact: 0 }],
      },
      concept: {
        ...coconutCheddarSnapshot().concept,
        name: 'Cashew Cream Cheese v2.0',
        targetMarket: 'Shoppers who value the sensory strengths validated in screening.',
        pricePoint: '',
      },
      evidence: {
        responseCount: 1,
        scaleMetrics: [],
        topSelections: [],
        comments: [],
        purchaseIntent: 7,
      },
    });

    const decision = buildDecisionSnapshot(input);
    const concept = buildConceptPackaging(input);
    const plan = buildCommercializationPlan(input);
    const risks = buildRisks(input);
    const claims = buildClaimsMatrix(input);
    const productReadiness = buildProductReadiness(input);
    const commercialReadiness = buildCommercialReadiness(input);

    expect(decision.reportTitle).toBe('PRODUCT DECISION: GO');
    expect(decision.category).toBe('Plant-based cream cheese');
    expect(decision.readinessStage).toBe('Approved for launch preparation · claims evidence limited');
    expect(decision.decisionSubheading).not.toMatch(/not approval to launch|continue validation/i);
    expect(decision.conceptEvidence).toBe('n=1 · directional only');
    expect(concept.positioning).toContain('a cashew-based soft cream cheese alternative');
    expect(concept.targetConsumer).toContain('Flexitarian and plant-curious');
    expect(concept.usageOccasion).toContain('Bagels, crackers, dips, sandwiches');
    expect(concept.productPromise).toBe('Smooth, creamy, familiar plant-based cream cheese.');
    expect(plan.rows.map(row => row.workstream)).toEqual([
      'Pilot manufacturing, product confirmation, and shelf life',
      'Consumer, competition, price, and commercial economics',
      'Packaging, regulatory, claims, and launch approval',
    ]);
    expect(plan.rows.every(row => !/not assigned|readiness gap/i.test(row.owner))).toBe(true);
    expect(plan.rows.every(row => row.owner === 'To assign')).toBe(true);
    expect(claims.rows.slice(0, 2).every(row => row.scope === 'Internal decision statement')).toBe(true);
    expect(claims.rows.slice(2).every(row => row.scope === 'External claim')).toBe(true);
    expect(risks.notPermitted).toEqual([
      'Consumer preference',
      'Purchase demand',
      'Price acceptance',
      'Representative market response',
      'Packaging preference',
      'Validated purchase intent',
    ]);
    expect(risks.rows[0].category).toBe('Product risk');
    expect(risks.rows[0].risk).not.toMatch(/concept|response/i);
    expect(productReadiness.rows.map(row => row.area)).toEqual([
      'Sensory performance',
      'Instrumental confirmation',
      'Pilot manufacturing',
      'Shelf life and food safety',
      'Packaging compatibility',
      'Regulatory, labeling, and nutrition',
    ]);
    expect(commercialReadiness.rows.map(row => row.area)).toContain('Unit economics');
    expect(commercialReadiness.rows.map(row => row.area)).toContain('Channel and buyer strategy');
    expect(commercialReadiness.rows.find(row => row.area === 'Target-consumer validation')?.status).toBe('Requires validation');
    expect(commercialReadiness.rows.find(row => row.area === 'Demand and launch forecast')?.status).toBe('Evidence gap');
    expect(productReadiness.rows.find(row => row.area === 'Shelf life and food safety')?.status).toBe('Evidence gap');
    expect([...productReadiness.rows, ...commercialReadiness.rows].map(row => row.status)).not.toContain('Not assessed');
  });
});
