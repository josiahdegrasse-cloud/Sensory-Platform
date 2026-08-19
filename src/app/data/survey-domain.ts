import {
  detectFoodType,
  FOOD_TYPE_PROFILES,
  getDefaultCataAttributesForFoodType,
  getDefaultIntensityAttributesForFoodType,
} from '../lib/food-intelligence';
import type { SurveySection } from '../lib/survey-sections';

export interface HedonicReferenceScores {
  overall: number;
  appearance: number;
  aroma: number;
  flavor: number;
  texture: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  createdDate: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  customAttributes?: string[];
  surveySections?: SurveySection[];
  isMultiSample?: boolean;
  samples?: { id: string; code: string; label: string }[];
  isCalibration?: boolean;
  referenceScores?: HedonicReferenceScores | null;
  blinded?: boolean;
  blindCode?: string | null;
  assignedPanelistIds?: string[];
  projectId?: string | null;
  instrumentalSampleId?: string | null;
  sourceImportBatchId?: string | null;
  sourceSampleId?: string | null;
}

export interface QuestionnaireResponse {
  id: string;
  userId: string;
  productId: string;
  timestamp: string;
  runNumber: number;
  cataAttributes: string[];
  intensityRatings: Record<string, number>;
  hedonicScores: Partial<HedonicReferenceScores>;
  emotionalProfile: Record<string, number>;
  comments?: string;
  sessionType?: string;
  sampleCode?: string;
  differentSample?: string;
  ranking?: string[];
  presentationOrder?: string[];
}

export const CATEGORY_CATA_ATTRIBUTES: Record<string, string[]> = {
  ...Object.fromEntries(FOOD_TYPE_PROFILES.map(profile => [profile.slug, getDefaultCataAttributesForFoodType(profile.slug)])),
  dairy: getDefaultCataAttributesForFoodType('cheese'),
  generic: getDefaultCataAttributesForFoodType('generic'),
};

const CATEGORY_INTENSITY_ATTRIBUTES: Record<string, string[]> = {
  ...Object.fromEntries(FOOD_TYPE_PROFILES.map(profile => [profile.slug, getDefaultIntensityAttributesForFoodType(profile.slug)])),
  dairy: getDefaultIntensityAttributesForFoodType('cheese'),
  generic: getDefaultIntensityAttributesForFoodType('generic'),
};

function matchCategory(category: string): string {
  const slug = detectFoodType(category).slug;
  return slug === 'cheese' ? 'dairy' : slug;
}

export function getDefaultCataAttributes(category: string): string[] {
  return [...(CATEGORY_CATA_ATTRIBUTES[matchCategory(category)] ?? CATEGORY_CATA_ATTRIBUTES.generic)];
}

export function getDefaultIntensityAttributes(category: string): string[] {
  return CATEGORY_INTENSITY_ATTRIBUTES[matchCategory(category)] ?? CATEGORY_INTENSITY_ATTRIBUTES.generic;
}

// Kept for backward compatibility with existing product defaults. Generic is
// intentional: production code should not silently treat unknown products as
// cheese/dairy.
export const DEFAULT_CATA_ATTRIBUTES = CATEGORY_CATA_ATTRIBUTES.generic;

export const INTENSITY_ATTRIBUTES = CATEGORY_INTENSITY_ATTRIBUTES.generic;

export const ESSENSE25_EMOTIONS = {
  positive: [
    'Happy', 'Satisfied', 'Pleasant', 'Delighted', 'Interested', 'Curious',
    'Enthusiastic', 'Calm', 'Comfortable', 'Energetic', 'Good', 'Joyful',
    'Loving', 'Nostalgic', 'Peaceful', 'Secure', 'Warm',
  ],
  negative: [
    'Disgusted', 'Bored', 'Disappointed', 'Worried', 'Aggressive', 'Guilty',
    'Tame', 'Uninterested',
  ],
};

/** Balanced, lower-burden subset used by live questionnaires. */
export const SURVEY_EMOTIONS = {
  positive: [
    'Happy', 'Satisfied', 'Pleasant', 'Interested',
    'Enthusiastic', 'Calm', 'Comfortable', 'Energetic',
  ],
  negative: [...ESSENSE25_EMOTIONS.negative],
};
