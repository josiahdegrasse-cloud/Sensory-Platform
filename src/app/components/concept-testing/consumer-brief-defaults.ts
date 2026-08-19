import { detectFoodType, getFoodTypeProfile } from '../../lib/food-intelligence';

export interface ConsumerBriefSuggestions {
  audience: string;
  occasions: string[];
  promise: string;
  proofCues: string[];
}

const FORM_OCCASIONS: Record<string, string[]> = {
  shredded: ['Cooking and melting', 'Topping everyday meals'],
  grated: ['Cooking and melting', 'Finishing pasta and meals'],
  slices: ['Sandwiches and burgers', 'Quick lunches'],
  block: ['Everyday cooking', 'Snacking and cheese boards'],
  wedge: ['Cheese boards and entertaining', 'Everyday snacking'],
  cubes: ['Snacking and lunchboxes', 'Sharing and entertaining'],
  spreadable: ['Toast, crackers, and sandwiches', 'Breakfast and snacking'],
  sliced_loaf: ['Breakfast and toast', 'Sandwiches and packed lunches'],
  whole_loaf: ['Sharing with meals', 'Breakfast and sandwiches'],
  rolls: ['Lunches and sandwiches', 'Alongside everyday meals'],
  buns: ['Burgers and casual meals', 'Barbecues and entertaining'],
  burger_patties: ['Weeknight meals', 'Barbecues and burgers'],
  sausages: ['Weeknight meals', 'Barbecues and breakfasts'],
  spoonable: ['Breakfast and snacking', 'With fruit or cereal'],
  drinkable: ['Breakfast on the go', 'Convenient snacking'],
  family_tub: ['Family breakfasts', 'Sharing at home'],
  ready_to_drink: ['On the go', 'With everyday meals'],
  bar: ['Personal treats', 'On-the-go snacking'],
  bites: ['Snacking and sharing', 'Lunchboxes and on the go'],
  truffles: ['Gifting and special occasions', 'After-dinner treats'],
  sharing_pieces: ['Sharing and entertaining', 'Evening treats'],
  dip: ['Dipping and sharing', 'Snacks and entertaining'],
  cooking_sauce: ['Weeknight cooking', 'Easy family meals'],
};

const CATEGORY_OCCASIONS: Record<string, string[]> = {
  cheese: ['Everyday meals', 'Snacking and sharing'],
  bread: ['Breakfast and toast', 'Sandwiches and packed lunches'],
  meat: ['Weeknight meals', 'Barbecues and entertaining'],
  yogurt: ['Breakfast and snacking', 'On the go'],
  beverage: ['With meals', 'On the go'],
  snack: ['Between meals', 'On the go'],
  sauce: ['Cooking and dipping', 'Everyday meals'],
  chocolate: ['Personal treats', 'Sharing and gifting'],
  generic: ['Everyday use', 'Sharing and entertaining'],
};

const CUE_LABELS: Record<string, string> = {
  cheese: 'Cheesy',
  cheesy: 'Cheesy',
  butter: 'Buttery',
  buttery: 'Buttery',
  cream: 'Creamy',
  creamy: 'Creamy',
  smooth: 'Smooth',
  appearance: 'Appetising appearance',
  flavour: 'Enjoyable flavour',
  flavor: 'Enjoyable flavour',
  texture: 'Enjoyable texture',
  chocolate: 'Chocolatey',
  cocoa: 'Cocoa-rich',
  sweet: 'Sweet',
  crunchy: 'Crunchy',
  crisp: 'Crisp',
  soft: 'Soft',
  juicy: 'Juicy',
  savoury: 'Savoury',
  savory: 'Savoury',
  rich: 'Rich',
  fresh: 'Fresh',
};

function cleanSignal(value: string) {
  const withoutMeasures = value
    .replace(/\b(?:cata\s*)?\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\b/gi, '')
    .replace(/\b\d+(?:\.\d+)?\s*%\b/g, '')
    .replace(/[():]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!withoutMeasures) return '';
  const key = withoutMeasures.toLowerCase();
  const direct = CUE_LABELS[key];
  if (direct) return direct;
  const matched = Object.entries(CUE_LABELS).find(([candidate]) => key.startsWith(`${candidate} `));
  if (matched) return matched[1];
  if (/instrument|composition|gc-ms|recovery|threshold|protein|salt|fat/i.test(withoutMeasures)) return '';
  return withoutMeasures.charAt(0).toUpperCase() + withoutMeasures.slice(1);
}

function unique(values: string[], limit: number) {
  return [...new Map(values.filter(Boolean).map(value => [value.toLowerCase(), value])).values()].slice(0, limit);
}

function audienceFor(input: { name: string; category: string; slug: string }) {
  const identity = `${input.name} ${input.category}`;
  const alternative = /plant[- ]?based|cashew|coconut|oat|almond|vegan|dairy[- ]?free/i.test(identity);
  if (input.slug === 'cheese') {
    return alternative
      ? 'Flexitarian and plant-curious households looking for a familiar cheese alternative.'
      : 'Households looking for familiar, versatile cheese for everyday meals.';
  }
  if (input.slug === 'bread') return 'Households looking for dependable bread for everyday breakfasts and lunches.';
  if (input.slug === 'meat') return alternative
    ? 'Flexitarian households looking for a satisfying alternative for familiar meals.'
    : 'Households looking for satisfying, dependable options for everyday meals.';
  if (input.slug === 'yogurt') return 'People looking for an enjoyable, convenient option for breakfast or snacking.';
  if (input.slug === 'chocolate') return 'Chocolate buyers looking for an enjoyable treat for themselves or to share.';
  if (input.slug === 'beverage') return 'People looking for an enjoyable drink that fits easily into everyday routines.';
  return `Shoppers looking for an enjoyable ${input.category.toLowerCase() || 'product'} for everyday use.`;
}

function sentenceCueList(cues: string[]) {
  const lowered = cues.map(cue => cue.charAt(0).toLowerCase() + cue.slice(1));
  if (lowered.length <= 1) return lowered[0] ?? '';
  return `${lowered.slice(0, -1).join(', ')} and ${lowered[lowered.length - 1]}`;
}

export function buildConsumerBriefSuggestions(input: {
  name: string;
  category: string;
  productForm?: string | null;
  sensorySignals?: string[];
}): ConsumerBriefSuggestions {
  const detection = detectFoodType(input.category, input.name);
  const profile = getFoodTypeProfile(detection.slug);
  const categorySlug = profile.parentSlug ?? profile.slug;
  const evidenceCues = unique((input.sensorySignals ?? []).map(cleanSignal), 4);
  const proofCues = evidenceCues.length > 0
    ? evidenceCues
    : unique(profile.successMarkers.slice(0, 4).map(cleanSignal), 4);
  const occasions = unique([
    ...(input.productForm ? FORM_OCCASIONS[input.productForm] ?? [] : []),
    ...(CATEGORY_OCCASIONS[categorySlug] ?? CATEGORY_OCCASIONS.generic),
  ], 3);
  const cuePhrase = sentenceCueList(proofCues.slice(0, 2));
  const occasionPhrase = occasions[0]?.toLowerCase() ?? 'everyday use';
  const categoryLabel = input.category.trim() || detection.label;
  const promise = cuePhrase
    ? `${cuePhrase.charAt(0).toUpperCase()}${cuePhrase.slice(1)} ${categoryLabel.toLowerCase()} made for ${occasionPhrase}.`
    : `A familiar ${categoryLabel.toLowerCase()} made for ${occasionPhrase}.`;

  return {
    audience: audienceFor({ name: input.name, category: categoryLabel, slug: categorySlug }),
    occasions,
    promise,
    proofCues,
  };
}
