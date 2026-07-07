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

/*
 * NFI-GST-2.0 re-pin (deliberate re-calibration):
 *  • Texture is scored over measured cues only (the 1.1 zero-fill
 *    "completeness penalty" moved into confidence as descriptor coverage),
 *    so texture-deflated reference samples rose: S5/S8/S12/B2/B5/B6/B9/B10/B12
 *    moved TWEAK → GO, and threshold-STOPs S11/B7 moved STOP → TWEAK.
 *  • Every hard STOP (hedonic floor / failed gate) held: S3, S7, B1, B4, B8.
 *  • Confidence now includes a texture-coverage term (weight 10).
 */
const PINNED_DECISIONS = [
  { sampleId: 'S1', foodType: 'cheese', decision: 'TWEAK', issfScore: 71.29, confidence: 90.35, fingerprint: '16843A6B' },
  { sampleId: 'S2', foodType: 'cheese', decision: 'TWEAK', issfScore: 60.32, confidence: 88.4, fingerprint: '7EC67B10' },
  { sampleId: 'S3', foodType: 'cheese', decision: 'STOP', issfScore: 0.0, confidence: 67.48, fingerprint: 'BF3D3BD1' },
  { sampleId: 'S4', foodType: 'cheese', decision: 'GO', issfScore: 85.71, confidence: 93.99, fingerprint: '6AEB0667' },
  { sampleId: 'S5', foodType: 'cheese', decision: 'GO', issfScore: 78.7, confidence: 92.02, fingerprint: 'D5DFF588' },
  { sampleId: 'S6', foodType: 'cheese', decision: 'TWEAK', issfScore: 73.73, confidence: 92.04, fingerprint: '50585B2D' },
  { sampleId: 'S7', foodType: 'cheese', decision: 'STOP', issfScore: 45.68, confidence: 80.18, fingerprint: 'DA979593' },
  { sampleId: 'S8', foodType: 'cheese', decision: 'GO', issfScore: 84.38, confidence: 93.34, fingerprint: '8F2A34B6' },
  { sampleId: 'S9', foodType: 'cheese', decision: 'TWEAK', issfScore: 63.11, confidence: 89.28, fingerprint: '101096F1' },
  { sampleId: 'S10', foodType: 'cheese', decision: 'TWEAK', issfScore: 69.19, confidence: 90.79, fingerprint: '792E40C3' },
  { sampleId: 'S11', foodType: 'cheese', decision: 'TWEAK', issfScore: 56.34, confidence: 87.43, fingerprint: 'D0E83189' },
  { sampleId: 'S12', foodType: 'cheese', decision: 'GO', issfScore: 84.86, confidence: 91.12, fingerprint: '31072A49' },
  { sampleId: 'D1', foodType: 'cheese', decision: 'GO', issfScore: 90.18, confidence: 91.77, fingerprint: 'B9FBA560' },
  { sampleId: 'D2', foodType: 'cheese', decision: 'GO', issfScore: 87.11, confidence: 91.24, fingerprint: '36D23F60' },
  { sampleId: 'B1', foodType: 'bread', decision: 'STOP', issfScore: 54.0, confidence: 67.4, fingerprint: '36E436F2' },
  { sampleId: 'B2', foodType: 'bread', decision: 'GO', issfScore: 82.95, confidence: 90.15, fingerprint: '3FBB907B' },
  { sampleId: 'B3', foodType: 'bread', decision: 'TWEAK', issfScore: 72.41, confidence: 91.31, fingerprint: 'F4955420' },
  { sampleId: 'B4', foodType: 'bread', decision: 'STOP', issfScore: 42.7, confidence: 65.78, fingerprint: '2FE07B4A' },
  { sampleId: 'B5', foodType: 'bread', decision: 'GO', issfScore: 93.82, confidence: 91.2, fingerprint: 'DE0734BC' },
  { sampleId: 'B6', foodType: 'bread', decision: 'GO', issfScore: 80.64, confidence: 90.44, fingerprint: '634E0F5E' },
  { sampleId: 'B7', foodType: 'bread', decision: 'TWEAK', issfScore: 64.08, confidence: 88.69, fingerprint: '05F1BD03' },
  { sampleId: 'B8', foodType: 'bread', decision: 'STOP', issfScore: 37.05, confidence: 66.93, fingerprint: '7FFEC20F' },
  { sampleId: 'B9', foodType: 'bread', decision: 'GO', issfScore: 87.53, confidence: 90.39, fingerprint: 'F0BCF123' },
  { sampleId: 'B10', foodType: 'bread', decision: 'GO', issfScore: 81.21, confidence: 88.27, fingerprint: 'C935B4BF' },
  { sampleId: 'B11', foodType: 'bread', decision: 'TWEAK', issfScore: 78.92, confidence: 81.69, fingerprint: '178192CA' },
  { sampleId: 'B12', foodType: 'bread', decision: 'GO', issfScore: 90.82, confidence: 90.22, fingerprint: '7E077D21' },
] as const;

describe('GO / STOP / TWEAK engine — pinned outputs (NFI-GST-2.0)', () => {
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
      expect(result.methodVersion).toBe('NFI-GST-2.0');
    },
  );
});
