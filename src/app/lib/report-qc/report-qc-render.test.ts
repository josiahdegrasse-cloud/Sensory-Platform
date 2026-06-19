import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCommercializationReportPdf } from '../../utils/commercialization-report-export';
import type { CommercializationReportPdfInput } from '../../utils/pdf/sections';
import { buildReportContext } from './context';
import { coconutCheddarAugmentation, coconutCheddarDecision, coconutCheddarSnapshot } from './fixtures';
import { COCONUT_CHEDDAR_PROFILE } from '../../data/coconut-cheddar-profile';

function renderInput(): CommercializationReportPdfInput {
  // Use a snapshot without a binary image so the test renders headless.
  const snapshot = coconutCheddarSnapshot({
    concept: { ...coconutCheddarSnapshot().concept, packagingImageUrl: '', packagingImageAiGenerated: false },
  });
  const reportContext = buildReportContext({
    snapshot,
    decision: coconutCheddarDecision(),
    approvalStatus: 'draft',
    reportVersion: 5,
    readinessThreshold: 60,
    augmentation: coconutCheddarAugmentation(),
    commercialProfile: COCONUT_CHEDDAR_PROFILE,
  });
  return {
    organizationName: 'New Food Innovation',
    workspaceName: 'Commercial Readiness Lab',
    version: 5,
    status: 'draft',
    reportTemplate: 'editorial-sage',
    primaryColor: '#2a3530',
    accentColor: '#7c9a89',
    snapshot,
    reportContext,
  };
}

describe('report-qc: stage-aware PDF render', () => {
  it('renders the conditional headline, real dashboard evidence, and a passing QC report', async () => {
    const input = renderInput();
    const { doc, qc } = await buildCommercializationReportPdf(input);

    expect(doc.getNumberOfPages()).toBe(9);
    expect(qc).toBeDefined();
    expect(qc!.exportAllowed).toBe(true);
    expect(qc!.qualityReport.reportStage).toBe('conditional_advancement');
    expect(qc!.qualityReport.launchAuthorization).toBe('not_approved');
    expect(qc!.qualityReport.totalScore).toBeGreaterThanOrEqual(97);
    // Draft is never client-ready.
    expect(qc!.qualityReport.clientReady).toBe(false);
    expect(qc!.missingEvidence.some(m => /n=0/.test(m))).toBe(true);

    if (process.env.GENERATE_REPORT_ARTIFACTS === '1') {
      const outDir = path.join(process.cwd(), 'tests/artifacts/report-qc');
      mkdirSync(outDir, { recursive: true });
      writeFileSync(path.join(outDir, 'coconut-cheddar-conditional.pdf'), Buffer.from(doc.output('arraybuffer')));
      writeFileSync(
        path.join(outDir, 'coconut-cheddar-quality-report.json'),
        `${JSON.stringify(qc!.qualityReport, null, 2)}\n`,
      );
    }
  });
});
