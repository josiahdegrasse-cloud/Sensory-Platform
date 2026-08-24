import { describe, expect, it } from 'vitest';
import { COCONUT_CHEDDAR_PROFILE } from '../data/coconut-cheddar-profile';
import { hashReportContext } from './report-agents/hash';
import {
  buildReportContextFromRecords,
  canMutateReportVersion,
} from './report-context-builder';
import {
  coconutCheddarAugmentation,
  coconutCheddarSnapshot,
} from './report-qc/fixtures';
import type { CommercializationReportSnapshot } from './commercialization-report';
import type {
  CommercializationReportRecord,
  DecisionRecord,
  WorkspaceSettings,
} from './database';
import type { EvidenceBundle } from './report-evidence-types';

function snapshot(
  overrides: Partial<CommercializationReportSnapshot> = {},
): CommercializationReportSnapshot {
  const base = coconutCheddarSnapshot();
  return {
    ...base,
    evidence: {
      responseCount: 42,
      purchaseIntent: 7.3,
      scaleMetrics: [{ question: 'Purchase intent', average: 7.3, count: 42 }],
      topSelections: [{ option: 'great cheddar cue', count: 31, percentage: 73.8 }],
      comments: ['Clear cheddar direction.'],
      ...(overrides.evidence ?? {}),
    },
    ...overrides,
  };
}

function decisionRecord(): DecisionRecord {
  return {
    id: '8a9dd594-626a-42ff-8cdf-3dc49166e150',
    timestamp: '2026-06-19T13:00:00.000Z',
    sampleId: 'S4',
    sampleName: 'Coconut Cheddar v3.0',
    decision: 'GO',
    issfScore: 76.7,
    confidence: 91,
    user: 'Admin',
    note: 'Advance to controlled commercialization preparation.',
    methodVersion: 'NFI-GST-1.1',
    decisionFingerprint: '699B8585',
  };
}

function report(
  reportSnapshot = snapshot(),
  overrides: Partial<CommercializationReportRecord> = {},
): CommercializationReportRecord {
  return {
    id: 'report-1',
    decisionRecordId: decisionRecord().id,
    conceptTestId: reportSnapshot.concept.id,
    packagingImageId: reportSnapshot.concept.packagingImageId,
    evidenceBundleId: 'bundle-1',
    status: 'draft',
    version: 3,
    title: 'Coconut Cheddar commercialization report',
    reportSnapshot: reportSnapshot as unknown as Record<string, unknown>,
    createdBy: 'user-1',
    approvedBy: null,
    approvedAt: null,
    createdAt: '2026-06-19T13:05:00.000Z',
    updatedAt: '2026-06-19T13:05:00.000Z',
    ...overrides,
  };
}

function liveProfile() {
  return {
    ...COCONUT_CHEDDAR_PROFILE,
    evidenceStatus: 'live' as const,
    evidenceLabel: 'Live linked client sensory and concept records.',
    conceptHypothesis: {
      ...COCONUT_CHEDDAR_PROFILE.conceptHypothesis,
      priceHypothesis: 'Hypothesis source pending; validate target price acceptance before external use.',
    },
  };
}

function evidenceBundle(panelSize = 14, useReferenceEvidence = false): EvidenceBundle {
  const augmentation = coconutCheddarAugmentation();
  const sourceEvidenceIds = augmentation.sourceEvidenceIds;
  return {
    id: 'bundle-1',
    projectId: 'S4',
    version: 1,
    schemaVersion: '1.0',
    generatedAt: '2026-06-19T13:02:00.000Z',
    sourceDataVersion: `responses-${panelSize}`,
    sampleSummaries: [{
      sampleId: 'S4',
      sampleName: 'Coconut Cheddar v3.0',
      decision: 'GO',
      issfScore: 76.7,
      confidenceScore: 91,
      riskLevel: 'medium',
      methodVersion: 'NFI-GST-1.1',
      decisionFingerprint: '699B8585',
    }],
    categoryResults: [],
    criticalAttributeResults: [],
    evidence: sourceEvidenceIds.map(id => ({
      id,
      evidenceType: 'metric',
      title: id,
      description: 'Linked source metric.',
      sourceType: 'sensory',
      sourceId: 'S4',
      sampleId: 'S4',
      confidence: 0.91,
      isCritical: id.endsWith('.decision'),
    })),
    missingData: [],
    qualityWarnings: [],
    deterministicCandidateDecision: 'GO',
    deterministicConfidence: 'high',
    decisionReasons: ['Sensory evidence supports continued development.'],
    createdBy: 'user-1',
    sensoryProfile: {
      panelSize,
      descriptors: augmentation.sensoryDescriptors.map(item => ({
        descriptor: item.descriptor,
        count: item.count,
      })),
      dimensionMeasures: Object.fromEntries(
        Object.entries(augmentation.dimensions).map(([key, value]) => [key, value?.measures ?? []]),
      ),
      intensity: augmentation.intensity ?? {},
      foodTypeSlug: 'cheese',
      instrumentSignal: augmentation.instrumentSignal ?? 72.3,
      gatePenalty: augmentation.gatePenalty ?? 0,
      instrumentalFindings: augmentation.instrumentalFindings ?? [],
      confidenceCalculation: augmentation.confidenceCalculation ?? [],
    },
    commercialProfile: useReferenceEvidence ? COCONUT_CHEDDAR_PROFILE : liveProfile(),
  };
}

const settings = {
  organizationName: 'NFI',
  workspaceName: 'Sensory Lab',
  adminContactEmail: '',
  defaultTimezone: 'America/New_York',
  dataRetentionMonths: 24,
  requirePanelistConsent: true,
  allowSelfSignup: true,
  defaultPanelSize: 24,
  requireHedonicSection: true,
  requireIntensitySection: true,
  requireEmotionSection: true,
  allowPanelistComments: true,
  requireAllSamplesBeforeSubmit: true,
  autoCreateFoodTypes: true,
  autoCreateSurveysFromImports: true,
  requireImportReview: false,
  duplicateSamplePolicy: 'skip',
  requirePanelistId: false,
  allowPanelistsViewHistory: true,
  inactivePanelistDays: 90,
  demoModeEnabled: false,
  conceptImageGenerationEnabled: true,
  conceptMaxGenerationsPerConcept: 5,
  conceptMonthlyBudgetCents: 5000,
  conceptRequireApproval: true,
  decisionGoThreshold: 75,
  decisionStopThreshold: 45,
  decisionMinResponses: 12,
  decisionLockConfirmed: true,
  anonymizePanelistsInReports: true,
  exportFormat: 'pdf',
  reportFooter: 'Confidential',
  reportTone: 'standard',
  defaultReportTitle: 'Report',
  logoUrl: null,
  primaryColor: '#0f172a',
  accentColor: '#14b8a6',
  reportTemplate: 'standard',
  notifyOnImport: false,
  notifyOnCompletionTarget: false,
  notifyOnGenerationFailure: false,
  updatedAt: null,
} satisfies WorkspaceSettings;

describe('report context builder', () => {
  it('rebuilds a saved report context suitable for library PDF export when context is complete', async () => {
    const result = await buildReportContextFromRecords({
      report: report(),
      decisionRecord: decisionRecord(),
      evidenceBundle: evidenceBundle(),
      evidenceBundleStatus: 'linked',
      settings,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected valid report context');
    expect(result.pdfInput.reportContext.sampleId).toBe('S4');
    expect(result.readiness.exportReady).toBe(true);
    expect(result.readiness.evidenceProvenance.sensory).toBe('live');
  });

  it('returns structured blockers instead of throwing when saved report context is missing', async () => {
    const result = await buildReportContextFromRecords({
      report: report(),
      decisionRecord: decisionRecord(),
      evidenceBundle: null,
      evidenceBundleStatus: 'missing',
      settings,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected missing context blockers');
    expect(result.readiness.exportReady).toBe(false);
    expect(result.blockers[0]).toMatch(/evidence bundle is missing/i);
  });

  it('reports readiness blockers for missing concept evidence', async () => {
    const result = await buildReportContextFromRecords({
      report: report(snapshot({ evidence: { ...snapshot().evidence, responseCount: 0, purchaseIntent: null } })),
      decisionRecord: decisionRecord(),
      evidenceBundle: evidenceBundle(),
      evidenceBundleStatus: 'linked',
      settings,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected rebuilt context');
    expect(result.readiness.approvalReady).toBe(false);
    expect(result.readiness.conceptStatus).toMatch(/missing concept evidence/i);
    expect(result.readiness.approvalBlockers.join(' ')).toMatch(/concept-test responses/i);
  });

  it('changes the ReportContext hash when the sensory response count changes', async () => {
    const first = await buildReportContextFromRecords({
      report: report(),
      decisionRecord: decisionRecord(),
      evidenceBundle: evidenceBundle(14),
      evidenceBundleStatus: 'linked',
      settings,
    });
    const second = await buildReportContextFromRecords({
      report: report(),
      decisionRecord: decisionRecord(),
      evidenceBundle: evidenceBundle(15),
      evidenceBundleStatus: 'linked',
      settings,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('expected rebuilt contexts');
    await expect(hashReportContext(first.reportContext)).resolves.not.toBe(await hashReportContext(second.reportContext));
  });

  it('blocks approval when sensory evidence is reference/demo provenance', async () => {
    const result = await buildReportContextFromRecords({
      report: report(snapshot(), { status: 'approved' }),
      decisionRecord: decisionRecord(),
      evidenceBundle: evidenceBundle(14, true),
      evidenceBundleStatus: 'linked',
      settings,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected rebuilt context');
    expect(result.readiness.approvalReady).toBe(false);
    expect(result.readiness.evidenceProvenance.sensory).toBe('reference');
    expect(result.readiness.approvalBlockers.join(' ')).toMatch(/reference\/demo/i);
  });

  it('does not allow approved report versions to be mutated', () => {
    expect(canMutateReportVersion(report(snapshot(), { status: 'draft' }))).toBe(true);
    expect(canMutateReportVersion(report(snapshot(), { status: 'approved' }))).toBe(false);
  });
});
