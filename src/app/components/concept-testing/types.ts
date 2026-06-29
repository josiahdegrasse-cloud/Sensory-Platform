// ─── Types ────────────────────────────────────────────────────────────────────

export type QuestionType = 'scale' | 'multiple_choice' | 'open_text' | 'ranking' | 'image_choice';

/** Structured positioning dimensions for a concept. Each dimension is a
 * controlled enum so results can be compared across concepts and correlated
 * with consumer outcomes. All fields are nullable — dimensions are optional
 * but strongly encouraged for causal interpretation. */
export interface VariantDimensions {
  positioning:       'premium' | 'accessible'                                                        | null;
  visualComplexity:  'minimal' | 'expressive'                                                        | null;
  appeal:            'health'  | 'indulgent'                                                          | null;
  channel:           'retail'  | 'lifestyle'                                                          | null;
  packagingFormat:   'pouch' | 'block' | 'jar' | 'can' | 'bottle' | 'sleeve' | 'tray' | 'tube'      | null;
  brandColorScheme:  'earthy' | 'vibrant' | 'minimalist' | 'luxury' | 'bold' | 'pastel'              | null;
  targetDemographic: 'young_active' | 'family' | 'professional' | 'senior' | 'health_seeker'         | null;
  pricePositioning:  'budget' | 'mainstream' | 'premium' | 'ultra_premium'                           | null;
}

export const EMPTY_VARIANT_DIMENSIONS: VariantDimensions = {
  positioning:       null,
  visualComplexity:  null,
  appeal:            null,
  channel:           null,
  packagingFormat:   null,
  brandColorScheme:  null,
  targetDemographic: null,
  pricePositioning:  null,
};

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
  required: boolean;
  category: 'appeal' | 'purchase' | 'price' | 'attributes' | 'demographics' | 'usage';
}

export interface ConceptDraft {
  name: string;
  category: string;
  projectName: string;
  description: string;
  marketingImages: string[];
  marketingImageIds: string[];
  targetMarket: string;
  targetOccasion: string;
  productAppearance: string;
  packageFormat: string;
  visualSetting: string;
  colorDirection: string;
  mustShow: string;
  pricePoint: string;
  keyBenefits: string;
  technicalChallenges: string;
  /** Canonical or legacy prompt style id; normalize via normalizePromptStyle before use. */
  promptStyle: string;
  /** Optional free-text art direction passed to image generation. */
  visualNotes: string;
  /** Claims that must never appear or be implied in generated images (one per line). */
  forbiddenClaims: string;
  approvalStatus: 'draft' | 'review' | 'approved';
  /** Structured positioning dimensions. Persisted to concept_tests.variant_dimensions. */
  variantDimensions: VariantDimensions;
}

export type WizardStep = 'concept' | 'visuals' | 'survey' | 'panel' | 'review' | 'launched';

// ─── Constants ────────────────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<Question['category'], string> = {
  appeal:       'bg-blue-100 text-blue-700',
  purchase:     'bg-emerald-100 text-emerald-700',
  price:        'bg-amber-100 text-amber-700',
  attributes:   'bg-purple-100 text-purple-700',
  demographics: 'bg-slate-100 text-slate-700',
  usage:        'bg-rose-100 text-rose-700',
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  scale: '1–9 Scale',
  multiple_choice: 'Multiple Choice',
  open_text: 'Open Text',
  ranking: 'Ranking',
  image_choice: 'Pick best visual',
};

export const CATEGORY_BAR_COLORS: Record<Question['category'], string> = {
  appeal:       'bg-blue-500',
  purchase:     'bg-emerald-500',
  price:        'bg-amber-500',
  attributes:   'bg-purple-500',
  demographics: 'bg-slate-500',
  usage:        'bg-rose-500',
};
