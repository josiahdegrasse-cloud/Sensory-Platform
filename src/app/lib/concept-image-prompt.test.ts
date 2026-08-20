import { describe, expect, it } from 'vitest';
import {
  CONCEPT_IMAGE_MODES,
  LEGACY_MODE_ALIASES,
  LEGACY_STYLE_ALIASES,
  PROMPT_STYLES,
  buildModeSequence,
  normalizeConceptImageMode,
  normalizePromptStyle,
} from '../../../supabase/functions/_shared/concept-image-catalog.ts';
import {
  AI_ARTIFACTS_TO_AVOID,
  PLATFORM_FORBIDDEN_IN_IMAGES,
  PROFESSIONAL_ART_DIRECTION_REQUIREMENTS,
  RETAIL_READINESS_REQUIREMENTS,
  buildConceptImageBrief,
  buildConceptImagePrompt,
  type ConceptImageBriefInput,
} from '../../../supabase/functions/_shared/concept-image-prompt.ts';

const baseInput: ConceptImageBriefInput = {
  clientName: 'Coastal Foods Co',
  brandTone: 'standard',
  productName: 'Coconut Cheddar v3.0',
  foodCategory: 'plant-based cheese',
  conceptName: 'Coconut Cheddar v3.0',
  conceptPositioning: 'a premium plant-based cheese option for health-conscious shoppers',
  targetSegments: 'Health-conscious adults 25-45',
  targetOccasion: 'everyday lunch',
  productAppearance: 'pale cheddar-orange slices with a smooth surface and realistic melt',
  packageFormat: 'a resealable 7 oz pouch with a clear product window',
  visualSetting: 'a bright modern kitchen with warm natural daylight',
  colorDirection: 'sage green, charcoal typography, and matte paper textures',
  mustShow: 'melted serving suggestion, plant-based cue',
  keyBenefits: 'Melts like dairy\nHigh in protein, Allergen-free',
  sensoryStrengths: ['creamy texture', 'clean dairy-like flavor'],
  technicalChallenges: 'melt consistency at high heat',
  forbiddenClaims: ['lowers cholesterol', 'doctor recommended'],
  imageMode: 'packaging',
  promptStyle: 'premium_natural',
  model: 'gpt-image-1.5',
  quality: 'medium',
  count: 4,
};

describe('catalog normalization', () => {
  it('maps every legacy mode alias to a canonical mode', () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_MODE_ALIASES)) {
      expect(normalizeConceptImageMode(legacy)).toBe(canonical);
      expect(CONCEPT_IMAGE_MODES.some(mode => mode.id === canonical)).toBe(true);
    }
  });

  it('keeps canonical modes unchanged and falls back to packaging', () => {
    for (const mode of CONCEPT_IMAGE_MODES) {
      expect(normalizeConceptImageMode(mode.id)).toBe(mode.id);
    }
    expect(normalizeConceptImageMode('not-a-mode')).toBe('packaging');
    expect(normalizeConceptImageMode(undefined)).toBe('packaging');
  });

  it('maps every legacy style alias to a canonical style', () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_STYLE_ALIASES)) {
      expect(normalizePromptStyle(legacy)).toBe(canonical);
      expect(PROMPT_STYLES.some(style => style.id === canonical)).toBe(true);
    }
  });

  it('keeps canonical styles unchanged and falls back to bold_retail', () => {
    for (const style of PROMPT_STYLES) {
      expect(normalizePromptStyle(style.id)).toBe(style.id);
    }
    expect(normalizePromptStyle('vaporwave')).toBe('bold_retail');
  });

  it('exposes the eight campaign modes, two governed report modes, and ten required styles', () => {
    expect(CONCEPT_IMAGE_MODES.map(m => m.id).sort()).toEqual([
      'buyer_presentation', 'concept_board', 'ecommerce', 'ingredient_benefit',
      'lifestyle', 'packaging', 'product_truth', 'report_cover', 'shelf', 'social_ad',
    ]);
    expect(PROMPT_STYLES).toHaveLength(10);
  });
});

describe('buildModeSequence', () => {
  it('leads with the chosen mode and spans distinct modes', () => {
    const sequence = buildModeSequence('shelf', 4);
    expect(sequence[0]).toBe('shelf');
    expect(new Set(sequence).size).toBe(4);
  });

  it('repeats the lead mode when spreading is disabled', () => {
    expect(buildModeSequence('packaging', 3, false)).toEqual(['packaging', 'packaging', 'packaging']);
  });

  it('cycles when more images than modes are requested', () => {
    const sequence = buildModeSequence('packaging', 10);
    expect(sequence).toHaveLength(10);
    expect(sequence[8]).toBe(sequence[0]);
  });
});

describe('buildConceptImageBrief', () => {
  it('normalizes list fields from strings and arrays, deduplicated', () => {
    const brief = buildConceptImageBrief(baseInput);
    expect(brief.keyBenefits).toEqual(['Melts like dairy', 'High in protein', 'Allergen-free']);
    expect(brief.sensoryStrengths).toEqual(['creamy texture', 'clean dairy-like flavor']);
    expect(brief.technicalChallenges).toEqual(['melt consistency at high heat']);
    expect(brief.mustShow).toEqual(['melted serving suggestion', 'plant-based cue']);
  });

  it('caps list fields at eight items', () => {
    const brief = buildConceptImageBrief({
      ...baseInput,
      keyBenefits: Array.from({ length: 15 }, (_, i) => `benefit ${i}`),
    });
    expect(brief.keyBenefits).toHaveLength(8);
  });

  it('falls back to neutral branding when no client profile exists', () => {
    const brief = buildConceptImageBrief({ ...baseInput, clientName: '' });
    expect(brief.clientName).toBe('');
    const { prompt } = buildConceptImagePrompt(brief);
    expect(prompt).toContain('a credible early-stage food brand');
    expect(prompt).not.toContain('New Food Innovation');
  });

  it('maps brand tone settings to descriptive tone phrases', () => {
    expect(buildConceptImageBrief({ ...baseInput, brandTone: 'formal' }).brandTone).toContain('formal');
    expect(buildConceptImageBrief({ ...baseInput, brandTone: 'energetic' }).brandTone).toContain('energetic');
    expect(buildConceptImageBrief({ ...baseInput, brandTone: '' }).brandTone).toContain('professional');
  });

  it('rejects unknown evidence strengths and clamps count', () => {
    expect(buildConceptImageBrief({ ...baseInput, evidenceStrength: 'Massive' }).evidenceStrength).toBe('');
    expect(buildConceptImageBrief({ ...baseInput, evidenceStrength: 'Limited' }).evidenceStrength).toBe('Limited');
    expect(buildConceptImageBrief({ ...baseInput, count: 99 }).count).toBe(8);
    expect(buildConceptImageBrief({ ...baseInput, count: 0 }).count).toBe(1);
  });
});

describe('buildConceptImagePrompt', () => {
  it('includes client branding, positioning, and target consumer', () => {
    const { prompt } = buildConceptImagePrompt(buildConceptImageBrief(baseInput));
    expect(prompt).toContain('Coastal Foods Co');
    expect(prompt).toContain('Coconut Cheddar v3.0');
    expect(prompt).toContain('premium plant-based cheese option');
    expect(prompt).toContain('Health-conscious adults 25-45');
    expect(prompt).toContain('everyday lunch');
    expect(prompt).toContain('pale cheddar-orange slices');
    expect(prompt).toContain('resealable 7 oz pouch');
    expect(prompt).toContain('bright modern kitchen');
    expect(prompt).toContain('sage green');
    expect(prompt).toContain('melted serving suggestion');
  });

  it('always carries the platform claim-safety guardrails, in every mode', () => {
    for (const mode of CONCEPT_IMAGE_MODES) {
      const { prompt } = buildConceptImagePrompt(buildConceptImageBrief({ ...baseInput, imageMode: mode.id }));
      for (const forbidden of PLATFORM_FORBIDDEN_IN_IMAGES) {
        expect(prompt).toContain(forbidden);
      }
      expect(prompt).toContain(mode.direction);
    }
  });

  it('adds professional art-direction and retail-readiness criteria to every prompt', () => {
    const { prompt } = buildConceptImagePrompt(buildConceptImageBrief(baseInput));
    expect(prompt).toContain('Professional art direction requirements');
    expect(prompt).toContain('Retail readiness requirements');
    for (const requirement of PROFESSIONAL_ART_DIRECTION_REQUIREMENTS) {
      expect(prompt).toContain(requirement);
    }
    for (const requirement of RETAIL_READINESS_REQUIREMENTS) {
      expect(prompt).toContain(requirement);
    }
  });

  it('suppresses common AI-image artifacts explicitly', () => {
    const { prompt } = buildConceptImagePrompt(buildConceptImageBrief(baseInput));
    expect(prompt).toContain('Avoid AI-image tells');
    for (const artifact of AI_ARTIFACTS_TO_AVOID) {
      expect(prompt).toContain(artifact);
    }
    expect(prompt).toContain('no obvious generative artifacts');
  });

  it('includes concept-level forbidden claims', () => {
    const { prompt } = buildConceptImagePrompt(buildConceptImageBrief(baseInput));
    expect(prompt).toContain('lowers cholesterol');
    expect(prompt).toContain('doctor recommended');
  });

  it('restricts allowed visual claims when provided', () => {
    const { prompt } = buildConceptImagePrompt(buildConceptImageBrief({
      ...baseInput,
      allowedClaims: ['high protein (validated)'],
    }));
    expect(prompt).toContain('high protein (validated)');
    expect(prompt).toContain('validated claims may be hinted at visually');
  });

  it('tightens claim language when evidence is limited or directional', () => {
    const limited = buildConceptImagePrompt(buildConceptImageBrief({ ...baseInput, evidenceStrength: 'Limited' }));
    expect(limited.prompt).toContain('evidence for this concept is still early');
    const established = buildConceptImagePrompt(buildConceptImageBrief({ ...baseInput, evidenceStrength: 'Established' }));
    expect(established.prompt).not.toContain('evidence for this concept is still early');
  });

  it('applies the per-mode text policy', () => {
    const packaging = buildConceptImagePrompt(buildConceptImageBrief({ ...baseInput, imageMode: 'packaging' }));
    expect(packaging.prompt).toContain('product name and one short positioning line');
    const lifestyle = buildConceptImagePrompt(buildConceptImageBrief({ ...baseInput, imageMode: 'lifestyle' }));
    expect(lifestyle.prompt).toContain('Do not render readable text');
    const shelf = buildConceptImagePrompt(buildConceptImageBrief({ ...baseInput, imageMode: 'shelf' }));
    expect(shelf.prompt).toContain('at most the product name');
  });

  it('applies retail-format craft directions to the core retail modes', () => {
    const packaging = buildConceptImagePrompt(buildConceptImageBrief({ ...baseInput, imageMode: 'packaging' }));
    expect(packaging.prompt).toContain('Packaging craft');
    expect(packaging.prompt).toContain('dieline/pack shape');
    expect(packaging.prompt).toContain('front label hierarchy');

    const shelf = buildConceptImagePrompt(buildConceptImageBrief({ ...baseInput, imageMode: 'shelf' }));
    expect(shelf.prompt).toContain('Shelf craft');
    expect(shelf.prompt).toContain('generic neighboring products');

    const ecommerce = buildConceptImagePrompt(buildConceptImageBrief({ ...baseInput, imageMode: 'ecommerce' }));
    expect(ecommerce.prompt).toContain('Ecommerce craft');
    expect(ecommerce.prompt).toContain('clean margins');

    const buyer = buildConceptImagePrompt(buildConceptImageBrief({ ...baseInput, imageMode: 'buyer_presentation' }));
    expect(buyer.prompt).toContain('Buyer-presentation craft');
    expect(buyer.prompt).toContain('commercialization deck');
  });

  it('varies the style direction across all ten styles', () => {
    const prompts = PROMPT_STYLES.map(style =>
      buildConceptImagePrompt(buildConceptImageBrief({ ...baseInput, promptStyle: style.id })).prompt,
    );
    expect(new Set(prompts).size).toBe(PROMPT_STYLES.length);
    for (let i = 0; i < PROMPT_STYLES.length; i++) {
      expect(prompts[i]).toContain(PROMPT_STYLES[i].direction);
    }
  });

  it('returns a short readable summary without raw prompt internals', () => {
    const { summary } = buildConceptImagePrompt(buildConceptImageBrief(baseInput));
    expect(summary).toContain('Packaging mockup');
    expect(summary).toContain('Premium natural');
    expect(summary).toContain('Coconut Cheddar v3.0');
    expect(summary.length).toBeLessThan(400);
    expect(summary).not.toContain('Strictly avoid');
  });

  it('caps the prompt length at 32k characters', () => {
    const { prompt } = buildConceptImagePrompt(buildConceptImageBrief({
      ...baseInput,
      conceptPositioning: 'x'.repeat(50000),
    }));
    expect(prompt.length).toBeLessThanOrEqual(32000);
  });

  it('handles a minimal brief without crashing or leaking placeholders', () => {
    const { prompt, summary } = buildConceptImagePrompt(buildConceptImageBrief({}));
    expect(prompt).toContain('a new food product concept');
    expect(prompt).toContain('a credible early-stage food brand');
    expect(summary).toContain('Packaging mockup');
    expect(prompt).not.toContain('undefined');
  });
});
