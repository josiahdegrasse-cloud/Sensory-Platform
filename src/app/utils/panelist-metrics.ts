import type { QuestionnaireResponse } from '../data/mock-users';

export type TrainingLevel = 'screened' | 'trained' | 'certified' | 'expert';

export const TRAINING_LEVELS: TrainingLevel[] = ['screened', 'trained', 'certified', 'expert'];

export const TRAINING_LEVEL_LABELS: Record<TrainingLevel, string> = {
  screened: 'Screened',
  trained: 'Trained',
  certified: 'Certified',
  expert: 'Expert',
};

export interface DriftPoint {
  session: number;
  date: string;
  myMean: number;
  panelMean: number;
}

export interface PanelistMetrics {
  userId: string;
  completedCount: number;
  repeatability: number | null;       // Pearson r between run1 & run2 hedonic overall; 0–1
  discriminationFRatio: number | null; // one-way ANOVA F across products; >2 = discriminates well
  meanDeviation: number | null;        // mean |panelist overall - panel mean| across products
  attributeDeviations: Partial<Record<HedonicKey, number>>;
  scaleUsageRange: number | null;      // max – min score (ideal ≥ 5 on 9-pt scale)
  scaleUsageMean: number | null;
  scaleUsageSD: number | null;
  scaleDistribution: number[];         // count per bin [1,2,…,9]
  driftData: DriftPoint[];
  rogueFlag: boolean;
  rogueCount: number;                  // how many hedonic dimensions exceeded 1.5 SD threshold
  calibrationDeviation: number | null; // mean deviation across all hedonic keys vs. reference
}

const HEDONIC_KEYS = ['overall', 'appearance', 'aroma', 'flavor', 'texture'] as const;
export type HedonicKey = typeof HEDONIC_KEYS[number];

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1));
}

function pearsonR(x: number[], y: number[]): number | null {
  if (x.length < 3 || x.length !== y.length) return null;
  const mx = mean(x), my = mean(y);
  const num = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
  const den = Math.sqrt(
    x.reduce((s, xi) => s + (xi - mx) ** 2, 0) *
    y.reduce((s, yi) => s + (yi - my) ** 2, 0),
  );
  return den > 0 ? num / den : null;
}

function buildPanelMeans(
  responses: QuestionnaireResponse[],
  key: HedonicKey,
): Record<string, number> {
  const sums: Record<string, { sum: number; count: number }> = {};
  responses.forEach(r => {
    (sums[r.productId] ??= { sum: 0, count: 0 }).sum += r.hedonicScores[key];
    sums[r.productId].count++;
  });
  const out: Record<string, number> = {};
  for (const [pid, { sum, count }] of Object.entries(sums)) out[pid] = sum / count;
  return out;
}

export function computePanelistMetrics(
  allResponses: QuestionnaireResponse[],
  userId: string,
  calibrationProductIds: Set<string> = new Set(),
  referenceScoresByProduct: Record<string, Partial<Record<HedonicKey, number>>> = {},
): PanelistMetrics {
  // Exclude calibration products from performance metrics
  const nonCalib = allResponses.filter(r => !calibrationProductIds.has(r.productId));
  const mine = nonCalib.filter(r => r.userId === userId);
  const completedCount = mine.length;

  // ── Repeatability: Pearson r between run 1 and run 2 across products ─────────
  const run1: Record<string, number> = {};
  const run2: Record<string, number> = {};
  mine.forEach(r => {
    if (r.runNumber === 1) run1[r.productId] = r.hedonicScores.overall;
    else if (r.runNumber === 2) run2[r.productId] = r.hedonicScores.overall;
  });
  const repPids = Object.keys(run1).filter(pid => pid in run2);
  const repeatability = pearsonR(repPids.map(p => run1[p]), repPids.map(p => run2[p]));

  // ── Discrimination F-ratio: one-way ANOVA across products ────────────────────
  let discriminationFRatio: number | null = null;
  const myByProduct: Record<string, number[]> = {};
  mine.forEach(r => (myByProduct[r.productId] ??= []).push(r.hedonicScores.overall));
  const pids = Object.keys(myByProduct);
  if (pids.length >= 3) {
    const grandMean = mean(mine.map(r => r.hedonicScores.overall));
    const ssBetween = pids.reduce((s, pid) => {
      const pm = mean(myByProduct[pid]);
      return s + myByProduct[pid].length * (pm - grandMean) ** 2;
    }, 0);
    const ssWithin = pids.reduce((s, pid) => {
      const pm = mean(myByProduct[pid]);
      return s + myByProduct[pid].reduce((ss, v) => ss + (v - pm) ** 2, 0);
    }, 0);
    const dfB = pids.length - 1;
    const dfW = mine.length - pids.length;
    if (dfW > 0 && ssWithin > 0) discriminationFRatio = (ssBetween / dfB) / (ssWithin / dfW);
  }

  // ── Per-attribute deviations from panel mean ──────────────────────────────────
  const panelMeanCache: Partial<Record<HedonicKey, Record<string, number>>> = {};
  const attributeDeviations: Partial<Record<HedonicKey, number>> = {};
  let meanDeviation: number | null = null;

  HEDONIC_KEYS.forEach(key => {
    const pm = buildPanelMeans(nonCalib, key);
    panelMeanCache[key] = pm;
    const devs = mine.filter(r => pm[r.productId] !== undefined).map(r => Math.abs(r.hedonicScores[key] - pm[r.productId]));
    if (devs.length >= 3) {
      attributeDeviations[key] = mean(devs);
      if (key === 'overall') meanDeviation = attributeDeviations.overall!;
    }
  });

  // ── Scale usage ───────────────────────────────────────────────────────────────
  const allScores = mine.map(r => r.hedonicScores.overall);
  const scaleDistribution: number[] = Array(9).fill(0);
  allScores.forEach(s => scaleDistribution[Math.min(8, Math.max(0, Math.round(s) - 1))]++);
  const scaleUsageRange = allScores.length >= 3 ? Math.max(...allScores) - Math.min(...allScores) : null;
  const scaleUsageMean = allScores.length >= 3 ? mean(allScores) : null;
  const scaleUsageSD = allScores.length >= 3 ? stdDev(allScores) : null;

  // ── Session drift (grouped by calendar date) ──────────────────────────────────
  const driftData: DriftPoint[] = [];
  const myByDate: Record<string, number[]> = {};
  const allByDate: Record<string, number[]> = {};
  mine.forEach(r => (myByDate[r.timestamp.slice(0, 10)] ??= []).push(r.hedonicScores.overall));
  nonCalib.forEach(r => (allByDate[r.timestamp.slice(0, 10)] ??= []).push(r.hedonicScores.overall));
  Object.keys(myByDate).sort().forEach((date, idx) => {
    driftData.push({
      session: idx + 1,
      date,
      myMean: mean(myByDate[date]),
      panelMean: allByDate[date] ? mean(allByDate[date]) : mean(myByDate[date]),
    });
  });

  // ── Rogue flag: deviation > panel mean + 1.5 SD on ≥ 3 hedonic dimensions ────
  const userIds = [...new Set(nonCalib.map(r => r.userId))];
  let rogueCount = 0;
  HEDONIC_KEYS.forEach(key => {
    const pm = panelMeanCache[key]!;
    const allDevMeans: number[] = [];
    userIds.forEach(uid => {
      const uResps = nonCalib.filter(r => r.userId === uid);
      const devs = uResps.filter(r => pm[r.productId] !== undefined).map(r => Math.abs(r.hedonicScores[key] - pm[r.productId]));
      if (devs.length >= 3) allDevMeans.push(mean(devs));
    });
    if (allDevMeans.length < 2) return;
    const threshold = mean(allDevMeans) + 1.5 * stdDev(allDevMeans);
    const myDev = attributeDeviations[key];
    if (myDev !== undefined && myDev > threshold) rogueCount++;
  });
  const rogueFlag = rogueCount >= 3;

  // ── Calibration deviation from reference scores ───────────────────────────────
  let calibrationDeviation: number | null = null;
  const myCalib = allResponses.filter(r => r.userId === userId && calibrationProductIds.has(r.productId));
  if (myCalib.length > 0) {
    const calibDevs: number[] = [];
    myCalib.forEach(r => {
      const ref = referenceScoresByProduct[r.productId];
      if (!ref) return;
      HEDONIC_KEYS.forEach(key => {
        const refVal = ref[key];
        if (refVal !== undefined) calibDevs.push(Math.abs(r.hedonicScores[key] - refVal));
      });
    });
    if (calibDevs.length > 0) calibrationDeviation = mean(calibDevs);
  }

  return {
    userId, completedCount, repeatability, discriminationFRatio,
    meanDeviation, attributeDeviations, scaleUsageRange, scaleUsageMean,
    scaleUsageSD, scaleDistribution, driftData, rogueFlag, rogueCount,
    calibrationDeviation,
  };
}

export function suggestTrainingTier(metrics: PanelistMetrics): TrainingLevel {
  const { repeatability: r, discriminationFRatio: f, meanDeviation: d, rogueFlag, completedCount } = metrics;
  if (completedCount < 3) return 'screened';
  if (r !== null && r >= 0.85 && f !== null && f >= 3.0 && d !== null && d < 1.0 && !rogueFlag) return 'expert';
  if (r !== null && r >= 0.75 && f !== null && f >= 2.0 && d !== null && d < 1.5 && !rogueFlag) return 'certified';
  if (completedCount >= 5 && (d === null || d < 2.5) && !rogueFlag) return 'trained';
  return 'screened';
}

export function repeatabilityLabel(r: number): string {
  if (r >= 0.85) return 'Excellent';
  if (r >= 0.75) return 'Good';
  if (r >= 0.60) return 'Acceptable';
  return 'Poor';
}

export function fRatioLabel(f: number): string {
  if (f >= 4.0) return 'Excellent';
  if (f >= 2.5) return 'Good';
  if (f >= 1.5) return 'Acceptable';
  return 'Poor';
}

export function deviationLabel(d: number): string {
  if (d < 1.0) return 'Excellent';
  if (d < 1.5) return 'Good';
  if (d < 2.5) return 'Acceptable';
  return 'High';
}
