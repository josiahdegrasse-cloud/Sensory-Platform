export const SAMPLES = [
  { id: "S1",  name: "Coconut Cheddar v2.1",        category: "Coconut-based",  type: "pbca"  },
  { id: "S2",  name: "Cashew Mozzarella v1.2",       category: "Cashew-based",   type: "pbca"  },
  { id: "S3",  name: "Oat-Based Brie v1.0",          category: "Oat-based",      type: "pbca"  },
  { id: "S4",  name: "Coconut Cheddar v3.0",         category: "Coconut-based",  type: "pbca"  },
  { id: "S5",  name: "Cashew Cream Cheese v2.0",     category: "Cashew-based",   type: "pbca"  },
  { id: "S6",  name: "Almond Gouda v1.0",            category: "Almond-based",   type: "pbca"  },
  { id: "S7",  name: "Mixed Base Sharp Cheddar",     category: "Mixed base",     type: "pbca"  },
  { id: "S8",  name: "Cashew Cream Cheese v2.1",     category: "Cashew-based",   type: "pbca"  },
  { id: "S9",  name: "Almond Feta v1.5",             category: "Almond-based",   type: "pbca"  },
  { id: "S10", name: "Coconut Parmesan v1.1",        category: "Coconut-based",  type: "pbca"  },
  { id: "S11", name: "Mixed Base Gouda v1.0",        category: "Mixed base",     type: "pbca"  },
  { id: "S12", name: "Cashew Cheddar v2.0",          category: "Cashew-based",   type: "pbca"  },
  { id: "D1",  name: "Dairy Control 1",              category: "Dairy",          type: "dairy" },
  { id: "D2",  name: "Dairy Control 2",              category: "Dairy",          type: "dairy" },
  { id: "B1",  name: "Sourdough Loaf v1.0",          category: "Sourdough",      type: "bread" },
  { id: "B2",  name: "White Sandwich Bread v2.1",    category: "White Sandwich", type: "bread" },
  { id: "B3",  name: "Multigrain Artisan v1.0",      category: "Multigrain",     type: "bread" },
  { id: "B4",  name: "Rye Sourdough v2.0",           category: "Rye Sourdough",  type: "bread" },
  { id: "B5",  name: "Brioche v2.0",                 category: "Brioche",        type: "bread" },
  { id: "B6",  name: "Ciabatta v1.5",                category: "Ciabatta",       type: "bread" },
  { id: "B7",  name: "Whole Wheat Sandwich v1.0",    category: "Whole Wheat",    type: "bread" },
  { id: "B8",  name: "Seeded Rye v2.0",              category: "Seeded Rye",     type: "bread" },
  { id: "B9",  name: "Baguette v1.0",                category: "Baguette",       type: "bread" },
  { id: "B10", name: "Focaccia v1.2",                category: "Focaccia",       type: "bread" },
  { id: "B11", name: "Sourdough Boule v2.0",         category: "Sourdough",      type: "bread" },
  { id: "B12", name: "Enriched White v3.1",          category: "Enriched White", type: "bread" },
];

// Exact CATA lexicon from "Sensory – Flavour Lexicon (3).docx"
export const CATA_ATTRIBUTES = [
  // Positive dairy notes
  "Lactic acid", "Milk", "Cheese", "Butter",
  // Grain/cereal notes
  "Malt", "Rye", "white flour", "Grains",
  // Sweet/pleasant
  "Dried fruits", "Nutty", "Vanilla", "Honey", "Molasses", "Caramel", "Toasted",
  // Fermented/yeast
  "Yeast",
  // Vegetable/neutral
  "Earthy/vegetal", "Oil",
  // Off-notes/defects
  "Vinegar", "Cardboard", "Musty", "Off-aroma", "Manure", "Paint", "Rancid", "Ammonia", "Animal feed"
];

// Attribute descriptions for tooltips
export const ATTRIBUTE_LEXICON: Record<string, string> = {
  "Lactic acid": "Tangy, yogurt-like sourness characteristic of fermented dairy",
  "Milk": "Fresh, clean dairy aroma and flavor",
  "Cheese": "Savory, aged dairy notes",
  "Butter": "Rich, creamy, fatty dairy character",
  "Malt": "Sweet, toasted grain flavor similar to malted barley",
  "Rye": "Earthy, slightly bitter grain note",
  "white flour": "Starchy, neutral grain character",
  "Grains": "General cereal/grain notes",
  "Dried fruits": "Sweet, concentrated fruit flavors (raisins, dates)",
  "Nutty": "Toasted nut aromas (almond, hazelnut, cashew)",
  "Vanilla": "Sweet, creamy aromatic from vanilla bean",
  "Honey": "Floral, sweet nectar-like notes",
  "Molasses": "Deep, bittersweet caramelized sugar",
  "Caramel": "Sweet, burnt sugar notes",
  "Toasted": "Browned, roasted character",
  "Yeast": "Bready, fermented dough aroma",
  "Earthy/vegetal": "Soil-like, plant-based notes",
  "Oil": "Fatty, lipid character without specific flavor",
  "Vinegar": "Sharp acetic acid sourness",
  "Cardboard": "Stale, papery oxidized note (defect)",
  "Musty": "Damp, moldy off-aroma (defect)",
  "Off-aroma": "Unpleasant, unidentified aroma (defect)",
  "Manure": "Barnyard, fecal off-note (defect)",
  "Paint": "Chemical, solvent-like aroma (defect)",
  "Rancid": "Oxidized fat, soapy off-flavor (defect)",
  "Ammonia": "Harsh, cleaning chemical note (defect)",
  "Animal feed": "Hay-like, stale grain defect"
};

// Full EsSense25 profile (not shortened)
export const ESSENSE_EMOTIONS = [
  // Positive
  { emotion: "Happy", valence: "positive" },
  { emotion: "Satisfied", valence: "positive" },
  { emotion: "Nostalgic", valence: "positive" },
  { emotion: "Comfortable", valence: "positive" },
  { emotion: "Energetic", valence: "positive" },
  { emotion: "Adventurous", valence: "positive" },
  { emotion: "Calm", valence: "positive" },
  { emotion: "Wild", valence: "positive" },
  { emotion: "Pleasant", valence: "positive" },
  { emotion: "Warm", valence: "positive" },
  { emotion: "Good", valence: "positive" },
  { emotion: "Interested", valence: "positive" },
  { emotion: "Joyful", valence: "positive" },
  { emotion: "Free", valence: "positive" },
  { emotion: "Understanding", valence: "positive" },
  { emotion: "Secure", valence: "positive" },
  { emotion: "Loving", valence: "positive" },
  // Negative
  { emotion: "Disgusted", valence: "negative" },
  { emotion: "Worried", valence: "negative" },
  { emotion: "Bored", valence: "negative" },
  { emotion: "Disappointed", valence: "negative" },
  { emotion: "Aggressive", valence: "negative" },
  { emotion: "Guilty", valence: "negative" },
  { emotion: "Tame", valence: "negative" },
  { emotion: "Mild", valence: "negative" },
];

// Sample preparation protocol (ISSF review 3.3)
export const SAMPLE_PREP_PROTOCOL = {
  cheese: "2 g",
  saline: "2 mL of 0.3 g/mL NaCl solution",
  internalStandard: "10 ng/L citronellal",
  spme: "50/30 DVB/CAR/PDMS fiber",
  incubation: "10 min at 40°C",
  extraction: "20 min",
  centrifuge: "7000 rpm",
  dilution: "2:5 ratio for e-tongue"
};