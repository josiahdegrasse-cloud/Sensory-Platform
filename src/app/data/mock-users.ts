// Shared types and constants — no mock data

export interface Product {
  id: string;
  name: string;
  category: string;
  createdDate: string;
  status: 'active' | 'completed';
  customAttributes?: string[];
  isMultiSample?: boolean;
  samples?: { id: string; code: string; label: string }[];
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
}

export const DEFAULT_CATA_ATTRIBUTES = [
  // Positive dairy notes
  'Milk', 'Creamy', 'Butter', 'Cheese', 'Tangy', 'Fresh', 'Mild', 'Sharp',
  'Aged', 'Nutty', 'Sweet', 'Salty', 'Umami',
  // Textural
  'Smooth', 'Firm', 'Spreadable', 'Crumbly',
  // Off-notes
  'Rancid', 'Cardboard', 'Fermented', 'Bitter', 'Astringent', 'Soapy',
  'Coconut', 'Beany', 'Chalky', 'Oily',
];

export const INTENSITY_ATTRIBUTES = [
  'Milk', 'Creamy', 'Butter', 'Cheese', 'Tangy', 'Nutty', 'Salty', 'Sweet',
];

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
