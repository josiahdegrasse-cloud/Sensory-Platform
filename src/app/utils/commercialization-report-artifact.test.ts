import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCommercializationReportPdf } from './commercialization-report-export';
import { evaluateCommercializationReport } from './commercialization-report-quality';
import type { CommercializationReportPdfInput } from './pdf/sections';

function asDataUrl(filePath: string, mimeType: string) {
  return `data:${mimeType};base64,${readFileSync(filePath).toString('base64')}`;
}

function sampleInput(): CommercializationReportPdfInput {
  const repoRoot = process.cwd();
  return {
    organizationName: 'New Food Innovation',
    workspaceName: 'Commercial Readiness Lab',
    version: 3,
    status: 'review',
    reportTemplate: 'editorial-sage',
    primaryColor: '#2a3530',
    accentColor: '#7c9a89',
    logoUrl: asDataUrl(path.join(repoRoot, 'public/new_foodinnovation_ltd_logo.jpg'), 'image/jpeg'),
    snapshot: {
      product: {
        sampleId: 'sample-coconut-cheddar-v3',
        sampleName: 'Coconut Cheddar v3',
        foodType: 'Plant-based cheese',
      },
      decision: {
        recordId: 'decision-cc-v3-20260611',
        outcome: 'GO',
        issfScore: 82.4,
        confidence: 86,
        recommendation: 'Advance to controlled pilot scale and buyer preparation.',
        dimensions: { hedonic: 84, texture: 68, cata: 81, emotional: 77 },
        prescriptions: [{
          priority: 1,
          target: 'Texture resilience',
          action: 'Reduce late-stage gumminess and confirm melt performance after pilot-scale processing.',
          expectedLift: 7,
        }],
        gates: [
          { id: 'off-note', label: 'Off-note control', status: 'pass', detail: 'No material off-note gate remains open.', impact: 0 },
          { id: 'qc', label: 'Instrument quality control', status: 'pass', detail: 'Instrument recovery is inside the method range.', impact: 0 },
        ],
        methodVersion: 'NFI-GST-1.1',
        fingerprint: 'nfi-cc-v3-82.4-go-6f17e9',
      },
      concept: {
        id: 'concept-everyday-melt',
        name: 'Everyday Melt',
        description: 'A familiar, versatile plant-based cheddar for weekday sandwiches, burgers, and cooking.',
        targetMarket: 'Flexitarian households seeking an easy dairy swap without sacrificing familiar flavor',
        pricePoint: '$5.99 per 7 oz pack',
        keyBenefits: 'Familiar cheddar flavor, dependable melt, and everyday versatility',
        packagingImageId: 'visual-everyday-melt-01',
        packagingImageUrl: asDataUrl(path.join(repoRoot, 'tests/artifacts/commercialization-report/everyday-melt-concept.png'), 'image/png'),
        packagingImageMode: 'packaging',
        packagingImagePromptStyle: 'premium-natural',
        packagingImageAiGenerated: true,
      },
      evidence: {
        responseCount: 24,
        scaleMetrics: [
          { question: 'Overall concept appeal', average: 7.2, count: 24 },
          { question: 'Fit with household needs', average: 6.9, count: 24 },
        ],
        topSelections: [
          { option: 'creamy', count: 17, percentage: 70.8 },
          { option: 'familiar cheddar', count: 15, percentage: 62.5 },
          { option: 'versatile', count: 13, percentage: 54.2 },
        ],
        comments: ['Feels easy to use every day.', 'The melt claim needs to be believable.'],
        purchaseIntent: 6.8,
      },
      narrative: {
        executiveSummary: 'Coconut Cheddar v3 has a confirmed GO recommendation.',
        whyLiked: 'creamy texture, familiar cheddar character, and versatile everyday use.',
        packagingRationale: 'Use a clean, premium-natural pack with an appetizing melted-use cue and clear everyday versatility.',
        launchRecommendation: 'Advance Coconut Cheddar v3 into pilot-scale confirmation, packaging refinement, and a targeted buyer review.',
        claimCaution: 'Validate all external claims before use.',
      },
      generatedAt: '2026-06-12T16:00:00.000Z',
    },
  };
}

describe('commercialization report quality evaluation', () => {
  it('generates and evaluates a sample PDF', async () => {
    const iteration = process.env.REPORT_ITERATION || '1';
    const input = sampleInput();
    const { doc } = await buildCommercializationReportPdf(input);
    const evaluation = evaluateCommercializationReport(doc, input);

    if (process.env.GENERATE_REPORT_ARTIFACTS === '1') {
      const outputDir = path.join(process.cwd(), 'tests/artifacts/commercialization-report');
      mkdirSync(outputDir, { recursive: true });
      const pdfPath = path.join(outputDir, `commercialization-readiness-iteration-${iteration}.pdf`);
      const evaluationPath = path.join(outputDir, `commercialization-readiness-iteration-${iteration}.json`);
      writeFileSync(pdfPath, Buffer.from(doc.output('arraybuffer')));
      writeFileSync(evaluationPath, `${JSON.stringify({
        iteration: Number(iteration),
        generatedAt: new Date().toISOString(),
        pdf: path.basename(pdfPath),
        scores: evaluation.scores,
        checks: evaluation.checks,
        pageWordCounts: evaluation.pageWordCounts,
        weaknesses: evaluation.weaknesses,
        passed: evaluation.passed,
      }, null, 2)}\n`);
    }

    expect(doc.getNumberOfPages()).toBe(8);
    expect(evaluation.weaknesses).toEqual([]);
    expect(evaluation.passed).toBe(true);
  });
});
