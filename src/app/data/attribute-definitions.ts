// Definitions for sensory attributes to help panelists understand what each term means

export const CATA_DEFINITIONS: Record<string, string> = {
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
  'Oily': 'A greasy, slick feeling that coats the mouth and lingers'
};

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
