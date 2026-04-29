export const SAMPLES = [
  { id: "S1", name: "Sample 1", category: "Coconut-based", type: "pbca" },
  { id: "S2", name: "Sample 2", category: "Coconut-based", type: "pbca" },
  { id: "S3", name: "Sample 3", category: "Coconut-based", type: "pbca" },
  { id: "S4", name: "Sample 4", category: "Coconut-based", type: "pbca" },
  { id: "S5", name: "Sample 5", category: "Cashew-based", type: "pbca" },
  { id: "S6", name: "Sample 6", category: "Cashew-based", type: "pbca" },
  { id: "S7", name: "Sample 7", category: "Cashew-based", type: "pbca" },
  { id: "S8", name: "Sample 8", category: "Cashew-based", type: "pbca" },
  { id: "S9", name: "Sample 9", category: "Mixed base", type: "pbca" },
  { id: "S10", name: "Sample 10", category: "Mixed base", type: "pbca" },
  { id: "S11", name: "Sample 11", category: "Mixed base", type: "pbca" },
  { id: "S12", name: "Sample 12", category: "Mixed base", type: "pbca" },
  { id: "D1", name: "Dairy Control 1", category: "Dairy", type: "dairy" },
  { id: "D2", name: "Dairy Control 2", category: "Dairy", type: "dairy" },
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