// Enhanced sensory data: Insent TS-5000Z + Agilent 7200 Q-TOF GC-MS + PHASER Olfactometer
// Sample prep: 2g cheese + 2mL 0.3g/mL NaCl + 10ng/L citronellal ISTD

export interface EnhancedSensoryProfile {
  sampleId: string;
  sampleName: string;
  
  // TS-5000Z E-Tongue (9 dimensions, 2:5 dilution, 40°C, 7000rpm)
  taste: {
    sourness: number; // 0-10 scale
    bitterness: number;
    astringency: number;
    umami: number;
    saltiness: number;
    sweetness: number;
    astringencyAftertaste: number;
    umamiAftertaste: number;
    bitternessAftertaste: number;
    richness: number;
  };
  
  // Chemical composition (ISO methods)
  composition: {
    salt: number; // % (argentometric)
    fat: number; // % (Gerber-van Gulik)
    protein: number; // % (Kjeldahl)
    starchDryMatter: number; // %
  };
  
  // GC-MS + GC-Olfactometry (Agilent 7200 Q-TOF + PHASER port, 67:33 split)
  gcmsOlfactometry: Array<{
    retentionTime: number; // minutes
    compound: string; // NIST match
    nistProbability: number; // % match
    peakArea: number;
    odour: string; // perceived at olfactometry port
    odourIntensity: number; // 0-5 scale
    concentration?: number; // ppm
    threshold?: number; // sensory threshold ppm
    isBlankArtefact?: boolean; // 25.4 min "burnt plastic" auto-removed
  }>;
  
  // Internal standard QC
  istdRecovery: number; // % recovery of 10 ng/L citronellal
  olfactometryFlowSplit: string; // "67:33 confirmed"
  
  // Semi-trained panel CATA (14 panelists, 25 attributes from Flavour Lexicon)
  cata: {
    [attribute: string]: number; // frequency count (0-14)
  };
  
  // Semi-trained panel intensity ratings (mean of 14 panelists, 0-10 scale)
  // Keys are food-type specific (dairy: sourMilk/milkiness/etc; bread: yeastiness/crustiness/etc)
  intensity: Record<string, number>;
  
  // 4 separate hedonic scales (9-point each - ISSF review Appendix D)
  hedonic: {
    appearance: number; // 1-9
    flavour: number;
    texture: number;
    overall: number;
  };
  
  // EsSense25 full profile (17 positive + 8 negative)
  emotions: {
    positive: number; // 0-5 scale average
    negative: number;
  };
  
  // Trained panel reference (parallel comparison: 14 semi-trained + 8 trained)
  trainedPanelReference?: {
    overallQuality: number; // 0-100
    recommendation: "GO" | "TWEAK" | "STOP";
    delta: number; // difference from ISSF score
  };
}

export const ENHANCED_SENSORY_DATA: EnhancedSensoryProfile[] = [
  {
    sampleId: "S1",
    sampleName: "Coconut Cheddar v2.1",
    taste: { sourness: 2.3, bitterness: 3.1, astringency: 2.8, umami: 2.8, saltiness: 4.2, sweetness: 1.5, astringencyAftertaste: 2.4, umamiAftertaste: 3.1, bitternessAftertaste: 2.9, richness: 5.2 },
    composition: { salt: 1.8, fat: 24.5, protein: 8.2, starchDryMatter: 12.3 },
    gcmsOlfactometry: [
      { retentionTime: 8.2, compound: "Diacetyl", nistProbability: 92, peakArea: 142000, odour: "buttery", odourIntensity: 2.8, concentration: 3.2, threshold: 10.0 },
      { retentionTime: 15.7, compound: "Vanillin", nistProbability: 88, peakArea: 58000, odour: "vanilla", odourIntensity: 1.4, concentration: 1.1 },
    ],
    istdRecovery: 94.2,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { "Lactic acid": 9, "Milk": 8, "Cheese": 7, Butter: 11, Nutty: 4 },
    intensity: { sourMilk: 2.1, milkiness: 6.3, cheesiness: 5.8, creamy: 6.8, grainy: 2.1, oily: 3.4, chalky: 1.8, smooth: 7.2 },
    hedonic: { appearance: 6.8, flavour: 6.5, texture: 6.4, overall: 6.2 },
    emotions: { positive: 3.9, negative: 1.2 },
    trainedPanelReference: { overallQuality: 79, recommendation: "GO", delta: 5.3 }
  },
  {
    sampleId: "S2",
    sampleName: "Cashew Mozzarella v1.2",
    taste: { sourness: 2.8, bitterness: 3.4, astringency: 3.1, umami: 3.1, saltiness: 3.9, sweetness: 1.3, astringencyAftertaste: 2.8, umamiAftertaste: 3.4, bitternessAftertaste: 3.2, richness: 4.8 },
    composition: { salt: 1.6, fat: 22.8, protein: 7.9, starchDryMatter: 11.7 },
    gcmsOlfactometry: [
      { retentionTime: 8.3, compound: "Diacetyl", nistProbability: 91, peakArea: 128000, odour: "buttery", odourIntensity: 2.4, concentration: 2.8, threshold: 10.0 },
      { retentionTime: 22.1, compound: "Limonene", nistProbability: 85, peakArea: 21000, odour: "citrus", odourIntensity: 0.8, concentration: 0.4 },
    ],
    istdRecovery: 92.8,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { "Lactic acid": 8, "Milk": 6, Butter: 10, Nutty: 3, Grains: 4 },
    intensity: { sourMilk: 2.4, milkiness: 5.7, cheesiness: 5.2, creamy: 5.9, grainy: 3.2, oily: 3.8, chalky: 2.4, smooth: 6.1 },
    hedonic: { appearance: 6.3, flavour: 6.0, texture: 5.9, overall: 5.8 },
    emotions: { positive: 3.4, negative: 1.6 },
    trainedPanelReference: { overallQuality: 72, recommendation: "GO", delta: 6.8 }
  },
  {
    sampleId: "S3",
    sampleName: "Oat-Based Brie v1.0",
    taste: { sourness: 4.5, bitterness: 2.9, astringency: 3.6, umami: 2.4, saltiness: 3.6, sweetness: 1.8, astringencyAftertaste: 3.8, umamiAftertaste: 2.1, bitternessAftertaste: 3.4, richness: 3.2 },
    composition: { salt: 1.5, fat: 19.2, protein: 6.8, starchDryMatter: 14.8 },
    gcmsOlfactometry: [
      { retentionTime: 18.4, compound: "Butyric acid", nistProbability: 96, peakArea: 385000, odour: "rancid", odourIntensity: 4.2, concentration: 12.4, threshold: 8.0 },
      { retentionTime: 12.7, compound: "Hexanal", nistProbability: 93, peakArea: 218000, odour: "cardboard", odourIntensity: 3.8, concentration: 6.8, threshold: 5.0 },
      { retentionTime: 6.9, compound: "Acetaldehyde", nistProbability: 89, peakArea: 94000, odour: "fermented", odourIntensity: 2.1, concentration: 2.1, threshold: 7.0 },
      { retentionTime: 25.4, compound: "Unknown", nistProbability: 42, peakArea: 12000, odour: "burnt plastic", odourIntensity: 0.0, isBlankArtefact: true },
    ],
    istdRecovery: 91.3,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Rancid: 9, Cardboard: 7, Vinegar: 12, Paint: 6, "Off-aroma": 8, Manure: 4 },
    intensity: { sourMilk: 6.8, milkiness: 2.1, cheesiness: 1.8, creamy: 2.4, grainy: 6.8, oily: 5.2, chalky: 5.9, smooth: 2.1 },
    hedonic: { appearance: 4.2, flavour: 2.1, texture: 3.4, overall: 2.8 },
    emotions: { positive: 1.8, negative: 3.7 },
    trainedPanelReference: { overallQuality: 38, recommendation: "STOP", delta: 3.2 }
  },
  {
    sampleId: "S4",
    sampleName: "Coconut Cheddar v3.0",
    taste: { sourness: 2.1, bitterness: 3.6, astringency: 2.9, umami: 3.3, saltiness: 4.1, sweetness: 1.4, astringencyAftertaste: 2.6, umamiAftertaste: 3.6, bitternessAftertaste: 3.3, richness: 5.4 },
    composition: { salt: 1.9, fat: 25.1, protein: 8.4, starchDryMatter: 11.9 },
    gcmsOlfactometry: [
      { retentionTime: 8.2, compound: "Diacetyl", nistProbability: 93, peakArea: 156000, odour: "buttery", odourIntensity: 3.1, concentration: 3.6, threshold: 10.0 },
      { retentionTime: 19.8, compound: "Benzaldehyde", nistProbability: 87, peakArea: 67000, odour: "nutty/almond", odourIntensity: 1.8, concentration: 1.4 },
    ],
    istdRecovery: 95.1,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { "Lactic acid": 11, "Milk": 11, Cheese: 13, Butter: 12, Nutty: 8 },
    intensity: { sourMilk: 2.0, milkiness: 7.2, cheesiness: 6.8, creamy: 8.4, grainy: 1.8, oily: 2.8, chalky: 1.2, smooth: 8.6 },
    hedonic: { appearance: 7.8, flavour: 7.6, texture: 7.5, overall: 7.6 },
    emotions: { positive: 4.4, negative: 0.8 },
    trainedPanelReference: { overallQuality: 86, recommendation: "GO", delta: 2.5 }
  },
  {
    sampleId: "S5",
    sampleName: "Cashew Cream Cheese v2.0",
    taste: { sourness: 3.2, bitterness: 2.7, astringency: 2.4, umami: 3.8, saltiness: 3.4, sweetness: 2.1, astringencyAftertaste: 2.2, umamiAftertaste: 4.1, bitternessAftertaste: 2.5, richness: 6.1 },
    composition: { salt: 1.7, fat: 26.3, protein: 8.9, starchDryMatter: 10.8 },
    gcmsOlfactometry: [
      { retentionTime: 19.9, compound: "Benzaldehyde", nistProbability: 88, peakArea: 89000, odour: "nutty/almond", odourIntensity: 2.6, concentration: 2.3 },
      { retentionTime: 15.8, compound: "Vanillin", nistProbability: 89, peakArea: 71000, odour: "vanilla", odourIntensity: 1.9, concentration: 1.6 },
      { retentionTime: 8.1, compound: "Diacetyl", nistProbability: 92, peakArea: 118000, odour: "buttery", odourIntensity: 2.3, concentration: 2.1, threshold: 10.0 },
    ],
    istdRecovery: 93.7,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Nutty: 10, "Milk": 8, Cheese: 9, Butter: 9, Vanilla: 8, Caramel: 5 },
    intensity: { sourMilk: 2.3, milkiness: 6.4, cheesiness: 6.1, creamy: 7.8, grainy: 1.8, oily: 2.9, chalky: 1.4, smooth: 8.1 },
    hedonic: { appearance: 7.4, flavour: 7.1, texture: 7.0, overall: 6.8 },
    emotions: { positive: 3.6, negative: 1.5 },
    trainedPanelReference: { overallQuality: 83, recommendation: "GO", delta: 3.9 }
  },
  {
    sampleId: "S6",
    sampleName: "Almond Gouda v1.0",
    taste: { sourness: 3.5, bitterness: 2.9, astringency: 2.6, umami: 3.5, saltiness: 3.6, sweetness: 2.3, astringencyAftertaste: 2.4, umamiAftertaste: 3.8, bitternessAftertaste: 2.7, richness: 5.8 },
    composition: { salt: 1.8, fat: 25.7, protein: 8.6, starchDryMatter: 11.2 },
    gcmsOlfactometry: [
      { retentionTime: 19.8, compound: "Benzaldehyde", nistProbability: 87, peakArea: 76000, odour: "nutty/almond", odourIntensity: 2.2, concentration: 2.0 },
      { retentionTime: 22.0, compound: "Limonene", nistProbability: 84, peakArea: 28000, odour: "citrus", odourIntensity: 1.1, concentration: 0.6 },
      { retentionTime: 8.2, compound: "Diacetyl", nistProbability: 91, peakArea: 134000, odour: "buttery", odourIntensity: 2.7, concentration: 2.5, threshold: 10.0 },
    ],
    istdRecovery: 94.5,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Nutty: 9, "Milk": 7, Cheese: 8, Butter: 8, "Dried fruits": 4 },
    intensity: { sourMilk: 2.5, milkiness: 6.0, cheesiness: 5.9, creamy: 7.3, grainy: 2.2, oily: 3.2, chalky: 1.7, smooth: 7.6 },
    hedonic: { appearance: 7.0, flavour: 6.7, texture: 6.6, overall: 6.4 },
    emotions: { positive: 3.5, negative: 1.4 },
    trainedPanelReference: { overallQuality: 78, recommendation: "GO", delta: 5.1 }
  },
  {
    sampleId: "S7",
    sampleName: "Mixed Base Sharp Cheddar",
    taste: { sourness: 3.8, bitterness: 3.2, astringency: 3.4, umami: 3.6, saltiness: 3.3, sweetness: 2.0, astringencyAftertaste: 3.2, umamiAftertaste: 3.9, bitternessAftertaste: 3.0, richness: 5.1 },
    composition: { salt: 1.6, fat: 23.4, protein: 7.8, starchDryMatter: 12.9 },
    gcmsOlfactometry: [
      { retentionTime: 7.1, compound: "Acetaldehyde", nistProbability: 90, peakArea: 287000, odour: "fermented", odourIntensity: 3.4, concentration: 8.1, threshold: 7.0 },
      { retentionTime: 8.2, compound: "Diacetyl", nistProbability: 92, peakArea: 98000, odour: "buttery", odourIntensity: 1.9, concentration: 1.9, threshold: 10.0 },
      { retentionTime: 14.3, compound: "Dimethyl sulfide", nistProbability: 86, peakArea: 42000, odour: "cabbage", odourIntensity: 1.6, concentration: 0.8 },
    ],
    istdRecovery: 92.1,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { "Lactic acid": 10, Yeast: 7, "Milk": 5, Cheese: 6, Vinegar: 8 },
    intensity: { sourMilk: 4.2, milkiness: 4.8, cheesiness: 5.1, creamy: 5.2, grainy: 3.8, oily: 3.9, chalky: 3.1, smooth: 5.6 },
    hedonic: { appearance: 6.5, flavour: 6.3, texture: 6.2, overall: 6.1 },
    emotions: { positive: 2.9, negative: 2.1 },
    trainedPanelReference: { overallQuality: 68, recommendation: "TWEAK", delta: 4.2 }
  },
  {
    sampleId: "S8",
    sampleName: "Cashew Cream Cheese v2.1",
    taste: { sourness: 3.1, bitterness: 2.5, astringency: 2.3, umami: 4.1, saltiness: 3.7, sweetness: 2.4, astringencyAftertaste: 2.1, umamiAftertaste: 4.4, bitternessAftertaste: 2.3, richness: 6.4 },
    composition: { salt: 1.9, fat: 27.2, protein: 9.1, starchDryMatter: 10.4 },
    gcmsOlfactometry: [
      { retentionTime: 19.9, compound: "Benzaldehyde", nistProbability: 89, peakArea: 104000, odour: "nutty/almond", odourIntensity: 2.9, concentration: 2.8 },
      { retentionTime: 15.7, compound: "Vanillin", nistProbability: 90, peakArea: 87000, odour: "vanilla", odourIntensity: 2.3, concentration: 2.0 },
      { retentionTime: 8.1, compound: "Diacetyl", nistProbability: 93, peakArea: 167000, odour: "buttery", odourIntensity: 3.4, concentration: 3.1, threshold: 10.0 },
    ],
    istdRecovery: 95.8,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Nutty: 11, "Milk": 9, Cheese: 10, Butter: 10, Vanilla: 9, Caramel: 6 },
    intensity: { sourMilk: 2.1, milkiness: 7.2, cheesiness: 6.8, creamy: 8.2, grainy: 1.6, oily: 2.7, chalky: 1.3, smooth: 8.4 },
    hedonic: { appearance: 7.7, flavour: 7.4, texture: 7.3, overall: 7.1 },
    emotions: { positive: 4.2, negative: 1.0 },
    trainedPanelReference: { overallQuality: 86, recommendation: "GO", delta: 2.8 }
  },
  {
    sampleId: "S9",
    sampleName: "Almond Feta v1.5",
    taste: { sourness: 2.9, bitterness: 3.3, astringency: 3.0, umami: 2.9, saltiness: 3.8, sweetness: 1.7, astringencyAftertaste: 2.8, umamiAftertaste: 3.2, bitternessAftertaste: 3.1, richness: 4.9 },
    composition: { salt: 1.7, fat: 23.9, protein: 8.0, starchDryMatter: 12.1 },
    gcmsOlfactometry: [
      { retentionTime: 8.3, compound: "Diacetyl", nistProbability: 91, peakArea: 121000, odour: "buttery", odourIntensity: 2.4, concentration: 2.4, threshold: 10.0 },
      { retentionTime: 12.8, compound: "Hexanal", nistProbability: 92, peakArea: 52000, odour: "cardboard", odourIntensity: 1.7, concentration: 1.2, threshold: 5.0 },
    ],
    istdRecovery: 93.2,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { "Lactic acid": 7, "Milk": 6, Cheese: 7, Butter: 9, Grains: 4 },
    intensity: { sourMilk: 2.6, milkiness: 5.8, cheesiness: 5.4, creamy: 6.4, grainy: 2.9, oily: 3.5, chalky: 2.3, smooth: 6.7 },
    hedonic: { appearance: 6.4, flavour: 6.1, texture: 6.0, overall: 5.9 },
    emotions: { positive: 3.3, negative: 1.7 },
    trainedPanelReference: { overallQuality: 73, recommendation: "GO", delta: 5.8 }
  },
  {
    sampleId: "S10",
    sampleName: "Coconut Parmesan v1.1",
    taste: { sourness: 3.4, bitterness: 3.0, astringency: 2.9, umami: 3.2, saltiness: 3.5, sweetness: 1.9, astringencyAftertaste: 2.7, umamiAftertaste: 3.5, bitternessAftertaste: 2.8, richness: 5.3 },
    composition: { salt: 1.7, fat: 24.6, protein: 8.2, starchDryMatter: 11.8 },
    gcmsOlfactometry: [
      { retentionTime: 8.2, compound: "Diacetyl", nistProbability: 92, peakArea: 138000, odour: "buttery", odourIntensity: 2.8, concentration: 2.7, threshold: 10.0 },
      { retentionTime: 19.8, compound: "Benzaldehyde", nistProbability: 86, peakArea: 61000, odour: "nutty/almond", odourIntensity: 1.7, concentration: 1.3 },
      { retentionTime: 22.1, compound: "Limonene", nistProbability: 85, peakArea: 24000, odour: "citrus", odourIntensity: 0.9, concentration: 0.5 },
    ],
    istdRecovery: 94.0,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { "Milk": 7, Cheese: 8, Butter: 7, Nutty: 5, "Lactic acid": 4 },
    intensity: { sourMilk: 2.7, milkiness: 6.1, cheesiness: 5.7, creamy: 7.0, grainy: 2.5, oily: 3.3, chalky: 2.0, smooth: 7.1 },
    hedonic: { appearance: 6.8, flavour: 6.5, texture: 6.4, overall: 6.3 },
    emotions: { positive: 3.6, negative: 1.5 },
    trainedPanelReference: { overallQuality: 76, recommendation: "GO", delta: 4.9 }
  },
  {
    sampleId: "S11",
    sampleName: "Mixed Base Gouda v1.0",
    taste: { sourness: 2.6, bitterness: 3.5, astringency: 3.2, umami: 2.7, saltiness: 4.0, sweetness: 1.6, astringencyAftertaste: 3.0, umamiAftertaste: 2.9, bitternessAftertaste: 3.3, richness: 4.7 },
    composition: { salt: 1.8, fat: 22.1, protein: 7.6, starchDryMatter: 13.2 },
    gcmsOlfactometry: [
      { retentionTime: 8.3, compound: "Diacetyl", nistProbability: 91, peakArea: 145000, odour: "buttery", odourIntensity: 2.9, concentration: 3.0, threshold: 10.0 },
      { retentionTime: 12.9, compound: "Hexanal", nistProbability: 93, peakArea: 78000, odour: "cardboard", odourIntensity: 2.2, concentration: 1.8, threshold: 5.0 },
    ],
    istdRecovery: 92.6,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { "Lactic acid": 9, Butter: 11, "Milk": 6, Cardboard: 3, Grains: 5 },
    intensity: { sourMilk: 2.4, milkiness: 5.4, cheesiness: 5.1, creamy: 5.8, grainy: 3.4, oily: 3.7, chalky: 2.7, smooth: 5.9 },
    hedonic: { appearance: 6.2, flavour: 5.9, texture: 5.8, overall: 5.7 },
    emotions: { positive: 3.1, negative: 1.8 },
    trainedPanelReference: { overallQuality: 70, recommendation: "TWEAK", delta: 5.6 }
  },
  {
    sampleId: "S12",
    sampleName: "Cashew Cheddar v2.0",
    taste: { sourness: 3.7, bitterness: 2.8, astringency: 2.5, umami: 3.4, saltiness: 3.4, sweetness: 2.2, astringencyAftertaste: 2.3, umamiAftertaste: 3.7, bitternessAftertaste: 2.6, richness: 5.9 },
    composition: { salt: 1.7, fat: 26.8, protein: 8.8, starchDryMatter: 10.9 },
    gcmsOlfactometry: [
      { retentionTime: 8.1, compound: "Diacetyl", nistProbability: 94, peakArea: 224000, odour: "buttery", odourIntensity: 4.1, concentration: 5.2, threshold: 10.0 },
      { retentionTime: 15.8, compound: "Vanillin", nistProbability: 91, peakArea: 96000, odour: "vanilla", odourIntensity: 2.6, concentration: 2.1 },
      { retentionTime: 19.9, compound: "Benzaldehyde", nistProbability: 88, peakArea: 81000, odour: "nutty/almond", odourIntensity: 2.1, concentration: 1.7 },
    ],
    istdRecovery: 96.2,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Butter: 12, Caramel: 8, "Milk": 10, Cheese: 11, Vanilla: 11, Nutty: 7 },
    intensity: { sourMilk: 2.8, milkiness: 7.6, cheesiness: 7.1, creamy: 8.5, grainy: 1.4, oily: 2.5, chalky: 1.1, smooth: 8.7 },
    hedonic: { appearance: 8.1, flavour: 7.8, texture: 7.6, overall: 7.4 },
    emotions: { positive: 4.1, negative: 1.1 },
    trainedPanelReference: { overallQuality: 91, recommendation: "GO", delta: 1.9 }
  },
  {
    sampleId: "D1",
    sampleName: "Dairy Control 1",
    taste: { sourness: 2.2, bitterness: 2.1, astringency: 2.0, umami: 4.3, saltiness: 4.5, sweetness: 2.0, astringencyAftertaste: 1.8, umamiAftertaste: 4.6, bitternessAftertaste: 1.9, richness: 6.8 },
    composition: { salt: 2.0, fat: 28.5, protein: 9.8, starchDryMatter: 9.2 },
    gcmsOlfactometry: [
      { retentionTime: 8.0, compound: "Diacetyl", nistProbability: 95, peakArea: 287000, odour: "buttery", odourIntensity: 4.8, concentration: 6.8, threshold: 10.0 },
      { retentionTime: 15.6, compound: "Vanillin", nistProbability: 90, peakArea: 54000, odour: "vanilla", odourIntensity: 1.4, concentration: 1.2 },
    ],
    istdRecovery: 97.1,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { "Lactic acid": 12, "Milk": 13, Cheese: 13, Butter: 11, Oil: 10 },
    intensity: { sourMilk: 3.2, milkiness: 8.4, cheesiness: 7.9, creamy: 9.1, grainy: 0.8, oily: 2.1, chalky: 0.6, smooth: 9.3 },
    hedonic: { appearance: 8.4, flavour: 8.1, texture: 8.0, overall: 7.8 },
    emotions: { positive: 4.5, negative: 0.7 },
    trainedPanelReference: { overallQuality: 95, recommendation: "GO", delta: 0.8 }
  },
  {
    sampleId: "D2",
    sampleName: "Dairy Control 2",
    taste: { sourness: 2.4, bitterness: 2.3, astringency: 2.1, umami: 4.2, saltiness: 4.4, sweetness: 2.1, astringencyAftertaste: 1.9, umamiAftertaste: 4.5, bitternessAftertaste: 2.0, richness: 6.6 },
    composition: { salt: 2.0, fat: 28.1, protein: 9.6, starchDryMatter: 9.5 },
    gcmsOlfactometry: [
      { retentionTime: 8.1, compound: "Diacetyl", nistProbability: 94, peakArea: 271000, odour: "buttery", odourIntensity: 4.6, concentration: 6.4, threshold: 10.0 },
      { retentionTime: 15.7, compound: "Vanillin", nistProbability: 91, peakArea: 61000, odour: "vanilla", odourIntensity: 1.6, concentration: 1.4 },
    ],
    istdRecovery: 96.8,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { "Lactic acid": 11, "Milk": 12, Cheese: 12, Butter: 10, Oil: 9 },
    intensity: { sourMilk: 3.0, milkiness: 8.1, cheesiness: 7.6, creamy: 8.9, grainy: 0.9, oily: 2.3, chalky: 0.7, smooth: 9.1 },
    hedonic: { appearance: 8.2, flavour: 7.9, texture: 7.8, overall: 7.6 },
    emotions: { positive: 4.4, negative: 0.8 },
    trainedPanelReference: { overallQuality: 93, recommendation: "GO", delta: 1.2 }
  },
  {
    sampleId: "B1",
    sampleName: "Sourdough Loaf v1.0",
    taste: { sourness: 4.2, bitterness: 2.1, astringency: 2.4, umami: 2.2, saltiness: 2.8, sweetness: 1.6, astringencyAftertaste: 2.2, umamiAftertaste: 2.0, bitternessAftertaste: 1.9, richness: 3.8 },
    composition: { salt: 1.8, fat: 3.2, protein: 9.4, starchDryMatter: 68.1 },
    gcmsOlfactometry: [
      { retentionTime: 5.1, compound: "Acetic acid", nistProbability: 94, peakArea: 342000, odour: "sour/vinegary", odourIntensity: 3.8, concentration: 9.2, threshold: 6.0 },
      { retentionTime: 7.4, compound: "Acetaldehyde", nistProbability: 91, peakArea: 198000, odour: "yeasty/fermented", odourIntensity: 3.2, concentration: 5.8, threshold: 7.0 },
      { retentionTime: 11.2, compound: "Furfural", nistProbability: 93, peakArea: 124000, odour: "caramel/toasted", odourIntensity: 2.6, concentration: 3.1 },
      { retentionTime: 8.1, compound: "Diacetyl", nistProbability: 88, peakArea: 62000, odour: "buttery", odourIntensity: 1.4, concentration: 1.2, threshold: 10.0 },
    ],
    istdRecovery: 93.8,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Yeasty: 12, "Fresh-baked": 11, Sour: 10, Crusty: 12, Chewy: 11, Tangy: 9, Wheaty: 7, Soft: 5 },
    intensity: { yeastiness: 7.8, crustiness: 8.2, softness: 5.4, chewiness: 7.6, butteriness: 2.1, maltiness: 3.8, graininess: 5.2, sweetness: 2.0 },
    hedonic: { appearance: 7.9, flavour: 7.6, texture: 7.8, overall: 7.7 },
    emotions: { positive: 4.3, negative: 0.9 },
    trainedPanelReference: { overallQuality: 88, recommendation: "GO", delta: 1.8 }
  },
  {
    sampleId: "B2",
    sampleName: "White Sandwich Bread v2.1",
    taste: { sourness: 1.4, bitterness: 1.2, astringency: 1.1, umami: 1.6, saltiness: 2.4, sweetness: 3.2, astringencyAftertaste: 1.0, umamiAftertaste: 1.4, bitternessAftertaste: 1.1, richness: 3.1 },
    composition: { salt: 1.4, fat: 5.8, protein: 8.1, starchDryMatter: 72.4 },
    gcmsOlfactometry: [
      { retentionTime: 8.0, compound: "Diacetyl", nistProbability: 90, peakArea: 88000, odour: "buttery", odourIntensity: 2.2, concentration: 2.1, threshold: 10.0 },
      { retentionTime: 11.1, compound: "Furfural", nistProbability: 92, peakArea: 76000, odour: "caramel/sweet", odourIntensity: 1.9, concentration: 1.8 },
      { retentionTime: 7.3, compound: "Acetaldehyde", nistProbability: 87, peakArea: 54000, odour: "yeasty", odourIntensity: 1.4, concentration: 1.6, threshold: 7.0 },
    ],
    istdRecovery: 94.6,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Soft: 13, "Fresh-baked": 10, Sweet: 11, Buttery: 9, Mild: 10, Airy: 9, Yeasty: 6, Springy: 8 },
    intensity: { yeastiness: 3.2, crustiness: 2.8, softness: 8.9, chewiness: 3.4, butteriness: 5.6, maltiness: 2.4, graininess: 1.6, sweetness: 6.2 },
    hedonic: { appearance: 7.2, flavour: 6.8, texture: 7.4, overall: 7.0 },
    emotions: { positive: 3.8, negative: 1.1 },
    trainedPanelReference: { overallQuality: 79, recommendation: "GO", delta: 3.2 }
  },
  {
    sampleId: "B3",
    sampleName: "Multigrain Artisan v1.0",
    taste: { sourness: 2.8, bitterness: 3.4, astringency: 3.1, umami: 2.8, saltiness: 3.1, sweetness: 2.2, astringencyAftertaste: 2.9, umamiAftertaste: 2.6, bitternessAftertaste: 3.2, richness: 4.2 },
    composition: { salt: 1.9, fat: 4.6, protein: 10.8, starchDryMatter: 62.3 },
    gcmsOlfactometry: [
      { retentionTime: 11.3, compound: "Furfural", nistProbability: 95, peakArea: 186000, odour: "caramel/toasted", odourIntensity: 3.4, concentration: 4.6 },
      { retentionTime: 19.8, compound: "Benzaldehyde", nistProbability: 86, peakArea: 72000, odour: "nutty/almond", odourIntensity: 2.1, concentration: 1.5 },
      { retentionTime: 7.4, compound: "Acetaldehyde", nistProbability: 90, peakArea: 112000, odour: "yeasty", odourIntensity: 2.4, concentration: 3.2, threshold: 7.0 },
      { retentionTime: 14.2, compound: "Hexanal", nistProbability: 88, peakArea: 58000, odour: "grassy/grain", odourIntensity: 1.8, concentration: 1.3, threshold: 5.0 },
    ],
    istdRecovery: 91.9,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Grainy: 12, Nutty: 10, Wheaty: 11, Dense: 9, Malty: 8, "Fresh-baked": 9, Chewy: 10, Crusty: 7 },
    intensity: { yeastiness: 5.2, crustiness: 6.8, softness: 3.6, chewiness: 7.2, butteriness: 2.8, maltiness: 6.4, graininess: 8.1, sweetness: 3.1 },
    hedonic: { appearance: 6.6, flavour: 6.2, texture: 6.4, overall: 6.1 },
    emotions: { positive: 3.2, negative: 1.6 },
    trainedPanelReference: { overallQuality: 74, recommendation: "TWEAK", delta: 4.8 }
  },
  {
    sampleId: "B4",
    sampleName: "Rye Sourdough v2.0",
    taste: { sourness: 5.8, bitterness: 3.2, astringency: 3.4, umami: 2.6, saltiness: 3.2, sweetness: 1.4, astringencyAftertaste: 3.6, umamiAftertaste: 2.2, bitternessAftertaste: 3.0, richness: 4.6 },
    composition: { salt: 2.0, fat: 2.1, protein: 9.8, starchDryMatter: 58.4 },
    gcmsOlfactometry: [
      { retentionTime: 5.1, compound: "Acetic acid", nistProbability: 96, peakArea: 518000, odour: "sour/vinegary", odourIntensity: 4.4, concentration: 14.2, threshold: 6.0 },
      { retentionTime: 6.2, compound: "Propionic acid", nistProbability: 91, peakArea: 228000, odour: "pungent/rye", odourIntensity: 3.6, concentration: 8.1 },
      { retentionTime: 11.2, compound: "Furfural", nistProbability: 94, peakArea: 162000, odour: "caramel/toasted", odourIntensity: 2.8, concentration: 4.1 },
      { retentionTime: 7.4, compound: "Acetaldehyde", nistProbability: 89, peakArea: 88000, odour: "yeasty/fermented", odourIntensity: 2.0, concentration: 3.4, threshold: 7.0 },
      { retentionTime: 21.4, compound: "2-Phenylethanol", nistProbability: 88, peakArea: 46000, odour: "rose/honey", odourIntensity: 1.2, concentration: 1.0 },
    ],
    istdRecovery: 92.4,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Sour: 13, Malty: 12, Dense: 11, Tangy: 12, Wheaty: 10, "Fresh-baked": 8, Chewy: 9, Bitter: 6 },
    intensity: { yeastiness: 6.8, crustiness: 7.4, softness: 2.8, chewiness: 8.4, butteriness: 1.4, maltiness: 8.2, graininess: 9.0, sweetness: 1.2 },
    hedonic: { appearance: 7.1, flavour: 6.8, texture: 6.4, overall: 6.6 },
    emotions: { positive: 3.6, negative: 1.4 },
    trainedPanelReference: { overallQuality: 80, recommendation: "GO", delta: 3.2 }
  },
  {
    sampleId: "B5",
    sampleName: "Brioche v2.0",
    taste: { sourness: 1.1, bitterness: 1.0, astringency: 0.9, umami: 2.1, saltiness: 2.0, sweetness: 5.4, astringencyAftertaste: 0.8, umamiAftertaste: 1.8, bitternessAftertaste: 0.9, richness: 6.8 },
    composition: { salt: 1.2, fat: 18.4, protein: 9.6, starchDryMatter: 54.2 },
    gcmsOlfactometry: [
      { retentionTime: 8.1, compound: "Diacetyl", nistProbability: 94, peakArea: 312000, odour: "buttery/rich", odourIntensity: 4.2, concentration: 7.2, threshold: 10.0 },
      { retentionTime: 15.7, compound: "Vanillin", nistProbability: 91, peakArea: 148000, odour: "vanilla/sweet", odourIntensity: 3.4, concentration: 3.8 },
      { retentionTime: 14.2, compound: "Ethyl butanoate", nistProbability: 87, peakArea: 96000, odour: "fruity/sweet", odourIntensity: 2.6, concentration: 2.1 },
      { retentionTime: 21.4, compound: "2-Phenylethanol", nistProbability: 92, peakArea: 84000, odour: "rose/honey", odourIntensity: 2.2, concentration: 1.8 },
      { retentionTime: 11.1, compound: "Furfural", nistProbability: 90, peakArea: 68000, odour: "caramel/toasted", odourIntensity: 1.8, concentration: 1.4 },
    ],
    istdRecovery: 95.2,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Buttery: 14, Sweet: 13, Soft: 14, Rich: 12, Tender: 11, "Fresh-baked": 10, Airy: 8, Springy: 9 },
    intensity: { yeastiness: 3.4, crustiness: 2.2, softness: 9.4, chewiness: 2.8, butteriness: 9.2, maltiness: 2.0, graininess: 0.8, sweetness: 8.6 },
    hedonic: { appearance: 8.4, flavour: 8.1, texture: 8.6, overall: 8.3 },
    emotions: { positive: 4.8, negative: 0.4 },
    trainedPanelReference: { overallQuality: 92, recommendation: "GO", delta: 1.4 }
  },
  {
    sampleId: "B6",
    sampleName: "Ciabatta v1.5",
    taste: { sourness: 1.8, bitterness: 1.4, astringency: 1.6, umami: 2.4, saltiness: 2.6, sweetness: 1.8, astringencyAftertaste: 1.4, umamiAftertaste: 2.2, bitternessAftertaste: 1.3, richness: 3.4 },
    composition: { salt: 1.6, fat: 2.8, protein: 8.4, starchDryMatter: 70.2 },
    gcmsOlfactometry: [
      { retentionTime: 11.2, compound: "Furfural", nistProbability: 93, peakArea: 104000, odour: "caramel/toasted", odourIntensity: 2.4, concentration: 2.6 },
      { retentionTime: 8.0, compound: "Diacetyl", nistProbability: 89, peakArea: 72000, odour: "buttery/mild", odourIntensity: 1.6, concentration: 1.4, threshold: 10.0 },
      { retentionTime: 7.4, compound: "Acetaldehyde", nistProbability: 91, peakArea: 64000, odour: "yeasty", odourIntensity: 1.4, concentration: 1.8, threshold: 7.0 },
      { retentionTime: 17.1, compound: "1-Octen-3-ol", nistProbability: 85, peakArea: 38000, odour: "mushroom/earthy", odourIntensity: 1.0, concentration: 0.8 },
    ],
    istdRecovery: 93.1,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Airy: 13, Crusty: 12, "Fresh-baked": 11, Mild: 11, Chewy: 9, Soft: 8, Yeasty: 7, Light: 10 },
    intensity: { yeastiness: 4.2, crustiness: 7.8, softness: 6.4, chewiness: 6.2, butteriness: 2.4, maltiness: 2.8, graininess: 2.6, sweetness: 2.2 },
    hedonic: { appearance: 7.8, flavour: 7.0, texture: 7.6, overall: 7.2 },
    emotions: { positive: 4.1, negative: 0.9 },
    trainedPanelReference: { overallQuality: 84, recommendation: "GO", delta: 2.6 }
  },
  {
    sampleId: "B7",
    sampleName: "Whole Wheat Sandwich v1.0",
    taste: { sourness: 2.2, bitterness: 2.8, astringency: 2.6, umami: 2.8, saltiness: 2.6, sweetness: 2.4, astringencyAftertaste: 2.4, umamiAftertaste: 2.6, bitternessAftertaste: 2.8, richness: 3.8 },
    composition: { salt: 1.6, fat: 4.2, protein: 11.4, starchDryMatter: 60.8 },
    gcmsOlfactometry: [
      { retentionTime: 11.3, compound: "Furfural", nistProbability: 92, peakArea: 138000, odour: "caramel/wholegrain", odourIntensity: 2.8, concentration: 3.4 },
      { retentionTime: 19.8, compound: "Benzaldehyde", nistProbability: 86, peakArea: 88000, odour: "nutty/almond", odourIntensity: 2.2, concentration: 1.8 },
      { retentionTime: 14.2, compound: "Hexanal", nistProbability: 90, peakArea: 74000, odour: "grassy/grain", odourIntensity: 1.8, concentration: 1.6, threshold: 5.0 },
      { retentionTime: 7.4, compound: "Acetaldehyde", nistProbability: 88, peakArea: 52000, odour: "yeasty", odourIntensity: 1.4, concentration: 1.4, threshold: 7.0 },
    ],
    istdRecovery: 91.8,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Wheaty: 12, Nutty: 9, Dense: 10, Fibrous: 8, Grainy: 11, "Fresh-baked": 7, Earthy: 6, Chewy: 8 },
    intensity: { yeastiness: 3.8, crustiness: 4.2, softness: 5.8, chewiness: 6.8, butteriness: 2.6, maltiness: 5.4, graininess: 7.8, sweetness: 3.4 },
    hedonic: { appearance: 6.4, flavour: 5.8, texture: 6.0, overall: 5.8 },
    emotions: { positive: 3.1, negative: 1.8 },
    trainedPanelReference: { overallQuality: 71, recommendation: "TWEAK", delta: 5.2 }
  },
  {
    sampleId: "B8",
    sampleName: "Seeded Rye v2.0",
    taste: { sourness: 4.8, bitterness: 3.6, astringency: 3.8, umami: 3.2, saltiness: 3.4, sweetness: 1.6, astringencyAftertaste: 3.6, umamiAftertaste: 2.8, bitternessAftertaste: 3.4, richness: 5.2 },
    composition: { salt: 1.9, fat: 5.6, protein: 11.2, starchDryMatter: 56.4 },
    gcmsOlfactometry: [
      { retentionTime: 22.0, compound: "Limonene", nistProbability: 90, peakArea: 188000, odour: "caraway/citrus", odourIntensity: 3.8, concentration: 6.2 },
      { retentionTime: 5.1, compound: "Acetic acid", nistProbability: 95, peakArea: 424000, odour: "sour/vinegary", odourIntensity: 4.2, concentration: 11.4, threshold: 6.0 },
      { retentionTime: 19.8, compound: "Benzaldehyde", nistProbability: 87, peakArea: 112000, odour: "nutty/seed", odourIntensity: 2.6, concentration: 2.4 },
      { retentionTime: 11.3, compound: "Furfural", nistProbability: 93, peakArea: 168000, odour: "toasted/malty", odourIntensity: 3.2, concentration: 4.2 },
      { retentionTime: 14.2, compound: "Hexanal", nistProbability: 88, peakArea: 64000, odour: "grassy/grain", odourIntensity: 1.6, concentration: 1.2, threshold: 5.0 },
    ],
    istdRecovery: 90.6,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Seedy: 13, Grainy: 12, Sour: 11, Malty: 10, Dense: 11, Nutty: 9, Tangy: 10, Earthy: 7 },
    intensity: { yeastiness: 5.6, crustiness: 6.4, softness: 2.4, chewiness: 8.8, butteriness: 1.8, maltiness: 7.6, graininess: 9.2, sweetness: 1.4 },
    hedonic: { appearance: 6.8, flavour: 6.2, texture: 6.0, overall: 6.0 },
    emotions: { positive: 3.2, negative: 1.6 },
    trainedPanelReference: { overallQuality: 72, recommendation: "TWEAK", delta: 4.4 }
  },
  {
    sampleId: "B9",
    sampleName: "Baguette v1.0",
    taste: { sourness: 1.6, bitterness: 1.2, astringency: 1.4, umami: 1.8, saltiness: 2.8, sweetness: 1.6, astringencyAftertaste: 1.2, umamiAftertaste: 1.6, bitternessAftertaste: 1.1, richness: 3.2 },
    composition: { salt: 1.8, fat: 1.4, protein: 8.8, starchDryMatter: 74.6 },
    gcmsOlfactometry: [
      { retentionTime: 9.8, compound: "2-Acetyl-1-pyrroline", nistProbability: 92, peakArea: 284000, odour: "popcorn/crust", odourIntensity: 4.6, concentration: 6.8 },
      { retentionTime: 11.2, compound: "Furfural", nistProbability: 95, peakArea: 246000, odour: "caramel/toasted", odourIntensity: 4.0, concentration: 6.2 },
      { retentionTime: 8.0, compound: "Diacetyl", nistProbability: 91, peakArea: 62000, odour: "buttery/mild", odourIntensity: 1.4, concentration: 1.1, threshold: 10.0 },
      { retentionTime: 7.4, compound: "Acetaldehyde", nistProbability: 90, peakArea: 48000, odour: "yeasty/fresh", odourIntensity: 1.2, concentration: 1.0, threshold: 7.0 },
    ],
    istdRecovery: 94.8,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Crusty: 14, Airy: 13, "Fresh-baked": 12, Light: 11, Mild: 10, Yeasty: 8, Springy: 9, Soft: 7 },
    intensity: { yeastiness: 4.6, crustiness: 9.4, softness: 7.2, chewiness: 4.4, butteriness: 1.6, maltiness: 2.6, graininess: 1.8, sweetness: 1.8 },
    hedonic: { appearance: 8.6, flavour: 7.6, texture: 8.4, overall: 8.0 },
    emotions: { positive: 4.6, negative: 0.6 },
    trainedPanelReference: { overallQuality: 91, recommendation: "GO", delta: 1.8 }
  },
  {
    sampleId: "B10",
    sampleName: "Focaccia v1.2",
    taste: { sourness: 1.4, bitterness: 1.6, astringency: 1.8, umami: 3.8, saltiness: 4.2, sweetness: 1.8, astringencyAftertaste: 1.6, umamiAftertaste: 3.6, bitternessAftertaste: 1.4, richness: 5.6 },
    composition: { salt: 2.2, fat: 12.8, protein: 8.6, starchDryMatter: 62.4 },
    gcmsOlfactometry: [
      { retentionTime: 23.6, compound: "Linalool", nistProbability: 93, peakArea: 168000, odour: "floral/herby", odourIntensity: 3.4, concentration: 4.8 },
      { retentionTime: 14.2, compound: "Hexanal", nistProbability: 90, peakArea: 124000, odour: "olive/green", odourIntensity: 2.8, concentration: 2.8, threshold: 5.0 },
      { retentionTime: 11.2, compound: "Furfural", nistProbability: 92, peakArea: 96000, odour: "caramel/toasted", odourIntensity: 2.2, concentration: 2.4 },
      { retentionTime: 8.1, compound: "Diacetyl", nistProbability: 88, peakArea: 78000, odour: "buttery", odourIntensity: 1.8, concentration: 1.6, threshold: 10.0 },
      { retentionTime: 17.1, compound: "1-Octen-3-ol", nistProbability: 86, peakArea: 54000, odour: "mushroom/earthy", odourIntensity: 1.4, concentration: 1.0 },
    ],
    istdRecovery: 93.4,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Herby: 12, Salty: 13, Oily: 11, "Fresh-baked": 10, Soft: 12, Savory: 11, Aromatic: 9, Chewy: 7 },
    intensity: { yeastiness: 3.2, crustiness: 5.4, softness: 7.8, chewiness: 5.6, butteriness: 7.2, maltiness: 2.4, graininess: 2.2, sweetness: 2.6 },
    hedonic: { appearance: 8.0, flavour: 7.8, texture: 7.6, overall: 7.7 },
    emotions: { positive: 4.4, negative: 0.7 },
    trainedPanelReference: { overallQuality: 89, recommendation: "GO", delta: 2.1 }
  },
  {
    sampleId: "B11",
    sampleName: "Sourdough Boule v2.0",
    taste: { sourness: 3.6, bitterness: 1.8, astringency: 2.0, umami: 2.4, saltiness: 3.0, sweetness: 2.2, astringencyAftertaste: 1.8, umamiAftertaste: 2.2, bitternessAftertaste: 1.6, richness: 4.4 },
    composition: { salt: 1.9, fat: 3.6, protein: 9.8, starchDryMatter: 66.4 },
    gcmsOlfactometry: [
      { retentionTime: 5.1, compound: "Acetic acid", nistProbability: 95, peakArea: 286000, odour: "sour/balanced", odourIntensity: 3.2, concentration: 7.6, threshold: 6.0 },
      { retentionTime: 9.8, compound: "2-Acetyl-1-pyrroline", nistProbability: 91, peakArea: 194000, odour: "popcorn/crust", odourIntensity: 3.8, concentration: 4.4 },
      { retentionTime: 11.2, compound: "Furfural", nistProbability: 94, peakArea: 152000, odour: "caramel/toasted", odourIntensity: 3.0, concentration: 3.8 },
      { retentionTime: 8.1, compound: "Diacetyl", nistProbability: 92, peakArea: 96000, odour: "buttery", odourIntensity: 2.2, concentration: 1.8, threshold: 10.0 },
      { retentionTime: 21.4, compound: "2-Phenylethanol", nistProbability: 88, peakArea: 62000, odour: "rose/honey", odourIntensity: 1.6, concentration: 1.2 },
    ],
    istdRecovery: 94.0,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Yeasty: 13, Crusty: 13, "Fresh-baked": 12, Tangy: 10, Chewy: 12, Balanced: 11, Airy: 8, Sour: 7 },
    intensity: { yeastiness: 8.2, crustiness: 8.8, softness: 6.2, chewiness: 7.4, butteriness: 3.2, maltiness: 4.4, graininess: 4.2, sweetness: 2.8 },
    hedonic: { appearance: 8.4, flavour: 8.2, texture: 8.0, overall: 8.3 },
    emotions: { positive: 4.7, negative: 0.5 },
    trainedPanelReference: { overallQuality: 94, recommendation: "GO", delta: 1.2 }
  },
  {
    sampleId: "B12",
    sampleName: "Enriched White v3.1",
    taste: { sourness: 0.9, bitterness: 0.8, astringency: 0.7, umami: 1.8, saltiness: 2.2, sweetness: 4.8, astringencyAftertaste: 0.6, umamiAftertaste: 1.6, bitternessAftertaste: 0.8, richness: 5.4 },
    composition: { salt: 1.4, fat: 8.2, protein: 8.2, starchDryMatter: 70.8 },
    gcmsOlfactometry: [
      { retentionTime: 8.1, compound: "Diacetyl", nistProbability: 93, peakArea: 268000, odour: "buttery/rich", odourIntensity: 4.0, concentration: 5.8, threshold: 10.0 },
      { retentionTime: 15.7, compound: "Vanillin", nistProbability: 90, peakArea: 122000, odour: "vanilla/sweet", odourIntensity: 3.0, concentration: 2.8 },
      { retentionTime: 11.1, compound: "Furfural", nistProbability: 92, peakArea: 82000, odour: "caramel/mild", odourIntensity: 1.8, concentration: 1.8 },
      { retentionTime: 7.4, compound: "Acetaldehyde", nistProbability: 88, peakArea: 44000, odour: "yeasty/mild", odourIntensity: 1.0, concentration: 1.0, threshold: 7.0 },
    ],
    istdRecovery: 95.6,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Soft: 14, Sweet: 13, Buttery: 12, Mild: 12, Fluffy: 11, Tender: 11, "Fresh-baked": 10, Springy: 9 },
    intensity: { yeastiness: 2.8, crustiness: 1.8, softness: 9.8, chewiness: 2.2, butteriness: 8.4, maltiness: 2.2, graininess: 0.6, sweetness: 9.0 },
    hedonic: { appearance: 7.8, flavour: 7.4, texture: 8.6, overall: 7.6 },
    emotions: { positive: 4.2, negative: 0.8 },
    trainedPanelReference: { overallQuality: 87, recommendation: "GO", delta: 2.4 }
  },
  {
    sampleId: "M1",
    sampleName: "Pea Protein Burger v1.0",
    taste: { sourness: 1.2, bitterness: 3.8, astringency: 2.6, umami: 4.9, saltiness: 4.5, sweetness: 1.1, astringencyAftertaste: 2.8, umamiAftertaste: 4.4, bitternessAftertaste: 3.6, richness: 4.6 },
    composition: { salt: 2.1, fat: 14.2, protein: 22.4, starchDryMatter: 5.1 },
    gcmsOlfactometry: [
      { retentionTime: 12.1, compound: "Hexanal", nistProbability: 91, peakArea: 164000, odour: "grassy", odourIntensity: 3.6, concentration: 0.82, threshold: 0.005 },
    ],
    istdRecovery: 93.1,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Savory: 10, Beany: 9, Juicy: 8, Salty: 9, Umami: 8, Firm: 7, Charred: 5 },
    intensity: { Savory: 6.4, Smoky: 3.8, Salty: 6.8, Umami: 6.2, Spiced: 3.0, Juicy: 5.6, Charred: 3.2, Fatty: 4.8 },
    hedonic: { appearance: 6.4, flavour: 5.6, texture: 6.0, overall: 5.8 },
    emotions: { positive: 3.2, negative: 1.8 },
    trainedPanelReference: { overallQuality: 64, recommendation: "TWEAK", delta: 4.1 }
  },
  {
    sampleId: "M2",
    sampleName: "Pea Protein Burger v1.1",
    taste: { sourness: 1.4, bitterness: 3.5, astringency: 2.4, umami: 4.7, saltiness: 4.3, sweetness: 1.3, astringencyAftertaste: 2.6, umamiAftertaste: 4.2, bitternessAftertaste: 3.3, richness: 4.7 },
    composition: { salt: 2.0, fat: 13.9, protein: 21.8, starchDryMatter: 5.2 },
    gcmsOlfactometry: [
      { retentionTime: 12.0, compound: "Hexanal", nistProbability: 90, peakArea: 158000, odour: "grassy", odourIntensity: 3.4, concentration: 0.91, threshold: 0.005 },
    ],
    istdRecovery: 92.6,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Savory: 11, Juicy: 9, Salty: 9, Umami: 9, Firm: 7, Beany: 7, Tender: 6 },
    intensity: { Savory: 6.8, Smoky: 4.0, Salty: 6.6, Umami: 6.6, Spiced: 3.2, Juicy: 6.0, Charred: 3.4, Fatty: 5.0 },
    hedonic: { appearance: 6.6, flavour: 6.2, texture: 6.4, overall: 6.2 },
    emotions: { positive: 3.6, negative: 1.4 },
    trainedPanelReference: { overallQuality: 69, recommendation: "TWEAK", delta: 3.4 }
  },
  {
    sampleId: "M3",
    sampleName: "Soy Mince v1.0",
    taste: { sourness: 1.1, bitterness: 4.1, astringency: 2.9, umami: 5.0, saltiness: 4.6, sweetness: 0.9, astringencyAftertaste: 3.2, umamiAftertaste: 4.6, bitternessAftertaste: 4.0, richness: 4.2 },
    composition: { salt: 2.3, fat: 11.3, protein: 24.1, starchDryMatter: 6.0 },
    gcmsOlfactometry: [
      { retentionTime: 5.8, compound: "Dimethyl sulfide", nistProbability: 89, peakArea: 96000, odour: "sulfurous", odourIntensity: 3.8, concentration: 0.14, threshold: 0.002 },
    ],
    istdRecovery: 90.4,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Sulfurous: 10, Savory: 8, Umami: 9, Salty: 8, Dry: 7, Fibrous: 8, Bland: 5 },
    intensity: { Savory: 5.8, Smoky: 2.6, Salty: 6.4, Umami: 6.8, Spiced: 2.4, Juicy: 3.6, Charred: 2.0, Fatty: 3.2 },
    hedonic: { appearance: 5.6, flavour: 4.6, texture: 5.0, overall: 4.8 },
    emotions: { positive: 2.4, negative: 2.8 },
    trainedPanelReference: { overallQuality: 51, recommendation: "TWEAK", delta: 4.6 }
  },
  {
    sampleId: "M4",
    sampleName: "Soy Mince v1.1",
    taste: { sourness: 1.3, bitterness: 4.3, astringency: 3.1, umami: 4.8, saltiness: 4.8, sweetness: 0.8, astringencyAftertaste: 3.4, umamiAftertaste: 4.4, bitternessAftertaste: 4.2, richness: 4.0 },
    composition: { salt: 2.2, fat: 10.9, protein: 23.7, starchDryMatter: 7.8 },
    gcmsOlfactometry: [
      { retentionTime: 5.9, compound: "Dimethyl sulfide", nistProbability: 90, peakArea: 102000, odour: "sulfurous", odourIntensity: 4.0, concentration: 0.19, threshold: 0.002 },
    ],
    istdRecovery: 89.8,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Sulfurous: 11, Bland: 7, Dry: 8, Fibrous: 9, Savory: 6, Salty: 7, Umami: 7 },
    intensity: { Savory: 5.2, Smoky: 2.4, Salty: 6.6, Umami: 6.2, Spiced: 2.0, Juicy: 3.0, Charred: 1.8, Fatty: 2.8 },
    hedonic: { appearance: 5.2, flavour: 4.0, texture: 4.6, overall: 4.3 },
    emotions: { positive: 2.0, negative: 3.2 },
    trainedPanelReference: { overallQuality: 45, recommendation: "STOP", delta: 5.0 }
  },
  {
    sampleId: "M5",
    sampleName: "Mycoprotein Cutlet v1.0",
    taste: { sourness: 1.6, bitterness: 2.9, astringency: 2.2, umami: 4.4, saltiness: 3.8, sweetness: 1.5, astringencyAftertaste: 2.4, umamiAftertaste: 4.0, bitternessAftertaste: 2.8, richness: 3.8 },
    composition: { salt: 1.8, fat: 8.7, protein: 19.6, starchDryMatter: 14.5 },
    gcmsOlfactometry: [
      { retentionTime: 9.4, compound: "2-Pentylfuran", nistProbability: 87, peakArea: 71000, odour: "earthy", odourIntensity: 2.6, concentration: 0.31, threshold: 0.008 },
    ],
    istdRecovery: 92.0,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Tender: 10, Savory: 9, Umami: 8, Fibrous: 6, Herby: 5, Gamey: 4, Salty: 7 },
    intensity: { Savory: 6.0, Smoky: 2.8, Salty: 5.6, Umami: 6.0, Spiced: 2.8, Juicy: 5.2, Charred: 2.4, Fatty: 3.4 },
    hedonic: { appearance: 6.6, flavour: 6.4, texture: 6.8, overall: 6.5 },
    emotions: { positive: 3.8, negative: 1.2 },
    trainedPanelReference: { overallQuality: 71, recommendation: "GO", delta: 2.8 }
  },
  {
    sampleId: "M6",
    sampleName: "Mycoprotein Cutlet v1.1",
    taste: { sourness: 1.8, bitterness: 2.7, astringency: 2.0, umami: 4.2, saltiness: 3.6, sweetness: 1.7, astringencyAftertaste: 2.2, umamiAftertaste: 3.8, bitternessAftertaste: 2.6, richness: 3.6 },
    composition: { salt: 1.7, fat: 9.2, protein: 20.1, starchDryMatter: 14.0 },
    gcmsOlfactometry: [
      { retentionTime: 9.5, compound: "2-Pentylfuran", nistProbability: 86, peakArea: 65000, odour: "earthy", odourIntensity: 2.4, concentration: 0.28, threshold: 0.008 },
    ],
    istdRecovery: 91.6,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Tender: 11, Savory: 9, Herby: 6, Umami: 7, Juicy: 6, Salty: 6, Mild: 5 },
    intensity: { Savory: 5.8, Smoky: 2.6, Salty: 5.4, Umami: 5.8, Spiced: 2.6, Juicy: 5.4, Charred: 2.2, Fatty: 3.6 },
    hedonic: { appearance: 6.8, flavour: 6.6, texture: 7.0, overall: 6.7 },
    emotions: { positive: 4.0, negative: 1.0 },
    trainedPanelReference: { overallQuality: 73, recommendation: "GO", delta: 2.2 }
  },
  {
    sampleId: "M7",
    sampleName: "Lentil Patty v1.0",
    taste: { sourness: 2.1, bitterness: 2.4, astringency: 2.0, umami: 3.8, saltiness: 3.2, sweetness: 2.3, astringencyAftertaste: 2.0, umamiAftertaste: 3.4, bitternessAftertaste: 2.2, richness: 3.0 },
    composition: { salt: 1.5, fat: 6.4, protein: 17.3, starchDryMatter: 21.4 },
    gcmsOlfactometry: [
      { retentionTime: 16.2, compound: "Nonanal", nistProbability: 85, peakArea: 48000, odour: "fatty/waxy", odourIntensity: 2.0, concentration: 0.44, threshold: 0.001 },
    ],
    istdRecovery: 90.9,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Herby: 9, Savory: 7, Dry: 8, Fibrous: 7, Mild: 8, Spiced: 6, Bland: 5 },
    intensity: { Savory: 5.0, Smoky: 2.2, Salty: 4.6, Umami: 4.8, Spiced: 4.2, Juicy: 3.4, Charred: 1.8, Fatty: 2.4 },
    hedonic: { appearance: 6.0, flavour: 5.6, texture: 5.4, overall: 5.7 },
    emotions: { positive: 3.0, negative: 1.6 },
    trainedPanelReference: { overallQuality: 60, recommendation: "TWEAK", delta: 3.6 }
  },
  {
    sampleId: "M8",
    sampleName: "Lentil Patty v1.1",
    taste: { sourness: 1.9, bitterness: 2.6, astringency: 2.1, umami: 3.9, saltiness: 3.4, sweetness: 2.1, astringencyAftertaste: 2.1, umamiAftertaste: 3.5, bitternessAftertaste: 2.4, richness: 3.2 },
    composition: { salt: 1.6, fat: 6.8, protein: 18.0, starchDryMatter: 20.4 },
    gcmsOlfactometry: [
      { retentionTime: 16.3, compound: "Nonanal", nistProbability: 86, peakArea: 51000, odour: "fatty/waxy", odourIntensity: 2.1, concentration: 0.38, threshold: 0.001 },
    ],
    istdRecovery: 91.2,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Herby: 10, Savory: 8, Spiced: 7, Tender: 7, Mild: 7, Fibrous: 6, Salty: 6 },
    intensity: { Savory: 5.4, Smoky: 2.4, Salty: 4.8, Umami: 5.0, Spiced: 4.6, Juicy: 3.8, Charred: 2.0, Fatty: 2.6 },
    hedonic: { appearance: 6.2, flavour: 6.0, texture: 5.8, overall: 6.0 },
    emotions: { positive: 3.4, negative: 1.2 },
    trainedPanelReference: { overallQuality: 65, recommendation: "TWEAK", delta: 3.0 }
  },
  {
    sampleId: "M9",
    sampleName: "Jackfruit Pulled \"Pork\" v1.0",
    taste: { sourness: 2.8, bitterness: 1.8, astringency: 1.6, umami: 2.6, saltiness: 2.9, sweetness: 3.4, astringencyAftertaste: 1.4, umamiAftertaste: 2.2, bitternessAftertaste: 1.6, richness: 2.4 },
    composition: { salt: 1.2, fat: 2.1, protein: 8.2, starchDryMatter: 17.3 },
    gcmsOlfactometry: [
      { retentionTime: 21.8, compound: "Limonene", nistProbability: 88, peakArea: 112000, odour: "citrus", odourIntensity: 1.8, concentration: 1.24, threshold: 0.010 },
    ],
    istdRecovery: 93.4,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Fibrous: 11, Sweet: 8, Chewy: 7, Bland: 8, Juicy: 6, Tender: 6, Sour: 4 },
    intensity: { Savory: 3.2, Smoky: 1.8, Salty: 3.6, Umami: 3.0, Spiced: 2.4, Juicy: 5.8, Charred: 1.4, Fatty: 1.4 },
    hedonic: { appearance: 5.8, flavour: 5.0, texture: 4.8, overall: 5.2 },
    emotions: { positive: 2.8, negative: 2.0 },
    trainedPanelReference: { overallQuality: 56, recommendation: "TWEAK", delta: 4.4 }
  },
  {
    sampleId: "M10",
    sampleName: "Jackfruit Pulled \"Pork\" v1.1",
    taste: { sourness: 3.1, bitterness: 1.6, astringency: 1.4, umami: 2.4, saltiness: 2.7, sweetness: 3.7, astringencyAftertaste: 1.2, umamiAftertaste: 2.0, bitternessAftertaste: 1.4, richness: 2.2 },
    composition: { salt: 1.1, fat: 1.8, protein: 7.9, starchDryMatter: 16.3 },
    gcmsOlfactometry: [
      { retentionTime: 21.9, compound: "Limonene", nistProbability: 87, peakArea: 108000, odour: "citrus", odourIntensity: 1.7, concentration: 1.18, threshold: 0.010 },
    ],
    istdRecovery: 93.0,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Fibrous: 12, Sweet: 9, Chewy: 8, Bland: 7, Sour: 5, Juicy: 5, Mild: 6 },
    intensity: { Savory: 2.8, Smoky: 1.6, Salty: 3.4, Umami: 2.8, Spiced: 2.2, Juicy: 5.6, Charred: 1.2, Fatty: 1.2 },
    hedonic: { appearance: 5.6, flavour: 4.8, texture: 4.6, overall: 5.0 },
    emotions: { positive: 2.6, negative: 2.2 },
    trainedPanelReference: { overallQuality: 53, recommendation: "TWEAK", delta: 4.8 }
  },
  {
    sampleId: "M11",
    sampleName: "Pea Protein Burger v1.2",
    taste: { sourness: 1.3, bitterness: 3.6, astringency: 2.5, umami: 4.8, saltiness: 4.4, sweetness: 1.2, astringencyAftertaste: 2.7, umamiAftertaste: 4.3, bitternessAftertaste: 3.4, richness: 4.8 },
    composition: { salt: 2.0, fat: 14.0, protein: 22.1, starchDryMatter: 5.2 },
    gcmsOlfactometry: [
      { retentionTime: 12.1, compound: "Hexanal", nistProbability: 91, peakArea: 161000, odour: "grassy", odourIntensity: 3.5, concentration: 0.86, threshold: 0.005 },
    ],
    istdRecovery: 93.6,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Savory: 12, Juicy: 10, Umami: 9, Salty: 9, Charred: 7, Tender: 7, Beany: 5 },
    intensity: { Savory: 7.2, Smoky: 4.6, Salty: 6.8, Umami: 6.8, Spiced: 3.6, Juicy: 6.4, Charred: 4.2, Fatty: 5.4 },
    hedonic: { appearance: 7.0, flavour: 6.8, texture: 6.9, overall: 6.9 },
    emotions: { positive: 4.2, negative: 1.0 },
    trainedPanelReference: { overallQuality: 76, recommendation: "GO", delta: 1.8 }
  },
  {
    sampleId: "M12",
    sampleName: "Soy Mince v1.2",
    taste: { sourness: 1.2, bitterness: 4.2, astringency: 2.8, umami: 4.9, saltiness: 4.7, sweetness: 0.9, astringencyAftertaste: 3.0, umamiAftertaste: 4.5, bitternessAftertaste: 3.8, richness: 4.4 },
    composition: { salt: 2.2, fat: 11.1, protein: 23.9, starchDryMatter: 6.0 },
    gcmsOlfactometry: [
      { retentionTime: 5.8, compound: "Dimethyl sulfide", nistProbability: 88, peakArea: 90000, odour: "sulfurous", odourIntensity: 3.4, concentration: 0.16, threshold: 0.002 },
    ],
    istdRecovery: 91.0,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Savory: 9, Umami: 9, Salty: 8, Sulfurous: 7, Firm: 7, Dry: 6, Fibrous: 6 },
    intensity: { Savory: 6.0, Smoky: 2.8, Salty: 6.6, Umami: 6.6, Spiced: 2.6, Juicy: 4.0, Charred: 2.4, Fatty: 3.6 },
    hedonic: { appearance: 5.8, flavour: 5.2, texture: 5.4, overall: 5.4 },
    emotions: { positive: 2.8, negative: 2.0 },
    trainedPanelReference: { overallQuality: 58, recommendation: "TWEAK", delta: 3.8 }
  },
  {
    sampleId: "YG-001",
    sampleName: "Greek Style Control",
    taste: { sourness: 4.2, bitterness: 1.1, astringency: 1.4, umami: 1.4, saltiness: 0.8, sweetness: 2.6, astringencyAftertaste: 1.2, umamiAftertaste: 1.2, bitternessAftertaste: 1.0, richness: 5.6 },
    composition: { salt: 0.18, fat: 4.1, protein: 10.2, starchDryMatter: 7.3 },
    gcmsOlfactometry: [
      { retentionTime: 8.1, compound: "Diacetyl", nistProbability: 93, peakArea: 188000, odour: "buttery creamy", odourIntensity: 2.6, concentration: 6.5, threshold: 2 },
    ],
    istdRecovery: 94.6,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Creamy: 12, Tangy: 11, Thick: 10, Fresh: 9, Milky: 8, Smooth: 9, Sour: 6 },
    intensity: { Creamy: 7.6, Tangy: 6.8, Sour: 5.4, Sweet: 2.8, Milky: 6.0, Thick: 7.4, Smooth: 7.0, Fresh: 6.6 },
    hedonic: { appearance: 7.6, flavour: 7.4, texture: 7.8, overall: 7.5 },
    emotions: { positive: 4.4, negative: 0.8 },
    trainedPanelReference: { overallQuality: 82, recommendation: "GO", delta: 1.6 }
  },
  {
    sampleId: "YG-002",
    sampleName: "High Protein Vanilla",
    taste: { sourness: 3.6, bitterness: 0.9, astringency: 1.1, umami: 1.2, saltiness: 0.7, sweetness: 4.1, astringencyAftertaste: 1.0, umamiAftertaste: 1.0, bitternessAftertaste: 0.8, richness: 5.2 },
    composition: { salt: 0.16, fat: 2.2, protein: 14.8, starchDryMatter: 6.9 },
    gcmsOlfactometry: [
      { retentionTime: 15.6, compound: "Vanillin", nistProbability: 94, peakArea: 246000, odour: "vanilla sweet", odourIntensity: 3.4, concentration: 42, threshold: 8 },
    ],
    istdRecovery: 95.0,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Sweet: 12, Creamy: 10, Smooth: 10, Fresh: 8, Tangy: 7, Fruity: 5, Thick: 6 },
    intensity: { Creamy: 6.8, Tangy: 4.6, Sour: 3.6, Sweet: 7.0, Milky: 5.4, Thick: 6.0, Smooth: 7.2, Fresh: 6.4 },
    hedonic: { appearance: 7.4, flavour: 7.6, texture: 7.2, overall: 7.5 },
    emotions: { positive: 4.6, negative: 0.6 },
    trainedPanelReference: { overallQuality: 83, recommendation: "GO", delta: 1.4 }
  },
  {
    sampleId: "YG-003",
    sampleName: "Plant Oat Yogurt",
    taste: { sourness: 3.1, bitterness: 1.8, astringency: 2.2, umami: 1.0, saltiness: 0.6, sweetness: 3.4, astringencyAftertaste: 2.0, umamiAftertaste: 1.0, bitternessAftertaste: 1.8, richness: 3.0 },
    composition: { salt: 0.12, fat: 3.8, protein: 4.6, starchDryMatter: 8.4 },
    gcmsOlfactometry: [
      { retentionTime: 9.6, compound: "2-Pentylfuran", nistProbability: 86, peakArea: 58000, odour: "cereal beany", odourIntensity: 2.8, concentration: 7.4, threshold: 3 },
    ],
    istdRecovery: 90.8,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Watery: 9, Chalky: 8, Fermented: 7, Fresh: 6, Sweet: 6, Bitter: 5, Artificial: 5 },
    intensity: { Creamy: 3.8, Tangy: 4.4, Sour: 4.0, Sweet: 4.6, Milky: 2.0, Thick: 3.6, Smooth: 4.2, Fresh: 5.0 },
    hedonic: { appearance: 5.4, flavour: 4.8, texture: 4.6, overall: 4.9 },
    emotions: { positive: 2.4, negative: 2.6 },
    trainedPanelReference: { overallQuality: 53, recommendation: "TWEAK", delta: 4.2 }
  },
  {
    sampleId: "YG-004",
    sampleName: "Strawberry Fruit Yogurt",
    taste: { sourness: 3.8, bitterness: 0.8, astringency: 1.0, umami: 0.9, saltiness: 0.5, sweetness: 4.7, astringencyAftertaste: 0.9, umamiAftertaste: 0.8, bitternessAftertaste: 0.7, richness: 4.6 },
    composition: { salt: 0.14, fat: 2.9, protein: 6.8, starchDryMatter: 9.3 },
    gcmsOlfactometry: [
      { retentionTime: 13.2, compound: "Ethyl butyrate", nistProbability: 92, peakArea: 204000, odour: "fruity strawberry", odourIntensity: 3.2, concentration: 34, threshold: 6 },
    ],
    istdRecovery: 94.1,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Fruity: 13, Sweet: 12, Creamy: 9, Fresh: 9, Smooth: 8, Tangy: 6, Thick: 6 },
    intensity: { Creamy: 6.4, Tangy: 4.8, Sour: 3.8, Sweet: 7.4, Milky: 4.6, Thick: 5.6, Smooth: 6.8, Fresh: 6.8 },
    hedonic: { appearance: 7.8, flavour: 7.8, texture: 7.2, overall: 7.7 },
    emotions: { positive: 4.8, negative: 0.6 },
    trainedPanelReference: { overallQuality: 85, recommendation: "GO", delta: 1.2 }
  },
  {
    sampleId: "YG-005",
    sampleName: "Low Sugar Skyr",
    taste: { sourness: 4.6, bitterness: 1.2, astringency: 1.8, umami: 1.5, saltiness: 0.9, sweetness: 1.8, astringencyAftertaste: 1.6, umamiAftertaste: 1.4, bitternessAftertaste: 1.2, richness: 5.8 },
    composition: { salt: 0.20, fat: 0.4, protein: 16.2, starchDryMatter: 5.9 },
    gcmsOlfactometry: [
      { retentionTime: 6.4, compound: "Acetic acid", nistProbability: 89, peakArea: 132000, odour: "sharp tangy", odourIntensity: 3.0, concentration: 22, threshold: 18 },
    ],
    istdRecovery: 92.4,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Tangy: 13, Thick: 11, Sour: 10, Fresh: 7, Astringent: 6, Milky: 5, Bitter: 4 },
    intensity: { Creamy: 5.0, Tangy: 7.6, Sour: 6.8, Sweet: 1.8, Milky: 4.4, Thick: 7.8, Smooth: 5.4, Fresh: 5.8 },
    hedonic: { appearance: 6.4, flavour: 5.8, texture: 6.6, overall: 6.0 },
    emotions: { positive: 3.2, negative: 1.8 },
    trainedPanelReference: { overallQuality: 64, recommendation: "TWEAK", delta: 3.4 }
  },
  {
    sampleId: "YG-006",
    sampleName: "Coconut Yogurt Alternative",
    taste: { sourness: 2.9, bitterness: 1.5, astringency: 1.6, umami: 0.8, saltiness: 0.5, sweetness: 3.9, astringencyAftertaste: 1.4, umamiAftertaste: 0.8, bitternessAftertaste: 1.4, richness: 4.4 },
    composition: { salt: 0.10, fat: 8.6, protein: 3.2, starchDryMatter: 6.2 },
    gcmsOlfactometry: [
      { retentionTime: 17.8, compound: "Delta-octalactone", nistProbability: 88, peakArea: 96000, odour: "coconut creamy", odourIntensity: 2.8, concentration: 16, threshold: 2 },
    ],
    istdRecovery: 91.5,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Creamy: 10, Fermented: 7, Sweet: 8, Watery: 6, Fresh: 6, Artificial: 6, Astringent: 4 },
    intensity: { Creamy: 5.8, Tangy: 3.8, Sour: 3.4, Sweet: 5.6, Milky: 2.4, Thick: 5.0, Smooth: 5.8, Fresh: 5.0 },
    hedonic: { appearance: 6.0, flavour: 5.6, texture: 5.8, overall: 5.7 },
    emotions: { positive: 3.0, negative: 1.8 },
    trainedPanelReference: { overallQuality: 60, recommendation: "TWEAK", delta: 3.6 }
  },
  {
    sampleId: "YG-007",
    sampleName: "Lemon Kefir Yogurt",
    taste: { sourness: 4.9, bitterness: 1.0, astringency: 1.5, umami: 1.1, saltiness: 0.6, sweetness: 3.0, astringencyAftertaste: 1.4, umamiAftertaste: 1.0, bitternessAftertaste: 1.0, richness: 4.0 },
    composition: { salt: 0.13, fat: 1.8, protein: 5.4, starchDryMatter: 8.3 },
    gcmsOlfactometry: [
      { retentionTime: 19.3, compound: "Citral", nistProbability: 91, peakArea: 142000, odour: "lemon citrus", odourIntensity: 3.2, concentration: 19, threshold: 4 },
    ],
    istdRecovery: 93.2,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Tangy: 12, Sour: 10, Fruity: 8, Fermented: 8, Fresh: 8, Smooth: 6, Astringent: 4 },
    intensity: { Creamy: 4.6, Tangy: 7.2, Sour: 6.6, Sweet: 3.4, Milky: 3.0, Thick: 4.4, Smooth: 5.6, Fresh: 6.8 },
    hedonic: { appearance: 6.8, flavour: 6.6, texture: 6.2, overall: 6.5 },
    emotions: { positive: 3.8, negative: 1.2 },
    trainedPanelReference: { overallQuality: 71, recommendation: "GO", delta: 2.6 }
  },
  {
    sampleId: "YG-008",
    sampleName: "Plain Whole Milk Yogurt",
    taste: { sourness: 3.9, bitterness: 0.7, astringency: 1.0, umami: 1.3, saltiness: 0.8, sweetness: 2.2, astringencyAftertaste: 0.9, umamiAftertaste: 1.2, bitternessAftertaste: 0.7, richness: 5.4 },
    composition: { salt: 0.17, fat: 5.2, protein: 7.8, starchDryMatter: 6.4 },
    gcmsOlfactometry: [
      { retentionTime: 4.6, compound: "Acetaldehyde", nistProbability: 90, peakArea: 118000, odour: "fresh cultured", odourIntensity: 2.4, concentration: 31, threshold: 12 },
    ],
    istdRecovery: 93.8,
    olfactometryFlowSplit: "67:33 confirmed",
    cata: { Milky: 12, Creamy: 11, Fresh: 10, Tangy: 8, Smooth: 9, Thick: 6, Sour: 5 },
    intensity: { Creamy: 6.6, Tangy: 5.4, Sour: 4.8, Sweet: 2.6, Milky: 7.0, Thick: 5.4, Smooth: 6.8, Fresh: 6.6 },
    hedonic: { appearance: 7.2, flavour: 7.0, texture: 7.0, overall: 7.1 },
    emotions: { positive: 4.0, negative: 1.0 },
    trainedPanelReference: { overallQuality: 78, recommendation: "GO", delta: 1.8 }
  },
];
