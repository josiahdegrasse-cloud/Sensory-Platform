// Definitions for sensory attributes to help panelists understand what each term means
import { detectFoodType } from '../lib/food-intelligence';

const DAIRY_DEFINITIONS: Record<string, string> = {
  // Positive dairy notes
  'Milk': 'Fresh, sweet dairy milk flavor — like a glass of cold whole milk',
  'Creamy': 'Rich, smooth, thick mouthfeel — like double cream or crème fraîche',
  'Butter': 'Rich, fatty, slightly sweet flavor — like unsalted butter melting on warm bread',
  'Cheese': 'General cheese-like flavor — the overall savory depth you associate with cheddar or parmesan',
  'Tangy': 'Sharp, acidic, slightly sour taste — like plain yogurt or a mild vinegar note',
  'Fresh': 'Clean, mild dairy flavor without any aged or sharp characteristics',
  'Mild': 'Subtle, delicate flavor without strong or sharp notes — gentle and soft on the palate',
  'Sharp': 'Intense, piquant, acidic flavor — like a well-aged cheddar that bites the back of your tongue',
  'Aged': 'Complex, developed flavors from long fermentation — earthy depth like parmesan or aged gouda',
  'Nutty': 'Toasted, roasted nut-like flavors — like cashews or hazelnuts',
  'Sweet': 'Sugar-like sweetness — a pleasant mild sweetness, not candy-sweet',
  'Salty': 'The taste of salt — how much does it make your mouth water?',
  'Umami': 'A deep, savory, mouth-filling taste — the same satisfying richness you find in aged cheese, soy sauce, or slow-cooked meat',

  // Textural
  'Smooth': 'Even, uniform texture without graininess — like cream cheese or soft butter',
  'Firm': 'Solid, resistant texture that holds its shape when pressed',
  'Spreadable': 'Soft enough to spread easily at room temperature without crumbling',
  'Crumbly': 'Breaks apart easily into small dry pieces — like feta or a dry aged cheese',

  // Off-notes
  'Rancid': 'Oxidized or spoiled fat flavor — like old butter or stale cooking oil',
  'Cardboard': 'Papery, stale, flat flavor — like wet cardboard or an empty cereal box',
  'Fermented': 'Strong over-fermented flavor that goes beyond normal cheese tang — sharp and funky',
  'Bitter': 'An unpleasant sharp bitterness at the back of the mouth or throat',
  'Astringent': 'A dry, puckering feeling that makes your mouth feel tight or rough',
  'Soapy': 'A chemical, soapy flavor — like accidentally tasting dish soap',
  'Coconut': 'Sweet, tropical coconut flavor — like coconut milk or toasted coconut flakes',
  'Beany': 'Green, raw legume flavor — like undercooked lentils or raw soy milk',
  'Chalky': 'Dry, powdery mouthfeel — like chalk dust or calcium tablets',
  'Oily': 'A greasy, slick feeling that coats the mouth and lingers',
};

const BREAD_DEFINITIONS: Record<string, string> = {
  'Yeasty': 'The warm, fermented aroma of active yeast — like a freshly opened bag of bread dough',
  'Fresh-baked': 'The inviting warm aroma of bread straight from the oven',
  'Malty': 'A sweet, grain-like flavor reminiscent of malted barley or cereal',
  'Wheaty': 'The characteristic earthy, grassy flavor of whole wheat flour',
  'Grainy': 'A coarse, slightly rough flavor and texture from whole grains or seeds',
  'Honey': 'A light, floral sweetness resembling natural honey',
  'Nutty': 'Toasted, roasted nut-like flavors from browned flour or seeds',
  'Buttery': 'Rich, creamy butter flavor — from fat enrichment or Maillard browning',
  'Sweet': 'Pleasant mild sweetness from sugars or natural grain starches',
  'Salty': 'The taste of salt — how present is the savoury mineral note?',
  'Soft': 'A pillowy, yielding crumb that compresses easily without resistance',
  'Crusty': 'A firm, crispy outer shell with audible crunch',
  'Chewy': 'Requires sustained chewing — springy resistance like a bagel or sourdough',
  'Airy': 'Light, open crumb structure with large air pockets',
  'Dense': 'Compact, heavy crumb with few air pockets',
  'Springy': 'Bounces back when pressed — elastic crumb structure',
  'Crumbly': 'Breaks apart easily into small dry pieces',
  'Sticky': 'Clings to teeth or the roof of the mouth',
  'Stale': 'Dry, hard, loss of fresh aroma — bread past its prime',
  'Gummy': 'Wet, under-baked crumb that sticks to the teeth unpleasantly',
  'Sour': 'Excess lactic or acetic acid — strong vinegar or tang beyond normal sourdough',
  'Bitter': 'Unpleasant sharp bitterness, often from over-fermentation or burnt crust',
  'Bland': 'Flat, characterless — lacking expected bread flavour',
  'Doughy': 'Raw, under-cooked flour note — the interior feels unfinished',
  'Burnt': 'Charred, acrid, carbonized crust or crumb note',
  'Musty': 'Mouldy, damp basement note — sign of spoilage or poor storage',
};

const MEAT_DEFINITIONS: Record<string, string> = {
  'Beefy': 'Cooked beef-like savoury aroma and flavour',
  'Smoky': 'Smoke, grilled, or cured character',
  'Savory': 'Broad salty, cooked, non-sweet flavour depth',
  'Juicy': 'Moist, succulent mouthfeel during chewing',
  'Fatty': 'Rich fat flavour or mouth-coating perception',
  'Spiced': 'Seasoning character from pepper, herbs, or warm spices',
  'Herby': 'Green herb or botanical seasoning note',
  'Charred': 'Grilled browned surface flavour without excessive burning',
  'Tender': 'Easy to bite and chew',
  'Fibrous': 'Stringy or muscle-fiber-like texture',
  'Gamey': 'Strong animal-like flavour beyond clean cooked meat',
  'Livery': 'Metallic organ-meat note',
  'Rubbery': 'Elastic, bouncy texture that resists chewing',
  'Sulfurous': 'Eggy, cabbage-like, or oniony sulfur note',
};

const YOGURT_DEFINITIONS: Record<string, string> = {
  'Creamy': 'Smooth, rich dairy or cultured base mouthfeel',
  'Tangy': 'Clean lactic acidity typical of cultured yogurt',
  'Sour': 'Sharp acid taste, stronger than mild tang',
  'Fresh': 'Clean cultured character without stale or cooked notes',
  'Milky': 'Fresh milk-like flavour',
  'Thick': 'Viscous spoonable body',
  'Fermented': 'Cultured dairy aroma or flavour from fermentation',
  'Fruity': 'Fruit-like flavour or aroma',
  'Watery': 'Thin body or visible whey separation',
  'Artificial': 'Synthetic flavour character rather than natural dairy or fruit',
};

const GENERIC_DEFINITIONS: Record<string, string> = {
  'Sweet': 'Sugar-like sweetness — pleasant mild sweetness',
  'Salty': 'The taste of salt — savoury mineral note',
  'Sour': 'Acidic, sharp tartness',
  'Bitter': 'Sharp unpleasant bitterness at the back of the mouth',
  'Umami': 'Deep, savoury, mouth-filling richness',
  'Spicy': 'Heat or pungency from spices or chilli',
  'Fresh': 'Clean, light, bright character without off-notes',
  'Aromatic': 'Noticeable pleasant fragrance or aroma',
  'Rich': 'Full-bodied, intense, concentrated flavour',
  'Mild': 'Subtle, gentle — low intensity overall',
  'Smooth': 'Even, uniform texture without graininess or roughness',
  'Soft': 'Yields easily under pressure',
  'Firm': 'Solid, resistant texture that holds its shape',
  'Crispy': 'Dry, brittle, breaks with an audible snap',
  'Chewy': 'Requires sustained chewing — elastic resistance',
  'Moist': 'Pleasantly wet without being soggy',
  'Dry': 'Lacking moisture — can feel rough or powdery',
  'Bland': 'Flat, featureless — lacking expected character',
  'Off-note': 'Any unpleasant or unexpected flavour not otherwise listed',
  'Stale': 'Old, flat, loss of fresh character',
  'Burnt': 'Charred, acrid, carbonized note',
};

export const CATA_DEFINITIONS: Record<string, string> = {
  ...DAIRY_DEFINITIONS,
  ...BREAD_DEFINITIONS,
  ...MEAT_DEFINITIONS,
  ...YOGURT_DEFINITIONS,
  ...GENERIC_DEFINITIONS,
};

export function getCataDefinitions(category?: string): Record<string, string> {
  if (!category) return CATA_DEFINITIONS;
  const slug = detectFoodType(category).slug;
  if (slug === 'yogurt') return { ...GENERIC_DEFINITIONS, ...YOGURT_DEFINITIONS };
  if (slug === 'meat') return { ...GENERIC_DEFINITIONS, ...MEAT_DEFINITIONS };
  if (slug === 'cheese')
    return { ...GENERIC_DEFINITIONS, ...DAIRY_DEFINITIONS };
  if (slug === 'bread')
    return { ...GENERIC_DEFINITIONS, ...BREAD_DEFINITIONS };
  return GENERIC_DEFINITIONS;
}

export const INTENSITY_DEFINITIONS: Record<string, string> = {
  'Milk': 'How strong is the fresh dairy milk flavor?',
  'Creamy': 'How rich and cream-like is the mouthfeel?',
  'Butter': 'How intense is the butter flavor?',
  'Cheese': 'How strong is the overall cheese character?',
  'Tangy': 'How sharp and acidic is the taste?',
  'Nutty': 'How pronounced are the nutty notes?',
  'Salty': 'How salty does it taste?',
  'Sweet': 'How sweet is the flavor?'
};

export const HEDONIC_DEFINITIONS: Record<string, string> = {
  'overall': 'Your overall impression of the product',
  'appearance': 'The visual appeal, color, and texture appearance',
  'aroma': 'The smell before tasting',
  'flavor': 'The taste experience',
  'texture': 'The mouthfeel and physical structure'
};

export const EMOTION_DEFINITIONS: Record<string, string> = {
  // Positive
  'Happy': 'Feeling pleased and content',
  'Satisfied': 'Feeling fulfilled and content',
  'Pleasant': 'Enjoyable and agreeable experience',
  'Delighted': 'Extremely pleased and happy',
  'Interested': 'Curious and engaged',
  'Curious': 'Wanting to know or learn more',
  'Enthusiastic': 'Excited and eager',
  'Calm': 'Peaceful and relaxed',
  'Comfortable': 'At ease and relaxed',
  'Energetic': 'Feeling lively and active',
  'Good': 'General positive feeling',
  'Joyful': 'Experiencing great happiness',
  'Loving': 'Feeling affection and warmth',
  'Nostalgic': 'Sentimental longing for the past',
  'Peaceful': 'Calm and tranquil',
  'Secure': 'Safe and confident',
  'Warm': 'Comfortable and cozy feeling',

  // Negative
  'Disgusted': 'Strong aversion or revulsion',
  'Bored': 'Lacking interest or excitement',
  'Disappointed': 'Let down or dissatisfied',
  'Worried': 'Anxious or concerned',
  'Aggressive': 'Hostile or confrontational feeling',
  'Guilty': 'Feeling culpable or wrong',
  'Tame': 'Dull or unexciting',
  'Uninterested': 'Lacking enthusiasm or concern'
};
