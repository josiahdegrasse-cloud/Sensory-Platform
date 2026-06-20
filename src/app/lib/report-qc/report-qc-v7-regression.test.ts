import { describe, expect, it } from 'vitest';
import { coconutCheddarContext } from './fixtures';
import {
  validateVersion7ContextDefects,
  validateVersion7GeneratedDefects,
  validateVersion7RenderedDefects,
  type RenderedReportInspection,
} from './version-7-regressions';
import { validateGeneratedReport, type GeneratedSections } from './validate';
import type { ValidationFinding } from './types';

function sections(text: string, label = 'Regression stimulus'): GeneratedSections {
  return { sections: [{ label, text }] };
}

function expectBlockingDetector(findings: ValidationFinding[], code: string): void {
  const finding = findings.find(candidate => candidate.code === code);
  expect(finding, `Expected detector "${code}"`).toBeDefined();
  expect(finding).toMatchObject({
    code,
    severity: 'error',
    blocksExport: true,
  });
}

function renderedPage(
  overrides: Partial<RenderedReportInspection['pages'][number]> = {},
): RenderedReportInspection {
  return {
    pages: [{
      page: 1,
      text: 'ISSF = weighted sensory base plus instrumental signal minus gate penalties.',
      minimumFontSizePt: 9,
      overflow: false,
      warningVisible: true,
      tableCoverageRatio: 0.5,
      ...overrides,
    }],
  };
}

describe('report-qc: Version 7 defect regressions', () => {
  it('detects raw deterministic candidate decision language as raw-deterministic', () => {
    const result = validateGeneratedReport(
      coconutCheddarContext(),
      sections('The deterministic candidate decision supports advancement.'),
    );

    expectBlockingDetector(result.errors, 'raw-deterministic');
    expect(result.exportAllowed).toBe(false);
  });

  it('detects confirmed GO for commercialization as contradictory-commercialization-go', () => {
    const findings = validateVersion7GeneratedDefects(
      coconutCheddarContext(),
      sections('The study confirmed GO for commercialization.'),
    );

    expectBlockingDetector(findings, 'contradictory-commercialization-go');
  });

  it('detects undocumented missing firmness and spreadability zero imputation as missing-metric-zero-imputation', () => {
    const ctx = coconutCheddarContext();
    ctx.methodology.missingDataPolicy = 'No policy exists.';
    const texture = ctx.dimensions.find(dimension => dimension.key === 'texture');
    expect(texture).toBeDefined();
    texture!.calculationExplanation = 'Missing firm and spreadable count as 0 in the texture score.';

    const findings = validateVersion7ContextDefects(ctx);

    expectBlockingDetector(findings, 'missing-metric-zero-imputation');
  });

  it('detects a texture recommendation that contradicts high creamy and smooth values as texture-recommendation-evidence-conflict', () => {
    const findings = validateVersion7GeneratedDefects(
      coconutCheddarContext(),
      sections('Increase creaminess and smoothness in the next prototype.'),
    );

    expectBlockingDetector(findings, 'texture-recommendation-evidence-conflict');
  });

  it('detects a broken ISSF formula glyph as broken-issf-formula-glyph', () => {
    const findings = validateVersion7RenderedDefects(
      coconutCheddarContext(),
      renderedPage({ text: 'ISSF = weighted base � 0.86 + instrument signal.' }),
    );

    expectBlockingDetector(findings, 'broken-issf-formula-glyph');
  });

  it('detects a duplicated Method ID field as duplicate-method-id', () => {
    const findings = validateVersion7GeneratedDefects(
      coconutCheddarContext(),
      sections('Method ID: NFI-GST-1.1. Traceability record — Method ID: NFI-GST-1.1.'),
    );

    expectBlockingDetector(findings, 'duplicate-method-id');
  });

  it('detects 95.1 versus 96.0 without a transformation as unexplained-numeric-transformation', () => {
    const findings = validateVersion7GeneratedDefects(
      coconutCheddarContext(),
      sections('Internal-standard recovery was 95.1%. The displayed recovery score is 96.0%.'),
    );

    expectBlockingDetector(findings, 'unexplained-numeric-transformation');
  });

  it('detects sensory composite confusion with final ISSF as sensory-composite-issf-conflation', () => {
    const findings = validateVersion7GeneratedDefects(
      coconutCheddarContext(),
      sections('The weighted sensory base is the final ISSF used for the decision.'),
    );

    expectBlockingDetector(findings, 'sensory-composite-issf-conflation');
  });

  it('detects unsupported packaging appeal language as unsupported-packaging-appeal', () => {
    const findings = validateVersion7GeneratedDefects(
      coconutCheddarContext(),
      sections('The eye-catching package will create shelf standout.'),
    );

    expectBlockingDetector(findings, 'unsupported-packaging-appeal');
  });

  it('detects an unexplained numeric price range as unexplained-price-range', () => {
    const ctx = coconutCheddarContext();
    ctx.conceptStrategy.priceHypothesis = '$5.99-$7.49 per pack.';

    const findings = validateVersion7GeneratedDefects(ctx, sections('Price range shown in concept.'));

    expectBlockingDetector(findings, 'unexplained-price-range');
  });

  it('detects sensory descriptors presented as consumer evidence as sensory-consumer-population-conflation', () => {
    const findings = validateVersion7GeneratedDefects(
      coconutCheddarContext(),
      sections('Consumers described the product as cheesy, buttery, creamy, and smooth.'),
    );

    expectBlockingDetector(findings, 'sensory-consumer-population-conflation');
    const bounded = validateVersion7GeneratedDefects(
      coconutCheddarContext(),
      sections('Run target-consumer concept validation before using sensory descriptors in external copy.'),
    );
    expect(bounded.some(finding => finding.code === 'sensory-consumer-population-conflation')).toBe(false);
  });

  it('detects a demo warning hidden from a rendered page as demo-warning-not-page-visible', () => {
    const findings = validateVersion7RenderedDefects(
      coconutCheddarContext(),
      renderedPage({ page: 2, warningVisible: false }),
    );

    expectBlockingDetector(findings, 'demo-warning-not-page-visible');
  });

  it('detects instrumental findings mislabeled as n=3 as instrumental-finding-count-as-sample-size', () => {
    const findings = validateVersion7GeneratedDefects(
      coconutCheddarContext(),
      sections('Evidence populations: sensory panel n=14; instrumental findings n=3.'),
    );

    expectBlockingDetector(findings, 'instrumental-finding-count-as-sample-size');
  });

  it('detects generic repeated action dependencies as generic-repeated-dependency', () => {
    const findings = validateVersion7GeneratedDefects(
      coconutCheddarContext(),
      sections(
        'Texture — Dependencies: source evidence and cross-functional review. '
        + 'Packaging — Dependencies: source evidence and cross-functional review.',
      ),
    );

    expectBlockingDetector(findings, 'generic-repeated-dependency');
  });

  it('detects an overly dense action-plan table as action-plan-density', () => {
    const findings = validateVersion7RenderedDefects(
      coconutCheddarContext(),
      renderedPage({ page: 7, minimumFontSizePt: 7.1, tableCoverageRatio: 0.8 }),
    );

    expectBlockingDetector(findings, 'action-plan-density');
  });
});
