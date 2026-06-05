// Shared types and constants
import {
  getDefaultCataAttributesForFoodType,
  getDefaultIntensityAttributesForFoodType,
  detectFoodType,
} from '../lib/food-intelligence';

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
  status: 'active' | 'completed' | 'archived';
  customAttributes?: string[];
  isMultiSample?: boolean;
  samples?: { id: string; code: string; label: string }[];
  isCalibration?: boolean;
  referenceScores?: HedonicReferenceScores | null;
  blinded?: boolean;
  assignedPanelistIds?: string[];
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
  hedonicScores: {
    overall: number;
    appearance: number;
    aroma: number;
    flavor: number;
    texture: number;
  };
  emotionalProfile: Record<string, number>;
  comments?: string;
  sessionType?: string;
  sampleCode?: string;
  differentSample?: string;
  ranking?: string[];
}

export const CATEGORY_CATA_ATTRIBUTES: Record<string, string[]> = {
  dairy: getDefaultCataAttributesForFoodType('cheese'),
  cheese: getDefaultCataAttributesForFoodType('cheese'),
  bread: getDefaultCataAttributesForFoodType('bread'),
  meat: getDefaultCataAttributesForFoodType('meat'),
  yogurt: getDefaultCataAttributesForFoodType('yogurt'),
  beverage: getDefaultCataAttributesForFoodType('beverage'),
  snack: getDefaultCataAttributesForFoodType('snack'),
  sauce: getDefaultCataAttributesForFoodType('sauce'),
  generic: getDefaultCataAttributesForFoodType('generic'),
};

const CATEGORY_INTENSITY_ATTRIBUTES: Record<string, string[]> = {
  dairy: getDefaultIntensityAttributesForFoodType('cheese'),
  cheese: getDefaultIntensityAttributesForFoodType('cheese'),
  bread: getDefaultIntensityAttributesForFoodType('bread'),
  meat: getDefaultIntensityAttributesForFoodType('meat'),
  yogurt: getDefaultIntensityAttributesForFoodType('yogurt'),
  beverage: getDefaultIntensityAttributesForFoodType('beverage'),
  snack: getDefaultIntensityAttributesForFoodType('snack'),
  sauce: getDefaultIntensityAttributesForFoodType('sauce'),
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

// Kept for backward compatibility — existing saved products are unaffected
export const DEFAULT_CATA_ATTRIBUTES = CATEGORY_CATA_ATTRIBUTES.dairy;

export const INTENSITY_ATTRIBUTES = CATEGORY_INTENSITY_ATTRIBUTES.dairy;

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
