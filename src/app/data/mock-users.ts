// Shared types and constants — no mock data

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
  dairy: [
    'Milk', 'Creamy', 'Butter', 'Cheese', 'Tangy', 'Fresh', 'Mild', 'Sharp',
    'Aged', 'Nutty', 'Sweet', 'Salty', 'Umami',
    'Smooth', 'Firm', 'Spreadable', 'Crumbly',
    'Rancid', 'Cardboard', 'Fermented', 'Bitter', 'Astringent', 'Soapy',
    'Coconut', 'Beany', 'Chalky', 'Oily',
  ],
  bread: [
    'Yeasty', 'Fresh-baked', 'Malty', 'Wheaty', 'Grainy', 'Honey', 'Nutty', 'Buttery', 'Sweet', 'Salty',
    'Soft', 'Crusty', 'Chewy', 'Airy', 'Dense', 'Springy', 'Crumbly', 'Sticky',
    'Stale', 'Gummy', 'Sour', 'Bitter', 'Bland', 'Doughy', 'Burnt', 'Musty',
  ],
  meat: [
    'Beefy', 'Smoky', 'Savory', 'Juicy', 'Fatty', 'Salty', 'Umami', 'Spiced', 'Herby', 'Charred',
    'Tender', 'Chewy', 'Firm', 'Juicy', 'Dry', 'Fibrous',
    'Gamey', 'Rancid', 'Livery', 'Bland', 'Rubbery', 'Sour',
  ],
  beverage: [
    'Sweet', 'Sour', 'Bitter', 'Tangy', 'Fresh', 'Fruity', 'Floral', 'Earthy', 'Woody', 'Spiced',
    'Smooth', 'Astringent', 'Carbonated', 'Thin', 'Full-bodied',
    'Off-note', 'Stale', 'Metallic', 'Musty', 'Soapy',
  ],
  generic: [
    'Sweet', 'Salty', 'Sour', 'Bitter', 'Umami', 'Spicy', 'Fresh', 'Aromatic', 'Rich', 'Mild',
    'Smooth', 'Soft', 'Firm', 'Crispy', 'Chewy', 'Moist', 'Dry',
    'Bland', 'Off-note', 'Stale', 'Burnt', 'Bitter', 'Sour',
  ],
};

const CATEGORY_INTENSITY_ATTRIBUTES: Record<string, string[]> = {
  dairy:    ['Milk', 'Creamy', 'Butter', 'Cheese', 'Tangy', 'Nutty', 'Salty', 'Sweet'],
  bread:    ['Yeasty', 'Wheaty', 'Buttery', 'Sweet', 'Salty', 'Crusty', 'Malty', 'Soft'],
  meat:     ['Savory', 'Smoky', 'Salty', 'Umami', 'Spiced', 'Juicy', 'Charred', 'Fatty'],
  beverage: ['Sweet', 'Sour', 'Bitter', 'Fruity', 'Aromatic', 'Smooth', 'Tangy', 'Fresh'],
  generic:  ['Sweet', 'Salty', 'Sour', 'Bitter', 'Aromatic', 'Rich', 'Smooth', 'Fresh'],
};

function matchCategory(category: string): string {
  const c = category.toLowerCase();
  if (/cheese|dairy|milk|cream|butter|yogurt|pbca|plant.based/.test(c)) return 'dairy';
  if (/bread|bak|loaf|pastry|dough|cake|cookie|biscuit|muffin|roll/.test(c)) return 'bread';
  if (/meat|beef|pork|chicken|poultry|lamb|fish|seafood|protein/.test(c)) return 'meat';
  if (/drink|beverage|juice|soda|wine|beer|coffee|tea|water/.test(c)) return 'beverage';
  return 'generic';
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
