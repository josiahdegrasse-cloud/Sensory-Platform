// ISSF (Integrated Sensory Screening Framework) Mock Data for Plant-Based Cheese Alternatives

// ========== CORE INTERFACES ==========

export interface ETongueData {
  dimension: string;
  value: number;
  unit: string;
  dairyBenchmark: number;
  deviation: number;
}

export interface ChemicalData {
  parameter: string;
  value: number;
  unit: string;
  correlation?: number; // correlation to key taste dimension
}

export interface CATAAttribute {
  attribute: string;
  frequency: number; // % of panelists who selected it
  eTongueScore?: number;
  convergence?: number; // 0-1, how well it aligns with e-tongue
}

export interface HedonicScale {
  dimension: string;
  score: number; // 1-9 scale
  stdDev: number;
}

export interface EsSense25Emotion {
  emotion: string;
  intensity: number; // 0-100
}

export interface HFDMetric {
  aspect: string;
  value: string | number;
  improvement?: string;
}

export interface ConvergenceData {
  attribute: string;
  eTongue: number;
  panelPredicted: number;
  dairyBenchmark: number;
  convergence: number; // 0-1
  correlationR: number;
  deviation: number;
}

export interface AttributeContribution {
  source: string;
  contribution: number;
  type: 'E-Tongue' | 'Chemical' | 'Panel';
  note?: string;
}

export interface IterationMetrics {
  cycle: string;
  consistency: number;
  convergence: number;
  vocabularyAlignment: number;
}

// NEW: Individual Panelist Data
export interface PanelistData {
  panelistId: string;
  attribute: string;
  score: number;
  sessionId: string;
}

// NEW: GC-MS Volatile Compounds
export interface VolatileCompound {
  compoundName: string;
  concentration: number; // ppb
  unit: string;
  odorThreshold: number;
  odorActivity: number; // concentration / threshold
  dairyBenchmark: number;
  deviation: number;
  category: 'Fatty Acid' | 'Aldehyde' | 'Ketone' | 'Ester' | 'Sulfur' | 'Alcohol';
  odorDescription: string;
}

// NEW: Correlation Matrix
export interface CorrelationPair {
  instrumentalVar: string;
  sensoryVar: string;
  rValue: number;
  pValue: number;
  significant: boolean; // p < 0.05
  strength: 'Very Strong' | 'Strong' | 'Moderate' | 'Weak' | 'Very Weak';
}

// NEW: ANOVA Results
export interface ANOVAResult {
  attribute: string;
  fStatistic: number;
  pValue: number;
  significant: boolean;
  degreesOfFreedom: [number, number];
  effectSize: number; // eta-squared
}

// NEW: Feature Importance
export interface FeatureImportance {
  feature: string;
  importance: number; // 0-1
  type: 'E-Tongue' | 'Chemical' | 'GC-MS' | 'Panel';
  rank: number;
}

// NEW: Data Quality Indicator
export interface DataQualityIssue {
  source: string;
  issue: string;
  severity: 'Critical' | 'Warning' | 'Info';
  value?: string;
  recommendation: string;
}

// NEW: Panelist Reliability
export interface PanelistReliability {
  panelistId: string;
  cronbachAlpha: number;
  icc: number; // Intraclass Correlation
  repeatability: number;
  averageDeviation: number;
  outlierCount: number;
  status: 'Excellent' | 'Good' | 'Fair' | 'Needs Training';
}

// ========== PRODUCT METADATA ==========

export const productMetadata = {
  productName: 'PBCA Sample 202602 - Coconut Oil Cheddar-Style',
  date: 'February 2026',
  frameworkVersion: 'ISSF v1.2',
  overallConvergence: 0.85, // Overall convergence score
  category: 'Semi-hard PBCA',
  baseIngredients: 'Coconut oil, potato starch, nutritional yeast',
};

// ========== E-TONGUE DATA (TS-5000Z) ==========

export const eTongueData: ETongueData[] = [
  { dimension: 'Sourness', value: 3.8, unit: 'mV', dairyBenchmark: 4.2, deviation: -0.4 },
  { dimension: 'Bitterness', value: 2.1, unit: 'mV', dairyBenchmark: 1.5, deviation: 0.6 },
  { dimension: 'Astringency', value: 3.2, unit: 'mV', dairyBenchmark: 2.8, deviation: 0.4 },
  { dimension: 'Umami', value: 4.5, unit: 'mV', dairyBenchmark: 5.1, deviation: -0.6 },
  { dimension: 'Saltiness', value: 2.9, unit: 'mV', dairyBenchmark: 3.2, deviation: -0.3 },
  { dimension: 'Sweetness', value: 1.8, unit: 'mV', dairyBenchmark: 2.3, deviation: -0.5 },
  { dimension: 'Aftertaste-Bitter', value: 3.4, unit: 'mV', dairyBenchmark: 1.8, deviation: 1.6 },
  { dimension: 'Richness', value: 3.6, unit: 'mV', dairyBenchmark: 4.8, deviation: -1.2 },
];

// ========== CHEMICAL ANALYSIS ==========

export const chemicalData: ChemicalData[] = [
  { parameter: 'Protein', value: 3.2, unit: '%', correlation: 0.78 },
  { parameter: 'Fat', value: 28.5, unit: '%', correlation: 0.85 },
  { parameter: 'Starch', value: 18.4, unit: '%', correlation: 0.62 },
  { parameter: 'Salt', value: 1.6, unit: '%', correlation: 0.91 },
  { parameter: 'Sugar', value: 0.8, unit: '%', correlation: 0.74 },
  { parameter: 'Dry Matter', value: 52.1, unit: '%', correlation: 0.55 },
  { parameter: 'pH', value: 5.8, unit: '', correlation: 0.82 },
  { parameter: 'Conductivity', value: 4.2, unit: 'mS/cm', correlation: 0.68 },
];

// ========== SEMI-TRAINED PANEL DATA ==========

export const cataAttributes: CATAAttribute[] = [
  { attribute: 'Buttery', frequency: 28, eTongueScore: 2.1, convergence: 0.72 },
  { attribute: 'Smooth', frequency: 64, eTongueScore: 3.6, convergence: 0.88 },
  { attribute: 'Artificial', frequency: 42, eTongueScore: 3.4, convergence: 0.81 },
  { attribute: 'Rubbery', frequency: 35, eTongueScore: 3.2, convergence: 0.76 },
  { attribute: 'Creamy', frequency: 51, eTongueScore: 3.6, convergence: 0.84 },
  { attribute: 'Nutty', frequency: 23, eTongueScore: 1.8, convergence: 0.69 },
  { attribute: 'Tangy', frequency: 58, eTongueScore: 3.8, convergence: 0.89 },
  { attribute: 'Off-flavour', frequency: 31, eTongueScore: 3.4, convergence: 0.79 },
  { attribute: 'Starchy', frequency: 47, eTongueScore: 4.2, convergence: 0.86 },
  { attribute: 'Chalky', frequency: 39, eTongueScore: 3.2, convergence: 0.77 },
];

export const hedonicScales: HedonicScale[] = [
  { dimension: 'Appearance', score: 6.8, stdDev: 1.2 },
  { dimension: 'Flavour', score: 5.4, stdDev: 1.8 },
  { dimension: 'Texture', score: 5.9, stdDev: 1.6 },
  { dimension: 'Overall Liking', score: 5.7, stdDev: 1.5 },
];

export const esSense25: EsSense25Emotion[] = [
  { emotion: 'Interested', intensity: 62 },
  { emotion: 'Bored', intensity: 28 },
  { emotion: 'Disgusted', intensity: 18 },
  { emotion: 'Pleasant', intensity: 54 },
  { emotion: 'Satisfied', intensity: 48 },
  { emotion: 'Disappointed', intensity: 35 },
  { emotion: 'Curious', intensity: 71 },
  { emotion: 'Guilty', intensity: 12 },
];

export const openEndedThemes = [
  { theme: 'Persistent aftertaste', mentions: 8, sentiment: 'negative' },
  { theme: 'Lacks richness', mentions: 6, sentiment: 'negative' },
  { theme: 'Good meltability', mentions: 11, sentiment: 'positive' },
  { theme: 'Artificial note', mentions: 7, sentiment: 'negative' },
  { theme: 'Interesting texture', mentions: 9, sentiment: 'neutral' },
];

// ========== HFD INTEGRATION METRICS ==========

export const hfdMetrics: HFDMetric[] = [
  { aspect: 'Vocabulary Co-design', value: 'User-elicited terms integrated', improvement: 'Cycle 2' },
  { aspect: 'Cognitive Load (session)', value: 3.2, improvement: 'from 4.8 (Cycle 1)' },
  { aspect: 'Mental Model Alignment', value: '87%', improvement: 'from 72%' },
  { aspect: 'Protocol Duration', value: '35 min', improvement: 'from 52 min' },
  { aspect: 'Attribute List Updates', value: 3, improvement: 'Removed 4 redundant terms' },
  { aspect: 'Briefing Clarity Score', value: 8.2, improvement: 'from 6.5/10' },
];

// ========== CONVERGENCE DATA FOR RADAR CHART ==========

export const convergenceData: ConvergenceData[] = [
  { 
    attribute: 'Sourness', 
    eTongue: 3.8, 
    panelPredicted: 3.6, 
    dairyBenchmark: 4.2, 
    convergence: 0.91, 
    correlationR: 0.94,
    deviation: -0.6
  },
  { 
    attribute: 'Bitterness', 
    eTongue: 2.1, 
    panelPredicted: 2.4, 
    dairyBenchmark: 1.5, 
    convergence: 0.78, 
    correlationR: 0.81,
    deviation: 0.6
  },
  { 
    attribute: 'Astringency', 
    eTongue: 3.2, 
    panelPredicted: 3.0, 
    dairyBenchmark: 2.8, 
    convergence: 0.85, 
    correlationR: 0.88,
    deviation: 0.4
  },
  { 
    attribute: 'Umami', 
    eTongue: 4.5, 
    panelPredicted: 4.3, 
    dairyBenchmark: 5.1, 
    convergence: 0.89, 
    correlationR: 0.92,
    deviation: -0.6
  },
  { 
    attribute: 'Saltiness', 
    eTongue: 2.9, 
    panelPredicted: 3.1, 
    dairyBenchmark: 3.2, 
    convergence: 0.92, 
    correlationR: 0.95,
    deviation: -0.3
  },
  { 
    attribute: 'Sweetness', 
    eTongue: 1.8, 
    panelPredicted: 2.0, 
    dairyBenchmark: 2.3, 
    convergence: 0.87, 
    correlationR: 0.90,
    deviation: -0.5
  },
  { 
    attribute: 'Aftertaste', 
    eTongue: 3.4, 
    panelPredicted: 3.7, 
    dairyBenchmark: 1.8, 
    convergence: 0.74, 
    correlationR: 0.79,
    deviation: 1.6
  },
  { 
    attribute: 'Richness', 
    eTongue: 3.6, 
    panelPredicted: 3.4, 
    dairyBenchmark: 4.8, 
    convergence: 0.88, 
    correlationR: 0.91,
    deviation: -1.2
  },
];

// ========== ATTRIBUTE CONTRIBUTIONS ==========

export const getAttributeContributions = (attribute: string): AttributeContribution[] => {
  const contributions: Record<string, AttributeContribution[]> = {
    'Bitter Aftertaste': [
      { source: 'E-Tongue Bitterness Aftertaste', contribution: 0.52, type: 'E-Tongue' },
      { source: 'Salt content correlation', contribution: 0.28, type: 'Chemical', note: 'pH 5.8 enhances perception' },
      { source: 'CATA "Off-flavour" frequency', contribution: 0.20, type: 'Panel', note: '31% selection rate' },
    ],
    'Rubbery Texture': [
      { source: 'E-Tongue Astringency', contribution: 0.38, type: 'E-Tongue' },
      { source: 'Starch content (18.4%)', contribution: 0.46, type: 'Chemical' },
      { source: 'CATA "Rubbery" (35%)', contribution: 0.16, type: 'Panel' },
    ],
    'Sourness': [
      { source: 'E-Tongue Sourness (3.8 mV)', contribution: 0.52, type: 'E-Tongue' },
      { source: 'pH 5.8', contribution: 0.31, type: 'Chemical' },
      { source: 'CATA "Tangy" (58%)', contribution: 0.17, type: 'Panel' },
    ],
  };
  
  return contributions[attribute] || [
    { source: 'E-Tongue sensors', contribution: 0.50, type: 'E-Tongue' },
    { source: 'Chemical analysis', contribution: 0.30, type: 'Chemical' },
    { source: 'Panel CATA/Hedonic', contribution: 0.20, type: 'Panel' },
  ];
};

// ========== HISTORICAL VALIDATION (ISSF ACCURACY) ==========

export const historicalValidation = [
  { sample: 'PBCA-001', issfPredicted: 3.2, trainedPanel: 3.4, error: 0.2, convergence: 0.88 },
  { sample: 'PBCA-002', issfPredicted: 2.8, trainedPanel: 2.7, error: 0.1, convergence: 0.94 },
  { sample: 'PBCA-003', issfPredicted: 3.5, trainedPanel: 3.8, error: 0.3, convergence: 0.82 },
  { sample: 'PBCA-004', issfPredicted: 2.1, trainedPanel: 2.0, error: 0.1, convergence: 0.91 },
  { sample: 'PBCA-005', issfPredicted: 3.9, trainedPanel: 3.7, error: 0.2, convergence: 0.89 },
  { sample: 'PBCA-006', issfPredicted: 2.5, trainedPanel: 2.6, error: 0.1, convergence: 0.93 },
  { sample: 'PBCA-007', issfPredicted: 3.3, trainedPanel: 3.1, error: 0.2, convergence: 0.87 },
  { sample: 'PBCA-008', issfPredicted: 2.9, trainedPanel: 3.2, error: 0.3, convergence: 0.81 },
  { sample: 'PBCA-009', issfPredicted: 3.7, trainedPanel: 3.6, error: 0.1, convergence: 0.92 },
  { sample: 'PBCA-010', issfPredicted: 2.4, trainedPanel: 2.5, error: 0.1, convergence: 0.90 },
];

// ========== ITERATION IMPROVEMENT METRICS ==========

export const iterationMetrics: IterationMetrics[] = [
  { cycle: 'Cycle 1', consistency: 0.72, convergence: 0.78, vocabularyAlignment: 0.68 },
  { cycle: 'Cycle 2', consistency: 0.84, convergence: 0.83, vocabularyAlignment: 0.79 },
  { cycle: 'Cycle 3', consistency: 0.91, convergence: 0.87, vocabularyAlignment: 0.87 },
];

// ========== DECISION THRESHOLDS ==========

export const decisionThresholds = {
  convergenceMinimum: 0.80,
  deviationTolerance: 0.50,
  attributeDiscrimination: 0.05, // Cochran's Q p-value
  emotionalPredictionAccuracy: 0.75,
  vocabularyAlignment: 0.75,
};

// ========== COST & TIME COMPARISON ==========

export const costComparison = [
  {
    method: 'Fully Trained Panel',
    costPerSample: 850,
    timeValue: 'Weeks',
    reliability: 'High (gold standard)',
    details: '16 trained panelists, full protocol',
  },
  {
    method: 'ISSF Hybrid',
    costPerSample: 185,
    timeValue: 'Days',
    reliability: 'High (screening-level)',
    details: 'E-tongue + 14 semi-trained panelists',
  },
];

export const projectedSavings = {
  totalSamplesPerYear: 240,
  trainedPanelSubstitution: 0.70, // 70% substitution rate after 3 cycles
  issfCostPerSample: 185,
  trainedCostPerSample: 850,
  annualSavingsAmount: Math.round(240 * 0.70 * (850 - 185)),
};

// ========== STAGE CONVERGENCE TABLE ==========

export const stageConvergence = [
  { stage: 'Stage 1', stream: 'E-Tongue', sampleAttribute: 'Bitterness', score: 2.1, convergence: 0.78 },
  { stage: 'Stage 2', stream: 'CATA Panel', sampleAttribute: 'Artificial', frequency: 42, convergence: 0.81 },
  { stage: 'Stage 3', stream: 'Hedonic', sampleAttribute: 'Overall Liking', score: 5.7, convergence: 0.84 },
  { stage: 'Stage 4', stream: 'HFD Refinement', sampleAttribute: 'Cognitive Load', value: 3.2, convergence: 0.87 },
];

// ========== NEW: GC-MS VOLATILE COMPOUNDS ==========

export const volatileCompounds: VolatileCompound[] = [
  {
    compoundName: 'Diacetyl',
    concentration: 42,
    unit: 'ppb',
    odorThreshold: 5,
    odorActivity: 8.4,
    dairyBenchmark: 85,
    deviation: -43,
    category: 'Ketone',
    odorDescription: 'Buttery, creamy'
  },
  {
    compoundName: 'Butyric Acid',
    concentration: 118,
    unit: 'ppb',
    odorThreshold: 2,
    odorActivity: 59.0,
    dairyBenchmark: 240,
    deviation: -122,
    category: 'Fatty Acid',
    odorDescription: 'Cheesy, rancid'
  },
  {
    compoundName: 'Dimethyl Sulfide',
    concentration: 28,
    unit: 'ppb',
    odorThreshold: 1,
    odorActivity: 28.0,
    dairyBenchmark: 12,
    deviation: 16,
    category: 'Sulfur',
    odorDescription: 'Cabbage-like'
  },
  {
    compoundName: 'Hexanal',
    concentration: 65,
    unit: 'ppb',
    odorThreshold: 4.5,
    odorActivity: 14.4,
    dairyBenchmark: 35,
    deviation: 30,
    category: 'Aldehyde',
    odorDescription: 'Grassy, green'
  },
  {
    compoundName: 'Ethyl Butyrate',
    concentration: 22,
    unit: 'ppb',
    odorThreshold: 1,
    odorActivity: 22.0,
    dairyBenchmark: 45,
    deviation: -23,
    category: 'Ester',
    odorDescription: 'Fruity, pineapple'
  },
  {
    compoundName: '2-Nonanone',
    concentration: 38,
    unit: 'ppb',
    odorThreshold: 0.7,
    odorActivity: 54.3,
    dairyBenchmark: 62,
    deviation: -24,
    category: 'Ketone',
    odorDescription: 'Blue cheese-like'
  },
  {
    compoundName: '1-Octen-3-ol',
    concentration: 12,
    unit: 'ppb',
    odorThreshold: 1,
    odorActivity: 12.0,
    dairyBenchmark: 8,
    deviation: 4,
    category: 'Alcohol',
    odorDescription: 'Mushroom, earthy'
  },
  {
    compoundName: 'Methional',
    concentration: 8,
    unit: 'ppb',
    odorThreshold: 0.2,
    odorActivity: 40.0,
    dairyBenchmark: 3,
    deviation: 5,
    category: 'Sulfur',
    odorDescription: 'Cooked potato'
  }
];

// ========== NEW: INDIVIDUAL PANELIST DATA ==========

const generatePanelistScores = (attribute: string, mean: number, stdDev: number): PanelistData[] => {
  const panelists = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10', 'P11', 'P12', 'P13', 'P14'];
  return panelists.map(id => ({
    panelistId: id,
    attribute,
    score: Math.max(0, Math.min(6, mean + (Math.random() - 0.5) * stdDev * 2)),
    sessionId: 'S001'
  }));
};

export const panelistDataRaw: PanelistData[] = [
  ...generatePanelistScores('Sourness', 3.6, 0.8),
  ...generatePanelistScores('Bitterness', 2.4, 1.1),
  ...generatePanelistScores('Umami', 4.3, 0.7),
  ...generatePanelistScores('Saltiness', 3.1, 0.9),
  ...generatePanelistScores('Creaminess', 3.4, 1.2),
  ...generatePanelistScores('Overall Liking', 5.7, 1.5),
];

// ========== NEW: PANELIST RELIABILITY METRICS ==========

export const panelistReliability: PanelistReliability[] = [
  { panelistId: 'P01', cronbachAlpha: 0.89, icc: 0.84, repeatability: 0.91, averageDeviation: 0.42, outlierCount: 0, status: 'Excellent' },
  { panelistId: 'P02', cronbachAlpha: 0.92, icc: 0.88, repeatability: 0.94, averageDeviation: 0.38, outlierCount: 0, status: 'Excellent' },
  { panelistId: 'P03', cronbachAlpha: 0.78, icc: 0.72, repeatability: 0.81, averageDeviation: 0.68, outlierCount: 1, status: 'Good' },
  { panelistId: 'P04', cronbachAlpha: 0.85, icc: 0.81, repeatability: 0.87, averageDeviation: 0.51, outlierCount: 0, status: 'Good' },
  { panelistId: 'P05', cronbachAlpha: 0.91, icc: 0.86, repeatability: 0.93, averageDeviation: 0.39, outlierCount: 0, status: 'Excellent' },
  { panelistId: 'P06', cronbachAlpha: 0.68, icc: 0.62, repeatability: 0.74, averageDeviation: 0.89, outlierCount: 2, status: 'Fair' },
  { panelistId: 'P07', cronbachAlpha: 0.87, icc: 0.83, repeatability: 0.89, averageDeviation: 0.47, outlierCount: 0, status: 'Excellent' },
  { panelistId: 'P08', cronbachAlpha: 0.82, icc: 0.77, repeatability: 0.84, averageDeviation: 0.59, outlierCount: 1, status: 'Good' },
  { panelistId: 'P09', cronbachAlpha: 0.59, icc: 0.54, repeatability: 0.67, averageDeviation: 1.12, outlierCount: 3, status: 'Needs Training' },
  { panelistId: 'P10', cronbachAlpha: 0.90, icc: 0.85, repeatability: 0.92, averageDeviation: 0.41, outlierCount: 0, status: 'Excellent' },
  { panelistId: 'P11', cronbachAlpha: 0.84, icc: 0.79, repeatability: 0.86, averageDeviation: 0.54, outlierCount: 0, status: 'Good' },
  { panelistId: 'P12', cronbachAlpha: 0.88, icc: 0.84, repeatability: 0.90, averageDeviation: 0.45, outlierCount: 0, status: 'Excellent' },
  { panelistId: 'P13', cronbachAlpha: 0.75, icc: 0.70, repeatability: 0.79, averageDeviation: 0.72, outlierCount: 1, status: 'Good' },
  { panelistId: 'P14', cronbachAlpha: 0.86, icc: 0.82, repeatability: 0.88, averageDeviation: 0.49, outlierCount: 0, status: 'Good' },
];

// ========== NEW: CORRELATION MATRIX ==========

export const correlationMatrix: CorrelationPair[] = [
  // E-Tongue correlations
  { instrumentalVar: 'E-Tongue Sourness', sensoryVar: 'Sourness', rValue: 0.94, pValue: 0.001, significant: true, strength: 'Very Strong' },
  { instrumentalVar: 'E-Tongue Umami', sensoryVar: 'Umami', rValue: 0.92, pValue: 0.002, significant: true, strength: 'Very Strong' },
  { instrumentalVar: 'E-Tongue Saltiness', sensoryVar: 'Saltiness', rValue: 0.95, pValue: 0.001, significant: true, strength: 'Very Strong' },
  { instrumentalVar: 'E-Tongue Bitterness', sensoryVar: 'Bitterness', rValue: 0.81, pValue: 0.008, significant: true, strength: 'Strong' },
  { instrumentalVar: 'E-Tongue Richness', sensoryVar: 'Creaminess', rValue: 0.88, pValue: 0.003, significant: true, strength: 'Strong' },
  
  // Chemical correlations
  { instrumentalVar: 'pH', sensoryVar: 'Sourness', rValue: -0.82, pValue: 0.007, significant: true, strength: 'Strong' },
  { instrumentalVar: 'Fat Content', sensoryVar: 'Creaminess', rValue: 0.85, pValue: 0.005, significant: true, strength: 'Strong' },
  { instrumentalVar: 'Salt Content', sensoryVar: 'Saltiness', rValue: 0.91, pValue: 0.002, significant: true, strength: 'Very Strong' },
  { instrumentalVar: 'Protein Content', sensoryVar: 'Umami', rValue: 0.78, pValue: 0.011, significant: true, strength: 'Strong' },
  { instrumentalVar: 'Starch Content', sensoryVar: 'Starchiness', rValue: 0.72, pValue: 0.018, significant: true, strength: 'Strong' },
  
  // GC-MS correlations
  { instrumentalVar: 'Diacetyl (GC-MS)', sensoryVar: 'Buttery', rValue: 0.86, pValue: 0.004, significant: true, strength: 'Strong' },
  { instrumentalVar: 'Butyric Acid (GC-MS)', sensoryVar: 'Cheesy', rValue: 0.79, pValue: 0.010, significant: true, strength: 'Strong' },
  { instrumentalVar: 'Dimethyl Sulfide (GC-MS)', sensoryVar: 'Off-flavor', rValue: 0.74, pValue: 0.015, significant: true, strength: 'Strong' },
  { instrumentalVar: 'Hexanal (GC-MS)', sensoryVar: 'Grassy', rValue: 0.68, pValue: 0.024, significant: true, strength: 'Moderate' },
  
  // Weak correlations
  { instrumentalVar: 'Dry Matter', sensoryVar: 'Texture', rValue: 0.55, pValue: 0.067, significant: false, strength: 'Moderate' },
  { instrumentalVar: 'Conductivity', sensoryVar: 'Aftertaste', rValue: 0.48, pValue: 0.112, significant: false, strength: 'Weak' },
];

// ========== NEW: ANOVA RESULTS ==========

export const anovaResults: ANOVAResult[] = [
  { attribute: 'Sourness', fStatistic: 24.8, pValue: 0.0001, significant: true, degreesOfFreedom: [3, 52], effectSize: 0.59 },
  { attribute: 'Bitterness', fStatistic: 18.2, pValue: 0.0003, significant: true, degreesOfFreedom: [3, 52], effectSize: 0.51 },
  { attribute: 'Umami', fStatistic: 31.5, pValue: 0.00001, significant: true, degreesOfFreedom: [3, 52], effectSize: 0.65 },
  { attribute: 'Saltiness', fStatistic: 28.7, pValue: 0.00003, significant: true, degreesOfFreedom: [3, 52], effectSize: 0.62 },
  { attribute: 'Creaminess', fStatistic: 21.4, pValue: 0.0002, significant: true, degreesOfFreedom: [3, 52], effectSize: 0.55 },
  { attribute: 'Overall Liking', fStatistic: 15.9, pValue: 0.0006, significant: true, degreesOfFreedom: [3, 52], effectSize: 0.48 },
  { attribute: 'Starchiness', fStatistic: 12.3, pValue: 0.0015, significant: true, degreesOfFreedom: [3, 52], effectSize: 0.42 },
  { attribute: 'Aftertaste', fStatistic: 9.8, pValue: 0.0038, significant: true, degreesOfFreedom: [3, 52], effectSize: 0.36 },
];

// ========== NEW: FEATURE IMPORTANCE ==========

export const featureImportance: FeatureImportance[] = [
  { feature: 'E-Tongue Saltiness', importance: 0.95, type: 'E-Tongue', rank: 1 },
  { feature: 'E-Tongue Sourness', importance: 0.94, type: 'E-Tongue', rank: 2 },
  { feature: 'E-Tongue Umami', importance: 0.92, type: 'E-Tongue', rank: 3 },
  { feature: 'Salt Content', importance: 0.91, type: 'Chemical', rank: 4 },
  { feature: 'E-Tongue Richness', importance: 0.88, type: 'E-Tongue', rank: 5 },
  { feature: 'Diacetyl Concentration', importance: 0.86, type: 'GC-MS', rank: 6 },
  { feature: 'Fat Content', importance: 0.85, type: 'Chemical', rank: 7 },
  { feature: 'pH Level', importance: 0.82, type: 'Chemical', rank: 8 },
  { feature: 'E-Tongue Bitterness', importance: 0.81, type: 'E-Tongue', rank: 9 },
  { feature: 'Butyric Acid Concentration', importance: 0.79, type: 'GC-MS', rank: 10 },
  { feature: 'Protein Content', importance: 0.78, type: 'Chemical', rank: 11 },
  { feature: 'Dimethyl Sulfide', importance: 0.74, type: 'GC-MS', rank: 12 },
  { feature: 'Sugar Content', importance: 0.74, type: 'Chemical', rank: 13 },
  { feature: 'Starch Content', importance: 0.72, type: 'Chemical', rank: 14 },
  { feature: 'Hexanal Concentration', importance: 0.68, type: 'GC-MS', rank: 15 },
];

// ========== NEW: DATA QUALITY ISSUES ==========

export const dataQualityIssues: DataQualityIssue[] = [
  {
    source: 'Panelist P09',
    issue: 'High variability across attributes (SD > 1.1)',
    severity: 'Warning',
    value: 'ICC = 0.54',
    recommendation: 'Additional training session recommended'
  },
  {
    source: 'Panelist P06',
    issue: '2 outlier responses detected',
    severity: 'Warning',
    value: 'Sourness: 5.8 (>2SD from mean)',
    recommendation: 'Review with panelist; possible misunderstanding'
  },
  {
    source: 'E-Tongue Aftertaste-Bitter',
    issue: 'Large deviation from dairy benchmark (+1.6 mV)',
    severity: 'Info',
    value: '3.4 mV vs 1.8 mV target',
    recommendation: 'Formulation adjustment: reduce bitter compounds'
  },
  {
    source: 'GC-MS Dimethyl Sulfide',
    issue: 'Elevated sulfur compound',
    severity: 'Warning',
    value: '28 ppb (133% above benchmark)',
    recommendation: 'Check ingredient quality; consider sulfur-masking agents'
  },
  {
    source: 'Overall Convergence',
    issue: 'Aftertaste convergence below threshold',
    severity: 'Warning',
    value: '0.74 (target: 0.80)',
    recommendation: 'May require trained panel confirmation for this attribute'
  },
];