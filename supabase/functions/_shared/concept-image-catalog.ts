// Canonical catalog of concept image modes and prompt styles.
//
// This module is shared between the generate-concept-images edge function and
// the frontend (Concept Lab UI + vitest), so it must stay pure TypeScript:
// no Deno globals, no browser globals, no imports.

// ─── Image modes ──────────────────────────────────────────────────────────────

export type ConceptImageMode =
  | 'packaging'
  | 'lifestyle'
  | 'ecommerce'
  | 'shelf'
  | 'social_ad'
  | 'ingredient_benefit'
  | 'buyer_presentation'
  | 'concept_board';

/** The three render sizes the gpt-image family supports. */
export type ConceptImageSize = '1024x1024' | '1536x1024' | '1024x1536';

export const CONCEPT_IMAGE_SIZES: ConceptImageSize[] = ['1024x1024', '1536x1024', '1024x1536'];

export const CONCEPT_IMAGE_SIZE_LABELS: Record<ConceptImageSize, string> = {
  '1024x1024': 'Square',
  '1536x1024': 'Landscape',
  '1024x1536': 'Portrait',
};

export interface ConceptImageModeDefinition {
  id: ConceptImageMode;
  label: string;
  purpose: string;
  /** Creative direction injected into the prompt for this mode. */
  direction: string;
  /** Mode-specific things the image must not contain. */
  avoid: string;
  /** How much rendered text the image may carry. */
  textPolicy: 'name-and-positioning' | 'name-only' | 'no-text';
  /** Render size matched to how this format is actually used downstream. */
  size: ConceptImageSize;
}

export const CONCEPT_IMAGE_MODES: ConceptImageModeDefinition[] = [
  {
    id: 'packaging',
    label: 'Packaging mockup',
    purpose: 'Realistic front-of-pack packaging concept for panelist testing and early buyer conversations',
    direction:
      'Show one production-feasible front-of-pack design, straight-on or slight three-quarter view, on a quiet studio surface. '
      + 'Use a believable pack structure for the category, correct folds/seams/caps/windows, controlled label hierarchy, realistic material finish, and clear product/category recognition within two seconds. '
      + 'The design should feel like a senior packaging designer prepared it for a retail buyer review: not ornate, not generic, and not decorated with filler copy.',
    avoid:
      'fake nutrition facts panels, dense or unreadable label text, fantasy or physically impossible packaging structures, random badges, real brand logos',
    textPolicy: 'name-and-positioning',
    size: '1024x1024',
  },
  {
    id: 'lifestyle',
    label: 'Lifestyle hero',
    purpose: 'Product shown in a realistic usage occasion that supports the positioning',
    direction:
      'Show the product in a specific, believable usage occasion chosen for the target shopper: kitchen counter, lunch table, family meal, snack moment, cafe, or grocery-prep context. '
      + 'Use naturalistic commercial food photography with coherent light direction, real food styling, plausible portion size, authentic surface texture, and a camera position that feels observed rather than staged.',
    avoid:
      'sterile stock-photo posing, readable packaging text, celebrity likenesses, exaggerated performance or health storytelling, perfect plastic food, extra fingers or distorted hands',
    textPolicy: 'no-text',
    size: '1536x1024',
  },
  {
    id: 'ecommerce',
    label: 'Ecommerce listing',
    purpose: 'Clean product-first image suitable for an online listing or product page',
    direction:
      'Show the product or pack front and center on a white or very light seamless background in professional catalog photography style. '
      + 'Use even softbox lighting, accurate geometry, a subtle contact shadow, true-to-life color, no lifestyle clutter, and enough negative space for commerce cropping.',
    avoid:
      'busy backgrounds, props that obscure the product, decorative typography overlays, badges or rosettes, warped pack edges, floating objects',
    textPolicy: 'name-only',
    size: '1024x1024',
  },
  {
    id: 'shelf',
    label: 'Retail shelf',
    purpose: 'Grocery shelf mockup to evaluate shelf presence and category fit',
    direction:
      'Show the package facing forward at eye level in a realistic grocery shelf environment for its category. '
      + 'Use generic neighboring packs with intentionally unreadable details, credible shelf depth, real retail lighting, correct pack scale, and enough visual contrast to judge shelf standout without turning the scene into an advertisement.',
    avoid:
      'real retailer names or signage, competitor logos or recognizable competitor packs, fake price tags with claims, detailed readable labels on neighboring products, impossible shelf spacing',
    textPolicy: 'name-only',
    size: '1536x1024',
  },
  {
    id: 'social_ad',
    label: 'Social ad creative',
    purpose: 'Expressive campaign-style visual for early concept and message testing',
    direction:
      'Create a controlled campaign-style product visual with the product as the clear focal point, one strong color or scene idea, deliberate negative space for a future headline, and lighting that feels professionally art-directed. '
      + 'Keep it commercially plausible: expressive enough for message testing, restrained enough for a food brand deck.',
    avoid:
      'rendered headlines or slogans, claim text of any kind, meme styling, surreal AI-art effects, confetti, excessive glow, distorted product forms',
    textPolicy: 'name-only',
    size: '1024x1536',
  },
  {
    id: 'ingredient_benefit',
    label: 'Ingredient & benefit',
    purpose: 'Shows ingredients, sensory cues, or benefit direction without making claims',
    direction:
      'Show the product with a small number of ingredient, texture, or sensory cues arranged in a disciplined visual hierarchy. '
      + 'Use food-stylist restraint: credible ingredient scale, no floating ingredient explosions, coherent shadows, and a composition that suggests the benefit direction visually without making a written claim.',
    avoid:
      'health or nutrition claim text, medical imagery, certification marks, ingredient callout labels or annotations, levitating ingredient storms',
    textPolicy: 'no-text',
    size: '1024x1024',
  },
  {
    id: 'buyer_presentation',
    label: 'Buyer presentation',
    purpose: 'Polished visual for commercialization reports and buyer-facing slides',
    direction:
      'Create a clean buyer-slide-ready visual with the product or pack staged like a serious commercialization asset. '
      + 'Use refined studio or restrained environmental staging, modest props only when they clarify category or occasion, calm negative space, and lighting/color grading suitable for a boardroom deck.',
    avoid:
      'gimmicky effects, aggressive marketing styling, dense text, awards or endorsement imagery, overly dramatic shadows that hide product truth',
    textPolicy: 'name-and-positioning',
    size: '1536x1024',
  },
  {
    id: 'concept_board',
    label: 'Concept board',
    purpose: 'Collage-style mood board for internal creative alignment',
    direction:
      'Create a cohesive creative territory board combining a packaging cue, target-consumer lifestyle cue, usage occasion, ingredient or sensory texture cue, and material/color direction. '
      + 'Use a disciplined editorial grid, consistent lighting language, and restrained annotations-free composition so it reads as one creative direction rather than random generated tiles.',
    avoid:
      'readable text blocks, logos, watermark-style labels, clashing visual styles between tiles, scrapbook clutter',
    textPolicy: 'no-text',
    size: '1536x1024',
  },
];

/** Older stored mode ids map onto the canonical catalog. */
export const LEGACY_MODE_ALIASES: Record<string, ConceptImageMode> = {
  usage: 'lifestyle',
  ad: 'social_ad',
  ingredient: 'ingredient_benefit',
};

export function normalizeConceptImageMode(value: unknown): ConceptImageMode {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw in LEGACY_MODE_ALIASES) return LEGACY_MODE_ALIASES[raw];
  const match = CONCEPT_IMAGE_MODES.find(mode => mode.id === raw);
  return match ? match.id : 'packaging';
}

export function getConceptImageMode(value: unknown): ConceptImageModeDefinition {
  const id = normalizeConceptImageMode(value);
  return CONCEPT_IMAGE_MODES.find(mode => mode.id === id)!;
}

/**
 * Cost multipliers by quality tier, relative to the org's configured
 * estimated_cost_per_image (which is the MEDIUM-quality baseline). Mirrors the
 * gpt-image family's published pricing shape: low renders cost a fraction of
 * medium, high renders roughly 4x. 'auto' is estimated at the medium rate.
 * Estimates only — actual provider billing governs.
 */
export const QUALITY_COST_MULTIPLIERS: Record<string, number> = {
  low: 0.3,
  medium: 1,
  high: 4,
  auto: 1,
};

/** Quality-aware cost estimate shared by the edge function and the UI. */
export function estimateConceptImageCost(baseCostPerImage: number, quality: string, count: number): number {
  const multiplier = QUALITY_COST_MULTIPLIERS[quality] ?? 1;
  const total = Math.max(0, baseCostPerImage) * multiplier * Math.max(1, count);
  return Number(total.toFixed(4));
}

/**
 * Resolves the render size for a mode. `override` accepts an explicit size
 * (admin's "image shape" choice) or 'auto'/anything else to use the mode's
 * catalog default, so every format renders in the shape it is used in
 * downstream (ecommerce square, shelf landscape, social portrait, ...).
 */
export function getConceptImageSize(mode: unknown, override?: unknown): ConceptImageSize {
  const requested = typeof override === 'string' ? override.trim() : '';
  if ((CONCEPT_IMAGE_SIZES as string[]).includes(requested)) return requested as ConceptImageSize;
  return getConceptImageMode(mode).size;
}

// A generation batch spans these modes (in priority order, lead mode first) so
// the results read as genuinely different marketing directions rather than
// near-duplicate renders of one shot.
export const MODE_SEQUENCE: ConceptImageMode[] = [
  'packaging', 'lifestyle', 'shelf', 'social_ad', 'ecommerce', 'ingredient_benefit', 'buyer_presentation', 'concept_board',
];

export function buildModeSequence(leadMode: ConceptImageMode, count: number, spreadModes = true): ConceptImageMode[] {
  const total = Math.max(1, count);
  if (!spreadModes) return Array.from({ length: total }, () => leadMode);
  const ordered = [leadMode, ...MODE_SEQUENCE.filter(mode => mode !== leadMode)];
  // If more images than modes are requested, cycle back through the sequence.
  return Array.from({ length: total }, (_, i) => ordered[i % ordered.length]);
}

// ─── Prompt styles ────────────────────────────────────────────────────────────

export type PromptStyleId =
  | 'premium_natural'
  | 'clean_clinical'
  | 'playful_modern'
  | 'rustic_artisanal'
  | 'bold_retail'
  | 'health_forward'
  | 'indulgent_premium'
  | 'family_friendly'
  | 'sustainable_earthy'
  | 'minimalist_ecommerce';

export interface PromptStyleDefinition {
  id: PromptStyleId;
  label: string;
  /** Lighting, color mood, composition, typography minimalism, props, background. */
  direction: string;
}

export const PROMPT_STYLES: PromptStyleDefinition[] = [
  {
    id: 'premium_natural',
    label: 'Premium natural',
    direction:
      'Natural side light, a controlled neutral palette with one fresh accent, matte paper or soft-touch substrates, refined sans typography, one or two tactile props at most, and quiet negative space. Premium grocery, not spa stock imagery.',
  },
  {
    id: 'clean_clinical',
    label: 'Clean clinical',
    direction:
      'Even studio light, white/cool-neutral surfaces, one precise accent color, geometric alignment, crisp pack edges, sparse technical typography, and no decorative props. Transparent and lab-clean without medical cues.',
  },
  {
    id: 'playful_modern',
    label: 'Playful modern',
    direction:
      'Bright directional light, two or three confident colors, simple graphic shapes, dynamic but balanced composition, friendly bold typography on pack only, and very limited props. Contemporary challenger brand, not toy-like.',
  },
  {
    id: 'rustic_artisanal',
    label: 'Rustic artisanal',
    direction:
      'Warm directional food-photography light, kraft or uncoated paper cues, ceramic/wood/cloth textures used sparingly, heritage typography on pack only, and a tactile but uncluttered surface. Small-batch credibility without farmers-market cosplay.',
  },
  {
    id: 'bold_retail',
    label: 'Bold retail',
    direction:
      'Crisp commercial lighting, one dominant shelf-recognizable color, high-contrast pack hierarchy, large simple product name, strong hero composition, and minimal props. Mainstream shelf standout with credible retail restraint.',
  },
  {
    id: 'health_forward',
    label: 'Health forward',
    direction:
      'Fresh daylight, clean ingredient cues, airy composition, greens/whites/citrus used with restraint, light typography, and kitchen or active-lifestyle context only when it feels natural. Vital and optimistic without medical signaling.',
  },
  {
    id: 'indulgent_premium',
    label: 'Indulgent premium',
    direction:
      'Controlled low-key commercial lighting, rich product texture, deep color accents, elegant restrained typography, close but not claustrophobic crop, and one premium material cue such as stone or dark wood. Desire-led, not fantasy luxury.',
  },
  {
    id: 'family_friendly',
    label: 'Family friendly',
    direction:
      'Warm home daylight, approachable saturated accents, clear pack recognition, friendly rounded typography, everyday table or kitchen cues, and practical portion styling. Easy mealtime credibility without cartoonish sweetness.',
  },
  {
    id: 'sustainable_earthy',
    label: 'Sustainable earthy',
    direction:
      'Diffused natural light, recycled or uncoated material cues, grounded clay/moss/kraft accents, understated typography, and one honest raw-material or reusable prop. Planet-conscious without greenwashing icons or leaf overload.',
  },
  {
    id: 'minimalist_ecommerce',
    label: 'Minimalist ecommerce',
    direction:
      'Shadow-controlled softbox lighting, white or near-white seamless background, centered product geometry, accurate color, subtle contact shadow, zero props, and no typography beyond the pack itself. Clean product presentation for commerce crops.',
  },
];

/** Older stored style ids map onto the closest canonical style. */
export const LEGACY_STYLE_ALIASES: Record<string, PromptStyleId> = {
  balanced: 'bold_retail',
  premium: 'indulgent_premium',
  natural: 'premium_natural',
  family: 'family_friendly',
  foodservice: 'bold_retail',
  'clean-label': 'clean_clinical',
};

export function normalizePromptStyle(value: unknown): PromptStyleId {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw in LEGACY_STYLE_ALIASES) return LEGACY_STYLE_ALIASES[raw];
  const match = PROMPT_STYLES.find(style => style.id === raw);
  return match ? match.id : 'bold_retail';
}

export function getPromptStyle(value: unknown): PromptStyleDefinition {
  const id = normalizePromptStyle(value);
  return PROMPT_STYLES.find(style => style.id === id)!;
}
