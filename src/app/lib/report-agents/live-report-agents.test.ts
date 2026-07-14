import { describe, expect, it } from 'vitest';
import { coconutCheddarContext, coconutCheddarSnapshot } from '../report-qc/fixtures';
import { createMeteredReportAgentRunner } from './api';
import { hasGeneratedReportDraft, runCommercializationReportOrchestrator } from './agent-orchestrator';
import { buildGeneratedReportSections } from '../../utils/commercialization-report-export';

describe.runIf(process.env.RUN_LIVE_REPORT_AGENTS === '1')('live local report agents', () => {
  it('completes the unified specialist workflow and produces a document', async () => {
    const metered = createMeteredReportAgentRunner();
    const context = coconutCheddarContext();
    const snapshot = coconutCheddarSnapshot();
    const reportInput = {
      snapshot: {
        ...snapshot,
        concept: { ...snapshot.concept, packagingImageUrl: '' },
      },
      organizationName: 'New Food Innovation',
      workspaceName: 'Commercial Readiness Lab',
      version: 1,
      status: 'draft',
      reportContext: context,
    };
    const result = await runCommercializationReportOrchestrator({
      mode: 'full_release_review',
      reportInput,
      runner: metered.runner,
      render: async ({ draft }) => ({
        generatedSections: buildGeneratedReportSections(reportInput),
        writtenReport: draft,
        finalPdfText: draft.pages.map(page => page.sections.map(section => section.body).join(' ')).join('\n'),
        renderedPages: [{
          page: 1,
          imageUrl: 'data:image/jpeg;base64,',
          width: 595,
          height: 842,
          text: 'Reference / demonstration evidence',
          minimumFontSizePt: 8,
          contrastFailures: [],
          warningRequired: true,
          warningVisible: true,
        }],
      }),
    });

    const writer = metered.usage.find(item => item.role === 'professional_report_writer');
    expect(writer).toBeDefined();
    expect(hasGeneratedReportDraft(result)).toBe(true);
  }, 300_000);
});
