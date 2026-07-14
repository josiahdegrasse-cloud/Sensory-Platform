import { describe, expect, it } from 'vitest';
import { assessSampleWorkflow, findDataIntegrityIssues, summarizeProjectReadiness } from './workflow-readiness';

const sample = {
  sampleId: 'M1',
  sampleName: 'Burger V1',
  type: 'meat',
  sourness: 1,
  bitterness: 2,
  saltiness: 3,
  umami: 4,
  sweetness: 1,
};

describe('workflow readiness', () => {
  it('explains every prerequisite blocking a decision', () => {
    const readiness = assessSampleWorkflow({
      sample,
      responseCount: 0,
      minimumResponses: 12,
      hasGcms: false,
      hasComposition: false,
    });

    expect(readiness.decisionReady).toBe(false);
    expect(readiness.blockers).toContain('Create a questionnaire for this sample.');
    expect(readiness.stages.find(stage => stage.id === 'questionnaire')?.state).toBe('current');
  });

  it('marks a fully assigned and completed sample ready', () => {
    const readiness = assessSampleWorkflow({
      sample,
      product: {
        id: 'product-1',
        name: 'Burger V1',
        category: 'Meat',
        status: 'active',
        customAttributes: [],
        assignedPanelistIds: ['panelist-1'],
        createdDate: '2026-06-06',
      },
      responseCount: 12,
      minimumResponses: 12,
      hasGcms: true,
      hasComposition: true,
    });

    expect(readiness.decisionReady).toBe(true);
    expect(readiness.stages.every(stage => stage.state === 'complete')).toBe(true);
  });

  it('treats an open product survey as assigned under legacy product semantics', () => {
    const readiness = assessSampleWorkflow({
      sample,
      product: {
        id: 'product-open',
        name: 'Open Burger Survey',
        category: 'Meat',
        status: 'active',
        customAttributes: [],
        assignedPanelistIds: [],
        createdDate: '2026-06-06',
      },
      responseCount: 0,
      minimumResponses: 12,
      hasGcms: true,
      hasComposition: true,
    });

    expect(readiness.blockers).not.toContain('Assign the questionnaire to panelists.');
    expect(readiness.stages.find(stage => stage.id === 'assignment')).toMatchObject({
      state: 'complete',
      detail: 'Open to all active panelists.',
    });
  });

  it('detects duplicate samples and orphaned surveys', () => {
    const issues = findDataIntegrityIssues({
      dataset: { eTongueData: [sample, sample], gcmsData: {}, compositionData: {} },
      products: [{
        id: 'product-2',
        name: 'Missing sample',
        category: 'Meat',
        status: 'active',
        customAttributes: [],
        sourceSampleId: 'M9',
        createdDate: '2026-06-06',
      }],
      importBatches: [],
    });

    expect(issues.some(issue => issue.id === 'duplicate:M1')).toBe(true);
    expect(issues.some(issue => issue.id === 'orphan-survey:product-2')).toBe(true);
  });

  it('reports no-samples when the project has nothing imported yet', () => {
    expect(summarizeProjectReadiness([]).stage).toBe('no-samples');
  });

  it('reports no-questionnaires until every sample has a product — this is the exact regression that motivated the rollup: a project can have real questionnaires and zero responses, which must read as "waiting", not "nothing created yet"', () => {
    const noProduct = assessSampleWorkflow({ sample, responseCount: 0, minimumResponses: 12, hasGcms: false, hasComposition: false });
    expect(summarizeProjectReadiness([noProduct]).stage).toBe('no-questionnaires');
  });

  it('reports awaiting-responses once every sample has a questionnaire but none have cleared the threshold', () => {
    const product = {
      id: 'product-1', name: 'Burger V1', category: 'Meat', status: 'active' as const,
      customAttributes: [], assignedPanelistIds: [], createdDate: '2026-06-06',
    };
    const zeroResponses = assessSampleWorkflow({ sample, product, responseCount: 0, minimumResponses: 12, hasGcms: false, hasComposition: false });
    const someResponses = assessSampleWorkflow({ sample, product, responseCount: 5, minimumResponses: 12, hasGcms: false, hasComposition: false });
    const summary = summarizeProjectReadiness([zeroResponses, someResponses]);
    expect(summary.stage).toBe('awaiting-responses');
    expect(summary.withQuestionnaire).toBe(2);
    expect(summary.totalResponses).toBe(5);
    expect(summary.readyCount).toBe(0);
  });

  it('reports ready as soon as at least one sample clears the threshold', () => {
    const product = {
      id: 'product-1', name: 'Burger V1', category: 'Meat', status: 'active' as const,
      customAttributes: [], assignedPanelistIds: [], createdDate: '2026-06-06',
    };
    const ready = assessSampleWorkflow({ sample, product, responseCount: 12, minimumResponses: 12, hasGcms: true, hasComposition: true });
    const notReady = assessSampleWorkflow({ sample, product, responseCount: 3, minimumResponses: 12, hasGcms: false, hasComposition: false });
    const summary = summarizeProjectReadiness([ready, notReady]);
    expect(summary.stage).toBe('ready');
    expect(summary.readyCount).toBe(1);
    expect(summary.totalResponses).toBe(15);
  });

  it('checks a large import without producing false integrity errors', () => {
    const largeDataset = Array.from({ length: 5_000 }, (_, index) => ({
      ...sample,
      sampleId: `M${index + 1}`,
      sampleName: `Burger ${index + 1}`,
    }));

    expect(findDataIntegrityIssues({
      dataset: { eTongueData: largeDataset, gcmsData: {}, compositionData: {} },
      products: [],
      importBatches: [],
    })).toEqual([]);
  });
});
