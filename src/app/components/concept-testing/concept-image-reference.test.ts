import { describe, expect, it } from 'vitest';
import {
  CONCEPT_IMAGE_MODES,
  CONCEPT_IMAGE_SIZES,
  estimateConceptImageCost,
  getConceptImageSize,
} from '../../../../supabase/functions/_shared/concept-image-catalog.ts';
import {
  buildConceptImageBrief,
  buildConceptImagePrompt,
  buildConceptImageRefinePrompt,
  buildReferenceDirections,
} from '../../../../supabase/functions/_shared/concept-image-prompt.ts';

const baseBrief = () => buildConceptImageBrief({
  productName: 'Coconut Cheddar',
  foodCategory: 'cheese',
  conceptPositioning: 'everyday plant-based cheddar',
  imageMode: 'packaging',
  promptStyle: 'bold_retail',
});

describe('per-mode render sizes', () => {
  it('every catalog mode declares one of the supported sizes', () => {
    for (const mode of CONCEPT_IMAGE_MODES) {
      expect(CONCEPT_IMAGE_SIZES).toContain(mode.size);
    }
  });

  it('formats render in the shape they are used in downstream', () => {
    expect(getConceptImageSize('packaging')).toBe('1024x1024');
    expect(getConceptImageSize('ecommerce')).toBe('1024x1024');
    expect(getConceptImageSize('shelf')).toBe('1536x1024');
    expect(getConceptImageSize('buyer_presentation')).toBe('1536x1024');
    expect(getConceptImageSize('social_ad')).toBe('1024x1536');
    expect(getConceptImageSize('product_truth')).toBe('1024x1024');
    expect(getConceptImageSize('report_cover')).toBe('1024x1536');
  });

  it('builds a text-free portrait cover prompt from locked food truth', () => {
    const { prompt } = buildConceptImagePrompt(
      buildConceptImageBrief({ ...baseBrief(), imageMode: 'report_cover' }),
      { productLocked: true, referenceKind: 'food', productReferenceCount: 1 },
    );
    expect(prompt).toContain('product-truth source');
    expect(prompt).toContain('negative space across the top and left');
    expect(prompt).toContain('Do not render readable text anywhere');
    expect(prompt).toContain('preserve the exact locked product');
  });

  it('an explicit override wins; junk overrides fall back to the mode default', () => {
    expect(getConceptImageSize('packaging', '1536x1024')).toBe('1536x1024');
    expect(getConceptImageSize('shelf', 'auto')).toBe('1536x1024');
    expect(getConceptImageSize('shelf', '4096x4096')).toBe('1536x1024');
  });
});

describe('quality-aware cost estimate', () => {
  it('scales the configured medium rate by quality tier and count', () => {
    expect(estimateConceptImageCost(0.034, 'medium', 4)).toBeCloseTo(0.136, 4);
    expect(estimateConceptImageCost(0.034, 'low', 4)).toBeCloseTo(0.0408, 4);
    expect(estimateConceptImageCost(0.034, 'high', 4)).toBeCloseTo(0.544, 4);
  });

  it('an unknown quality tier defaults to the medium multiplier', () => {
    expect(estimateConceptImageCost(0.034, 'ultra', 1)).toBeCloseTo(0.034, 4);
  });

  it('never goes negative and treats a non-positive count as one image', () => {
    expect(estimateConceptImageCost(-1, 'medium', 4)).toBe(0);
    expect(estimateConceptImageCost(0.034, 'medium', 0)).toBeCloseTo(0.034, 4);
  });
});

describe('reference-aware prompt building', () => {
  it('without a reference context the prompt has no preservation language', () => {
    const { prompt } = buildConceptImagePrompt(baseBrief());
    expect(prompt).not.toContain('attached reference image');
    expect(prompt).not.toContain('house brand style');
  });

  it('a locked design demands exact product preservation and re-staging only', () => {
    const { prompt, summary } = buildConceptImagePrompt(baseBrief(), { productLocked: true });
    expect(prompt).toContain("The attached reference image is this concept's approved product and pack design");
    expect(prompt).toContain('do not redesign, restyle, or rename it');
    expect(summary).toContain('re-staged from the locked product design');
  });

  it('locked design + brand kit image address first and second attachments in order', () => {
    const directions = buildReferenceDirections({
      productLocked: true,
      brandKit: { brandDescriptor: 'matte kraft, deep green', brandColors: ['#123456'], hasReferenceImage: true },
    });
    expect(directions).toHaveLength(2);
    expect(directions[0]).toContain('The first attached reference image');
    expect(directions[1]).toContain('The second attached reference image');
    expect(directions[1]).toContain('same brand family');
    expect(directions[1]).toContain('#123456');
  });

  it('a descriptor-only brand kit still steers the house style without an image', () => {
    const directions = buildReferenceDirections({
      productLocked: false,
      brandKit: { brandDescriptor: 'quiet serif voice', brandColors: [], hasReferenceImage: false },
    });
    expect(directions).toHaveLength(1);
    expect(directions[0]).not.toContain('attached reference image');
    expect(directions[0]).toContain('quiet serif voice');
  });
});

describe('refinement prompt', () => {
  it('carries the instruction, preservation rule, and platform guardrails', () => {
    const { prompt, summary } = buildConceptImageRefinePrompt({
      brief: baseBrief(),
      instruction: 'warmer background lighting',
    });
    expect(prompt).toContain('Apply exactly one focused revision');
    expect(prompt).toContain('Requested revision: warmer background lighting.');
    expect(prompt).toContain('Preserve everything the revision does not name');
    expect(prompt).toContain('Strictly avoid:');
    expect(prompt).toContain('Avoid AI-image tells:');
    expect(summary).toContain('warmer background lighting');
  });

  it('falls back to a safe no-op instruction when none is given', () => {
    const { prompt } = buildConceptImageRefinePrompt({ brief: baseBrief(), instruction: '   ' });
    expect(prompt).toContain('Improve overall commercial polish without changing the design');
  });
});
