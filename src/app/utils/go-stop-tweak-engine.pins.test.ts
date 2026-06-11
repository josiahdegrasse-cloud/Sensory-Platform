import { describe, expect, it } from 'vitest';
import { ENHANCED_SENSORY_DATA } from '../data/enhanced-sensory';
import { calculateGoStopTweakDecision } from './go-stop-tweak-engine';

/**
 * Output-pinning regression suite.
 *
 * The GO/STOP/TWEAK engine is full of calibration constants (weights, gate
 * penalties, thresholds). Any change to those constants silently shifts every
 * decision in the app. This suite pins the exact engine output for the full
 * reference dataset so that a science/calibration change shows up as an
 * explicit test diff and must be made deliberately.
 *
 * If you intentionally re-calibrate the engine: re-generate this table (run
 * the engine over ENHANCED_SENSORY_DATA with the default weights below), and
 * bump METHOD_VERSION in go-stop-tweak-engine.ts so downstream decision
 * fingerprints are distinguishable from the previous method.
 */
const DEFAULT_WEIGHTS = { hedonic: 30, texture: 25, cata: 25, emotional: 15 };

const PINNED_DECISIONS = [
  { sampleId: 'S1', foodType: 'cheese', decision: 'TWEAK', issfScore: 64.39, confidence: 87.91, fingerprint: '075F1826' },
  { sampleId: 'S2', foodType: 'cheese', decision: 'TWEAK', issfScore: 55.22, confidence: 86.74, fingerprint: '8F58A14B' },
  { sampleId: 'S3', foodType: 'cheese', decision: 'STOP', issfScore: 0.0, confidence: 67.28, fingerprint: '126E2811' },
  { sampleId: 'S4', foodType: 'cheese', decision: 'GO', issfScore: 76.7, confidence: 90.78, fingerprint: '699B8585' },
  { sampleId: 'S5', foodType: 'cheese', decision: 'TWEAK', issfScore: 70.41, confidence: 89.0, fingerprint: '10F41E33' },
  { sampleId: 'S6', foodType: 'cheese', decision: 'TWEAK', issfScore: 66.3, confidence: 89.48, fingerprint: '8D1E140D' },
  { sampleId: 'S7', foodType: 'cheese', decision: 'STOP', issfScore: 41.78, confidence: 78.64, fingerprint: 'FAEB3550' },
  { sampleId: 'S8', foodType: 'cheese', decision: 'TWEAK', issfScore: 75.58, confidence: 90.17, fingerprint: '6F7CC292' },
  { sampleId: 'S9', foodType: 'cheese', decision: 'TWEAK', issfScore: 57.22, confidence: 87.28, fingerprint: '0198204B' },
  { sampleId: 'S10', foodType: 'cheese', decision: 'TWEAK', issfScore: 62.45, confidence: 88.48, fingerprint: '918F81C7' },
  { sampleId: 'S11', foodType: 'cheese', decision: 'STOP', issfScore: 51.61, confidence: 85.87, fingerprint: 'EAA2C9CB' },
  { sampleId: 'S12', foodType: 'cheese', decision: 'TWEAK', issfScore: 75.55, confidence: 87.46, fingerprint: '94FED3CA' },
  { sampleId: 'D1', foodType: 'cheese', decision: 'GO', issfScore: 79.76, confidence: 87.57, fingerprint: '4E0EE56F' },
  { sampleId: 'D2', foodType: 'cheese', decision: 'GO', issfScore: 77.0, confidence: 87.16, fingerprint: '44050B80' },
  { sampleId: 'B1', foodType: 'bread', decision: 'STOP', issfScore: 41.96, confidence: 62.94, fingerprint: '338EB333' },
  { sampleId: 'B2', foodType: 'bread', decision: 'TWEAK', issfScore: 64.34, confidence: 87.88, fingerprint: '8549C6BD' },
  { sampleId: 'B3', foodType: 'bread', decision: 'TWEAK', issfScore: 56.32, confidence: 86.25, fingerprint: 'EF92067B' },
  { sampleId: 'B4', foodType: 'bread', decision: 'STOP', issfScore: 26.61, confidence: 58.97, fingerprint: '2ADD2DA5' },
  { sampleId: 'B5', foodType: 'bread', decision: 'TWEAK', issfScore: 72.19, confidence: 85.1, fingerprint: '218F6821' },
  { sampleId: 'B6', foodType: 'bread', decision: 'TWEAK', issfScore: 61.53, confidence: 83.66, fingerprint: '5C44BEDC' },
  { sampleId: 'B7', foodType: 'bread', decision: 'STOP', issfScore: 48.99, confidence: 83.92, fingerprint: '019B1AFD' },
  { sampleId: 'B8', foodType: 'bread', decision: 'STOP', issfScore: 21.96, confidence: 60.78, fingerprint: '7AA33B73' },
  { sampleId: 'B9', foodType: 'bread', decision: 'TWEAK', issfScore: 66.41, confidence: 82.52, fingerprint: 'E85A4963' },
  { sampleId: 'B10', foodType: 'bread', decision: 'TWEAK', issfScore: 62.1, confidence: 81.28, fingerprint: 'F9E6A4BD' },
  { sampleId: 'B11', foodType: 'bread', decision: 'TWEAK', issfScore: 58.8, confidence: 73.79, fingerprint: 'E805DA4B' },
  { sampleId: 'B12', foodType: 'bread', decision: 'TWEAK', issfScore: 69.2, confidence: 86.19, fingerprint: 'EB1FDCFB' },
] as const;

describe('GO / STOP / TWEAK engine — pinned outputs (NFI-GST-1.1)', () => {
  it.each(PINNED_DECISIONS)(
    '$sampleId ($foodType) stays $decision at ISSF $issfScore',
    ({ sampleId, foodType, decision, issfScore, confidence, fingerprint }) => {
      const sample = ENHANCED_SENSORY_DATA.find(item => item.sampleId === sampleId);
      expect(sample, `reference sample ${sampleId} missing`).toBeTruthy();

      const result = calculateGoStopTweakDecision(sample!, DEFAULT_WEIGHTS, foodType);

      expect(result.decision).toBe(decision);
      expect(result.issfScore).toBeCloseTo(issfScore, 2);
      expect(result.confidenceScore).toBeCloseTo(confidence, 2);
      expect(result.decisionFingerprint).toBe(fingerprint);
      expect(result.methodVersion).toBe('NFI-GST-1.1');
    },
  );
});
