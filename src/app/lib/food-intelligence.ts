import { EXTRA_BULK_PRESET_GROUPS } from './food-taxonomy-presets';

export type CanonicalFoodType = 'cheese' | 'bread' | 'meat' | 'yogurt' | 'beverage' | 'snack' | 'sauce' | 'generic' | string;

export interface FoodTypeDetection {
  slug: CanonicalFoodType;
  label: string;
  confidence: number;
  evidence: string[];
  aliases: string[];
  modifiers: FoodTypeModifier[];
}

export interface FoodTypeModifier {
  slug: string;
  label: string;
  aliases: string[];
}

export interface FoodTypeProfile {
  slug: CanonicalFoodType;
  label: string;
  parentSlug?: CanonicalFoodType;
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

export const FOOD_TYPE_MODIFIERS: FoodTypeModifier[] = [
  { slug: 'plant-based', label: 'Plant-Based', aliases: ['plant based', 'plant-based', 'vegan', 'vegetarian', 'meatless', 'dairy free', 'dairy-free', 'non dairy', 'non-dairy'] },
  { slug: 'gluten-free', label: 'Gluten-Free', aliases: ['gluten free', 'gluten-free', 'gf'] },
  { slug: 'organic', label: 'Organic', aliases: ['organic', 'certified organic'] },
  { slug: 'non-gmo', label: 'Non-GMO', aliases: ['non gmo', 'non-gmo', 'nongmo'] },
  { slug: 'kosher', label: 'Kosher', aliases: ['kosher'] },
  { slug: 'halal', label: 'Halal', aliases: ['halal'] },
  { slug: 'keto', label: 'Keto', aliases: ['keto', 'ketogenic'] },
  { slug: 'paleo', label: 'Paleo', aliases: ['paleo'] },
  { slug: 'whole-grain', label: 'Whole-Grain', aliases: ['whole grain', 'whole-grain', 'whole wheat', 'wholemeal'] },
  { slug: 'high-protein', label: 'High-Protein', aliases: ['high protein', 'high-protein', 'protein enriched', 'protein-enriched'] },
  { slug: 'low-sugar', label: 'Low-Sugar', aliases: ['low sugar', 'low-sugar', 'reduced sugar', 'no added sugar', 'sugar free', 'sugar-free'] },
  { slug: 'low-sodium', label: 'Low-Sodium', aliases: ['low sodium', 'low-sodium', 'reduced sodium', 'low salt', 'reduced salt'] },
  { slug: 'low-fat', label: 'Low-Fat', aliases: ['low fat', 'low-fat', 'reduced fat', 'fat free', 'fat-free'] },
  { slug: 'high-fiber', label: 'High-Fiber', aliases: ['high fiber', 'high-fiber', 'fiber enriched', 'fibre enriched'] },
  { slug: 'fortified', label: 'Fortified', aliases: ['fortified', 'enriched', 'vitamin fortified', 'mineral fortified'] },
  { slug: 'probiotic', label: 'Probiotic', aliases: ['probiotic', 'live culture', 'live cultures'] },
  { slug: 'fermented', label: 'Fermented', aliases: ['fermented', 'cultured'] },
  { slug: 'smoked', label: 'Smoked', aliases: ['smoked', 'smokehouse'] },
  { slug: 'roasted', label: 'Roasted', aliases: ['roasted', 'oven roasted', 'fire roasted'] },
  { slug: 'grilled', label: 'Grilled', aliases: ['grilled', 'char grilled', 'char-grilled'] },
  { slug: 'fried', label: 'Fried', aliases: ['fried', 'deep fried', 'deep-fried', 'pan fried', 'pan-fried'] },
  { slug: 'baked', label: 'Baked', aliases: ['baked', 'oven baked', 'oven-baked'] },
  { slug: 'raw', label: 'Raw', aliases: ['raw', 'uncooked'] },
  { slug: 'fresh', label: 'Fresh', aliases: ['fresh', 'fresh cut', 'fresh-cut'] },
  { slug: 'frozen', label: 'Frozen', aliases: ['frozen', 'individually quick frozen', 'iqf'] },
  { slug: 'shelf-stable', label: 'Shelf-Stable', aliases: ['shelf stable', 'shelf-stable', 'ambient'] },
  { slug: 'ready-to-eat', label: 'Ready-to-Eat', aliases: ['ready to eat', 'ready-to-eat', 'rte'] },
  { slug: 'ready-to-cook', label: 'Ready-to-Cook', aliases: ['ready to cook', 'ready-to-cook', 'rtc'] },
  { slug: 'spicy', label: 'Spicy', aliases: ['spicy', 'hot', 'chili', 'chilli'] },
  { slug: 'sweetened', label: 'Sweetened', aliases: ['sweetened'] },
  { slug: 'unsweetened', label: 'Unsweetened', aliases: ['unsweetened', 'no sweetener'] },
];

const COMPOSITIONAL_MODIFIER_SLUGS = new Set([
  'plant-based',
  'gluten-free',
  'organic',
  'non-gmo',
  'kosher',
  'halal',
  'keto',
  'paleo',
  'whole-grain',
  'high-protein',
  'low-sugar',
  'low-sodium',
  'low-fat',
  'high-fiber',
  'fortified',
  'probiotic',
  'sweetened',
  'unsweetened',
]);

const PROFILES: FoodTypeProfile[] = [
  {
    slug: 'cheese',
    label: 'Cheese',
    aliases: ['cheese', 'dairy', 'milk', 'cream', 'butter', 'pbca', 'cheddar', 'mozzarella', 'mozza', 'gouda', 'parmesan', 'brie'],
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
    aliases: ['meat', 'beef', 'pork', 'chicken', 'poultry', 'turkey', 'lamb', 'steak', 'burger', 'patty', 'mince', 'sausage', 'bacon', 'ham', 'protein'],
    cataAttributes: ['Beefy', 'Smoky', 'Savory', 'Juicy', 'Fatty', 'Salty', 'Umami', 'Spiced', 'Herby', 'Charred', 'Tender', 'Chewy', 'Firm', 'Dry', 'Fibrous', 'Gamey', 'Rancid', 'Livery', 'Bland', 'Rubbery', 'Sour', 'Beany', 'Sulfurous'],
    intensityAttributes: ['Savory', 'Smoky', 'Salty', 'Umami', 'Spiced', 'Juicy', 'Charred', 'Fatty'],
    riskMarkers: ['rancid', 'livery', 'rubbery', 'beany', 'sulfurous', 'dry', 'cardboard', 'grassy'],
    successMarkers: ['savory', 'umami', 'smoky', 'juicy', 'charred', 'fatty', 'spiced'],
    decisionWeights: { instrumentalFit: 30, offNoteRisk: 30, nutrition: 15, panelAcceptance: 25 },
  },
  {
    slug: 'seafood',
    label: 'Seafood',
    aliases: ['seafood', 'fish', 'salmon', 'tuna', 'cod', 'haddock', 'shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'mussel', 'clam', 'oyster', 'sushi'],
    cataAttributes: ['Fresh', 'Marine', 'Briny', 'Sweet', 'Salty', 'Umami', 'Buttery', 'Mild', 'Firm', 'Flaky', 'Tender', 'Juicy', 'Smoky', 'Fishy', 'Muddy', 'Metallic', 'Ammonia', 'Rancid', 'Rubbery', 'Dry'],
    intensityAttributes: ['Marine', 'Briny', 'Sweet', 'Salty', 'Umami', 'Fishy', 'Firm', 'Tender'],
    riskMarkers: ['fishy', 'muddy', 'metallic', 'ammonia', 'rancid', 'rubbery', 'dry'],
    successMarkers: ['fresh', 'briny', 'mild', 'sweet', 'flaky', 'tender'],
    decisionWeights: { instrumentalFit: 30, offNoteRisk: 35, nutrition: 10, panelAcceptance: 25 },
  },
  {
    slug: 'egg',
    label: 'Egg',
    aliases: ['egg', 'eggs', 'omelet', 'omelette', 'scramble', 'frittata', 'quiche', 'mayonnaise', 'mayo'],
    cataAttributes: ['Eggy', 'Savory', 'Sulfurous', 'Buttery', 'Creamy', 'Salty', 'Umami', 'Mild', 'Rich', 'Tender', 'Firm', 'Rubbery', 'Watery', 'Dry', 'Chalky', 'Metallic', 'Bitter'],
    intensityAttributes: ['Eggy', 'Savory', 'Sulfurous', 'Salty', 'Creamy', 'Firm', 'Rubbery', 'Rich'],
    riskMarkers: ['sulfurous', 'rubbery', 'watery', 'chalky', 'metallic', 'bitter'],
    successMarkers: ['eggy', 'savory', 'creamy', 'tender', 'rich', 'mild'],
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
  {
    slug: 'snack',
    label: 'Snack',
    aliases: ['snack', 'chips', 'crisps', 'cracker', 'pretzel', 'bar', 'granola', 'popcorn', 'puff', 'trail mix'],
    cataAttributes: ['Crunchy', 'Crispy', 'Salty', 'Savory', 'Toasted', 'Roasted', 'Nutty', 'Sweet', 'Spiced', 'Buttery', 'Light', 'Dense', 'Greasy', 'Dry', 'Stale', 'Bitter', 'Burnt', 'Bland'],
    intensityAttributes: ['Crunchy', 'Salty', 'Savory', 'Toasted', 'Sweet', 'Spiced', 'Greasy', 'Bitter'],
    riskMarkers: ['stale', 'greasy', 'burnt', 'bitter', 'bland', 'dry'],
    successMarkers: ['crunchy', 'crispy', 'savory', 'toasted', 'balanced salt', 'snackable'],
    decisionWeights: { instrumentalFit: 25, offNoteRisk: 20, nutrition: 15, panelAcceptance: 40 },
  },
  {
    slug: 'sauce',
    label: 'Sauce',
    aliases: ['sauce', 'tomato sauce', 'chili sauce', 'hot sauce', 'pepper sauce', 'herb sauce', 'basil sauce', 'dip', 'dressing', 'condiment', 'salsa', 'marinade', 'spread', 'aioli', 'ketchup', 'mustard'],
    cataAttributes: ['Savory', 'Tangy', 'Sweet', 'Sour', 'Salty', 'Spicy', 'Umami', 'Herbal', 'Garlic', 'Creamy', 'Smooth', 'Thick', 'Thin', 'Oily', 'Watery', 'Bitter', 'Metallic', 'Artificial'],
    intensityAttributes: ['Tangy', 'Sweet', 'Salty', 'Spicy', 'Umami', 'Creamy', 'Thick', 'Herbal'],
    riskMarkers: ['watery', 'oily', 'bitter', 'metallic', 'artificial', 'unbalanced'],
    successMarkers: ['balanced', 'savory', 'tangy', 'creamy', 'fresh', 'flavorful'],
    decisionWeights: { instrumentalFit: 25, offNoteRisk: 25, nutrition: 10, panelAcceptance: 40 },
  },
  {
    slug: 'fruit',
    label: 'Fruit',
    aliases: ['fruit', 'apple', 'banana', 'berry', 'berries', 'strawberry', 'blueberry', 'raspberry', 'cherry', 'citrus', 'orange', 'lemon', 'lime', 'grape', 'mango', 'pineapple', 'peach', 'pear', 'melon'],
    cataAttributes: ['Fresh', 'Fruity', 'Sweet', 'Sour', 'Tart', 'Juicy', 'Ripe', 'Green', 'Floral', 'Citrus', 'Tropical', 'Jammy', 'Crisp', 'Soft', 'Fibrous', 'Watery', 'Fermented', 'Bruised', 'Bitter', 'Astringent', 'Musty'],
    intensityAttributes: ['Sweet', 'Sour', 'Tart', 'Fruity', 'Juicy', 'Ripe', 'Citrus', 'Fresh'],
    riskMarkers: ['fermented', 'bruised', 'musty', 'bitter', 'astringent', 'watery'],
    successMarkers: ['fresh', 'fruity', 'ripe', 'juicy', 'balanced sweetness', 'bright acidity'],
    decisionWeights: { instrumentalFit: 25, offNoteRisk: 20, nutrition: 15, panelAcceptance: 40 },
  },
  {
    slug: 'vegetable',
    label: 'Vegetable',
    aliases: ['vegetable', 'vegetables', 'veg', 'tomato', 'carrot', 'broccoli', 'cauliflower', 'spinach', 'kale', 'lettuce', 'pepper', 'onion', 'garlic', 'mushroom', 'potato', 'sweet potato', 'corn', 'pea', 'beet'],
    cataAttributes: ['Fresh', 'Green', 'Earthy', 'Sweet', 'Bitter', 'Savory', 'Herbal', 'Grassy', 'Peppery', 'Sulfurous', 'Cooked', 'Roasted', 'Crisp', 'Crunchy', 'Tender', 'Fibrous', 'Watery', 'Mushy', 'Musty', 'Metallic'],
    intensityAttributes: ['Fresh', 'Green', 'Earthy', 'Sweet', 'Bitter', 'Herbal', 'Crunchy', 'Tender'],
    riskMarkers: ['musty', 'metallic', 'mushy', 'watery', 'sulfurous', 'bitter'],
    successMarkers: ['fresh', 'green', 'sweet', 'crisp', 'roasted', 'savory'],
    decisionWeights: { instrumentalFit: 30, offNoteRisk: 25, nutrition: 15, panelAcceptance: 30 },
  },
  {
    slug: 'grain-cereal',
    label: 'Grain & Cereal',
    aliases: ['cereal', 'grain', 'grains', 'oat', 'oats', 'oatmeal', 'wheat', 'barley', 'quinoa', 'millet', 'muesli', 'porridge', 'breakfast cereal'],
    cataAttributes: ['Grainy', 'Toasted', 'Malty', 'Nutty', 'Wheaty', 'Oaty', 'Sweet', 'Honey', 'Earthy', 'Bran', 'Crispy', 'Crunchy', 'Chewy', 'Soft', 'Dry', 'Cardboard', 'Stale', 'Bitter', 'Dusty'],
    intensityAttributes: ['Grainy', 'Toasted', 'Malty', 'Nutty', 'Sweet', 'Crunchy', 'Chewy', 'Dry'],
    riskMarkers: ['stale', 'cardboard', 'dusty', 'bitter', 'dry', 'musty'],
    successMarkers: ['toasted', 'grainy', 'malty', 'nutty', 'crispy', 'balanced sweetness'],
    decisionWeights: { instrumentalFit: 30, offNoteRisk: 20, nutrition: 20, panelAcceptance: 30 },
  },
  {
    slug: 'pasta-noodle',
    label: 'Pasta & Noodle',
    aliases: ['pasta', 'noodle', 'noodles', 'spaghetti', 'macaroni', 'ramen', 'udon', 'soba', 'gnocchi', 'dumpling'],
    cataAttributes: ['Wheaty', 'Eggy', 'Neutral', 'Salty', 'Savory', 'Starchy', 'Chewy', 'Springy', 'Tender', 'Firm', 'Sticky', 'Soft', 'Mushy', 'Gummy', 'Dry', 'Bland', 'Bitter'],
    intensityAttributes: ['Wheaty', 'Starchy', 'Salty', 'Savory', 'Chewy', 'Firm', 'Sticky', 'Tender'],
    riskMarkers: ['mushy', 'gummy', 'sticky', 'dry', 'bland', 'bitter'],
    successMarkers: ['springy', 'firm', 'tender', 'wheaty', 'neutral', 'sauce-carrying'],
    decisionWeights: { instrumentalFit: 35, offNoteRisk: 20, nutrition: 10, panelAcceptance: 35 },
  },
  {
    slug: 'rice',
    label: 'Rice',
    aliases: ['rice', 'risotto', 'paella', 'pilaf', 'sushi rice', 'brown rice', 'basmati', 'jasmine rice'],
    cataAttributes: ['Starchy', 'Nutty', 'Toasted', 'Sweet', 'Earthy', 'Floral', 'Neutral', 'Savory', 'Soft', 'Sticky', 'Fluffy', 'Chewy', 'Firm', 'Dry', 'Mushy', 'Gummy', 'Bland', 'Stale'],
    intensityAttributes: ['Starchy', 'Nutty', 'Sweet', 'Floral', 'Sticky', 'Fluffy', 'Chewy', 'Dry'],
    riskMarkers: ['mushy', 'gummy', 'dry', 'stale', 'bland', 'musty'],
    successMarkers: ['fluffy', 'tender', 'nutty', 'aromatic', 'clean', 'balanced'],
    decisionWeights: { instrumentalFit: 35, offNoteRisk: 20, nutrition: 10, panelAcceptance: 35 },
  },
  {
    slug: 'legume',
    label: 'Legume',
    aliases: ['legume', 'bean', 'beans', 'pea', 'peas', 'lentil', 'lentils', 'chickpea', 'chickpeas', 'hummus', 'soy', 'tofu', 'tempeh', 'edamame', 'falafel'],
    cataAttributes: ['Beany', 'Nutty', 'Earthy', 'Savory', 'Umami', 'Green', 'Grassy', 'Sweet', 'Creamy', 'Firm', 'Mealy', 'Gritty', 'Chalky', 'Dry', 'Bitter', 'Astringent', 'Metallic'],
    intensityAttributes: ['Beany', 'Nutty', 'Earthy', 'Savory', 'Green', 'Creamy', 'Firm', 'Chalky'],
    riskMarkers: ['beany', 'grassy', 'chalky', 'mealy', 'bitter', 'astringent', 'metallic'],
    successMarkers: ['nutty', 'savory', 'creamy', 'firm', 'clean', 'umami'],
    decisionWeights: { instrumentalFit: 30, offNoteRisk: 30, nutrition: 20, panelAcceptance: 20 },
  },
  {
    slug: 'nut-seed',
    label: 'Nut & Seed',
    aliases: ['nut', 'nuts', 'seed', 'seeds', 'almond', 'cashew', 'peanut', 'walnut', 'hazelnut', 'pistachio', 'pecan', 'sunflower', 'sesame', 'tahini', 'chia', 'flax'],
    cataAttributes: ['Nutty', 'Roasted', 'Toasted', 'Sweet', 'Earthy', 'Buttery', 'Creamy', 'Oily', 'Rich', 'Crunchy', 'Crisp', 'Firm', 'Dry', 'Bitter', 'Rancid', 'Cardboard', 'Burnt', 'Astringent'],
    intensityAttributes: ['Nutty', 'Roasted', 'Toasted', 'Sweet', 'Oily', 'Crunchy', 'Bitter', 'Rich'],
    riskMarkers: ['rancid', 'cardboard', 'burnt', 'bitter', 'astringent', 'stale'],
    successMarkers: ['nutty', 'roasted', 'toasted', 'fresh', 'crunchy', 'rich'],
    decisionWeights: { instrumentalFit: 25, offNoteRisk: 30, nutrition: 15, panelAcceptance: 30 },
  },
  {
    slug: 'dessert',
    label: 'Dessert',
    aliases: ['dessert', 'cake', 'cookie', 'cookies', 'brownie', 'pie', 'pudding', 'custard', 'mousse', 'cheesecake', 'donut', 'doughnut', 'pastry dessert'],
    cataAttributes: ['Sweet', 'Vanilla', 'Chocolate', 'Caramel', 'Buttery', 'Creamy', 'Rich', 'Fruity', 'Spiced', 'Toasted', 'Moist', 'Soft', 'Dense', 'Fluffy', 'Crumbly', 'Dry', 'Stale', 'Burnt', 'Artificial', 'Bitter'],
    intensityAttributes: ['Sweet', 'Vanilla', 'Chocolate', 'Buttery', 'Creamy', 'Rich', 'Moist', 'Dry'],
    riskMarkers: ['stale', 'dry', 'burnt', 'artificial', 'bitter', 'cloying'],
    successMarkers: ['sweet', 'rich', 'moist', 'creamy', 'balanced', 'indulgent'],
    decisionWeights: { instrumentalFit: 20, offNoteRisk: 20, nutrition: 10, panelAcceptance: 50 },
  },
  {
    slug: 'frozen-dessert',
    label: 'Frozen Dessert',
    aliases: ['frozen dessert', 'ice cream', 'icecream', 'gelato', 'sorbet', 'sherbet', 'frozen yogurt', 'popsicle', 'ice lolly'],
    cataAttributes: ['Sweet', 'Creamy', 'Milky', 'Vanilla', 'Chocolate', 'Fruity', 'Cold', 'Smooth', 'Rich', 'Icy', 'Melty', 'Thick', 'Thin', 'Watery', 'Gritty', 'Chalky', 'Artificial', 'Bitter'],
    intensityAttributes: ['Sweet', 'Creamy', 'Milky', 'Fruity', 'Cold', 'Smooth', 'Icy', 'Rich'],
    riskMarkers: ['icy', 'watery', 'gritty', 'chalky', 'artificial', 'bitter'],
    successMarkers: ['creamy', 'smooth', 'rich', 'balanced sweetness', 'clean melt', 'fresh'],
    decisionWeights: { instrumentalFit: 25, offNoteRisk: 25, nutrition: 10, panelAcceptance: 40 },
  },
  {
    slug: 'confectionery',
    label: 'Confectionery',
    aliases: ['confectionery', 'candy', 'sweets', 'sweet', 'chocolate', 'gummy', 'gum', 'toffee', 'caramel', 'fudge', 'licorice', 'marshmallow'],
    cataAttributes: ['Sweet', 'Chocolate', 'Caramel', 'Vanilla', 'Fruity', 'Sour', 'Bitter', 'Milky', 'Nutty', 'Waxy', 'Chewy', 'Sticky', 'Hard', 'Soft', 'Smooth', 'Grainy', 'Artificial', 'Chemical', 'Burnt'],
    intensityAttributes: ['Sweet', 'Chocolate', 'Caramel', 'Fruity', 'Sour', 'Bitter', 'Chewy', 'Sticky'],
    riskMarkers: ['waxy', 'grainy', 'artificial', 'chemical', 'burnt', 'cloying'],
    successMarkers: ['balanced sweetness', 'smooth', 'clean flavor', 'pleasant chew', 'rich', 'bright'],
    decisionWeights: { instrumentalFit: 20, offNoteRisk: 25, nutrition: 5, panelAcceptance: 50 },
  },
  {
    slug: 'soup',
    label: 'Soup',
    aliases: ['soup', 'broth', 'stock', 'bisque', 'chowder', 'stew', 'ramen broth'],
    cataAttributes: ['Savory', 'Umami', 'Salty', 'Sweet', 'Herbal', 'Spiced', 'Roasted', 'Vegetable', 'Meaty', 'Creamy', 'Rich', 'Thin', 'Watery', 'Thick', 'Grainy', 'Bitter', 'Metallic', 'Stale'],
    intensityAttributes: ['Savory', 'Umami', 'Salty', 'Herbal', 'Spiced', 'Creamy', 'Rich', 'Thin'],
    riskMarkers: ['watery', 'metallic', 'bitter', 'stale', 'grainy', 'unbalanced'],
    successMarkers: ['savory', 'umami', 'balanced salt', 'rich', 'aromatic', 'comforting'],
    decisionWeights: { instrumentalFit: 25, offNoteRisk: 25, nutrition: 15, panelAcceptance: 35 },
  },
  {
    slug: 'ready-meal',
    label: 'Ready Meal',
    aliases: ['ready meal', 'meal', 'entree', 'main dish', 'prepared meal', 'frozen meal', 'meal kit', 'casserole', 'bowl', 'wrap', 'sandwich', 'pizza'],
    cataAttributes: ['Savory', 'Balanced', 'Salty', 'Sweet', 'Spiced', 'Umami', 'Herbal', 'Roasted', 'Fresh', 'Rich', 'Creamy', 'Crispy', 'Tender', 'Chewy', 'Dry', 'Soggy', 'Bland', 'Stale', 'Artificial'],
    intensityAttributes: ['Savory', 'Salty', 'Spiced', 'Umami', 'Fresh', 'Rich', 'Crispy', 'Tender'],
    riskMarkers: ['soggy', 'dry', 'bland', 'stale', 'artificial', 'unbalanced'],
    successMarkers: ['balanced', 'savory', 'fresh', 'tender', 'satisfying', 'aromatic'],
    decisionWeights: { instrumentalFit: 25, offNoteRisk: 25, nutrition: 15, panelAcceptance: 35 },
  },
  {
    slug: 'salad',
    label: 'Salad',
    aliases: ['salad', 'slaw', 'coleslaw', 'greens', 'grain bowl', 'poke bowl'],
    cataAttributes: ['Fresh', 'Green', 'Crisp', 'Crunchy', 'Juicy', 'Tangy', 'Sweet', 'Sour', 'Bitter', 'Herbal', 'Peppery', 'Creamy', 'Watery', 'Wilted', 'Oxidized', 'Musty', 'Bland'],
    intensityAttributes: ['Fresh', 'Green', 'Crisp', 'Tangy', 'Sweet', 'Bitter', 'Herbal', 'Creamy'],
    riskMarkers: ['wilted', 'oxidized', 'watery', 'musty', 'bland', 'bitter'],
    successMarkers: ['fresh', 'crisp', 'balanced dressing', 'bright', 'juicy', 'clean'],
    decisionWeights: { instrumentalFit: 25, offNoteRisk: 25, nutrition: 20, panelAcceptance: 30 },
  },
  {
    slug: 'oil-fat',
    label: 'Oil & Fat',
    aliases: ['oil', 'fat', 'shortening', 'margarine', 'ghee', 'lard', 'olive oil', 'coconut oil', 'butter oil'],
    cataAttributes: ['Oily', 'Fatty', 'Buttery', 'Rich', 'Smooth', 'Coating', 'Neutral', 'Nutty', 'Grassy', 'Waxy', 'Rancid', 'Oxidized', 'Bitter', 'Metallic', 'Soapy', 'Heavy'],
    intensityAttributes: ['Oily', 'Fatty', 'Buttery', 'Rich', 'Smooth', 'Waxy', 'Rancid', 'Bitter'],
    riskMarkers: ['rancid', 'oxidized', 'waxy', 'metallic', 'soapy', 'bitter'],
    successMarkers: ['clean', 'smooth', 'rich', 'fresh', 'neutral', 'buttery'],
    decisionWeights: { instrumentalFit: 30, offNoteRisk: 35, nutrition: 10, panelAcceptance: 25 },
  },
  {
    slug: 'fermented-pickle',
    label: 'Fermented & Pickled',
    aliases: ['fermented', 'pickle', 'pickled', 'kimchi', 'sauerkraut', 'kombucha', 'miso', 'vinegar', 'brine', 'kraut'],
    cataAttributes: ['Tangy', 'Sour', 'Acidic', 'Salty', 'Fermented', 'Umami', 'Funky', 'Spicy', 'Garlic', 'Crisp', 'Crunchy', 'Soft', 'Pungent', 'Yeasty', 'Over-fermented', 'Bitter', 'Musty'],
    intensityAttributes: ['Tangy', 'Sour', 'Acidic', 'Salty', 'Fermented', 'Umami', 'Funky', 'Crisp'],
    riskMarkers: ['over-fermented', 'musty', 'bitter', 'pungent', 'soft', 'unbalanced acidity'],
    successMarkers: ['bright acidity', 'balanced salt', 'crisp', 'complex', 'umami', 'fresh'],
    decisionWeights: { instrumentalFit: 30, offNoteRisk: 30, nutrition: 10, panelAcceptance: 30 },
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

type PresetFoodTypeSpec = {
  slug: CanonicalFoodType;
  label: string;
  parentSlug: CanonicalFoodType;
  aliases: string[];
  cata?: string[];
  intensity?: string[];
  risk?: string[];
  success?: string[];
};

const PRESET_FOOD_TYPE_SPECS: PresetFoodTypeSpec[] = [
  { slug: 'cheddar', label: 'Cheddar', parentSlug: 'cheese', aliases: ['cheddar', 'cheddar cheese', 'mild cheddar', 'sharp cheddar', 'white cheddar'], cata: ['Sharp', 'Cheddar', 'Aged'] },
  { slug: 'mozzarella', label: 'Mozzarella', parentSlug: 'cheese', aliases: ['mozzarella', 'mozzarella cheese', 'mozza', 'fresh mozzarella', 'low moisture mozzarella'], cata: ['Milky', 'Mild', 'Stretchy'] },
  { slug: 'gouda', label: 'Gouda', parentSlug: 'cheese', aliases: ['gouda', 'gouda cheese', 'smoked gouda', 'aged gouda'], cata: ['Nutty', 'Caramel', 'Aged'] },
  { slug: 'parmesan', label: 'Parmesan', parentSlug: 'cheese', aliases: ['parmesan', 'parmesan cheese', 'parmigiano', 'grana padano'], cata: ['Aged', 'Salty', 'Umami'] },
  { slug: 'brie', label: 'Brie', parentSlug: 'cheese', aliases: ['brie', 'brie cheese', 'double cream brie'], cata: ['Creamy', 'Mushroom', 'Rind'] },
  { slug: 'blue-cheese', label: 'Blue Cheese', parentSlug: 'cheese', aliases: ['blue cheese', 'gorgonzola', 'roquefort', 'stilton'], cata: ['Blue', 'Pungent', 'Sharp'] },
  { slug: 'feta', label: 'Feta', parentSlug: 'cheese', aliases: ['feta', 'feta cheese'], cata: ['Briny', 'Crumbly', 'Tangy'] },
  { slug: 'goat-cheese', label: 'Goat Cheese', parentSlug: 'cheese', aliases: ['goat cheese', 'chevre'], cata: ['Goaty', 'Tangy', 'Creamy'] },
  { slug: 'cream-cheese', label: 'Cream Cheese', parentSlug: 'cheese', aliases: ['cream cheese', 'spreadable cheese'], cata: ['Creamy', 'Spreadable', 'Tangy'] },
  { slug: 'cottage-cheese', label: 'Cottage Cheese', parentSlug: 'cheese', aliases: ['cottage cheese', 'curds'], cata: ['Milky', 'Curdy', 'Watery'] },
  { slug: 'ricotta', label: 'Ricotta', parentSlug: 'cheese', aliases: ['ricotta', 'ricotta cheese'], cata: ['Milky', 'Grainy', 'Sweet'] },
  { slug: 'queso', label: 'Queso', parentSlug: 'cheese', aliases: ['queso', 'queso fresco', 'queso blanco', 'queso dip'], cata: ['Milky', 'Salty', 'Fresh'] },
  { slug: 'plant-based-cheese', label: 'Plant-Based Cheese', parentSlug: 'cheese', aliases: ['plant based cheese', 'plant-based cheese', 'vegan cheese', 'dairy free cheese', 'dairy-free cheese', 'coconut based cheese', 'coconut-based cheese', 'cashew cheese', 'almond cheese', 'oat cheese'], cata: ['Creamy', 'Cheesy', 'Plant-based'] },

  { slug: 'sourdough', label: 'Sourdough', parentSlug: 'bread', aliases: ['sourdough', 'sourdough bread', 'sourdough loaf', 'sourdough boule'], cata: ['Sour', 'Crusty', 'Fermented'] },
  { slug: 'baguette', label: 'Baguette', parentSlug: 'bread', aliases: ['baguette', 'french baguette'], cata: ['Crusty', 'Chewy', 'Fresh-baked'] },
  { slug: 'brioche', label: 'Brioche', parentSlug: 'bread', aliases: ['brioche', 'brioche bun', 'brioche loaf'], cata: ['Buttery', 'Sweet', 'Soft'] },
  { slug: 'rye-bread', label: 'Rye Bread', parentSlug: 'bread', aliases: ['rye bread', 'rye loaf', 'pumpernickel'], cata: ['Rye', 'Earthy', 'Sour'] },
  { slug: 'whole-wheat-bread', label: 'Whole Wheat Bread', parentSlug: 'bread', aliases: ['whole wheat bread', 'wholemeal bread', 'wheat bread'], cata: ['Wheaty', 'Grainy', 'Nutty'] },
  { slug: 'white-bread', label: 'White Bread', parentSlug: 'bread', aliases: ['white bread', 'sandwich bread', 'white sandwich'], cata: ['Soft', 'Mild', 'Sweet'] },
  { slug: 'flatbread', label: 'Flatbread', parentSlug: 'bread', aliases: ['flatbread', 'naan', 'pita', 'lavash', 'roti'], cata: ['Chewy', 'Toasted', 'Soft'] },
  { slug: 'tortilla', label: 'Tortilla', parentSlug: 'bread', aliases: ['tortilla', 'corn tortilla', 'flour tortilla', 'wrap tortilla'], cata: ['Corn', 'Wheaty', 'Flexible'] },
  { slug: 'bagel', label: 'Bagel', parentSlug: 'bread', aliases: ['bagel', 'everything bagel'], cata: ['Chewy', 'Dense', 'Malty'] },
  { slug: 'english-muffin', label: 'English Muffin', parentSlug: 'bread', aliases: ['english muffin', 'muffin bread'], cata: ['Toasted', 'Nooks', 'Chewy'] },
  { slug: 'croissant', label: 'Croissant', parentSlug: 'bread', aliases: ['croissant', 'butter croissant', 'pain au chocolat'], cata: ['Buttery', 'Flaky', 'Rich'] },
  { slug: 'muffin', label: 'Muffin', parentSlug: 'bread', aliases: ['muffin', 'blueberry muffin', 'corn muffin'], cata: ['Moist', 'Sweet', 'Crumbly'] },

  { slug: 'beef', label: 'Beef', parentSlug: 'meat', aliases: ['beef', 'steak', 'ground beef', 'beef patty', 'beef burger'], cata: ['Beefy', 'Juicy', 'Charred'] },
  { slug: 'pork', label: 'Pork', parentSlug: 'meat', aliases: ['pork', 'pork chop', 'pulled pork'], cata: ['Porky', 'Savory', 'Fatty'] },
  { slug: 'chicken', label: 'Chicken', parentSlug: 'meat', aliases: ['chicken', 'chicken breast', 'chicken thigh', 'chicken nugget'], cata: ['Chicken', 'Savory', 'Tender'] },
  { slug: 'turkey', label: 'Turkey', parentSlug: 'meat', aliases: ['turkey', 'turkey breast', 'turkey burger'], cata: ['Turkey', 'Lean', 'Savory'] },
  { slug: 'lamb', label: 'Lamb', parentSlug: 'meat', aliases: ['lamb', 'lamb chop', 'mutton'], cata: ['Gamey', 'Savory', 'Fatty'] },
  { slug: 'duck', label: 'Duck', parentSlug: 'meat', aliases: ['duck', 'duck breast', 'confit duck'], cata: ['Rich', 'Gamey', 'Fatty'] },
  { slug: 'sausage', label: 'Sausage', parentSlug: 'meat', aliases: ['sausage', 'bratwurst', 'chorizo', 'salami', 'pepperoni'], cata: ['Spiced', 'Fatty', 'Savory'] },
  { slug: 'bacon', label: 'Bacon', parentSlug: 'meat', aliases: ['bacon', 'pancetta', 'lardon'], cata: ['Smoky', 'Salty', 'Crispy'] },
  { slug: 'ham', label: 'Ham', parentSlug: 'meat', aliases: ['ham', 'prosciutto', 'cured ham'], cata: ['Salty', 'Cured', 'Savory'] },
  { slug: 'plant-based-meat', label: 'Plant-Based Meat', parentSlug: 'meat', aliases: ['plant based meat', 'plant-based meat', 'meat alternative', 'vegan meat', 'soy meat', 'pea protein burger'], cata: ['Savory', 'Beany', 'Umami'] },

  { slug: 'salmon', label: 'Salmon', parentSlug: 'seafood', aliases: ['salmon', 'salmon fillet', 'smoked salmon'], cata: ['Fatty', 'Marine', 'Buttery'] },
  { slug: 'tuna', label: 'Tuna', parentSlug: 'seafood', aliases: ['tuna', 'ahi tuna', 'yellowfin tuna'], cata: ['Meaty', 'Marine', 'Firm'] },
  { slug: 'cod', label: 'Cod', parentSlug: 'seafood', aliases: ['cod', 'cod fillet', 'white fish'], cata: ['Mild', 'Flaky', 'Clean'] },
  { slug: 'shrimp', label: 'Shrimp', parentSlug: 'seafood', aliases: ['shrimp', 'prawn', 'prawns'], cata: ['Sweet', 'Briny', 'Firm'] },
  { slug: 'crab', label: 'Crab', parentSlug: 'seafood', aliases: ['crab', 'crab meat', 'crab cake'], cata: ['Sweet', 'Briny', 'Delicate'] },
  { slug: 'lobster', label: 'Lobster', parentSlug: 'seafood', aliases: ['lobster', 'lobster tail'], cata: ['Sweet', 'Buttery', 'Firm'] },
  { slug: 'scallop', label: 'Scallop', parentSlug: 'seafood', aliases: ['scallop', 'scallops'], cata: ['Sweet', 'Tender', 'Buttery'] },
  { slug: 'oyster', label: 'Oyster', parentSlug: 'seafood', aliases: ['oyster', 'oysters'], cata: ['Briny', 'Mineral', 'Fresh'] },
  { slug: 'sushi', label: 'Sushi', parentSlug: 'seafood', aliases: ['sushi', 'sashimi', 'nigiri', 'maki'], cata: ['Fresh', 'Marine', 'Rice'] },

  { slug: 'scrambled-egg', label: 'Scrambled Egg', parentSlug: 'egg', aliases: ['scrambled egg', 'scrambled eggs'], cata: ['Eggy', 'Creamy', 'Tender'] },
  { slug: 'boiled-egg', label: 'Boiled Egg', parentSlug: 'egg', aliases: ['boiled egg', 'hard boiled egg', 'soft boiled egg'], cata: ['Eggy', 'Sulfurous', 'Firm'] },
  { slug: 'omelet', label: 'Omelet', parentSlug: 'egg', aliases: ['omelet', 'omelette'], cata: ['Eggy', 'Savory', 'Tender'] },
  { slug: 'plant-based-egg', label: 'Plant-Based Egg', parentSlug: 'egg', aliases: ['plant based egg', 'vegan egg', 'egg alternative', 'mung bean egg'], cata: ['Eggy', 'Beany', 'Savory'] },

  { slug: 'greek-yogurt', label: 'Greek Yogurt', parentSlug: 'yogurt', aliases: ['greek yogurt', 'greek yoghurt'], cata: ['Thick', 'Tangy', 'Creamy'] },
  { slug: 'skyr', label: 'Skyr', parentSlug: 'yogurt', aliases: ['skyr', 'icelandic yogurt'], cata: ['Thick', 'Tangy', 'High protein'] },
  { slug: 'kefir', label: 'Kefir', parentSlug: 'yogurt', aliases: ['kefir', 'drinkable yogurt'], cata: ['Tangy', 'Fermented', 'Thin'] },
  { slug: 'plant-based-yogurt', label: 'Plant-Based Yogurt', parentSlug: 'yogurt', aliases: ['plant based yogurt', 'plant-based yogurt', 'coconut yogurt', 'coconut yoghurt', 'almond yogurt', 'almond yoghurt', 'soy yogurt', 'soy yoghurt', 'oat yogurt', 'oat yoghurt'], cata: ['Creamy', 'Tangy', 'Plant-based'] },

  { slug: 'water', label: 'Water', parentSlug: 'beverage', aliases: ['water', 'still water', 'sparkling water', 'mineral water'], cata: ['Clean', 'Mineral', 'Neutral'] },
  { slug: 'juice', label: 'Juice', parentSlug: 'beverage', aliases: ['juice', 'orange juice', 'apple juice', 'grape juice'], cata: ['Fruity', 'Sweet', 'Tart'] },
  { slug: 'smoothie', label: 'Smoothie', parentSlug: 'beverage', aliases: ['smoothie', 'fruit smoothie', 'protein smoothie'], cata: ['Fruity', 'Thick', 'Creamy'] },
  { slug: 'soda', label: 'Soda', parentSlug: 'beverage', aliases: ['soda', 'pop', 'cola', 'lemonade soda'], cata: ['Carbonated', 'Sweet', 'Acidic'] },
  { slug: 'energy-drink', label: 'Energy Drink', parentSlug: 'beverage', aliases: ['energy drink', 'caffeinated drink'], cata: ['Sweet', 'Taurine', 'Acidic'] },
  { slug: 'coffee', label: 'Coffee', parentSlug: 'beverage', aliases: ['coffee', 'espresso', 'latte', 'cold brew', 'cappuccino'], cata: ['Roasted', 'Bitter', 'Aromatic'] },
  { slug: 'tea', label: 'Tea', parentSlug: 'beverage', aliases: ['tea', 'black tea', 'green tea', 'herbal tea', 'matcha'], cata: ['Astringent', 'Herbal', 'Floral'] },
  { slug: 'beer', label: 'Beer', parentSlug: 'beverage', aliases: ['beer', 'lager', 'ale', 'ipa', 'stout'], cata: ['Malty', 'Hoppy', 'Bitter'] },
  { slug: 'wine', label: 'Wine', parentSlug: 'beverage', aliases: ['wine', 'red wine', 'white wine', 'rose wine', 'sparkling wine'], cata: ['Fruity', 'Astringent', 'Acidic'] },
  { slug: 'cocktail', label: 'Cocktail', parentSlug: 'beverage', aliases: ['cocktail', 'mocktail', 'mixed drink'], cata: ['Sweet', 'Acidic', 'Aromatic'] },
  { slug: 'milk-beverage', label: 'Milk Beverage', parentSlug: 'beverage', aliases: ['milk beverage', 'milk drink', 'flavored milk', 'chocolate milk'], cata: ['Milky', 'Sweet', 'Creamy'] },
  { slug: 'plant-milk', label: 'Plant Milk', parentSlug: 'beverage', aliases: ['plant milk', 'oat milk', 'almond milk', 'soy milk', 'coconut milk', 'rice milk'], cata: ['Creamy', 'Nutty', 'Watery'] },

  { slug: 'potato-chip', label: 'Potato Chip', parentSlug: 'snack', aliases: ['potato chip', 'potato chips', 'crisps'], cata: ['Crispy', 'Salty', 'Potato'] },
  { slug: 'tortilla-chip', label: 'Tortilla Chip', parentSlug: 'snack', aliases: ['tortilla chip', 'tortilla chips', 'corn chip'], cata: ['Corn', 'Crunchy', 'Salty'] },
  { slug: 'cracker', label: 'Cracker', parentSlug: 'snack', aliases: ['cracker', 'crackers', 'water cracker'], cata: ['Crispy', 'Dry', 'Toasted'] },
  { slug: 'pretzel', label: 'Pretzel', parentSlug: 'snack', aliases: ['pretzel', 'pretzels'], cata: ['Salty', 'Bready', 'Crunchy'] },
  { slug: 'popcorn', label: 'Popcorn', parentSlug: 'snack', aliases: ['popcorn', 'popped corn'], cata: ['Toasted', 'Buttery', 'Light'] },
  { slug: 'protein-bar', label: 'Protein Bar', parentSlug: 'snack', aliases: ['protein bar', 'nutrition bar', 'energy bar'], cata: ['Chewy', 'Sweet', 'Dense'] },
  { slug: 'granola-bar', label: 'Granola Bar', parentSlug: 'snack', aliases: ['granola bar', 'cereal bar'], cata: ['Oaty', 'Sweet', 'Chewy'] },
  { slug: 'trail-mix', label: 'Trail Mix', parentSlug: 'snack', aliases: ['trail mix', 'snack mix'], cata: ['Nutty', 'Sweet', 'Crunchy'] },

  { slug: 'ketchup', label: 'Ketchup', parentSlug: 'sauce', aliases: ['ketchup', 'tomato ketchup'], cata: ['Tomato', 'Sweet', 'Tangy'] },
  { slug: 'mustard', label: 'Mustard', parentSlug: 'sauce', aliases: ['mustard', 'dijon mustard', 'yellow mustard'], cata: ['Mustardy', 'Pungent', 'Tangy'] },
  { slug: 'mayonnaise', label: 'Mayonnaise', parentSlug: 'sauce', aliases: ['mayonnaise', 'mayo'], cata: ['Creamy', 'Eggy', 'Tangy'] },
  { slug: 'barbecue-sauce', label: 'Barbecue Sauce', parentSlug: 'sauce', aliases: ['barbecue sauce', 'bbq sauce'], cata: ['Smoky', 'Sweet', 'Tangy'] },
  { slug: 'hot-sauce', label: 'Hot Sauce', parentSlug: 'sauce', aliases: ['hot sauce', 'chili sauce', 'pepper sauce'], cata: ['Spicy', 'Vinegar', 'Heat'] },
  { slug: 'tomato-sauce', label: 'Tomato Sauce', parentSlug: 'sauce', aliases: ['tomato sauce', 'marinara', 'pizza sauce', 'pasta sauce'], cata: ['Tomato', 'Savory', 'Acidic'] },
  { slug: 'pesto', label: 'Pesto', parentSlug: 'sauce', aliases: ['pesto', 'basil pesto'], cata: ['Herbal', 'Garlic', 'Nutty'] },
  { slug: 'salsa', label: 'Salsa', parentSlug: 'sauce', aliases: ['salsa', 'pico de gallo'], cata: ['Tomato', 'Fresh', 'Spicy'] },
  { slug: 'hummus-dip', label: 'Hummus Dip', parentSlug: 'sauce', aliases: ['hummus dip', 'hummus spread'], cata: ['Chickpea', 'Creamy', 'Garlic'] },
  { slug: 'ranch-dressing', label: 'Ranch Dressing', parentSlug: 'sauce', aliases: ['ranch', 'ranch dressing'], cata: ['Creamy', 'Herbal', 'Tangy'] },
  { slug: 'vinaigrette', label: 'Vinaigrette', parentSlug: 'sauce', aliases: ['vinaigrette', 'salad vinaigrette'], cata: ['Acidic', 'Oily', 'Herbal'] },
  { slug: 'soy-sauce', label: 'Soy Sauce', parentSlug: 'sauce', aliases: ['soy sauce', 'tamari', 'shoyu'], cata: ['Salty', 'Umami', 'Fermented'] },
  { slug: 'teriyaki-sauce', label: 'Teriyaki Sauce', parentSlug: 'sauce', aliases: ['teriyaki', 'teriyaki sauce'], cata: ['Sweet', 'Soy', 'Umami'] },
  { slug: 'curry-sauce', label: 'Curry Sauce', parentSlug: 'sauce', aliases: ['curry sauce', 'curry paste', 'tikka masala sauce'], cata: ['Spiced', 'Savory', 'Aromatic'] },

  { slug: 'apple', label: 'Apple', parentSlug: 'fruit', aliases: ['apple', 'apples'], cata: ['Crisp', 'Juicy', 'Sweet'] },
  { slug: 'banana', label: 'Banana', parentSlug: 'fruit', aliases: ['banana', 'bananas'], cata: ['Banana', 'Sweet', 'Soft'] },
  { slug: 'strawberry', label: 'Strawberry', parentSlug: 'fruit', aliases: ['strawberry', 'strawberries'], cata: ['Berry', 'Sweet', 'Tart'] },
  { slug: 'blueberry', label: 'Blueberry', parentSlug: 'fruit', aliases: ['blueberry', 'blueberries'], cata: ['Berry', 'Sweet', 'Floral'] },
  { slug: 'raspberry', label: 'Raspberry', parentSlug: 'fruit', aliases: ['raspberry', 'raspberries'], cata: ['Berry', 'Tart', 'Seedy'] },
  { slug: 'blackberry', label: 'Blackberry', parentSlug: 'fruit', aliases: ['blackberry', 'blackberries'], cata: ['Berry', 'Jammy', 'Tart'] },
  { slug: 'cherry', label: 'Cherry', parentSlug: 'fruit', aliases: ['cherry', 'cherries'], cata: ['Cherry', 'Sweet', 'Tart'] },
  { slug: 'orange', label: 'Orange', parentSlug: 'fruit', aliases: ['orange', 'oranges'], cata: ['Citrus', 'Juicy', 'Sweet'] },
  { slug: 'lemon', label: 'Lemon', parentSlug: 'fruit', aliases: ['lemon', 'lemons'], cata: ['Citrus', 'Sour', 'Zesty'] },
  { slug: 'lime', label: 'Lime', parentSlug: 'fruit', aliases: ['lime', 'limes'], cata: ['Citrus', 'Sour', 'Zesty'] },
  { slug: 'grape', label: 'Grape', parentSlug: 'fruit', aliases: ['grape', 'grapes'], cata: ['Grape', 'Sweet', 'Juicy'] },
  { slug: 'mango', label: 'Mango', parentSlug: 'fruit', aliases: ['mango', 'mangoes'], cata: ['Tropical', 'Sweet', 'Juicy'] },
  { slug: 'pineapple', label: 'Pineapple', parentSlug: 'fruit', aliases: ['pineapple'], cata: ['Tropical', 'Sweet', 'Acidic'] },
  { slug: 'peach', label: 'Peach', parentSlug: 'fruit', aliases: ['peach', 'peaches', 'nectarine'], cata: ['Stone fruit', 'Sweet', 'Juicy'] },
  { slug: 'pear', label: 'Pear', parentSlug: 'fruit', aliases: ['pear', 'pears'], cata: ['Pear', 'Sweet', 'Grainy'] },
  { slug: 'melon', label: 'Melon', parentSlug: 'fruit', aliases: ['melon', 'watermelon', 'cantaloupe', 'honeydew'], cata: ['Melon', 'Watery', 'Sweet'] },
  { slug: 'kiwi', label: 'Kiwi', parentSlug: 'fruit', aliases: ['kiwi', 'kiwifruit'], cata: ['Tart', 'Green', 'Seedy'] },
  { slug: 'coconut', label: 'Coconut', parentSlug: 'fruit', aliases: ['coconut', 'coconut meat'], cata: ['Coconut', 'Fatty', 'Sweet'] },

  { slug: 'tomato', label: 'Tomato', parentSlug: 'vegetable', aliases: ['tomato', 'tomatoes'], cata: ['Tomato', 'Umami', 'Acidic'] },
  { slug: 'potato', label: 'Potato', parentSlug: 'vegetable', aliases: ['potato', 'potatoes'], cata: ['Potato', 'Starchy', 'Earthy'] },
  { slug: 'sweet-potato', label: 'Sweet Potato', parentSlug: 'vegetable', aliases: ['sweet potato', 'yam'], cata: ['Sweet', 'Starchy', 'Earthy'] },
  { slug: 'carrot', label: 'Carrot', parentSlug: 'vegetable', aliases: ['carrot', 'carrots'], cata: ['Sweet', 'Earthy', 'Crunchy'] },
  { slug: 'broccoli', label: 'Broccoli', parentSlug: 'vegetable', aliases: ['broccoli'], cata: ['Green', 'Sulfurous', 'Bitter'] },
  { slug: 'cauliflower', label: 'Cauliflower', parentSlug: 'vegetable', aliases: ['cauliflower'], cata: ['Mild', 'Sulfurous', 'Tender'] },
  { slug: 'spinach', label: 'Spinach', parentSlug: 'vegetable', aliases: ['spinach'], cata: ['Green', 'Mineral', 'Tender'] },
  { slug: 'kale', label: 'Kale', parentSlug: 'vegetable', aliases: ['kale'], cata: ['Green', 'Bitter', 'Fibrous'] },
  { slug: 'lettuce', label: 'Lettuce', parentSlug: 'vegetable', aliases: ['lettuce', 'romaine', 'iceberg lettuce'], cata: ['Crisp', 'Watery', 'Green'] },
  { slug: 'cucumber', label: 'Cucumber', parentSlug: 'vegetable', aliases: ['cucumber', 'cucumbers'], cata: ['Fresh', 'Watery', 'Green'] },
  { slug: 'pepper', label: 'Pepper', parentSlug: 'vegetable', aliases: ['pepper', 'bell pepper', 'capsicum'], cata: ['Green', 'Sweet', 'Peppery'] },
  { slug: 'onion', label: 'Onion', parentSlug: 'vegetable', aliases: ['onion', 'onions', 'shallot'], cata: ['Pungent', 'Sweet', 'Sulfurous'] },
  { slug: 'garlic', label: 'Garlic', parentSlug: 'vegetable', aliases: ['garlic'], cata: ['Garlic', 'Pungent', 'Savory'] },
  { slug: 'mushroom', label: 'Mushroom', parentSlug: 'vegetable', aliases: ['mushroom', 'mushrooms', 'shiitake', 'portobello'], cata: ['Umami', 'Earthy', 'Meaty'] },
  { slug: 'corn', label: 'Corn', parentSlug: 'vegetable', aliases: ['corn', 'sweet corn', 'maize'], cata: ['Corn', 'Sweet', 'Starchy'] },
  { slug: 'pea', label: 'Pea', parentSlug: 'vegetable', aliases: ['pea', 'peas', 'green pea'], cata: ['Green', 'Sweet', 'Starchy'] },
  { slug: 'beet', label: 'Beet', parentSlug: 'vegetable', aliases: ['beet', 'beetroot'], cata: ['Earthy', 'Sweet', 'Mineral'] },
  { slug: 'zucchini', label: 'Zucchini', parentSlug: 'vegetable', aliases: ['zucchini', 'courgette'], cata: ['Mild', 'Watery', 'Green'] },
  { slug: 'eggplant', label: 'Eggplant', parentSlug: 'vegetable', aliases: ['eggplant', 'aubergine'], cata: ['Mild', 'Spongy', 'Bitter'] },
  { slug: 'avocado', label: 'Avocado', parentSlug: 'vegetable', aliases: ['avocado'], cata: ['Creamy', 'Fatty', 'Green'] },

  { slug: 'oat', label: 'Oat', parentSlug: 'grain-cereal', aliases: ['oat', 'oats', 'oatmeal', 'porridge'], cata: ['Oaty', 'Creamy', 'Grainy'] },
  { slug: 'wheat', label: 'Wheat', parentSlug: 'grain-cereal', aliases: ['wheat', 'wheat berry', 'bulgur'], cata: ['Wheaty', 'Nutty', 'Chewy'] },
  { slug: 'barley', label: 'Barley', parentSlug: 'grain-cereal', aliases: ['barley', 'pearl barley'], cata: ['Malty', 'Chewy', 'Nutty'] },
  { slug: 'quinoa', label: 'Quinoa', parentSlug: 'grain-cereal', aliases: ['quinoa'], cata: ['Nutty', 'Earthy', 'Bitter'] },
  { slug: 'cereal', label: 'Cereal', parentSlug: 'grain-cereal', aliases: ['breakfast cereal', 'corn flakes', 'bran flakes'], cata: ['Crispy', 'Sweet', 'Toasted'] },
  { slug: 'granola', label: 'Granola', parentSlug: 'grain-cereal', aliases: ['granola', 'muesli'], cata: ['Toasted', 'Oaty', 'Sweet'] },

  { slug: 'spaghetti', label: 'Spaghetti', parentSlug: 'pasta-noodle', aliases: ['spaghetti'], cata: ['Wheaty', 'Firm', 'Chewy'] },
  { slug: 'macaroni', label: 'Macaroni', parentSlug: 'pasta-noodle', aliases: ['macaroni', 'mac and cheese', 'macaroni cheese'], cata: ['Wheaty', 'Tender', 'Starchy'] },
  { slug: 'ramen', label: 'Ramen', parentSlug: 'pasta-noodle', aliases: ['ramen', 'ramen noodles'], cata: ['Springy', 'Wheaty', 'Savory'] },
  { slug: 'udon', label: 'Udon', parentSlug: 'pasta-noodle', aliases: ['udon', 'udon noodle'], cata: ['Thick', 'Chewy', 'Wheaty'] },
  { slug: 'gnocchi', label: 'Gnocchi', parentSlug: 'pasta-noodle', aliases: ['gnocchi'], cata: ['Potato', 'Soft', 'Pillowy'] },

  { slug: 'white-rice', label: 'White Rice', parentSlug: 'rice', aliases: ['white rice', 'long grain rice'], cata: ['Neutral', 'Fluffy', 'Starchy'] },
  { slug: 'brown-rice', label: 'Brown Rice', parentSlug: 'rice', aliases: ['brown rice'], cata: ['Nutty', 'Chewy', 'Earthy'] },
  { slug: 'basmati-rice', label: 'Basmati Rice', parentSlug: 'rice', aliases: ['basmati', 'basmati rice'], cata: ['Aromatic', 'Floral', 'Fluffy'] },
  { slug: 'jasmine-rice', label: 'Jasmine Rice', parentSlug: 'rice', aliases: ['jasmine rice'], cata: ['Aromatic', 'Floral', 'Soft'] },
  { slug: 'risotto', label: 'Risotto', parentSlug: 'rice', aliases: ['risotto'], cata: ['Creamy', 'Starchy', 'Rich'] },

  { slug: 'bean', label: 'Bean', parentSlug: 'legume', aliases: ['bean', 'beans', 'black bean', 'pinto bean', 'kidney bean'], cata: ['Beany', 'Earthy', 'Creamy'] },
  { slug: 'lentil', label: 'Lentil', parentSlug: 'legume', aliases: ['lentil', 'lentils'], cata: ['Earthy', 'Beany', 'Mealy'] },
  { slug: 'chickpea', label: 'Chickpea', parentSlug: 'legume', aliases: ['chickpea', 'chickpeas', 'garbanzo'], cata: ['Nutty', 'Beany', 'Creamy'] },
  { slug: 'soy', label: 'Soy', parentSlug: 'legume', aliases: ['soy', 'soybean', 'soybeans'], cata: ['Beany', 'Green', 'Nutty'] },
  { slug: 'tofu', label: 'Tofu', parentSlug: 'legume', aliases: ['tofu', 'bean curd'], cata: ['Soy', 'Mild', 'Soft'] },
  { slug: 'tempeh', label: 'Tempeh', parentSlug: 'legume', aliases: ['tempeh'], cata: ['Fermented', 'Nutty', 'Firm'] },
  { slug: 'hummus', label: 'Hummus', parentSlug: 'legume', aliases: ['hummus'], cata: ['Chickpea', 'Garlic', 'Creamy'] },
  { slug: 'falafel', label: 'Falafel', parentSlug: 'legume', aliases: ['falafel'], cata: ['Herbal', 'Fried', 'Chickpea'] },

  { slug: 'almond', label: 'Almond', parentSlug: 'nut-seed', aliases: ['almond', 'almonds'], cata: ['Almond', 'Nutty', 'Toasted'] },
  { slug: 'cashew', label: 'Cashew', parentSlug: 'nut-seed', aliases: ['cashew', 'cashews'], cata: ['Cashew', 'Creamy', 'Sweet'] },
  { slug: 'peanut', label: 'Peanut', parentSlug: 'nut-seed', aliases: ['peanut', 'peanuts', 'peanut butter'], cata: ['Peanut', 'Roasted', 'Nutty'] },
  { slug: 'walnut', label: 'Walnut', parentSlug: 'nut-seed', aliases: ['walnut', 'walnuts'], cata: ['Walnut', 'Bitter', 'Astringent'] },
  { slug: 'hazelnut', label: 'Hazelnut', parentSlug: 'nut-seed', aliases: ['hazelnut', 'hazelnuts'], cata: ['Hazelnut', 'Roasted', 'Sweet'] },
  { slug: 'pistachio', label: 'Pistachio', parentSlug: 'nut-seed', aliases: ['pistachio', 'pistachios'], cata: ['Pistachio', 'Green', 'Nutty'] },
  { slug: 'sesame', label: 'Sesame', parentSlug: 'nut-seed', aliases: ['sesame', 'sesame seed', 'tahini'], cata: ['Sesame', 'Toasted', 'Nutty'] },
  { slug: 'sunflower-seed', label: 'Sunflower Seed', parentSlug: 'nut-seed', aliases: ['sunflower seed', 'sunflower seeds'], cata: ['Nutty', 'Toasted', 'Oily'] },

  { slug: 'cake', label: 'Cake', parentSlug: 'dessert', aliases: ['cake', 'sponge cake', 'layer cake'], cata: ['Sweet', 'Moist', 'Fluffy'] },
  { slug: 'cookie', label: 'Cookie', parentSlug: 'dessert', aliases: ['cookie', 'cookies', 'biscuit cookie'], cata: ['Sweet', 'Crisp', 'Buttery'] },
  { slug: 'brownie', label: 'Brownie', parentSlug: 'dessert', aliases: ['brownie', 'brownies'], cata: ['Chocolate', 'Fudgy', 'Dense'] },
  { slug: 'pie', label: 'Pie', parentSlug: 'dessert', aliases: ['pie', 'fruit pie', 'cream pie'], cata: ['Sweet', 'Crust', 'Filling'] },
  { slug: 'pudding', label: 'Pudding', parentSlug: 'dessert', aliases: ['pudding', 'custard pudding'], cata: ['Creamy', 'Sweet', 'Smooth'] },
  { slug: 'custard', label: 'Custard', parentSlug: 'dessert', aliases: ['custard', 'creme brulee', 'flan'], cata: ['Eggy', 'Creamy', 'Vanilla'] },
  { slug: 'donut', label: 'Donut', parentSlug: 'dessert', aliases: ['donut', 'doughnut'], cata: ['Fried', 'Sweet', 'Soft'] },
  { slug: 'pancake', label: 'Pancake', parentSlug: 'dessert', aliases: ['pancake', 'pancakes', 'waffle', 'waffles'], cata: ['Sweet', 'Bready', 'Soft'] },

  { slug: 'ice-cream', label: 'Ice Cream', parentSlug: 'frozen-dessert', aliases: ['ice cream', 'icecream'], cata: ['Creamy', 'Cold', 'Sweet'] },
  { slug: 'gelato', label: 'Gelato', parentSlug: 'frozen-dessert', aliases: ['gelato'], cata: ['Dense', 'Creamy', 'Rich'] },
  { slug: 'sorbet', label: 'Sorbet', parentSlug: 'frozen-dessert', aliases: ['sorbet', 'sherbet'], cata: ['Fruity', 'Icy', 'Tart'] },
  { slug: 'popsicle', label: 'Popsicle', parentSlug: 'frozen-dessert', aliases: ['popsicle', 'ice pop', 'ice lolly'], cata: ['Icy', 'Sweet', 'Fruity'] },

  { slug: 'chocolate', label: 'Chocolate', parentSlug: 'confectionery', aliases: ['chocolate', 'milk chocolate', 'dark chocolate', 'white chocolate'], cata: ['Chocolate', 'Cocoa', 'Sweet'] },
  { slug: 'gummy-candy', label: 'Gummy Candy', parentSlug: 'confectionery', aliases: ['gummy', 'gummies', 'gummy candy'], cata: ['Chewy', 'Fruity', 'Sweet'] },
  { slug: 'caramel-candy', label: 'Caramel Candy', parentSlug: 'confectionery', aliases: ['caramel candy', 'toffee', 'caramel chew'], cata: ['Caramel', 'Chewy', 'Buttery'] },
  { slug: 'hard-candy', label: 'Hard Candy', parentSlug: 'confectionery', aliases: ['hard candy', 'boiled sweet', 'lollipop'], cata: ['Hard', 'Sweet', 'Fruity'] },
  { slug: 'marshmallow', label: 'Marshmallow', parentSlug: 'confectionery', aliases: ['marshmallow', 'marshmallows'], cata: ['Sweet', 'Vanilla', 'Soft'] },

  { slug: 'tomato-soup', label: 'Tomato Soup', parentSlug: 'soup', aliases: ['tomato soup'], cata: ['Tomato', 'Acidic', 'Savory'] },
  { slug: 'chicken-soup', label: 'Chicken Soup', parentSlug: 'soup', aliases: ['chicken soup', 'chicken noodle soup'], cata: ['Chicken', 'Brothy', 'Savory'] },
  { slug: 'vegetable-soup', label: 'Vegetable Soup', parentSlug: 'soup', aliases: ['vegetable soup', 'minestrone'], cata: ['Vegetable', 'Savory', 'Herbal'] },
  { slug: 'miso-soup', label: 'Miso Soup', parentSlug: 'soup', aliases: ['miso soup'], cata: ['Miso', 'Umami', 'Fermented'] },
  { slug: 'ramen-broth', label: 'Ramen Broth', parentSlug: 'soup', aliases: ['ramen broth', 'tonkotsu', 'shoyu ramen'], cata: ['Umami', 'Rich', 'Savory'] },
  { slug: 'chowder', label: 'Chowder', parentSlug: 'soup', aliases: ['chowder', 'clam chowder', 'corn chowder'], cata: ['Creamy', 'Thick', 'Savory'] },

  { slug: 'pizza', label: 'Pizza', parentSlug: 'ready-meal', aliases: ['pizza', 'flatbread pizza'], cata: ['Cheesy', 'Tomato', 'Bready'] },
  { slug: 'sandwich', label: 'Sandwich', parentSlug: 'ready-meal', aliases: ['sandwich', 'sub sandwich', 'panini'], cata: ['Bready', 'Savory', 'Fresh'] },
  { slug: 'wrap', label: 'Wrap', parentSlug: 'ready-meal', aliases: ['wrap', 'burrito wrap'], cata: ['Flexible', 'Savory', 'Fresh'] },
  { slug: 'burger', label: 'Burger', parentSlug: 'ready-meal', aliases: ['burger', 'hamburger', 'cheeseburger'], cata: ['Savory', 'Juicy', 'Bready'] },
  { slug: 'taco', label: 'Taco', parentSlug: 'ready-meal', aliases: ['taco', 'tacos'], cata: ['Corn', 'Spiced', 'Fresh'] },
  { slug: 'burrito', label: 'Burrito', parentSlug: 'ready-meal', aliases: ['burrito', 'bean burrito'], cata: ['Savory', 'Starchy', 'Spiced'] },
  { slug: 'curry', label: 'Curry', parentSlug: 'ready-meal', aliases: ['curry', 'thai curry', 'indian curry'], cata: ['Spiced', 'Aromatic', 'Savory'] },
  { slug: 'stir-fry', label: 'Stir Fry', parentSlug: 'ready-meal', aliases: ['stir fry', 'stir-fry'], cata: ['Savory', 'Fresh', 'Wok hei'] },
  { slug: 'casserole', label: 'Casserole', parentSlug: 'ready-meal', aliases: ['casserole', 'hotdish'], cata: ['Baked', 'Savory', 'Rich'] },
  { slug: 'lasagna', label: 'Lasagna', parentSlug: 'ready-meal', aliases: ['lasagna', 'lasagne'], cata: ['Tomato', 'Cheesy', 'Pasta'] },
  { slug: 'sushi-roll', label: 'Sushi Roll', parentSlug: 'ready-meal', aliases: ['sushi roll', 'california roll'], cata: ['Rice', 'Marine', 'Fresh'] },
  { slug: 'dumpling', label: 'Dumpling', parentSlug: 'ready-meal', aliases: ['dumpling', 'dumplings', 'gyoza', 'potsticker'], cata: ['Savory', 'Chewy', 'Juicy'] },

  { slug: 'green-salad', label: 'Green Salad', parentSlug: 'salad', aliases: ['green salad', 'garden salad'], cata: ['Fresh', 'Green', 'Crisp'] },
  { slug: 'caesar-salad', label: 'Caesar Salad', parentSlug: 'salad', aliases: ['caesar salad'], cata: ['Creamy', 'Garlic', 'Umami'] },
  { slug: 'coleslaw', label: 'Coleslaw', parentSlug: 'salad', aliases: ['coleslaw', 'slaw'], cata: ['Crunchy', 'Creamy', 'Tangy'] },
  { slug: 'potato-salad', label: 'Potato Salad', parentSlug: 'salad', aliases: ['potato salad'], cata: ['Creamy', 'Potato', 'Tangy'] },
  { slug: 'grain-bowl', label: 'Grain Bowl', parentSlug: 'salad', aliases: ['grain bowl', 'buddha bowl'], cata: ['Grainy', 'Fresh', 'Savory'] },

  { slug: 'olive-oil', label: 'Olive Oil', parentSlug: 'oil-fat', aliases: ['olive oil', 'extra virgin olive oil'], cata: ['Grassy', 'Peppery', 'Fruity'] },
  { slug: 'coconut-oil', label: 'Coconut Oil', parentSlug: 'oil-fat', aliases: ['coconut oil'], cata: ['Coconut', 'Fatty', 'Waxy'] },
  { slug: 'butter', label: 'Butter', parentSlug: 'oil-fat', aliases: ['butter', 'cultured butter'], cata: ['Buttery', 'Creamy', 'Fatty'] },
  { slug: 'margarine', label: 'Margarine', parentSlug: 'oil-fat', aliases: ['margarine', 'spreadable margarine'], cata: ['Buttery', 'Oily', 'Waxy'] },
  { slug: 'shortening', label: 'Shortening', parentSlug: 'oil-fat', aliases: ['shortening', 'vegetable shortening'], cata: ['Neutral', 'Waxy', 'Fatty'] },

  { slug: 'kimchi', label: 'Kimchi', parentSlug: 'fermented-pickle', aliases: ['kimchi'], cata: ['Fermented', 'Spicy', 'Garlic'] },
  { slug: 'sauerkraut', label: 'Sauerkraut', parentSlug: 'fermented-pickle', aliases: ['sauerkraut', 'kraut'], cata: ['Sour', 'Cabbage', 'Fermented'] },
  { slug: 'pickle', label: 'Pickle', parentSlug: 'fermented-pickle', aliases: ['pickle', 'pickles', 'dill pickle'], cata: ['Sour', 'Salty', 'Crisp'] },
  { slug: 'miso', label: 'Miso', parentSlug: 'fermented-pickle', aliases: ['miso', 'miso paste'], cata: ['Umami', 'Fermented', 'Salty'] },
  { slug: 'kombucha', label: 'Kombucha', parentSlug: 'fermented-pickle', aliases: ['kombucha'], cata: ['Fermented', 'Acidic', 'Fizzy'] },
  { slug: 'vinegar', label: 'Vinegar', parentSlug: 'fermented-pickle', aliases: ['vinegar', 'apple cider vinegar', 'balsamic vinegar'], cata: ['Acidic', 'Pungent', 'Sharp'] },
];

type BulkPresetGroup = {
  parentSlug: CanonicalFoodType;
  labels: string[];
};

const BULK_PRESET_GROUPS: BulkPresetGroup[] = [
  {
    parentSlug: 'cheese',
    labels: [
      'Monterey Jack', 'Colby Jack', 'Pepper Jack', 'Swiss Cheese', 'Emmental', 'Gruyere', 'Manchego', 'Halloumi', 'Paneer', 'Provolone',
      'Asiago', 'Fontina', 'Havarti', 'Muenster', 'Mascarpone', 'Neufchatel', 'Camembert', 'Limburger', 'Raclette', 'Comte',
      'Cotija', 'Oaxaca Cheese', 'Burrata', 'Stracciatella Cheese', 'Taleggio', 'Pecorino Romano', 'Anejo Cheese', 'Farmer Cheese', 'Processed Cheese', 'Cheese Spread',
      'Nacho Cheese', 'Vegan Cheddar', 'Vegan Mozzarella', 'Vegan Parmesan', 'Cashew Cream Cheese', 'Almond Ricotta', 'Coconut Mozzarella',
    ],
  },
  {
    parentSlug: 'bread',
    labels: [
      'Ciabatta', 'Focaccia', 'Chapati', 'Paratha', 'Arepa', 'Cornbread', 'Biscuit', 'Dinner Roll', 'Hamburger Bun', 'Hot Dog Bun',
      'Milk Bread', 'Hokkaido Milk Bread', 'Challah', 'Panettone', 'Stollen', 'Irish Soda Bread', 'Banana Bread', 'Zucchini Bread', 'Pumpkin Bread', 'Garlic Bread',
      'Breadstick', 'Pretzel Bun', 'Kaiser Roll', 'Potato Bread', 'Multigrain Bread', 'Seeded Bread', 'Gluten Free Bread', 'Lavash', 'Injera', 'Bao Bun',
      'Steamed Bun', 'Pao de Queijo', 'Crumpet', 'Scone', 'Pita Chip',
    ],
  },
  {
    parentSlug: 'meat',
    labels: [
      'Ribeye Steak', 'Sirloin Steak', 'Filet Mignon', 'Brisket', 'Short Rib', 'Meatball', 'Meatloaf', 'Roast Beef', 'Corned Beef', 'Pastrami',
      'Chicken Wing', 'Chicken Tender', 'Fried Chicken', 'Roast Chicken', 'Chicken Sausage', 'Turkey Bacon', 'Turkey Sausage', 'Pork Belly', 'Pork Tenderloin', 'Pork Shoulder',
      'Prosciutto', 'Mortadella', 'Bologna', 'Cured Salami', 'Andouille', 'Kielbasa', 'Hot Dog', 'Meat Jerky', 'Beef Jerky', 'Venison',
      'Bison', 'Goat Meat', 'Rabbit', 'Plant Based Sausage', 'Plant Based Chicken', 'Plant Based Beef', 'Seitan', 'Jackfruit Meat Alternative',
    ],
  },
  {
    parentSlug: 'seafood',
    labels: [
      'Haddock', 'Halibut', 'Tilapia', 'Trout', 'Sea Bass', 'Mahi Mahi', 'Swordfish', 'Mackerel', 'Sardine', 'Anchovy',
      'Catfish', 'Pollock', 'Flounder', 'Sole', 'Monkfish', 'Barramundi', 'Snapper', 'Grouper', 'Crawfish', 'Langoustine',
      'Mussel', 'Clam', 'Octopus', 'Squid', 'Calamari', 'Eel', 'Caviar', 'Roe', 'Fish Cake', 'Surimi',
      'Imitation Crab', 'Fish Stick', 'Fish Finger', 'Seaweed Snack', 'Wakame', 'Nori',
    ],
  },
  {
    parentSlug: 'egg',
    labels: [
      'Fried Egg', 'Poached Egg', 'Sunny Side Egg', 'Deviled Egg', 'Egg Salad', 'Egg Bite', 'Egg White', 'Liquid Egg', 'Quail Egg', 'Duck Egg',
      'Century Egg', 'Custard Egg', 'Shakshuka Egg', 'Egg Drop Soup', 'Egg Patty',
    ],
  },
  {
    parentSlug: 'yogurt',
    labels: [
      'Plain Yogurt', 'Vanilla Yogurt', 'Strawberry Yogurt', 'Blueberry Yogurt', 'Drinkable Yogurt', 'Probiotic Yogurt', 'Low Fat Yogurt', 'Whole Milk Yogurt',
      'Soy Yogurt', 'Almond Yogurt', 'Oat Yogurt', 'Cashew Yogurt', 'Coconut Yogurt', 'Lassi', 'Labneh',
    ],
  },
  {
    parentSlug: 'beverage',
    labels: [
      'Coconut Water', 'Flavored Water', 'Tonic Water', 'Club Soda', 'Root Beer', 'Ginger Ale', 'Ginger Beer', 'Lemonade', 'Iced Tea', 'Kombucha Beverage',
      'Kefir Drink', 'Drinking Chocolate', 'Hot Chocolate', 'Mocha', 'Americano', 'Macchiato', 'Flat White', 'Frappuccino', 'Yerba Mate', 'Chai',
      'Bubble Tea', 'Milk Tea', 'Horchata', 'Ayran', 'Sports Drink', 'Electrolyte Drink', 'Protein Shake', 'Meal Replacement Shake', 'Vegetable Juice', 'Tomato Juice',
      'Cider', 'Hard Seltzer', 'Whiskey', 'Vodka', 'Gin', 'Rum', 'Tequila', 'Sake',
    ],
  },
  {
    parentSlug: 'snack',
    labels: [
      'Cheese Puff', 'Corn Puff', 'Rice Cake', 'Popped Chip', 'Veggie Straw', 'Plantain Chip', 'Banana Chip', 'Apple Chip', 'Kale Chip', 'Seaweed Chip',
      'Snack Cracker', 'Cheese Cracker', 'Graham Cracker', 'Rice Cracker', 'Wheat Cracker', 'Pita Chip', 'Bagel Chip', 'Snack Pellet', 'Extruded Snack', 'Pork Rind',
      'Jerky Snack', 'Fruit Leather', 'Dried Fruit Snack', 'Roasted Chickpea Snack', 'Roasted Edamame Snack', 'Nut Cluster', 'Seed Cluster', 'Chocolate Bar', 'Wafer Bar', 'Rice Crispy Treat',
      'Snack Cake', 'Mini Muffin Snack', 'Doughnut Hole', 'Filled Pretzel', 'Snack Cup',
    ],
  },
  {
    parentSlug: 'sauce',
    labels: [
      'Alfredo Sauce', 'Bechamel Sauce', 'Hollandaise Sauce', 'Bearnaise Sauce', 'Buffalo Sauce', 'Sweet Chili Sauce', 'Sriracha', 'Harissa', 'Gochujang Sauce', 'Peanut Sauce',
      'Tahini Sauce', 'Tzatziki', 'Guacamole', 'Chimichurri', 'Mole Sauce', 'Enchilada Sauce', 'Sofrito', 'Gravy', 'Brown Gravy', 'White Gravy',
      'Tartar Sauce', 'Cocktail Sauce', 'Remoulade', 'Teriyaki Glaze', 'Hoisin Sauce', 'Plum Sauce', 'Duck Sauce', 'Fish Sauce', 'Worcestershire Sauce', 'Steak Sauce',
      'Honey Mustard', 'Caesar Dressing', 'Italian Dressing', 'Blue Cheese Dressing', 'Thousand Island Dressing', 'Sesame Dressing', 'Yum Yum Sauce', 'Garlic Aioli', 'Chipotle Mayo', 'Sour Cream Dip',
    ],
  },
  {
    parentSlug: 'fruit',
    labels: [
      'Plum', 'Apricot', 'Pomegranate', 'Passion Fruit', 'Guava', 'Papaya', 'Dragon Fruit', 'Lychee', 'Longan', 'Rambutan',
      'Persimmon', 'Fig', 'Date', 'Prune', 'Cranberry', 'Gooseberry', 'Currant', 'Elderberry', 'Boysenberry', 'Mulberry',
      'Tangerine', 'Mandarin', 'Grapefruit', 'Pomelo', 'Yuzu', 'Plantain', 'Starfruit', 'Jackfruit', 'Durian', 'Breadfruit',
      'Acai', 'Camu Camu', 'Quince', 'Soursop', 'Cherimoya', 'Nectarine',
    ],
  },
  {
    parentSlug: 'vegetable',
    labels: [
      'Asparagus', 'Brussels Sprout', 'Cabbage', 'Red Cabbage', 'Bok Choy', 'Swiss Chard', 'Collard Greens', 'Arugula', 'Watercress', 'Celery',
      'Fennel', 'Leek', 'Scallion', 'Radish', 'Daikon', 'Turnip', 'Rutabaga', 'Parsnip', 'Artichoke', 'Okra',
      'Green Bean', 'Snow Pea', 'Sugar Snap Pea', 'Butternut Squash', 'Acorn Squash', 'Pumpkin', 'Spaghetti Squash', 'Jicama', 'Cassava', 'Taro',
      'Lotus Root', 'Bamboo Shoot', 'Water Chestnut', 'Heart Of Palm', 'Endive', 'Radicchio', 'Microgreens', 'Sprout', 'Sea Vegetable', 'Kohlrabi',
    ],
  },
  {
    parentSlug: 'grain-cereal',
    labels: [
      'Cornmeal', 'Polenta', 'Grits', 'Farro', 'Spelt', 'Rye Grain', 'Buckwheat', 'Sorghum', 'Teff', 'Amaranth',
      'Freekeh', 'Couscous', 'Pearl Couscous', 'Semolina', 'Bran Cereal', 'Puffed Rice Cereal', 'Puffed Wheat Cereal', 'Granola Cereal', 'Malt Cereal', 'Hot Cereal',
      'Cream Of Wheat', 'Millet Porridge', 'Congee Base',
    ],
  },
  {
    parentSlug: 'pasta-noodle',
    labels: [
      'Fettuccine', 'Linguine', 'Penne', 'Rigatoni', 'Fusilli', 'Farfalle', 'Orzo', 'Ravioli', 'Tortellini', 'Tagliatelle',
      'Pappardelle', 'Cavatappi', 'Vermicelli', 'Rice Noodle', 'Glass Noodle', 'Shirataki Noodle', 'Soba Noodle', 'Egg Noodle', 'Lasagna Noodle', 'Cannelloni',
      'Couscous Pasta', 'Spaetzle',
    ],
  },
  {
    parentSlug: 'rice',
    labels: [
      'Arborio Rice', 'Sushi Rice', 'Sticky Rice', 'Glutinous Rice', 'Wild Rice', 'Black Rice', 'Red Rice', 'Calrose Rice', 'Bomba Rice', 'Carolina Rice',
      'Carnaroli Rice', 'Rice Pudding', 'Rice Cake', 'Rice Ball', 'Rice Pilaf', 'Fried Rice', 'Jollof Rice', 'Spanish Rice', 'Cilantro Lime Rice',
    ],
  },
  {
    parentSlug: 'legume',
    labels: [
      'Black Bean', 'Pinto Bean', 'Kidney Bean', 'Navy Bean', 'Great Northern Bean', 'Cannellini Bean', 'Fava Bean', 'Lima Bean', 'Mung Bean', 'Adzuki Bean',
      'Black Eyed Pea', 'Split Pea', 'Green Lentil', 'Red Lentil', 'Black Lentil', 'Yellow Lentil', 'Pea Protein', 'Soy Protein', 'Textured Vegetable Protein', 'Soy Curl',
      'Soy Milk Curd', 'Edamame', 'Natto', 'Peanut Legume',
    ],
  },
  {
    parentSlug: 'nut-seed',
    labels: [
      'Pecan', 'Macadamia', 'Brazil Nut', 'Pine Nut', 'Chestnut', 'Tiger Nut', 'Pumpkin Seed', 'Hemp Seed', 'Chia Seed', 'Flaxseed',
      'Poppy Seed', 'Nigella Seed', 'Caraway Seed', 'Fennel Seed', 'Coriander Seed', 'Nut Butter', 'Almond Butter', 'Cashew Butter', 'Sunflower Butter', 'Seed Butter',
      'Trail Nut Mix',
    ],
  },
  {
    parentSlug: 'dessert',
    labels: [
      'Cheesecake', 'Cupcake', 'Pound Cake', 'Coffee Cake', 'Carrot Cake', 'Red Velvet Cake', 'Angel Food Cake', 'Churro', 'Cannoli', 'Tiramisu',
      'Baklava', 'Eclair', 'Cream Puff', 'Macaron', 'Macaroon', 'Tart', 'Fruit Tart', 'Cobbler', 'Crumble', 'Crisp Dessert',
      'Trifle', 'Rice Pudding Dessert', 'Bread Pudding', 'Mochi Dessert', 'Sweet Roll', 'Cinnamon Roll', 'Danish Pastry', 'Turnover', 'Fritter', 'Beignet',
      'Meringue', 'Pavlova',
    ],
  },
  {
    parentSlug: 'frozen-dessert',
    labels: [
      'Frozen Custard', 'Soft Serve', 'Ice Cream Sandwich', 'Ice Cream Bar', 'Ice Cream Cone', 'Frozen Novelty', 'Frozen Pop', 'Frozen Fruit Bar', 'Granita', 'Italian Ice',
      'Kulfi', 'Mochi Ice Cream', 'Frozen Mousse', 'Plant Based Ice Cream', 'Oat Milk Ice Cream', 'Coconut Ice Cream', 'Almond Milk Ice Cream',
    ],
  },
  {
    parentSlug: 'confectionery',
    labels: [
      'Fudge', 'Truffle', 'Praline', 'Nougat', 'Brittle', 'Toffee Candy', 'Taffy', 'Jelly Bean', 'Sour Candy', 'Licorice',
      'Mint Candy', 'Chocolate Candy Bar', 'Chocolate Bonbon', 'Chocolate Spread', 'Cocoa Nib', 'Candy Cane', 'Cotton Candy', 'Halva', 'Turkish Delight', 'Fruit Chew',
    ],
  },
  {
    parentSlug: 'soup',
    labels: [
      'French Onion Soup', 'Lentil Soup', 'Split Pea Soup', 'Black Bean Soup', 'Pumpkin Soup', 'Butternut Squash Soup', 'Potato Soup', 'Broccoli Cheddar Soup', 'Mushroom Soup', 'Beef Stew',
      'Chicken Stew', 'Gumbo', 'Jambalaya Stew', 'Pho Broth', 'Laksa', 'Borscht', 'Gazpacho', 'Pozole', 'Menudo', 'Matzo Ball Soup',
    ],
  },
  {
    parentSlug: 'ready-meal',
    labels: [
      'Mac And Cheese', 'Shepherds Pie', 'Pot Pie', 'Quiche Meal', 'Frittata Meal', 'Paella', 'Risotto Meal', 'Bibimbap', 'Pad Thai', 'Lo Mein',
      'Chow Mein', 'Fried Noodle Meal', 'Butter Chicken', 'Tikka Masala', 'Korma', 'Vindaloo', 'Biryani', 'Tandoori Meal', 'Kebab', 'Gyro',
      'Falafel Wrap', 'Shawarma', 'Quesadilla', 'Enchilada', 'Tamale', 'Nachos', 'Chili', 'Poke Bowl', 'Power Bowl', 'Breakfast Burrito',
      'Breakfast Sandwich', 'Frozen Entree', 'Meal Replacement Bowl', 'Plant Based Bowl', 'Vegetable Curry Meal',
    ],
  },
  {
    parentSlug: 'salad',
    labels: [
      'Greek Salad', 'Cobb Salad', 'Chef Salad', 'Wedge Salad', 'Pasta Salad', 'Macaroni Salad', 'Chicken Salad', 'Tuna Salad', 'Egg Salad', 'Bean Salad',
      'Lentil Salad', 'Quinoa Salad', 'Tabbouleh', 'Caprese Salad', 'Nicoise Salad', 'Waldorf Salad', 'Kale Salad', 'Arugula Salad', 'Fruit Salad', 'Seaweed Salad',
    ],
  },
  {
    parentSlug: 'oil-fat',
    labels: [
      'Avocado Oil', 'Canola Oil', 'Sunflower Oil', 'Safflower Oil', 'Peanut Oil', 'Sesame Oil', 'Walnut Oil', 'Grapeseed Oil', 'Corn Oil', 'Soybean Oil',
      'Palm Oil', 'Palm Kernel Oil', 'Ghee', 'Clarified Butter', 'Lard', 'Tallow', 'Duck Fat', 'MCT Oil', 'Flavored Oil', 'Cooking Spray',
    ],
  },
  {
    parentSlug: 'fermented-pickle',
    labels: [
      'Pickled Onion', 'Pickled Jalapeno', 'Pickled Carrot', 'Pickled Beet', 'Pickled Ginger', 'Cornichon', 'Relish', 'Fermented Hot Sauce', 'Fermented Garlic', 'Fermented Bean Paste',
      'Doubanjiang', 'Doenjang', 'Tempeh Ferment', 'Fermented Tofu', 'Fish Sauce Ferment', 'Natto Ferment', 'Achar', 'Atchara', 'Preserved Lemon', 'Kvass',
    ],
  },
];

function bulkSpec(parentSlug: CanonicalFoodType, label: string): PresetFoodTypeSpec {
  return {
    slug: slugifyFoodType(label),
    label,
    parentSlug,
    aliases: [label],
  };
}

const ALL_BULK_PRESET_GROUPS = [...BULK_PRESET_GROUPS, ...EXTRA_BULK_PRESET_GROUPS];

const BULK_PRESET_FOOD_TYPE_SPECS = ALL_BULK_PRESET_GROUPS.flatMap(group =>
  group.labels.map(label => bulkSpec(group.parentSlug, label))
);

function uniqueItems<T>(items: T[], getKey: (item: T) => string = item => String(item)): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = getKey(item).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function profileFromSpec(spec: PresetFoodTypeSpec): FoodTypeProfile {
  const base = PROFILES.find(profile => profile.slug === spec.parentSlug) ?? GENERIC_PROFILE;
  return {
    ...base,
    slug: spec.slug,
    label: spec.label,
    parentSlug: spec.parentSlug,
    aliases: uniqueItems([spec.label, spec.slug, ...spec.aliases]),
    cataAttributes: uniqueItems([...(spec.cata ?? []), ...base.cataAttributes]),
    intensityAttributes: uniqueItems([...(spec.intensity ?? spec.cata ?? []).slice(0, 8), ...base.intensityAttributes]).slice(0, 12),
    riskMarkers: uniqueItems([...(spec.risk ?? []), ...base.riskMarkers]),
    successMarkers: uniqueItems([...(spec.success ?? []), ...base.successMarkers]),
  };
}

const ALL_PRESET_FOOD_TYPE_SPECS = uniqueItems(
  [...PRESET_FOOD_TYPE_SPECS, ...BULK_PRESET_FOOD_TYPE_SPECS],
  spec => spec.slug,
);

const PRESET_FOOD_TYPE_PROFILES = ALL_PRESET_FOOD_TYPE_SPECS.map(profileFromSpec);

export const FOOD_TYPE_PROFILES = [...PROFILES, ...PRESET_FOOD_TYPE_PROFILES];

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

export function formatFoodTypeDetectionLabel(detection: Pick<FoodTypeDetection, 'label' | 'modifiers'>) {
  if (detection.modifiers.length === 0) return detection.label;
  return `${detection.modifiers.map(modifier => modifier.label).join(' ')} ${detection.label}`;
}

export function getFoodTypeProfile(slug: string): FoodTypeProfile {
  return FOOD_TYPE_PROFILES.find(profile => profile.slug === slug) ?? {
    ...GENERIC_PROFILE,
    slug,
    label: formatFoodTypeLabel(slug),
  };
}

function aliasMatches(text: string, alias: string) {
  const escaped = alias.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
}

function detectModifiers(text: string): FoodTypeModifier[] {
  return FOOD_TYPE_MODIFIERS.filter(modifier =>
    modifier.aliases.some(alias => aliasMatches(text, alias))
  );
}

function stripCompositionalModifiers(text: string): string {
  let result = ` ${text} `;
  FOOD_TYPE_MODIFIERS
    .filter(modifier => COMPOSITIONAL_MODIFIER_SLUGS.has(modifier.slug))
    .flatMap(modifier => modifier.aliases)
    .sort((a, b) => b.length - a.length)
    .forEach(alias => {
      const escaped = alias.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'gi'), ' ');
    });
  return result.replace(/\s+/g, ' ').trim();
}

export function detectFoodType(...values: Array<string | undefined | null>): FoodTypeDetection {
  const text = values.filter(Boolean).join(' ').toLowerCase();
  const matchText = stripCompositionalModifiers(text) || text;
  const modifiers = detectModifiers(text);
  const evidence: string[] = [];
  let bestProfile: FoodTypeProfile | null = null;
  let bestScore = 0;
  let tied = false;

  for (const profile of FOOD_TYPE_PROFILES) {
    const matches = profile.aliases.filter(alias => aliasMatches(matchText, alias));
    const score = matches.reduce((sum, alias) => {
      const normalizedAlias = alias.toLowerCase().trim();
      if (normalizedAlias === matchText.trim()) return sum + 5;
      return sum + (normalizedAlias.includes(' ') ? 2 : 1);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestProfile = profile;
      tied = false;
      evidence.splice(0, evidence.length, ...matches);
    } else if (score > 0 && score === bestScore) {
      if (bestProfile && profile.parentSlug === bestProfile.slug) {
        bestProfile = profile;
        tied = false;
        evidence.splice(0, evidence.length, ...matches);
      } else if (bestProfile?.parentSlug === profile.slug) {
        tied = false;
      } else {
        tied = true;
      }
    }
  }

  if (bestProfile && !tied) {
    return {
      slug: bestProfile.slug,
      label: bestProfile.label,
      confidence: Math.min(0.98, 0.65 + bestScore * 0.12),
      evidence,
      aliases: bestProfile.aliases,
      modifiers,
    };
  }

  const explicit = values.find(value => value?.trim());
  const slug = slugifyFoodType(matchText || explicit || 'generic');
  return {
    slug,
    label: slug === 'generic' ? 'Generic' : formatFoodTypeLabel(slug),
    confidence: slug === 'generic' ? 0.25 : 0.45,
    evidence: explicit ? [explicit] : [],
    aliases: [],
    modifiers,
  };
}

export function getDefaultCataAttributesForFoodType(slug: string) {
  return [...getFoodTypeProfile(slug).cataAttributes];
}

export function getDefaultIntensityAttributesForFoodType(slug: string) {
  return [...getFoodTypeProfile(slug).intensityAttributes];
}
