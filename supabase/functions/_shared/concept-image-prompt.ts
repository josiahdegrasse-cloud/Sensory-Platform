// Builds the normalized ConceptImageBrief and the final image-generation
// prompt from it. Shared between the generate-concept-images edge function and
// the frontend (prompt preview + vitest), so it must stay pure TypeScript:
// no Deno globals, no browser globals.

import {
  type ConceptImageMode,
  type PromptStyleId,
  getConceptImageMode,
  getPromptStyle,
  normalizeConceptImageMode,
  normalizePromptStyle,
} from './concept-image-catalog.ts';

const MAX_PROMPT_LENGTH = 32000;
const MAX_LIST_ITEMS = 8;

/** Guardrails appended to every prompt regardless of mode, style, or tenant. */
export const PLATFORM_FORBIDDEN_IN_IMAGES = [
  'unsupported health, nutrition, medical, or performance claims',
  'fake certifications, seals, or award badges',
  'fake or detailed nutrition facts panels',
  'real retailer names, logos, or store branding',
  'competitor logos or lookalikes of real brands',
  'copyrighted characters or celebrity likenesses',
  'dense, unreadable, or distorted text',
  'watermarks or stock-photo artifacts',
];

export interface ConceptImageBrief {
  // Tenant / brand
  clientName: string;
  brandTone: string;
  // Concept
  productName: string;
  foodCategory: string;
  conceptName: string;
  conceptPositioning: string;
  targetSegments: string[];
  targetOccasion: string;
  keyBenefits: string[];
  sensoryStrengths: string[];
  technicalChallenges: string[];
  // Claim safety
  forbiddenClaims: string[];
  allowedClaims: string[];
  evidenceStrength: 'Limited' | 'Directional' | 'Developing' | 'Established' | '';
  decisionContext: string;
  // Generation parameters
  imageMode: ConceptImageMode;
  promptStyle: PromptStyleId;
  model: string;
  quality: string;
  count: number;
  // Free-text art direction from the admin
  visualNotes: string;
  // Provenance
  conceptTestId: string;
  projectName: string;
  foodTypeSlug: string;
}

export interface ConceptImageBriefInput {
  clientName?: unknown;
  brandTone?: unknown;
  productName?: unknown;
  foodCategory?: unknown;
  conceptName?: unknown;
  conceptPositioning?: unknown;
  targetSegments?: unknown;
  targetOccasion?: unknown;
  keyBenefits?: unknown;
  sensoryStrengths?: unknown;
  technicalChallenges?: unknown;
  forbiddenClaims?: unknown;
  allowedClaims?: unknown;
  evidenceStrength?: unknown;
  decisionContext?: unknown;
  imageMode?: unknown;
  promptStyle?: unknown;
  model?: unknown;
  quality?: unknown;
  count?: unknown;
  visualNotes?: unknown;
  conceptTestId?: unknown;
  projectName?: unknown;
  foodTypeSlug?: unknown;
}

function cleanText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

/** Accepts a string (split on newlines/semicolons/bullets/commas) or string array. */
function cleanList(value: unknown): string[] {
  const parts = Array.isArray(value)
    ? value.map(item => cleanText(item))
    : cleanText(value).split(/[\n;•]+|, /);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of parts) {
    const item = part.replace(/^[-*\s]+/, '').trim();
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= MAX_LIST_ITEMS) break;
  }
  return result;
}

const BRAND_TONES: Record<string, string> = {
  formal: 'polished, formal, and professional',
  standard: 'professional and approachable',
  energetic: 'confident, vibrant, and energetic',
};

const EVIDENCE_STRENGTHS = new Set(['Limited', 'Directional', 'Developing', 'Established']);

export function buildConceptImageBrief(input: ConceptImageBriefInput): ConceptImageBrief {
  const tone = cleanText(input.brandTone).toLowerCase();
  const evidence = cleanText(input.evidenceStrength);
  return {
    clientName: cleanText(input.clientName),
    brandTone: BRAND_TONES[tone] ?? (tone || BRAND_TONES.standard),
    productName: cleanText(input.productName, cleanText(input.conceptName)),
    foodCategory: cleanText(input.foodCategory),
    conceptName: cleanText(input.conceptName, cleanText(input.productName)),
    conceptPositioning: cleanText(input.conceptPositioning),
    targetSegments: cleanList(input.targetSegments),
    targetOccasion: cleanText(input.targetOccasion),
    keyBenefits: cleanList(input.keyBenefits),
    sensoryStrengths: cleanList(input.sensoryStrengths),
    technicalChallenges: cleanList(input.technicalChallenges),
    forbiddenClaims: cleanList(input.forbiddenClaims),
    allowedClaims: cleanList(input.allowedClaims),
    evidenceStrength: EVIDENCE_STRENGTHS.has(evidence) ? evidence as ConceptImageBrief['evidenceStrength'] : '',
    decisionContext: cleanText(input.decisionContext),
    imageMode: normalizeConceptImageMode(input.imageMode),
    promptStyle: normalizePromptStyle(input.promptStyle),
    model: cleanText(input.model, 'gpt-image-1.5'),
    quality: cleanText(input.quality, 'medium'),
    count: Math.max(1, Math.min(8, Number(input.count) || 1)),
    visualNotes: cleanText(input.visualNotes),
    conceptTestId: cleanText(input.conceptTestId),
    projectName: cleanText(input.projectName, 'Project 1'),
    foodTypeSlug: cleanText(input.foodTypeSlug),
  };
}

function brandPhrase(brief: ConceptImageBrief): string {
  // Multi-client rule: use the active client/company profile when available;
  // otherwise fall back to neutral platform phrasing — never a hardcoded brand.
  return brief.clientName
    ? `${brief.clientName}, a credible food company`
    : 'a credible early-stage food brand';
}

const TEXT_POLICY_DIRECTIONS: Record<string, string> = {
  'name-and-positioning':
    'Keep any rendered package text minimal and readable: at most the product name and one short positioning line. No other label copy.',
  'name-only':
    'Keep rendered text minimal: at most the product name on the pack itself. No headlines, claims, or label copy.',
  'no-text':
    'Do not render readable text anywhere in the image; communicate everything through styling, color, and composition.',
};

export function buildConceptImagePrompt(brief: ConceptImageBrief): { prompt: string; summary: string } {
  const mode = getConceptImageMode(brief.imageMode);
  const style = getPromptStyle(brief.promptStyle);
  const product = brief.productName || 'a new food product concept';
  const category = brief.foodCategory ? ` in the ${brief.foodCategory} category` : '';
  const segments = brief.targetSegments.join(', ');
  const limitedEvidence = brief.evidenceStrength === 'Limited' || brief.evidenceStrength === 'Directional';

  const sections = [
    // 1. Subject
    `Create a professional ${mode.label.toLowerCase()} concept image for "${product}"${category}, developed for ${brandPhrase(brief)}.`,
    // 2. Image mode direction
    `${mode.purpose}. ${mode.direction}`,
    // 3. Marketing positioning
    brief.conceptPositioning
      ? `Positioning to communicate visually: ${brief.conceptPositioning}.`
      : '',
    brief.keyBenefits.length
      ? `The image should suggest these consumer benefits through styling alone, never as written claims: ${brief.keyBenefits.join(', ')}.`
      : '',
    brief.decisionContext ? `Commercial context: ${brief.decisionContext}.` : '',
    // 4. Target consumer / occasion
    segments
      ? `Target consumer: ${segments} — let color, styling, and composition feel deliberately chosen for them, not generic.`
      : '',
    brief.targetOccasion ? `Usage occasion to evoke: ${brief.targetOccasion}.` : '',
    // 5. Visual style
    `Visual style — ${style.label}: ${style.direction}`,
    `Overall brand tone: ${brief.brandTone}.`,
    brief.visualNotes ? `Additional art direction from the team: ${brief.visualNotes}.` : '',
    // 6. Food realism
    'Food realism: make the food look appetizing, physically plausible, and true to the category — believable portion sizes, natural surface textures, and accurate color. No uncanny, plastic, or impossible food.'
      + (brief.sensoryStrengths.length
        ? ` Emphasize these validated sensory strengths: ${brief.sensoryStrengths.join(', ')}.`
        : ''),
    brief.technicalChallenges.length
      ? `Watch-outs from R&D — do not exaggerate or visually overpromise on: ${brief.technicalChallenges.join(', ')}.`
      : '',
    // 7. Brand and packaging text constraints
    TEXT_POLICY_DIRECTIONS[mode.textPolicy],
    // 8. Claim safety
    `Strictly avoid: ${PLATFORM_FORBIDDEN_IN_IMAGES.join('; ')}; ${mode.avoid}.`
      + (brief.forbiddenClaims.length
        ? ` Additionally never depict or imply: ${brief.forbiddenClaims.join(', ')}.`
        : '')
      + (brief.allowedClaims.length
        ? ` Only the following validated claims may be hinted at visually: ${brief.allowedClaims.join(', ')}.`
        : ''),
    limitedEvidence
      ? 'Consumer evidence for this concept is still early, so express benefits only through mood and styling — nothing in the image should read as a stated claim.'
      : '',
    // 9. Output quality
    'Output quality: indistinguishable from a finished agency asset — professional commercial photography or packaging design, tack-sharp hero focus, intentional color grading, believable lighting and materials. This is an honest early-stage concept visualization for directional testing, not fantasy art.',
  ].filter(Boolean);

  const prompt = sections.join(' ').slice(0, MAX_PROMPT_LENGTH);

  const summaryParts = [
    `${mode.label} · ${style.label}`,
    brief.conceptPositioning
      ? `${product} presented as ${brief.conceptPositioning}`
      : `${product}${category}`,
    segments ? `for ${segments}` : '',
    brief.targetOccasion ? `(${brief.targetOccasion})` : '',
  ].filter(Boolean);
  const summary = `${summaryParts.join(' — ')}.`;

  return { prompt, summary };
}
