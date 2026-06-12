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
}

export const CONCEPT_IMAGE_MODES: ConceptImageModeDefinition[] = [
  {
    id: 'packaging',
    label: 'Packaging mockup',
    purpose: 'Realistic front-of-pack packaging concept for panelist testing and early buyer conversations',
    direction:
      'Show a single realistic front-of-pack package on a clean, light studio background with professional retail design: '
      + 'credible structure for the category, restrained color palette, premium grocery-store styling, and clear product/category recognition at a glance. '
      + 'The pack should look brandable and production-feasible — a design a packaging agency could actually deliver.',
    avoid:
      'fake nutrition facts panels, dense or unreadable label text, fantasy or physically impossible packaging structures, real brand logos',
    textPolicy: 'name-and-positioning',
  },
  {
    id: 'lifestyle',
    label: 'Lifestyle hero',
    purpose: 'Product shown in a realistic usage occasion that supports the positioning',
    direction:
      'Show the product being enjoyed in a realistic usage occasion — a bright kitchen, lunch table, family meal, snack moment, fitness setting, cafe, or grocery context, chosen to fit the target consumer. '
      + 'Use natural light, appetizing food styling, authentic textures (steam, crumb, condensation where relevant), and candid framing that feels like finished commercial food photography.',
    avoid:
      'sterile stock-photo posing, readable packaging text, celebrity likenesses, exaggerated performance or health storytelling',
    textPolicy: 'no-text',
  },
  {
    id: 'ecommerce',
    label: 'Ecommerce listing',
    purpose: 'Clean product-first image suitable for an online listing or product page',
    direction:
      'Show the product front and center on a white or very light seamless background in professional catalog photography style: '
      + 'even soft lighting, tack-sharp focus, true-to-life color, minimal or no props, and clear presentation of the product or pack so an online shopper instantly understands what it is.',
    avoid:
      'busy backgrounds, props that obscure the product, decorative typography overlays, badges or rosettes',
    textPolicy: 'name-only',
  },
  {
    id: 'shelf',
    label: 'Retail shelf',
    purpose: 'Grocery shelf mockup to evaluate shelf presence and category fit',
    direction:
      'Show the package facing forward at eye level in a realistic grocery shelf environment for its category, with softly blurred generic neighboring products, realistic retail lighting, and a composition that demonstrates genuine shelf stand-out without looking staged.',
    avoid:
      'real retailer names or signage, competitor logos or recognizable competitor packs, fake price tags with claims, detailed readable labels on neighboring products',
    textPolicy: 'name-only',
  },
  {
    id: 'social_ad',
    label: 'Social ad creative',
    purpose: 'Expressive campaign-style visual for early concept and message testing',
    direction:
      'Create a bold, eye-catching campaign visual: the product as the clear focal point against a confident color block or styled scene, dramatic but professional lighting, strong occasion or mood cue, and intentional negative space where a headline could sit. '
      + 'Expressive and energetic, yet still credible food-industry advertising.',
    avoid:
      'rendered headlines or slogans, claim text of any kind, meme styling, surreal AI-art effects unless the chosen style explicitly calls for boldness',
    textPolicy: 'name-only',
  },
  {
    id: 'ingredient_benefit',
    label: 'Ingredient & benefit',
    purpose: 'Shows ingredients, sensory cues, or benefit direction without making claims',
    direction:
      'Show the product with its key ingredients or sensory cues arranged in a deliberate visual hierarchy — for example creamy texture pulls, fresh produce, grains, or indulgent drizzle — communicating the benefit direction purely through styling. '
      + 'Soft diffused light, clean composition, credible food-science-meets-brand aesthetic.',
    avoid:
      'health or nutrition claim text, medical imagery, certification marks, ingredient callout labels or annotations',
    textPolicy: 'no-text',
  },
  {
    id: 'buyer_presentation',
    label: 'Buyer presentation',
    purpose: 'Polished visual for commercialization reports and buyer-facing slides',
    direction:
      'Create a premium, clean, business-presentation-ready product visual: refined studio or environmental staging, restrained props, elegant lighting, and a calm confident composition that would sit credibly on a retail buyer slide or in a commercialization report. '
      + 'Polished, never flashy.',
    avoid:
      'gimmicky effects, aggressive marketing styling, dense text, awards or endorsement imagery',
    textPolicy: 'name-and-positioning',
  },
  {
    id: 'concept_board',
    label: 'Concept board',
    purpose: 'Collage-style mood board for internal creative alignment',
    direction:
      'Create a cohesive collage-style concept mood board combining: a packaging direction cue, a target-consumer lifestyle cue, a usage occasion, an ingredient or sensory texture cue, and an overall brand color/material mood. '
      + 'Arrange the tiles with consistent lighting and a unified visual language so the board reads as one creative direction, not random images.',
    avoid:
      'readable text blocks, logos, watermark-style labels, clashing visual styles between tiles',
    textPolicy: 'no-text',
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
      'Soft natural window light, earthy muted palette with warm neutrals, organic textures (linen, stone, raw wood), minimal refined typography if any, sparse botanical props, calm uncluttered backgrounds — wellness-premium without feeling clinical.',
  },
  {
    id: 'clean_clinical',
    label: 'Clean clinical',
    direction:
      'Bright even studio lighting, white and cool-neutral palette with one precise accent color, geometric ordered composition, strictly minimal typography, no decorative props, seamless light backgrounds — transparent, honest, lab-grade cleanliness.',
  },
  {
    id: 'playful_modern',
    label: 'Playful modern',
    direction:
      'Punchy directional lighting, saturated cheerful palette with bold color blocking, dynamic off-center composition, chunky minimal typography if any, witty graphic props used sparingly, solid bright backgrounds — fun and contemporary, still professional.',
  },
  {
    id: 'rustic_artisanal',
    label: 'Rustic artisanal',
    direction:
      'Warm golden-hour or candle-warm light, heritage palette of creams, browns, and deep accents, handcrafted textures (kraft paper, ceramic, weathered wood), hand-touched minimal typography, market-style props, tactile rustic backgrounds — small-batch craft credibility.',
  },
  {
    id: 'bold_retail',
    label: 'Bold retail',
    direction:
      'Crisp high-contrast commercial lighting, confident saturated brand colors, strong centered hero composition, oversized but minimal typography, no clutter props, punchy solid-color backgrounds — mainstream shelf stand-out with challenger-brand energy.',
  },
  {
    id: 'health_forward',
    label: 'Health forward',
    direction:
      'Fresh bright daylight, energizing palette of greens, whites, and citrus accents, airy open composition, light minimal typography, fresh-ingredient props, clean kitchen or gym-adjacent backgrounds — active and vital without medical or clinical cues.',
  },
  {
    id: 'indulgent_premium',
    label: 'Indulgent premium',
    direction:
      'Moody dramatic lighting with rich shadows, deep jewel tones and metallic accents, intimate close-crop composition, elegant restrained typography, luxurious props (marble, dark wood, silk), dark sophisticated backgrounds — desire-driven premium indulgence.',
  },
  {
    id: 'family_friendly',
    label: 'Family friendly',
    direction:
      'Warm welcoming daylight, cheerful saturated but cozy palette, lively open composition with room to breathe, rounded friendly minimal typography, everyday home props, bright kitchen or table backgrounds — an easy, joyful mealtime win.',
  },
  {
    id: 'sustainable_earthy',
    label: 'Sustainable earthy',
    direction:
      'Diffused overcast natural light, grounded palette of clay, moss, sand, and recycled-kraft tones, honest unstaged composition, understated minimal typography, reusable/natural-material props, outdoor or raw-material backgrounds — planet-conscious without greenwashed clichés.',
  },
  {
    id: 'minimalist_ecommerce',
    label: 'Minimalist ecommerce',
    direction:
      'Shadowless even softbox lighting, white or near-white palette letting product color carry the image, perfectly centered catalog composition, no typography beyond the pack itself, zero props, seamless white backgrounds — pure clean product presentation.',
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
