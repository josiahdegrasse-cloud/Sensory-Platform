// Hybrid screening escalation data - 9 critical screening attributes
// Focus: Instrumental + semi-trained panel checkpoint → Full trained panel escalation decision

export interface ConvergenceAttribute {
  attribute: string;
  category: 'Taste' | 'Aroma' | 'Texture';
  instrumental: number;
  semiTrainedPanel: number; // Semi-trained panel ratings (not full trained panel)
  screeningAlignment: number; // Agreement between instrumental + semi-trained (not "convergence")
  correlationR: number; // Model internal consistency
  rmse: number;
  mae: number; // Mean Absolute Error between instrumental and semi-trained
  rankAgreement: number; // Directional agreement
  confidenceLower: number;
  confidenceUpper: number;
  instrumentalRepeatability: number; // Instrumental measurement stability (lower = better)
  source: string;
  escalationTrigger: boolean; // If true, this attribute can trigger full panel escalation
}

export const convergenceData: ConvergenceAttribute[] = [
  // === TASTE ATTRIBUTES (TSS E-Tongue) ===
  { 
    attribute: 'Sourness',
    category: 'Taste',
    instrumental: 3.8, 
    semiTrainedPanel: 3.6, 
    screeningAlignment: 0.91, 
    correlationR: 0.94,
    rmse: 0.22,
    mae: 0.18,
    rankAgreement: 94,
    confidenceLower: 3.4,
    confidenceUpper: 4.2,
    instrumentalRepeatability: 0.15,
    source: 'E-Tongue (PLSR)',
    escalationTrigger: true // Key taste driver - high disagreement triggers escalation
  },
  { 
    attribute: 'Bitterness',
    category: 'Taste',
    instrumental: 2.1, 
    semiTrainedPanel: 2.4, 
    screeningAlignment: 0.78, 
    correlationR: 0.81,
    rmse: 0.38,
    mae: 0.31,
    rankAgreement: 82,
    confidenceLower: 1.8,
    confidenceUpper: 2.6,
    instrumentalRepeatability: 0.28,
    source: 'E-Tongue (PLSR)',
    escalationTrigger: false // Secondary attribute
  },
  { 
    attribute: 'Umami',
    category: 'Taste',
    instrumental: 4.5, 
    semiTrainedPanel: 4.3, 
    screeningAlignment: 0.89, 
    correlationR: 0.92,
    rmse: 0.25,
    mae: 0.20,
    rankAgreement: 91,
    confidenceLower: 4.1,
    confidenceUpper: 4.9,
    instrumentalRepeatability: 0.18,
    source: 'E-Tongue (PLSR)',
    escalationTrigger: true // Critical for cheese authenticity
  },
  { 
    attribute: 'Saltiness',
    category: 'Taste',
    instrumental: 2.9, 
    semiTrainedPanel: 3.1, 
    screeningAlignment: 0.92, 
    correlationR: 0.95,
    rmse: 0.19,
    mae: 0.16,
    rankAgreement: 96,
    confidenceLower: 2.7,
    confidenceUpper: 3.3,
    instrumentalRepeatability: 0.12,
    source: 'Salt Content (Chemical)',
    escalationTrigger: false // Well-characterized via direct chemical analysis
  },

  // === AROMA ATTRIBUTES (GC-MS/GC-O) ===
  { 
    attribute: 'Cheesy Aroma',
    category: 'Aroma',
    instrumental: 3.5, 
    semiTrainedPanel: 3.4, 
    screeningAlignment: 0.88, 
    correlationR: 0.91,
    rmse: 0.26,
    mae: 0.21,
    rankAgreement: 90,
    confidenceLower: 3.1,
    confidenceUpper: 3.9,
    instrumentalRepeatability: 0.19,
    source: 'Volatile Fatty Acids',
    escalationTrigger: true // Primary aroma identity
  },
  { 
    attribute: 'Fermented Note',
    category: 'Aroma',
    instrumental: 2.7, 
    semiTrainedPanel: 2.9, 
    screeningAlignment: 0.84, 
    correlationR: 0.87,
    rmse: 0.32,
    mae: 0.26,
    rankAgreement: 85,
    confidenceLower: 2.4,
    confidenceUpper: 3.2,
    instrumentalRepeatability: 0.24,
    source: 'Diacetyl + Acetoin',
    escalationTrigger: false // Secondary complexity
  },
  { 
    attribute: 'Rancid Note',
    category: 'Aroma',
    instrumental: 1.5, 
    semiTrainedPanel: 1.8, 
    screeningAlignment: 0.72, 
    correlationR: 0.76,
    rmse: 0.45,
    mae: 0.38,
    rankAgreement: 77,
    confidenceLower: 1.1,
    confidenceUpper: 2.1,
    instrumentalRepeatability: 0.35,
    source: 'Short-Chain Fatty Acids',
    escalationTrigger: true // Off-note detection - regulatory critical
  },

  // === TEXTURE ATTRIBUTES (Sensory Lexicon) ===
  { 
    attribute: 'Creaminess',
    category: 'Texture',
    instrumental: 3.2, 
    semiTrainedPanel: 3.1, 
    screeningAlignment: 0.87, 
    correlationR: 0.89,
    rmse: 0.28,
    mae: 0.23,
    rankAgreement: 88,
    confidenceLower: 2.9,
    confidenceUpper: 3.5,
    instrumentalRepeatability: 0.20,
    source: 'Fat Content + Viscosity',
    escalationTrigger: false // Consumer-facing but not regulatory
  },
  { 
    attribute: 'Firmness',
    category: 'Texture',
    instrumental: 3.6, 
    semiTrainedPanel: 3.5, 
    screeningAlignment: 0.93, 
    correlationR: 0.96,
    rmse: 0.18,
    mae: 0.15,
    rankAgreement: 95,
    confidenceLower: 3.3,
    confidenceUpper: 3.9,
    instrumentalRepeatability: 0.11,
    source: 'Texture Analyzer',
    escalationTrigger: true // Major texture driver - well-characterized instrumentally
  },
];

// Screening Risk Score Calculation (weighted - estimates escalation necessity)
export function calculateScreeningRiskScore(data: ConvergenceAttribute[]): number {
  const escalationTriggerAttrs = data.filter(attr => attr.escalationTrigger);
  const allAttrs = data;

  // Mean screening alignment for escalation-trigger attributes (must be high)
  const triggerAlignment = escalationTriggerAttrs.reduce((sum, attr) => sum + attr.screeningAlignment, 0) / escalationTriggerAttrs.length;

  // Mean rank agreement across all attributes (directional consistency)
  const rankAgreementScore = allAttrs.reduce((sum, attr) => sum + attr.rankAgreement / 100, 0) / allAttrs.length;

  // Instrumental reliability score (inverse of mean repeatability - lower variance = better)
  const meanRepeatability = allAttrs.reduce((sum, attr) => sum + attr.instrumentalRepeatability, 0) / allAttrs.length;
  const reliabilityScore = Math.max(0, 1 - (meanRepeatability / 0.5)); // Normalize: 0.5 std = 0 score

  // Weighted combination - higher score = lower risk = escalation not needed
  const riskScore = (0.5 * triggerAlignment) + (0.3 * rankAgreementScore) + (0.2 * reliabilityScore);

  return riskScore;
}

// Escalation Trigger Check (not "substitution eligibility")
export function checkEscalationTriggers(data: ConvergenceAttribute[], threshold: number = 0.85): {
  escalationRequired: boolean;
  triggers: ConvergenceAttribute[];
} {
  const escalationTriggerAttrs = data.filter(attr => attr.escalationTrigger);
  const triggers = escalationTriggerAttrs.filter(attr => attr.screeningAlignment < threshold);
  
  return {
    escalationRequired: triggers.length > 0,
    triggers
  };
}

// Risk Detection (identifies screening gaps)
export function detectScreeningRisks(data: ConvergenceAttribute[]): string[] {
  const risks: string[] = [];

  data.forEach(attr => {
    // Low model consistency
    if (attr.correlationR < 0.80) {
      risks.push(`Low ${attr.attribute} model consistency (r=${attr.correlationR.toFixed(2)})`);
    }

    // High prediction error
    if (attr.rmse > 0.40) {
      risks.push(`High ${attr.attribute} prediction error (RMSE=${attr.rmse.toFixed(2)})`);
    }

    // High instrumental variability
    if (attr.instrumentalRepeatability > 0.30) {
      risks.push(`High ${attr.attribute} instrumental variability (σ=${attr.instrumentalRepeatability.toFixed(2)})`);
    }

    // Escalation trigger attribute with low alignment
    if (attr.escalationTrigger && attr.screeningAlignment < 0.85) {
      risks.push(`Escalation trigger: ${attr.attribute} screening alignment below threshold (${(attr.screeningAlignment * 100).toFixed(0)}%)`);
    }
  });

  return risks;
}