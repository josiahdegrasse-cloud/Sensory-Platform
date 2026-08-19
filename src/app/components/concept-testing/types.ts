// ─── Types ────────────────────────────────────────────────────────────────────

export type QuestionType = 'scale' | 'multiple_choice' | 'open_text' | 'ranking' | 'image_choice';

/** Structured positioning dimensions for a concept. Known values are suggested
 * presets for cross-concept comparison; custom strings from "Other" are allowed
 * when a concept needs a more specific positioning cue. */
export interface VariantDimensions {
  productForm:       string | null;
  positioning:       string | null;
  visualComplexity:  string | null;
  appeal:            string | null;
  channel:           string | null;
  packagingFormat:   string | null;
  brandColorScheme:  string | null;
  targetDemographic: string | null;
  pricePositioning:  string | null;
}

export const EMPTY_VARIANT_DIMENSIONS: VariantDimensions = {
  productForm:       null,
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
  /** Zero-based index of the concept visual shown with this question. */
  imageIndex?: number;
  required: boolean;
  category: 'appeal' | 'purchase' | 'price' | 'attributes' | 'demographics' | 'usage';
}

export type ConceptVisualReviewStatus = 'draft' | 'selected' | 'approved' | 'rejected';

export type ConceptVisualQaKey =
  | 'packBelievability'
  | 'foodRealism'
  | 'claimSafety'
  | 'audienceFit'
  | 'panelistReady'
  | 'buyerDeckReady';

export interface ConceptVisualReview {
  imageId: string;
  status: ConceptVisualReviewStatus;
  qa: Partial<Record<ConceptVisualQaKey, boolean>>;
  notes: string;
  reviewedAt?: string;
  reviewedBy?: string;
  source: 'ai' | 'external';
}

/**
 * The concept image an admin locked as this concept's product design. Later
 * generations re-stage this exact design (via the image-edit endpoint) instead
 * of inventing a new pack per batch.
 */
export interface ConceptBrandReference {
  /** concept_images id — validated server-side against the caller's org. */
  imageId: string;
  /** Signed display URL captured at lock time (expires ~1h; wizard-session use). */
  url: string;
  /** The mode the locked image was generated as. */
  mode: string;
}

export interface ConceptDraft {
  name: string;
  category: string;
  projectName: string;
  description: string;
  marketingImages: string[];
  marketingImageIds: string[];
  marketingImageReviews: ConceptVisualReview[];
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
  /** Locked product design for reference-anchored generation; null = exploring. */
  brandReference: ConceptBrandReference | null;
}

export type WizardStep = 'concept' | 'survey' | 'panel' | 'review' | 'launched';

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
