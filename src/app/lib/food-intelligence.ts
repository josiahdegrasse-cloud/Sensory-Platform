export type CanonicalFoodType = 'cheese' | 'bread' | 'meat' | 'yogurt' | 'beverage' | 'snack' | 'sauce' | 'generic' | string;

export interface FoodTypeDetection {
  slug: CanonicalFoodType;
  label: string;
  confidence: number;
  evidence: string[];
  aliases: string[];
}

export interface FoodTypeProfile {
  slug: CanonicalFoodType;
  label: string;
  aliases: string[];
  cataAttributes: string[];
  intensityAttributes: string[];
  riskMarkers: string[];
  successMarkers: string[];
  decisionWeights: {
    instrumentalFit: number;
    offNoteRisk: number;
    nutrition: number;
    panelAcceptance: number;
  };
}

const PROFILES: FoodTypeProfile[] = [
  {
    slug: 'cheese',
    label: 'Cheese',
    aliases: ['cheese', 'dairy', 'milk', 'cream', 'butter', 'pbca', 'cheddar', 'mozzarella', 'gouda', 'parmesan', 'brie'],
    cataAttributes: ['Milk', 'Creamy', 'Butter', 'Cheese', 'Tangy', 'Fresh', 'Sharp', 'Aged', 'Nutty', 'Salty', 'Umami', 'Smooth', 'Firm', 'Spreadable', 'Crumbly', 'Rancid', 'Cardboard', 'Fermented', 'Bitter', 'Astringent', 'Soapy', 'Coconut', 'Beany', 'Chalky', 'Oily'],
    intensityAttributes: ['Milk', 'Creamy', 'Butter', 'Cheese', 'Tangy', 'Nutty', 'Salty', 'Sweet'],
    riskMarkers: ['rancid', 'cardboard', 'bitter', 'astringent', 'soapy', 'beany', 'chalky'],
    successMarkers: ['creamy', 'buttery', 'cheesy', 'salty', 'umami', 'fresh dairy'],
    decisionWeights: { instrumentalFit: 30, offNoteRisk: 25, nutrition: 15, panelAcceptance: 30 },
  },
  {
    slug: 'bread',
    label: 'Bread',
    aliases: ['bread', 'bakery', 'baked', 'loaf', 'pastry', 'dough', 'sourdough', 'rye', 'brioche', 'baguette', 'focaccia'],
    cataAttributes: ['Yeasty', 'Fresh-baked', 'Malty', 'Wheaty', 'Grainy', 'Honey', 'Nutty', 'Buttery', 'Sweet', 'Salty', 'Soft', 'Crusty', 'Chewy', 'Airy', 'Dense', 'Springy', 'Crumbly', 'Sticky', 'Stale', 'Gummy', 'Sour', 'Bitter', 'Bland', 'Doughy', 'Burnt', 'Musty'],
    intensityAttributes: ['Yeasty', 'Wheaty', 'Buttery', 'Sweet', 'Salty', 'Crusty', 'Malty', 'Soft'],
    riskMarkers: ['stale', 'musty', 'gummy', 'burnt', 'bitter', 'bland'],
    successMarkers: ['fresh-baked', 'yeasty', 'malty', 'wheaty', 'crusty', 'soft'],
    decisionWeights: { instrumentalFit: 35, offNoteRisk: 20, nutrition: 10, panelAcceptance: 35 },
  },
  {
    slug: 'meat',
    label: 'Meat',
    aliases: ['meat', 'beef', 'pork', 'chicken', 'poultry', 'turkey', 'lamb', 'steak', 'burger', 'patty', 'mince', 'sausage', 'bacon', 'ham', 'fish', 'seafood', 'salmon', 'tuna', 'shrimp', 'protein'],
    cataAttributes: ['Beefy', 'Smoky', 'Savory', 'Juicy', 'Fatty', 'Salty', 'Umami', 'Spiced', 'Herby', 'Charred', 'Tender', 'Chewy', 'Firm', 'Dry', 'Fibrous', 'Gamey', 'Rancid', 'Livery', 'Bland', 'Rubbery', 'Sour', 'Beany', 'Sulfurous'],
    intensityAttributes: ['Savory', 'Smoky', 'Salty', 'Umami', 'Spiced', 'Juicy', 'Charred', 'Fatty'],
    riskMarkers: ['rancid', 'livery', 'rubbery', 'beany', 'sulfurous', 'dry', 'cardboard', 'grassy'],
    successMarkers: ['savory', 'umami', 'smoky', 'juicy', 'charred', 'fatty', 'spiced'],
    decisionWeights: { instrumentalFit: 30, offNoteRisk: 30, nutrition: 15, panelAcceptance: 25 },
  },
  {
    slug: 'yogurt',
    label: 'Yogurt',
    aliases: ['yogurt', 'yoghurt', 'skyr', 'kefir', 'cultured dairy'],
    cataAttributes: ['Creamy', 'Tangy', 'Sour', 'Fresh', 'Milky', 'Smooth', 'Thick', 'Sweet', 'Fermented', 'Fruity', 'Watery', 'Chalky', 'Bitter', 'Astringent', 'Artificial'],
    intensityAttributes: ['Creamy', 'Tangy', 'Sour', 'Sweet', 'Milky', 'Thick', 'Smooth', 'Fresh'],
    riskMarkers: ['watery', 'chalky', 'bitter', 'astringent', 'artificial', 'over-fermented'],
    successMarkers: ['creamy', 'tangy', 'fresh', 'milky', 'smooth', 'thick'],
    decisionWeights: { instrumentalFit: 25, offNoteRisk: 25, nutrition: 20, panelAcceptance: 30 },
  },
  {
    slug: 'beverage',
    label: 'Beverage',
    aliases: ['drink', 'beverage', 'juice', 'soda', 'wine', 'beer', 'coffee', 'tea', 'water'],
    cataAttributes: ['Sweet', 'Sour', 'Bitter', 'Tangy', 'Fresh', 'Fruity', 'Floral', 'Earthy', 'Woody', 'Spiced', 'Smooth', 'Astringent', 'Carbonated', 'Thin', 'Full-bodied', 'Off-note', 'Stale', 'Metallic', 'Musty', 'Soapy'],
    intensityAttributes: ['Sweet', 'Sour', 'Bitter', 'Fruity', 'Aromatic', 'Smooth', 'Tangy', 'Fresh'],
    riskMarkers: ['stale', 'metallic', 'musty', 'soapy', 'astringent'],
    successMarkers: ['fresh', 'fruity', 'smooth', 'aromatic', 'balanced'],
    decisionWeights: { instrumentalFit: 25, offNoteRisk: 25, nutrition: 10, panelAcceptance: 40 },
  },
];

export const GENERIC_PROFILE: FoodTypeProfile = {
  slug: 'generic',
  label: 'Generic',
  aliases: [],
  cataAttributes: ['Sweet', 'Salty', 'Sour', 'Bitter', 'Umami', 'Spicy', 'Fresh', 'Aromatic', 'Rich', 'Mild', 'Smooth', 'Soft', 'Firm', 'Crispy', 'Chewy', 'Moist', 'Dry', 'Bland', 'Off-note', 'Stale', 'Burnt'],
  intensityAttributes: ['Sweet', 'Salty', 'Sour', 'Bitter', 'Aromatic', 'Rich', 'Smooth', 'Fresh'],
  riskMarkers: ['off-note', 'stale', 'burnt', 'bitter', 'sour'],
  successMarkers: ['fresh', 'balanced', 'rich', 'smooth'],
  decisionWeights: { instrumentalFit: 30, offNoteRisk: 25, nutrition: 15, panelAcceptance: 30 },
};

export const FOOD_TYPE_PROFILES = PROFILES;

export function slugifyFoodType(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'generic';
}

export function formatFoodTypeLabel(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getFoodTypeProfile(slug: string): FoodTypeProfile {
  return FOOD_TYPE_PROFILES.find(profile => profile.slug === slug) ?? {
    ...GENERIC_PROFILE,
    slug,
    label: formatFoodTypeLabel(slug),
  };
}

export function detectFoodType(...values: Array<string | undefined | null>): FoodTypeDetection {
  const text = values.filter(Boolean).join(' ').toLowerCase();
  const evidence: string[] = [];
  let bestProfile: FoodTypeProfile | null = null;
  let bestScore = 0;

  for (const profile of FOOD_TYPE_PROFILES) {
    const matches = profile.aliases.filter(alias => text.includes(alias.toLowerCase()));
    const score = matches.length;
    if (score > bestScore) {
      bestScore = score;
      bestProfile = profile;
      evidence.splice(0, evidence.length, ...matches);
    }
  }

  if (bestProfile) {
    return {
      slug: bestProfile.slug,
      label: bestProfile.label,
      confidence: Math.min(0.98, 0.65 + bestScore * 0.12),
      evidence,
      aliases: bestProfile.aliases,
    };
  }

  const explicit = values.find(value => value?.trim());
  const slug = slugifyFoodType(explicit ?? 'generic');
  return {
    slug,
    label: slug === 'generic' ? 'Generic' : formatFoodTypeLabel(slug),
    confidence: slug === 'generic' ? 0.25 : 0.45,
    evidence: explicit ? [explicit] : [],
    aliases: [],
  };
}

export function getDefaultCataAttributesForFoodType(slug: string) {
  return [...getFoodTypeProfile(slug).cataAttributes];
}

export function getDefaultIntensityAttributesForFoodType(slug: string) {
  return [...getFoodTypeProfile(slug).intensityAttributes];
}
