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
  intensity: {
    sourMilk: number;
    milkiness: number;
    cheesiness: number;
    creamy: number;
    grainy: number;
    oily: number;
    chalky: number;
    smooth: number;
  };
  
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
];
