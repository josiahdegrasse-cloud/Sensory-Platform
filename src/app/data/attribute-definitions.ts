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

const EXTENDED_CATA_DEFINITIONS: Record<string, string> = {
  'Acidic': 'A clean, sharp acid taste that makes the mouth water — similar to citrus juice or vinegar',
  'Almond': 'The sweet, nutty aroma and flavour associated with fresh or lightly toasted almonds',
  'Ammonia': 'A sharp, penetrating cleaning-product aroma that catches in the nose',
  'Baked': 'Warm, oven-cooked notes created by browning, similar to a baked crust or casserole edge',
  'Balanced': 'No single taste or aroma dominates; sweetness, acidity, salt, bitterness, and savoury notes feel proportionate',
  'Banana': 'A ripe banana-like aroma and flavour, ranging from fresh fruit to banana sweet',
  'Berry': 'A red- or dark-berry aroma and flavour, such as strawberry, raspberry, or blackberry',
  'Blue': 'The pungent, earthy, slightly peppery character associated with blue-mould cheese',
  'Bran': 'The toasted, woody grain flavour and dry mouthfeel associated with cereal bran',
  'Bready': 'A cooked bread or dough character, like crumb, toast, or a soft bread roll',
  'Briny': 'A clean salty, mineral character resembling seawater or pickle brine',
  'Brothy': 'A light cooked-stock character with savoury meat or vegetable notes',
  'Bruised': 'Overripe, softened fruit character with dull, slightly fermented or oxidised notes',
  'Cabbage': 'The cooked or fermented brassica aroma associated with cabbage or sauerkraut',
  'Caramel': 'Sweet browned-sugar flavour, like caramelised sugar or toffee',
  'Carbonated': 'The tingling, prickling sensation produced by dissolved bubbles in a drink',
  'Cashew': 'A mild, creamy nut flavour associated with raw or lightly roasted cashews',
  'Cheddar': 'The recognisable savoury, tangy cheese character associated with cheddar',
  'Cheesy': 'A clear cheese-like aroma or flavour, from mild dairy notes to aged savoury character',
  'Chemical': 'An artificial solvent-, cleaner-, or medicine-like aroma or flavour',
  'Cherry': 'A sweet-tart cherry aroma and flavour, ranging from fresh fruit to cherry preserve',
  'Chicken': 'The savoury aroma and flavour of cooked chicken meat or chicken stock',
  'Chickpea': 'The mild nutty, earthy flavour associated with cooked chickpeas',
  'Chocolate': 'The familiar cocoa-based flavour of milk or dark chocolate',
  'Citrus': 'Bright lemon-, lime-, orange-, or grapefruit-like aroma and acidity',
  'Clean': 'A clear, fresh character without stale, muddy, chemical, or lingering off-notes',
  'Coating': 'A film that remains over the tongue and mouth surfaces after swallowing',
  'Cocoa': 'Roasted cocoa-bean aroma and flavour, like unsweetened cocoa powder or dark chocolate',
  'Cold': 'The cooling temperature sensation perceived while the product is in the mouth',
  'Cooked': 'A heated vegetable, grain, egg, or protein note rather than a fresh or raw character',
  'Corn': 'The sweet, cereal-like flavour of cooked, toasted, or popped corn',
  'Crisp': 'A clean, brittle texture that breaks quickly with a sharp snap',
  'Crunchy': 'A firm texture that produces repeated, audible fractures during chewing',
  'Crust': 'A browned, firmer outer layer with baked or toasted flavour',
  'Curdy': 'Distinct soft curd pieces or a fresh cheese-curd texture in the mouth',
  'Cured': 'Salty, matured meat character produced by curing, similar to ham or prosciutto',
  'Delicate': 'A light, refined flavour that is noticeable but not forceful or lingering',
  'Dusty': 'A dry, powdery cereal or storage note that can feel stale in the nose or mouth',
  'Earthy': 'Soil-, root vegetable-, mushroom-, or dry leaf-like aroma and flavour',
  'Eggy': 'The characteristic savoury aroma and flavour of cooked egg',
  'Filling': 'The distinct fruit, cream, chocolate, or savoury centre enclosed by the product',
  'Fishy': 'A strong, lingering fish aroma beyond a clean fresh-seafood character',
  'Fizzy': 'A lively bubbling and tingling sensation from carbonation or fermentation',
  'Flaky': 'Separates easily into thin layers or moist flakes when bitten or pressed',
  'Flexible': 'Bends or folds easily without cracking, tearing, or breaking',
  'Floral': 'A flower-like perfume or aroma, such as blossom, rose, or jasmine',
  'Fluffy': 'Light, aerated texture with low density and a soft, open structure',
  'Fried': 'Cooked-oil and browned notes associated with deep- or pan-frying',
  'Fudgy': 'Dense, moist, cohesive chocolate texture that yields slowly when bitten',
  'Full-bodied': 'Substantial flavour and mouthfeel that fills the mouth and persists',
  'Funky': 'Strong, complex fermented aroma that may be earthy, yeasty, or animal-like',
  'Garlic': 'The pungent, savoury aroma and flavour of fresh, cooked, or roasted garlic',
  'Goaty': 'The distinct tangy, animal-like aroma associated with goat milk or goat cheese',
  'Grape': 'Fresh, cooked, or candy-like grape aroma and flavour',
  'Grassy': 'Fresh-cut grass, green leaf, or raw plant-like aroma and flavour',
  'Greasy': 'An excessive oily coating that feels heavy or slick in the mouth or on the fingers',
  'Green': 'Fresh, raw plant character resembling leaves, stems, peas, or unripe fruit',
  'Gritty': 'Noticeable hard or sandy particles that remain distinct during chewing',
  'Hard': 'High resistance to biting or compression; difficult to break or deform',
  'Hazelnut': 'Sweet, roasted nut aroma and flavour associated with hazelnuts',
  'Heat': 'A warming or burning sensation from chilli, pepper, ginger, or similar pungent ingredients',
  'Heavy': 'Dense, weighty mouthfeel that can feel filling or slow to clear',
  'Herbal': 'Fresh or dried herb aroma, such as basil, parsley, thyme, or oregano',
  'High protein': 'A dense, protein-rich character that may feel firm, drying, or slightly powdery',
  'Hoppy': 'Bitter, floral, citrus, resinous, or herbal aroma associated with hops',
  'Icy': 'Noticeable ice crystals or a coarse frozen texture rather than a smooth frozen body',
  'Jammy': 'Concentrated, cooked-fruit sweetness resembling jam or fruit preserve',
  'Lean': 'Low-fat meat character with little richness, oiliness, or mouth-coating fat',
  'Light': 'Low-density body or gentle flavour that clears quickly from the mouth',
  'Marine': 'Clean sea-air, seaweed, shellfish, or fresh-ocean aroma and flavour',
  'Mealy': 'Soft, dry, fine-particle texture like cooked beans, potatoes, or overripe fruit',
  'Meaty': 'Dense cooked-meat flavour and fibrous bite, broader than one specific meat species',
  'Melon': 'Fresh, watery-sweet aroma and flavour resembling melon',
  'Melty': 'Softens and flows readily with warmth, leaving a smooth rather than rubbery texture',
  'Metallic': 'Coin-, iron-, or blood-like taste that can feel sharp and lingering',
  'Mineral': 'Clean stone-, chalk-, or mineral-water-like taste without a metallic off-note',
  'Miso': 'Salty, fermented soybean character with deep savoury umami',
  'Muddy': 'Damp soil or pond-like flavour that obscures clean fresh notes',
  'Mushroom': 'Earthy, savoury aroma and flavour associated with fresh or cooked mushrooms',
  'Mushy': 'Over-soft texture with little structure or resistance during chewing',
  'Mustardy': 'Sharp, tangy mustard-seed flavour with mild nasal heat',
  'Neutral': 'Very little distinctive aroma or flavour; clean and unobtrusive',
  'Nooks': 'Open holes and irregular pockets in the crumb, typical of an English muffin',
  'Oaty': 'Mild, sweet cereal flavour associated with oats or oatmeal',
  'Over-fermented': 'Excessively sour, yeasty, alcoholic, or funky character from fermentation progressing too far',
  'Oxidized': 'Stale fat, papery, paint-like, or dulled flavour caused by exposure to oxygen',
  'Pasta': 'The mild wheat, egg, or cooked-starch character of pasta',
  'Peanut': 'The recognisable roasted, nutty flavour associated with peanuts',
  'Pear': 'Fresh pear aroma and flavour, often lightly floral, sweet, and juicy',
  'Peppery': 'Black-pepper-like pungency or a dry warming sensation in the mouth or nose',
  'Pillowy': 'Very soft, light, and yielding texture with gentle spring-back',
  'Pistachio': 'Sweet, green, roasted-nut aroma and flavour associated with pistachios',
  'Plant-based': 'Recognisable grain, pulse, nut, seed, or vegetable-base character rather than animal-derived flavour',
  'Porky': 'The characteristic savoury, slightly sweet aroma and flavour of cooked pork',
  'Potato': 'The earthy, starchy flavour and texture associated with cooked potato',
  'Pungent': 'Strong, penetrating aroma or flavour that reaches the nose quickly',
  'Rice': 'The mild, clean, starchy aroma and flavour of cooked rice',
  'Rind': 'The firmer outer cheese layer, which may taste earthy, mushroom-like, washed, or slightly bitter',
  'Ripe': 'Fully developed fruit aroma, sweetness, and softness without fermented or spoiled notes',
  'Roasted': 'Deep browned aroma and flavour created by dry heat, like roasted nuts, coffee, or vegetables',
  'Rye': 'Earthy, slightly sour and spicy grain character associated with rye',
  'Seedy': 'Distinct seed flavour or the presence of small seeds during chewing',
  'Sesame': 'Nutty, toasted seed aroma and flavour associated with sesame or tahini',
  'Soggy': 'Wet, collapsed texture that has lost expected crispness or structure',
  'Soy': 'The mild beany, nutty flavour associated with soybeans or tofu',
  'Spongy': 'Porous, compressible texture that springs back like a sponge',
  'Starchy': 'Cooked flour, rice, potato, or pasta character with a thick or powdery mouthfeel',
  'Stone fruit': 'Peach-, plum-, apricot-, or cherry-like aroma and flavour',
  'Stretchy': 'Pulls into elastic strands before breaking, as expected from melted mozzarella',
  'Tart': 'Bright, mouth-watering fruit acidity that is sharper than mild tanginess',
  'Taurine': 'A characteristic energy-drink note that can seem slightly medicinal, bitter, or synthetic',
  'Thin': 'Low viscosity or body; flows quickly and feels light in the mouth',
  'Toasted': 'Dry browned grain, bread, seed, or nut notes produced by gentle heating',
  'Tomato': 'The sweet-acidic, green, or cooked flavour associated with tomato',
  'Tropical': 'Fruit character resembling pineapple, mango, passion fruit, guava, or papaya',
  'Turkey': 'The mild savoury aroma and flavour of cooked turkey',
  'Vanilla': 'Sweet, warm vanilla-pod or vanilla-extract aroma and flavour',
  'Vegetable': 'General cooked or fresh vegetable aroma and flavour without one vegetable dominating',
  'Vinegar': 'Sharp acetic aroma and sour taste associated with vinegar',
  'Walnut': 'Earthy, woody nut flavour with the slight bitterness typical of walnuts',
  'Waxy': 'A firm, coating mouthfeel that resembles candle wax and melts slowly',
  'Wilted': 'Limp, softened plant texture with reduced freshness and crispness',
  'Wok hei': 'Smoky, toasted, high-heat aroma produced by rapid wok cooking',
  'Woody': 'Dry wood, bark, cedar, or oak-like aroma and flavour',
  'Zesty': 'Bright citrus-peel character with lively acidity and aromatic freshness',
  'Lactic acid': 'Clean yogurt-like sourness produced by lactic fermentation, softer than vinegar acidity',
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
  ...EXTENDED_CATA_DEFINITIONS,
};

function normalizeAttributeTerm(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[‐‑‒–—_]+/g, '-')
    .replace(/\s+/g, ' ');
}

function normalizedDefinitions(definitions: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(definitions).map(([term, definition]) => [normalizeAttributeTerm(term), definition]));
}

const NORMALIZED_CATA_DEFINITIONS = normalizedDefinitions(CATA_DEFINITIONS);

function customAttributeDefinition(attribute: string): string {
  const term = attribute.trim() || 'custom attribute';
  return `The ${term.toLocaleLowerCase()} character you perceive in this sample's aroma, flavour, taste, appearance, or texture. Select it only when it is clearly noticeable.`;
}

/** Return useful panelist guidance for every built-in or custom CATA term. */
export function getCataDefinition(attribute: string, _category?: string): string {
  return NORMALIZED_CATA_DEFINITIONS.get(normalizeAttributeTerm(attribute))
    ?? customAttributeDefinition(attribute);
}

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
