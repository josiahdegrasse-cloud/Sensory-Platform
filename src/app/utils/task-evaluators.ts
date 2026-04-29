// Task-level evaluation functions for escalation decision logic

import { samples, tastAttributes, aromaAttributes, textureAttribute, type SampleData } from '../data/sample-data';

export type TaskStatus = 'PASS' | 'BORDERLINE' | 'FAIL';

export interface IntensityScalingResult {
  attribute: string;
  correlation: number;
  mae: number;
  status: TaskStatus;
  scatterData: { instrumental: number; semiTrained: number; sampleName: string; key: string }[];
}

export interface RankOrderingResult {
  attribute: string;
  correctMatches: number;
  totalComparisons: number;
  percentCorrect: number;
  status: TaskStatus;
}

export interface OffNoteDetectionResult {
  status: TaskStatus;
  detections: {
    sampleId: number;
    sampleName: string;
    instrumentalLevel: number;
    semiTrainedDetected: boolean;
    agreement: boolean;
  }[];
  missedDetections: number;
  falseNegatives: string[];
}

export interface TextureProxyResult {
  correlation: number;
  mae: number;
  status: TaskStatus;
  scatterData: { instrumental: number; semiTrained: number; sampleName: string; key: string }[];
}

export interface EscalationDecision {
  escalationRequired: boolean;
  reason: string;
  failedTasks: string[];
  recommendation: string;
}

// Helper: Calculate Pearson correlation
function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

// Helper: Calculate Mean Absolute Error
function calculateMAE(x: number[], y: number[]): number {
  return x.reduce((sum, xi, i) => sum + Math.abs(xi - y[i]), 0) / x.length;
}

// Task 1: Intensity Scaling Agreement
export function evaluateIntensityScaling(): IntensityScalingResult[] {
  const results: IntensityScalingResult[] = [];
  
  // Evaluate taste attributes
  tastAttributes.forEach(attr => {
    const instrumental = samples.map(s => s.instrumental[attr as keyof typeof s.instrumental] as number);
    const semiTrained = samples.map(s => s.semiTrained[attr as keyof typeof s.semiTrained] as number);
    
    const correlation = calculateCorrelation(instrumental, semiTrained);
    const mae = calculateMAE(instrumental, semiTrained);
    
    let status: TaskStatus = 'PASS';
    if (mae > 0.4) status = 'FAIL';
    else if (mae > 0.3) status = 'BORDERLINE';
    
    results.push({
      attribute: attr.charAt(0).toUpperCase() + attr.slice(1),
      correlation,
      mae,
      status,
      scatterData: samples.map((s, i) => ({
        instrumental: instrumental[i],
        semiTrained: semiTrained[i],
        sampleName: s.sampleName,
        key: `${attr}-${s.id}`, // Add unique key
      })),
    });
  });
  
  // Evaluate aroma attributes
  aromaAttributes.forEach(attr => {
    const instrumental = samples.map(s => s.instrumental[attr.instrumental as keyof typeof s.instrumental] as number);
    const semiTrained = samples.map(s => s.semiTrained[attr.semiTrained as keyof typeof s.semiTrained] as number);
    
    const correlation = calculateCorrelation(instrumental, semiTrained);
    const mae = calculateMAE(instrumental, semiTrained);
    
    let status: TaskStatus = 'PASS';
    if (mae > 0.4) status = 'FAIL';
    else if (mae > 0.3) status = 'BORDERLINE';
    
    results.push({
      attribute: attr.name,
      correlation,
      mae,
      status,
      scatterData: samples.map((s, i) => ({
        instrumental: instrumental[i],
        semiTrained: semiTrained[i],
        sampleName: s.sampleName,
        key: `${attr.name}-${s.id}`, // Add unique key
      })),
    });
  });
  
  return results;
}

// Task 2: Rank Ordering Accuracy
export function evaluateRankOrdering(): RankOrderingResult[] {
  const results: RankOrderingResult[] = [];
  
  // Helper: Get pairwise rank agreement
  function getPairwiseAgreement(instrumental: number[], semiTrained: number[]): { correct: number; total: number } {
    let correct = 0;
    let total = 0;
    
    for (let i = 0; i < instrumental.length; i++) {
      for (let j = i + 1; j < instrumental.length; j++) {
        total++;
        const instRank = instrumental[i] > instrumental[j] ? 1 : instrumental[i] < instrumental[j] ? -1 : 0;
        const semiRank = semiTrained[i] > semiTrained[j] ? 1 : semiTrained[i] < semiTrained[j] ? -1 : 0;
        
        if (instRank === semiRank) correct++;
      }
    }
    
    return { correct, total };
  }
  
  // Evaluate taste attributes
  tastAttributes.forEach(attr => {
    const instrumental = samples.map(s => s.instrumental[attr as keyof typeof s.instrumental] as number);
    const semiTrained = samples.map(s => s.semiTrained[attr as keyof typeof s.semiTrained] as number);
    
    const { correct, total } = getPairwiseAgreement(instrumental, semiTrained);
    const percentCorrect = (correct / total) * 100;
    
    let status: TaskStatus = 'PASS';
    if (percentCorrect < 70) status = 'FAIL';
    else if (percentCorrect < 80) status = 'BORDERLINE';
    
    results.push({
      attribute: attr.charAt(0).toUpperCase() + attr.slice(1),
      correctMatches: correct,
      totalComparisons: total,
      percentCorrect,
      status,
    });
  });
  
  // Evaluate aroma attributes
  aromaAttributes.forEach(attr => {
    const instrumental = samples.map(s => s.instrumental[attr.instrumental as keyof typeof s.instrumental] as number);
    const semiTrained = samples.map(s => s.semiTrained[attr.semiTrained as keyof typeof s.semiTrained] as number);
    
    const { correct, total } = getPairwiseAgreement(instrumental, semiTrained);
    const percentCorrect = (correct / total) * 100;
    
    let status: TaskStatus = 'PASS';
    if (percentCorrect < 70) status = 'FAIL';
    else if (percentCorrect < 80) status = 'BORDERLINE';
    
    results.push({
      attribute: attr.name,
      correctMatches: correct,
      totalComparisons: total,
      percentCorrect,
      status,
    });
  });
  
  return results;
}

// Task 3: Off-Note Detection
export function evaluateOffNoteDetection(): OffNoteDetectionResult {
  const detections = samples.map(sample => {
    const instrumentalLevel = sample.instrumental.shortChainFA;
    const semiTrainedDetected = sample.semiTrained.offNoteDetected;
    
    // Instrument should flag if shortChainFA > 2.5
    const instrumentalShouldFlag = instrumentalLevel > 2.5;
    
    // Agreement: both detect or both don't detect
    const agreement = (instrumentalShouldFlag && semiTrainedDetected) || (!instrumentalShouldFlag && !semiTrainedDetected);
    
    return {
      sampleId: sample.id,
      sampleName: sample.sampleName,
      instrumentalLevel,
      semiTrainedDetected,
      agreement,
    };
  });
  
  // Count missed detections (semi-trained flagged but instrumental didn't predict high enough)
  const falseNegatives: string[] = [];
  let missedDetections = 0;
  
  detections.forEach(d => {
    if (d.semiTrainedDetected && d.instrumentalLevel <= 2.5) {
      missedDetections++;
      falseNegatives.push(`${d.sampleName}: Semi-trained detected off-note but instrumental level low (${d.instrumentalLevel.toFixed(1)})`);
    }
  });
  
  const status: TaskStatus = missedDetections > 0 ? 'FAIL' : 'PASS';
  
  return {
    status,
    detections,
    missedDetections,
    falseNegatives,
  };
}

// Task 4: Texture Proxy Reliability
export function evaluateTextureProxy(): TextureProxyResult {
  const instrumental = samples.map(s => s.instrumental.firmness);
  const semiTrained = samples.map(s => s.semiTrained.firmness);
  
  const correlation = calculateCorrelation(instrumental, semiTrained);
  const mae = calculateMAE(instrumental, semiTrained);
  
  let status: TaskStatus = 'PASS';
  if (correlation < 0.75 || mae > 0.4) status = 'FAIL';
  else if (correlation < 0.85 || mae > 0.3) status = 'BORDERLINE';
  
  return {
    correlation,
    mae,
    status,
    scatterData: samples.map((s, i) => ({
      instrumental: instrumental[i],
      semiTrained: semiTrained[i],
      sampleName: s.sampleName,
      key: `${textureAttribute}-${s.id}`, // Add unique key
    })),
  };
}

// Escalation Decision Logic (Decision Tree)
export function evaluateEscalation(): EscalationDecision {
  const intensityResults = evaluateIntensityScaling();
  const rankResults = evaluateRankOrdering();
  const offNoteResult = evaluateOffNoteDetection();
  const textureResult = evaluateTextureProxy();
  
  const failedTasks: string[] = [];
  let reason = '';
  let recommendation = '';
  
  // Decision tree logic
  
  // 1. If Off-Note FAIL → Escalate
  if (offNoteResult.status === 'FAIL') {
    failedTasks.push('Off-Note Detection');
    reason = 'Off-note detection failure: Semi-trained panel detected off-notes that instrumental data did not predict.';
    recommendation = 'Conduct full trained panel with focus on rancid/off-note characterization. Current instrumental model insufficient for off-note screening.';
    return { escalationRequired: true, reason, failedTasks, recommendation };
  }
  
  // 2. If Intensity Scaling FAIL on ≥2 key attributes → Escalate
  const keyAttributes = ['Sourness', 'Umami', 'Cheesy Aroma', 'Rancid Note'];
  const intensityFailures = intensityResults.filter(r => r.status === 'FAIL' && keyAttributes.includes(r.attribute));
  
  if (intensityFailures.length >= 2) {
    failedTasks.push('Intensity Scaling');
    reason = `Intensity scaling failure on ${intensityFailures.length} key attributes: ${intensityFailures.map(r => r.attribute).join(', ')}.`;
    recommendation = 'Full trained panel required. Instrumental predictions show insufficient accuracy for intensity estimation on critical attributes.';
    return { escalationRequired: true, reason, failedTasks, recommendation };
  }
  
  // 3. If Rank Accuracy < 70% on any attribute → Escalate
  const rankFailures = rankResults.filter(r => r.status === 'FAIL');
  
  if (rankFailures.length > 0) {
    failedTasks.push('Rank Ordering');
    reason = `Rank ordering failure on: ${rankFailures.map(r => r.attribute).join(', ')}. Instrumental cannot reliably order samples.`;
    recommendation = 'Full trained panel recommended. Rank ordering is essential for formulation optimization decisions.';
    return { escalationRequired: true, reason, failedTasks, recommendation };
  }
  
  // 4. If texture FAIL → Note but may not escalate alone
  if (textureResult.status === 'FAIL') {
    failedTasks.push('Texture Proxy');
  }
  
  // If we get here, screening is sufficient
  reason = 'All critical screening tasks meet acceptability thresholds. Hybrid screening (instrumental + semi-trained panel) is sufficient for early-stage validation.';
  recommendation = 'Proceed to next formulation iteration. Optional: Conduct focused trained panel validation on final product candidates only.';
  
  return {
    escalationRequired: false,
    reason,
    failedTasks,
    recommendation,
  };
}

// Get overall task summary
export function getTaskSummary() {
  const intensityResults = evaluateIntensityScaling();
  const rankResults = evaluateRankOrdering();
  const offNoteResult = evaluateOffNoteDetection();
  const textureResult = evaluateTextureProxy();
  
  // Aggregate intensity scaling
  const intensityPasses = intensityResults.filter(r => r.status === 'PASS').length;
  const intensityTotal = intensityResults.length;
  const intensityStatus = intensityResults.some(r => r.status === 'FAIL') ? 'FAIL' : 
                          intensityResults.some(r => r.status === 'BORDERLINE') ? 'BORDERLINE' : 'PASS';
  const avgMAE = intensityResults.reduce((sum, r) => sum + r.mae, 0) / intensityTotal;
  
  // Aggregate rank ordering
  const rankPasses = rankResults.filter(r => r.status === 'PASS').length;
  const rankTotal = rankResults.length;
  const rankStatus = rankResults.some(r => r.status === 'FAIL') ? 'FAIL' :
                     rankResults.some(r => r.status === 'BORDERLINE') ? 'BORDERLINE' : 'PASS';
  const avgRankMatch = rankResults.reduce((sum, r) => sum + r.percentCorrect, 0) / rankTotal;
  
  return {
    intensityScaling: {
      status: intensityStatus,
      passes: intensityPasses,
      total: intensityTotal,
      metric: `MAE ${avgMAE.toFixed(2)}`,
    },
    rankOrdering: {
      status: rankStatus,
      passes: rankPasses,
      total: rankTotal,
      metric: `${avgRankMatch.toFixed(0)}% match`,
    },
    offNoteDetection: {
      status: offNoteResult.status,
      metric: offNoteResult.missedDetections === 0 ? 'No misses' : `${offNoteResult.missedDetections} missed`,
    },
    textureProxy: {
      status: textureResult.status,
      metric: `r = ${textureResult.correlation.toFixed(2)}`,
    },
  };
}