// Parallel Validation Study: 14 semi-trained panelists + 8 trained panel comparison
// Study design: ISSF review 4.5 & Technical Review Feb 2026
// Reference comparison for transparent demo evaluation; not external validation.

export interface ValidationRecord {
  sampleId: string;
  issfScore: number; // 0-100 combined score
  trainedPanelScore: number; // 0-100 expert descriptive analysis
  issfDecision: "GO" | "TWEAK" | "STOP";
  trainedPanelDecision: "GO" | "TWEAK" | "STOP";
  agreement: boolean;
  category: string;
  delta: number; // absolute difference
}

// NFI-GST-2.1 evaluation snapshot against the original 14 trained-panel
// references. This is demo/reference evidence, not an external validation set.
export const VALIDATION_DATASET: ValidationRecord[] = [
  { sampleId: "S1", issfScore: 71.29, trainedPanelScore: 79, issfDecision: "TWEAK", trainedPanelDecision: "GO", agreement: false, category: "Coconut-based", delta: 7.71 },
  { sampleId: "S2", issfScore: 60.32, trainedPanelScore: 72, issfDecision: "TWEAK", trainedPanelDecision: "GO", agreement: false, category: "Coconut-based", delta: 11.68 },
  { sampleId: "S3", issfScore: 0, trainedPanelScore: 38, issfDecision: "STOP", trainedPanelDecision: "STOP", agreement: true, category: "Coconut-based", delta: 38 },
  { sampleId: "S4", issfScore: 85.71, trainedPanelScore: 81, issfDecision: "GO", trainedPanelDecision: "GO", agreement: true, category: "Coconut-based", delta: 4.71 },
  { sampleId: "S5", issfScore: 78.7, trainedPanelScore: 83, issfDecision: "GO", trainedPanelDecision: "GO", agreement: true, category: "Cashew-based", delta: 4.3 },
  { sampleId: "S6", issfScore: 73.73, trainedPanelScore: 78, issfDecision: "TWEAK", trainedPanelDecision: "GO", agreement: false, category: "Cashew-based", delta: 4.27 },
  { sampleId: "S7", issfScore: 54.68, trainedPanelScore: 68, issfDecision: "TWEAK", trainedPanelDecision: "TWEAK", agreement: true, category: "Cashew-based", delta: 13.32 },
  { sampleId: "S8", issfScore: 84.38, trainedPanelScore: 86, issfDecision: "GO", trainedPanelDecision: "GO", agreement: true, category: "Cashew-based", delta: 1.62 },
  { sampleId: "S9", issfScore: 63.11, trainedPanelScore: 73, issfDecision: "TWEAK", trainedPanelDecision: "GO", agreement: false, category: "Mixed base", delta: 9.89 },
  { sampleId: "S10", issfScore: 69.19, trainedPanelScore: 76, issfDecision: "TWEAK", trainedPanelDecision: "GO", agreement: false, category: "Mixed base", delta: 6.81 },
  { sampleId: "S11", issfScore: 56.34, trainedPanelScore: 70, issfDecision: "TWEAK", trainedPanelDecision: "TWEAK", agreement: true, category: "Mixed base", delta: 13.66 },
  { sampleId: "S12", issfScore: 84.86, trainedPanelScore: 91, issfDecision: "GO", trainedPanelDecision: "GO", agreement: true, category: "Mixed base", delta: 6.14 },
  { sampleId: "D1", issfScore: 90.18, trainedPanelScore: 95, issfDecision: "GO", trainedPanelDecision: "GO", agreement: true, category: "Dairy", delta: 4.82 },
  { sampleId: "D2", issfScore: 87.11, trainedPanelScore: 93, issfDecision: "GO", trainedPanelDecision: "GO", agreement: true, category: "Dairy", delta: 5.89 },
];

// Panelist calibration tracking (14 semi-trained, 2×90min HFD training)
export interface PanelistCalibration {
  panelistId: string;
  name: string;
  sessionsCompleted: number;
  attributeAgreement: number; // % agreement with reference standards
  intensityAccuracy: number; // RMSE vs. reference standards
  hedonicConsistency: number; // test-retest reliability
  cataPrecision: number; // sensitivity/specificity on 25 attributes
  lastHfdTraining: string; // Last HFD vocabulary elicitation date
  cognitiveWalkthroughDue: string; // Next refresh needed
  status: "calibrated" | "needs-refresh" | "in-training";
  referenceStandards: string[]; // e.g., "Parmesan for Cheese", "Rye bread for Rye"
}

export const PANELIST_CALIBRATION: PanelistCalibration[] = [
  { 
    panelistId: "P1", name: "Sarah M.", sessionsCompleted: 18, attributeAgreement: 0.89, 
    intensityAccuracy: 1.2, hedonicConsistency: 0.91, cataPrecision: 0.86, 
    lastHfdTraining: "2026-02-15", cognitiveWalkthroughDue: "2026-05-15", status: "calibrated",
    referenceStandards: ["Parmesan for Cheese", "Cultured butter for Butter"]
  },
  { 
    panelistId: "P2", name: "James K.", sessionsCompleted: 16, attributeAgreement: 0.87, 
    intensityAccuracy: 1.4, hedonicConsistency: 0.88, cataPrecision: 0.84, 
    lastHfdTraining: "2026-02-15", cognitiveWalkthroughDue: "2026-05-15", status: "calibrated",
    referenceStandards: ["Parmesan for Cheese", "Rye bread for Rye"]
  },
  { 
    panelistId: "P3", name: "Maria L.", sessionsCompleted: 21, attributeAgreement: 0.92, 
    intensityAccuracy: 1.1, hedonicConsistency: 0.93, cataPrecision: 0.91, 
    lastHfdTraining: "2026-02-15", cognitiveWalkthroughDue: "2026-05-15", status: "calibrated",
    referenceStandards: ["Parmesan for Cheese", "Vanilla extract for Vanilla"]
  },
  { 
    panelistId: "P4", name: "David C.", sessionsCompleted: 15, attributeAgreement: 0.84, 
    intensityAccuracy: 1.6, hedonicConsistency: 0.85, cataPrecision: 0.82, 
    lastHfdTraining: "2026-02-15", cognitiveWalkthroughDue: "2026-05-15", status: "calibrated",
    referenceStandards: ["Parmesan for Cheese", "Malt vinegar for Malt"]
  },
  { 
    panelistId: "P5", name: "Lisa T.", sessionsCompleted: 19, attributeAgreement: 0.90, 
    intensityAccuracy: 1.3, hedonicConsistency: 0.89, cataPrecision: 0.87, 
    lastHfdTraining: "2026-02-15", cognitiveWalkthroughDue: "2026-05-15", status: "calibrated",
    referenceStandards: ["Parmesan for Cheese", "Dried apricot for Dried fruits"]
  },
  { 
    panelistId: "P6", name: "Michael R.", sessionsCompleted: 17, attributeAgreement: 0.86, 
    intensityAccuracy: 1.5, hedonicConsistency: 0.87, cataPrecision: 0.83, 
    lastHfdTraining: "2026-02-15", cognitiveWalkthroughDue: "2026-05-15", status: "calibrated",
    referenceStandards: ["Parmesan for Cheese", "Honey for Honey"]
  },
  { 
    panelistId: "P7", name: "Emma W.", sessionsCompleted: 20, attributeAgreement: 0.91, 
    intensityAccuracy: 1.2, hedonicConsistency: 0.92, cataPrecision: 0.89, 
    lastHfdTraining: "2026-02-15", cognitiveWalkthroughDue: "2026-05-15", status: "calibrated",
    referenceStandards: ["Parmesan for Cheese", "Toasted bread for Toasted"]
  },
  { 
    panelistId: "P8", name: "Ryan P.", sessionsCompleted: 14, attributeAgreement: 0.85, 
    intensityAccuracy: 1.7, hedonicConsistency: 0.84, cataPrecision: 0.81, 
    lastHfdTraining: "2026-01-20", cognitiveWalkthroughDue: "2026-04-20", status: "needs-refresh",
    referenceStandards: ["Parmesan for Cheese", "Rye bread for Rye"]
  },
  { 
    panelistId: "P9", name: "Sophie B.", sessionsCompleted: 18, attributeAgreement: 0.88, 
    intensityAccuracy: 1.4, hedonicConsistency: 0.90, cataPrecision: 0.85, 
    lastHfdTraining: "2026-02-15", cognitiveWalkthroughDue: "2026-05-15", status: "calibrated",
    referenceStandards: ["Parmesan for Cheese", "Cultured butter for Butter"]
  },
  { 
    panelistId: "P10", name: "Tom H.", sessionsCompleted: 22, attributeAgreement: 0.93, 
    intensityAccuracy: 1.0, hedonicConsistency: 0.94, cataPrecision: 0.92, 
    lastHfdTraining: "2026-02-15", cognitiveWalkthroughDue: "2026-05-15", status: "calibrated",
    referenceStandards: ["Parmesan for Cheese", "Vanilla extract for Vanilla"]
  },
  { 
    panelistId: "P11", name: "Rachel D.", sessionsCompleted: 15, attributeAgreement: 0.83, 
    intensityAccuracy: 1.8, hedonicConsistency: 0.86, cataPrecision: 0.80, 
    lastHfdTraining: "2026-02-15", cognitiveWalkthroughDue: "2026-05-15", status: "calibrated",
    referenceStandards: ["Parmesan for Cheese", "Malt vinegar for Malt"]
  },
  { 
    panelistId: "P12", name: "Alex N.", sessionsCompleted: 17, attributeAgreement: 0.87, 
    intensityAccuracy: 1.5, hedonicConsistency: 0.88, cataPrecision: 0.84, 
    lastHfdTraining: "2026-02-15", cognitiveWalkthroughDue: "2026-05-15", status: "calibrated",
    referenceStandards: ["Parmesan for Cheese", "Dried apricot for Dried fruits"]
  },
  { 
    panelistId: "P13", name: "Olivia G.", sessionsCompleted: 19, attributeAgreement: 0.89, 
    intensityAccuracy: 1.3, hedonicConsistency: 0.90, cataPrecision: 0.86, 
    lastHfdTraining: "2026-02-15", cognitiveWalkthroughDue: "2026-05-15", status: "calibrated",
    referenceStandards: ["Parmesan for Cheese", "Honey for Honey"]
  },
  { 
    panelistId: "P14", name: "Chris F.", sessionsCompleted: 16, attributeAgreement: 0.86, 
    intensityAccuracy: 1.6, hedonicConsistency: 0.87, cataPrecision: 0.83, 
    lastHfdTraining: "2026-02-15", cognitiveWalkthroughDue: "2026-05-15", status: "calibrated",
    referenceStandards: ["Parmesan for Cheese", "Toasted bread for Toasted"]
  },
];

// Inter-rater reliability metrics
export const INTER_RATER_STATS = {
  cronbachAlpha: 0.87, // Internal consistency
  icc: 0.84, // Intraclass correlation coefficient
  fleissKappa: 0.79, // Agreement on 25 CATA attributes
  avgPairwiseCorrelation: 0.82,
  olfactometryPanelAgreement: 0.88, // Odour perception vs. GC-O
};

// Current NFI-GST-2.1 demo/reference comparison. Recalculate whenever the
// method version or validation snapshot changes.
export const METHOD_COMPARISON = {
  pearsonR: 0.977,
  rSquared: 0.955,
  rmse: 12.83,
  mae: 9.49,
  sensitivity: 0.545,
  specificity: 1.00,
  ppv: 1.00,
  npv: 0.375,
  accuracy: 0.643, // Exact three-class agreement (9/14)
  f1Score: 0.706,
  avgDelta: 9.49,
};

// Cost savings analysis (small/medium company use case)
export const COST_ANALYSIS = {
  totalPrototypesTested: 14,
  issfCost: 14 * 2000, // $28k (14 × $2k)
  trainedPanelCost: 14 * 35000, // $490k (14 × $35k)
  actualSpend: (12 * 2000) + (2 * 35000), // $94k (12 ISSF, 2 escalated)
  totalSavings: 490000 - 94000, // $396k
  savingsPercentage: 0.81, // 81% cost reduction
  avgTimeSavings: "7.2 weeks",
  maxSamplesPerSession: 7, // 6-7 samples max
  sessionFrequency: "twice per month",
};

// Use case boundaries (evidence-based, from ISSF review 4.8)
export const USE_CASE_BOUNDARIES = {
  safeForISFF: {
    title: "✅ USE ISSF SCREENING FOR:",
    criteria: [
      "Early screening & rapid iteration (6–7 samples max per session)",
      "Products with ISSF evidence-strength index ≥70%",
      "Clear GC-O defects (odour intensity ≥3 on off-notes)",
      "Go/No-Go decisions on prototypes",
      "Budget-conscious early development phases",
      "Rapid iteration cycles (<1 week turnaround)",
      "Twice-per-month evaluation cadence",
    ],
    historicalAccuracy: "64% exact agreement with trained panel in the NFI-GST-2.1 demo reference set (9/14; r=0.977)"
  },
  requireTrainedPanel: {
    title: "⚠️ ALWAYS USE TRAINED PANEL FOR:",
    criteria: [
      "Final product validation before market launch",
      "Regulatory claims requiring sensory support",
      "Products with ISSF evidence-strength index <70%",
      "Conflicting signals (high e-tongue, low hedonic)",
      "Premium positioning requiring expert verification",
      "GC-O odour intensity ≥4 (critical defect escalation)",
      "Subtle reformulations requiring expert discrimination",
    ],
    historicalAccuracy: "5 conservative non-GO calls against trained-panel GO references in the current 14-sample demo set"
  }
};

// Training protocol details (HFD + cognitive walkthrough)
export const TRAINING_PROTOCOL = {
  sessions: 2,
  durationPerSession: "90 minutes",
  methodology: "HFD (Human-Factored Design)",
  vocabularyElicitation: "Think-aloud protocol with panelists",
  cognitiveWalkthrough: "Co-designed clarifications for ambiguous terms (aggressive, wild, nostalgic)",
  referenceStandards: [
    "Parmesan for Cheese",
    "Cultured butter for Butter",
    "Rye bread for Rye",
    "Vanilla extract for Vanilla",
    "Malt vinegar for Malt",
    "Dried apricot for Dried fruits",
    "Honey for Honey",
    "Toasted bread for Toasted"
  ],
  refreshInterval: "3 months"
};
