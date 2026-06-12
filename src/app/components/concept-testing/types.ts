// ─── Types ────────────────────────────────────────────────────────────────────

export type QuestionType = 'scale' | 'multiple_choice' | 'open_text' | 'ranking' | 'image_choice';

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
  pricePoint: string;
  keyBenefits: string;
  technicalChallenges: string;
  promptStyle: 'balanced' | 'premium' | 'natural' | 'family' | 'foodservice' | 'clean-label';
  approvalStatus: 'draft' | 'review' | 'approved';
}

export type WizardStep = 'concept' | 'survey' | 'review' | 'launched';

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
