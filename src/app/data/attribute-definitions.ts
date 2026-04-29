// Definitions for sensory attributes to help panelists understand what each term means

export const CATA_DEFINITIONS: Record<string, string> = {
  // Positive dairy notes
  'Milk': 'Fresh, sweet dairy milk flavor and aroma',
  'Creamy': 'Rich, smooth, thick mouthfeel characteristic of dairy cream',
  'Butter': 'Rich, fatty, slightly sweet flavor reminiscent of butter',
  'Cheese': 'General cheese-like flavor and aroma',
  'Tangy': 'Sharp, acidic, slightly sour taste typical of fermented dairy',
  'Fresh': 'Clean, mild dairy flavor without aged characteristics',
  'Mild': 'Subtle, delicate flavor without strong or sharp notes',
  'Sharp': 'Intense, piquant, acidic flavor found in aged cheeses',
  'Aged': 'Complex, developed flavors from fermentation/aging',
  'Nutty': 'Toasted, roasted nut-like flavors',
  'Sweet': 'Sugar-like sweetness',
  'Salty': 'Sodium chloride taste',
  'Umami': 'Savory, meaty, glutamate-rich taste',

  // Textural
  'Smooth': 'Even, uniform texture without graininess',
  'Firm': 'Solid, resistant texture that holds shape',
  'Spreadable': 'Soft enough to spread easily at room temperature',
  'Crumbly': 'Breaks apart easily into small pieces',

  // Off-notes
  'Rancid': 'Oxidized fat flavor, stale or spoiled',
  'Cardboard': 'Papery, stale, oxidized flavor',
  'Fermented': 'Strong fermentation flavors beyond typical cheese tang',
  'Bitter': 'Sharp, unpleasant bitter taste',
  'Astringent': 'Dry, puckering mouthfeel',
  'Soapy': 'Chemical, fatty acid flavor reminiscent of soap',
  'Coconut': 'Sweet, tropical coconut flavor',
  'Beany': 'Green, raw legume flavor common in plant proteins',
  'Chalky': 'Dry, powdery mouthfeel',
  'Oily': 'Greasy, slick mouthfeel from excess fat'
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
