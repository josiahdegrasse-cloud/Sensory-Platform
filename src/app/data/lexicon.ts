// Sensory – Flavour Lexicon (co-designed with panelists via HFD think-aloud protocol)
// Reference standards used in training listed for each attribute

export const ATTRIBUTE_LEXICON: Record<string, string> = {
  // Positive dairy notes
  "Lactic acid": "Mild, clean sour note from lactic fermentation. Reference: Plain yogurt",
  "Milk": "Fresh, clean dairy flavor characteristic of whole milk. Reference: Fresh whole milk",
  "Cheese": "Dairy umami flavor typical of aged cheese. Reference: Parmesan",
  "Butter": "Rich, creamy dairy fat flavor. Reference: Cultured butter",
  
  // Grain/cereal notes
  "Malt": "Sweet, toasted grain flavor from malted barley. Reference: Malt vinegar",
  "Rye": "Earthy, slightly sour grain note. Reference: Rye bread",
  "white flour": "Neutral, starchy cereal note. Reference: White bread",
  "Grains": "General cereal/grain flavor. Reference: Oat milk",
  
  // Sweet/pleasant
  "Dried fruits": "Concentrated sweet fruit flavors (raisin, apricot, fig). Reference: Dried apricot",
  "Nutty": "Toasted nut aroma (almond, hazelnut, cashew). Reference: Roasted cashews",
  "Vanilla": "Sweet, creamy aromatic note from vanillin. Reference: Vanilla extract",
  "Honey": "Floral, sweet nectar flavor. Reference: Honey",
  "Molasses": "Dark, bittersweet syrup flavor. Reference: Blackstrap molasses",
  "Caramel": "Sweet, cooked sugar aroma from Maillard reactions. Reference: Caramel sauce",
  "Toasted": "Browned, roasted flavor. Reference: Toasted bread",
  
  // Fermented/yeast
  "Yeast": "Bready, fermented aroma from cultures or yeast extracts. Reference: Active dry yeast",
  
  // Vegetable/neutral
  "Earthy/vegetal": "Soil-like, mushroom, or vegetable note. Reference: Raw mushrooms",
  "Oil": "Neutral fatty flavor, can be vegetable or seed oil. Reference: Sunflower oil",
  
  // Off-notes/defects
  "Vinegar": "Sharp, acidic aroma from acetic acid (over-fermentation). Reference: White vinegar",
  "Cardboard": "Papery, oxidized flavor from lipid degradation. Reference: Oxidized nuts",
  "Musty": "Stale, damp aroma like old paper, indicates poor storage. Reference: Damp cardboard",
  "Off-aroma": "General unpleasant odor not fitting other categories. Reference: N/A",
  "Manure": "Animal waste odor, sometimes from certain cultures. Reference: N/A",
  "Paint": "Chemical, solvent-like off-flavor. Reference: N/A",
  "Rancid": "Off-flavor from oxidized fats, sour/stale/paint-like. Reference: Oxidized oil",
  "Ammonia": "Pungent, sharp alkaline odor. Reference: Cleaning ammonia (diluted)",
  "Animal feed": "Grassy, hay-like odor associated with livestock feed. Reference: Hay/silage",
};

// Reference standards used in 2×90min HFD training sessions
export const REFERENCE_STANDARDS = [
  { attribute: "Cheese", standard: "Parmesan", purpose: "Dairy umami benchmark" },
  { attribute: "Butter", standard: "Cultured butter", purpose: "Diacetyl/butterfat note" },
  { attribute: "Rye", standard: "Rye bread", purpose: "Earthy grain note" },
  { attribute: "Vanilla", standard: "Vanilla extract", purpose: "Vanillin aromatic" },
  { attribute: "Malt", standard: "Malt vinegar", purpose: "Malted grain sweetness" },
  { attribute: "Dried fruits", standard: "Dried apricot", purpose: "Concentrated fruit sweetness" },
  { attribute: "Honey", standard: "Honey", purpose: "Floral sweetness" },
  { attribute: "Toasted", standard: "Toasted bread", purpose: "Maillard browning" },
];
