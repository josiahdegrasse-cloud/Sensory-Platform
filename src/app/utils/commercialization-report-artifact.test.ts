import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { coconutCheddarContext } from '../lib/report-qc/fixtures';
import { buildCommercializationReportPdf, normalizeClientFacingNumbers } from './commercialization-report-export';
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
      panelDemographics: {
        participantCount: 24,
        matchedProfileCount: 22,
        profileCoveragePercentage: 91.7,
        minimumCellSize: 3,
        dimensions: [
          { key: 'age', label: 'Age', knownCount: 22, groups: [{ label: '25-34', count: 9, percentage: 40.9 }, { label: '35-44', count: 8, percentage: 36.4 }, { label: '45-54', count: 5, percentage: 22.7 }], suppressedCount: 0 },
          { key: 'gender', label: 'Gender', knownCount: 22, groups: [{ label: 'Female', count: 13, percentage: 59.1 }, { label: 'Male', count: 7, percentage: 31.8 }], suppressedCount: 2 },
          { key: 'region', label: 'Region', knownCount: 21, groups: [{ label: 'London', count: 8, percentage: 38.1 }, { label: 'South East', count: 7, percentage: 33.3 }, { label: 'Midlands', count: 4, percentage: 19 }], suppressedCount: 2 },
          { key: 'ethnicity', label: 'Ethnic group', knownCount: 21, groups: [{ label: 'White', count: 12, percentage: 57.1 }, { label: 'Asian or Asian British', count: 5, percentage: 23.8 }, { label: 'Mixed or Multiple ethnic groups', count: 3, percentage: 14.3 }], suppressedCount: 1 },
          { key: 'dietary', label: 'Dietary pattern', knownCount: 22, groups: [{ label: 'Flexitarian', count: 14, percentage: 63.6 }, { label: 'Vegetarian', count: 5, percentage: 22.7 }, { label: 'Vegan', count: 3, percentage: 13.6 }], suppressedCount: 0 },
          { key: 'grocery_role', label: 'Grocery role', knownCount: 22, groups: [{ label: 'Main shopper', count: 15, percentage: 68.2 }, { label: 'Shared shopper', count: 7, percentage: 31.8 }], suppressedCount: 0 },
        ],
        representativenessNote: 'Profiles cover 92% of concept respondents. This is an unweighted descriptive profile, not proof that the panel represents the target market.',
      },
      narrative: {
        executiveSummary: 'Coconut Cheddar v3 has a confirmed GO recommendation.',
        whyLiked: 'creamy texture, familiar cheddar character, and versatile everyday use.',
        packagingRationale: 'Use a clean, premium-natural pack with an appetizing melted-use cue and clear everyday versatility.',
        launchRecommendation: 'Advance Coconut Cheddar v3 into pilot-scale confirmation, packaging refinement, and a targeted buyer review.',
        claimCaution: 'Validate all external claims before use.',
      },
      literatureCitations: [
        {
          id: 'L1',
          title: 'Texture drivers in plant-based cheese alternatives',
          source: 'Approved NFI literature library',
          excerpt: 'Protein and hydrocolloid structure influence firmness, melt behavior, and perceived creaminess in plant-based cheese systems.',
        },
        {
          id: 'L2',
          title: 'Consumer acceptance of plant-based foods',
          source: 'Approved NFI literature library',
          excerpt: 'Familiar sensory cues and clear usage expectations can support acceptance, while representative consumer validation remains necessary.',
        },
      ],
      generatedAt: '2026-06-12T16:00:00.000Z',
    },
  };
}

describe('commercialization report quality evaluation', { timeout: 20_000 }, () => {
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
    expect(evaluation.checks.find(check => check.id === 'product-go-framing')?.passed).toBe(true);
    expect(evaluation.checks.find(check => check.id === 'claims-layer-separation')?.passed).toBe(true);
    expect(evaluation.checks.find(check => check.id === 'product-identity')?.passed).toBe(true);
    expect(evaluation.checks.find(check => check.id === 'internal-language')?.passed).toBe(true);
    expect(evaluation.pageTexts[0]).toContain('CLIENT PRODUCT DECISION REPORT');
    expect(evaluation.pageTexts[1]).toContain('Executive recommendation');
    expect(evaluation.pageTexts[4]).toContain('Panel and study profile');
    expect(evaluation.pageTexts[5]).toContain('Scientific literature and evidence map');
    expect(evaluation.pageTexts[7]).toContain('Evidence and release record');
    expect(evaluation.pageTexts[7]).toContain('Claim-to-evidence register');
    expect(evaluation.pageTexts.every(page => page.includes('Prepared by New Food Innovation'))).toBe(true);
    expect(evaluation.pageTexts.join(' ')).not.toContain('…');
    expect(evaluation.pageTexts.join(' ')).not.toMatch(/shelf[- ]?life/i);
    expect(evaluation.pageTexts.join(' ')).not.toMatch(/deterministic decision context|client-safe summary/i);
  });

  it('rejects launch-blocking language and raw numeric artifacts in a GO report', async () => {
    const input = sampleInput();
    const { doc } = await buildCommercializationReportPdf(input);
    const pages = (doc.internal as unknown as { pages: Array<string[] | undefined> }).pages;
    pages[1]?.push('(This is not approval to launch. Raw score 77.60000000000001.) Tj');

    const evaluation = evaluateCommercializationReport(doc, input);

    expect(evaluation.checks.find(check => check.id === 'no-unsupported-launch-block')?.passed).toBe(false);
    expect(evaluation.checks.find(check => check.id === 'number-formatting')?.passed).toBe(false);
    expect(evaluation.passed).toBe(false);
  });

  it('normalizes raw floating-point artifacts from client-facing source fields', async () => {
    const input = sampleInput();
    input.snapshot.concept.pricePoint = '$5.990000000000001 per pack';
    input.snapshot.narrative.launchRecommendation = 'Advance after the 77.60000000000001 benchmark is confirmed.';

    const { doc, clientEvaluation } = await buildCommercializationReportPdf(input);
    const reportText = clientEvaluation.pageTexts.join(' ');

    expect(reportText).toContain('$5.99 per pack');
    expect(reportText).not.toContain('5.990000000000001');
    expect(reportText).not.toContain('77.60000000000001');
    expect(clientEvaluation.checks.find(check => check.id === 'number-formatting')?.passed).toBe(true);
    expect(doc.getNumberOfPages()).toBe(8);
  });

  it('preserves DOI identifiers while normalizing genuine numeric artifacts', () => {
    const doi = 'DOI 10.1080/10408398.2025.2531220';

    expect(normalizeClientFacingNumbers(doi)).toBe(doi);
    expect(normalizeClientFacingNumbers('Score 77.60000000000001')).toBe('Score 77.6');
  });

  it('renders one concept response as a directional log and hides raw retrieval metadata', async () => {
    const input = sampleInput();
    input.snapshot.evidence = {
      responseCount: 1,
      scaleMetrics: [{ question: 'Concept appeal', average: 8, count: 1 }],
      topSelections: [{ option: '$5-$8', count: 1, percentage: 100 }, { option: 'Texture', count: 1, percentage: 100 }],
      comments: [],
      purchaseIntent: 7,
    };
    input.snapshot.literatureCitations = [{
      id: 'L1',
      title: 'Sensory Evaluation Practices in Plant-Based Cheese (1).pdf',
      source: 'nfi_publications/sensory_rag_bulk_pack__07_open_text.txt',
      excerpt: 'Methodological flaws include small sample sizes and incomplete reporting of panel design.',
    }];

    const { doc } = await buildCommercializationReportPdf(input);
    const evaluation = evaluateCommercializationReport(doc, input);
    const scientificPage = evaluation.pageTexts[5];
    const conceptPage = evaluation.pageTexts[3];

    expect(scientificPage).toContain('Scientific literature and evidence map');
    expect(scientificPage).toContain('Study design and reporting');
    expect(scientificPage).toContain('[L1]');
    expect(scientificPage).not.toMatch(/nfi_publications|sensory_rag_bulk_pack|\.pdf|\.txt/i);
    expect(conceptPage).toContain('Consumer and concept response');
    expect(conceptPage).toContain('CONCEPT EVIDENCE BOUNDARY');
    expect(conceptPage).toContain('Concept test n=1');
    expect(conceptPage).not.toContain('$5-$8');
    expect(conceptPage).not.toContain('100%');
    expect(evaluation.checks.find(check => check.id === 'raw-source-metadata')?.passed).toBe(true);
    expect(evaluation.passed).toBe(true);

    if (process.env.GENERATE_REPORT_ARTIFACTS === '1') {
      const outputDir = path.join(process.cwd(), 'output/pdf');
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(path.join(outputDir, 'commercialization-report-directional-concept-preview.pdf'), Buffer.from(doc.output('arraybuffer')));
    }
  });

  it('blocks raw source metadata if it reaches the generated PDF', async () => {
    const input = sampleInput();
    const { doc } = await buildCommercializationReportPdf(input);
    const pages = (doc.internal as unknown as { pages: Array<string[] | undefined> }).pages;
    pages[3]?.push('(nfi_publications/sensory_rag_bulk_pack__07_open_text.txt) Tj');

    const evaluation = evaluateCommercializationReport(doc, input);

    expect(evaluation.checks.find(check => check.id === 'raw-source-metadata')?.passed).toBe(false);
    expect(evaluation.passed).toBe(false);
  });

  it('keeps a dense instrumental and literature page inside the client layout', async () => {
    const input = sampleInput();
    input.reportContext = coconutCheddarContext();
    const { doc } = await buildCommercializationReportPdf(input);
    const evaluation = evaluateCommercializationReport(doc, input);
    const instrumentalPage = evaluation.pageTexts[2];
    const literaturePage = evaluation.pageTexts[5];

    expect(instrumentalPage).toContain('E-tongue / composition model');
    expect(instrumentalPage).toContain('GC-MS / GC-O');
    expect(literaturePage).toContain('Scientific literature and evidence map');
    expect(literaturePage).toContain('Approved source register');
    expect(literaturePage).not.toMatch(/nfi_publications|sensory_rag_bulk_pack|\.pdf|\.txt/i);
    expect(evaluation.pageTexts.join(' ')).not.toContain('…');
    expect(evaluation.pageTexts.join(' ')).not.toMatch(/shelf[- ]?life/i);
    expect(evaluation.pageTexts[2]).toContain(`concept test n=${input.snapshot.evidence.responseCount}`);

    if (process.env.GENERATE_REPORT_ARTIFACTS === '1') {
      const outputDir = path.join(process.cwd(), 'output/pdf');
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(path.join(outputDir, 'commercialization-report-literature-guidance-preview.pdf'), Buffer.from(doc.output('arraybuffer')));
    }
  });

  it('renders report-safe Evidence Assist guidance with approved source provenance', async () => {
    const input = sampleInput();
    input.reportContext = coconutCheddarContext();
    input.snapshot.evidenceCards = [{
      id: 'ea-texture-1',
      citationLabel: 'L1',
      topic: 'pilot texture confirmation',
      evidenceUse: 'validation_guidance',
      appliesTo: ['texture'],
      supports: ['controlled pilot validation'],
      doesNotSupport: ['product preference', 'product superiority'],
      safeReportLanguage: 'Confirm texture and melt performance at pilot scale using the same controlled sensory measures.',
      claimPermission: 'context_only',
      confidence: 'high',
      limitations: ['External literature is not product-specific proof.'],
      contentFingerprint: 'sha256:evidence-assist-preview',
    }];
    input.snapshot.literatureCitations = [{
      id: 'L1',
      title: 'Texture confirmation in plant-based cheese',
      excerpt: '',
      source: 'Approved NFI literature library',
    }];

    const { doc } = await buildCommercializationReportPdf(input);
    const evaluation = evaluateCommercializationReport(doc, input);
    const scientificPage = evaluation.pageTexts[2];
    const evidencePage = evaluation.pageTexts[5];

    expect(scientificPage).toContain('Pilot Texture Confirmation');
    expect(scientificPage).toContain('NFI recommends this as the next validation step');
    expect(scientificPage).toContain('Texture performance is 43/100');
    expect(evidencePage).toContain('Texture confirmation in plant-based cheese');
    expect(evaluation.pageTexts.join(' ')).not.toMatch(/chunkId|retrievedExcerpt|sourcePath|retrievalScore|\bRAG\b/i);
    expect(evaluation.weaknesses).toEqual([]);
    expect(evaluation.passed).toBe(true);

    if (process.env.GENERATE_REPORT_ARTIFACTS === '1') {
      const outputDir = path.join(process.cwd(), 'output/pdf');
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(path.join(outputDir, 'commercialization-report-evidence-led-preview.pdf'), Buffer.from(doc.output('arraybuffer')));
    }
  });

  it('prints authoritative metadata for recognized literature sources', async () => {
    const input = sampleInput();
    input.snapshot.literatureCitations = [
      {
        id: 'L1',
        title: 'Sensory Evaluation of Plant-Based Cheese: A Systematic Review with a Focus on Texture and Mouthfeel.pdf',
        source: 'Verified local publication',
        excerpt: 'Texture and mouthfeel measurement should be integrated into plant-based cheese study design.',
      },
      {
        id: 'L2',
        title: 'Sensory Characterisation and Consumer Acceptance of Plant-Based Cheese Alternatives: A Swiss Perspective.pdf',
        source: 'Verified local publication',
        excerpt: 'Consumer acceptance and category benchmarking should be evaluated with the intended consumer group.',
      },
    ];

    const { doc } = await buildCommercializationReportPdf(input);
    const evaluation = evaluateCommercializationReport(doc, input);
    const evidencePage = evaluation.pageTexts[5];

    expect(evidencePage).toContain('Birke Rune, Clausen & Giacalone (2026)');
    expect(evidencePage).toContain('DOI 10.1080/10408398.2025.2531220');
    expect(evidencePage).toContain('Guggenbühl et al. (2026)');
    expect(evidencePage).toContain('DOI 10.1016/j.foodqual.2025.105713');
    expect(evaluation.checks.find(check => check.id === 'number-formatting')?.passed).toBe(true);
    expect(evaluation.passed).toBe(true);
  });
});
