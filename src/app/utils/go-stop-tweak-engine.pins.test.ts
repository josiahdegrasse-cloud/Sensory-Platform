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
 * NFI-GST-2.1 re-pin (evidence-integrity and category calibration):
 *  • Category-positive aroma identity no longer becomes a defect merely for
 *    exceeding a detection threshold (notably sourdough acidity).
 *  • GC-MS-only risk evidence opens review; measured GC-O severity is required
 *    for an aroma hard STOP. Instrument QC failure places evidence on hold.
 *  • Defaults match workspace policy (STOP <45, GO >=75), and fingerprints
 *    cover the full evidence/configuration snapshot.
 *  • Coverage now pins every curated cheese, bread, meat, and yogurt profile.
 */
const PINNED_DECISIONS = [
  { sampleId: 'S1', foodType: 'cheese', decision: 'TWEAK', issfScore: 71.29, confidence: 90.35, fingerprint: 'BAB4553056A926C0' },
  { sampleId: 'S2', foodType: 'cheese', decision: 'TWEAK', issfScore: 60.32, confidence: 88.4, fingerprint: '037E13C84C7E8368' },
  { sampleId: 'S3', foodType: 'cheese', decision: 'STOP', issfScore: 0, confidence: 67.48, fingerprint: '9DFFED0F7A066A8B' },
  { sampleId: 'S4', foodType: 'cheese', decision: 'GO', issfScore: 85.71, confidence: 93.99, fingerprint: '9EE7AA857C65A5F9' },
  { sampleId: 'S5', foodType: 'cheese', decision: 'GO', issfScore: 78.7, confidence: 92.02, fingerprint: 'CCC2C9AB95F581C9' },
  { sampleId: 'S6', foodType: 'cheese', decision: 'TWEAK', issfScore: 73.73, confidence: 92.04, fingerprint: '94FDCD3CE7BFF92C' },
  { sampleId: 'S7', foodType: 'cheese', decision: 'TWEAK', issfScore: 54.68, confidence: 87.6, fingerprint: '2EEB0DB9701260E9' },
  { sampleId: 'S8', foodType: 'cheese', decision: 'GO', issfScore: 84.38, confidence: 93.34, fingerprint: 'C216D4511892A8FF' },
  { sampleId: 'S9', foodType: 'cheese', decision: 'TWEAK', issfScore: 63.11, confidence: 89.28, fingerprint: '72B61CEBCBA7DB6F' },
  { sampleId: 'S10', foodType: 'cheese', decision: 'TWEAK', issfScore: 69.19, confidence: 90.79, fingerprint: 'CA580A017B1AAFFB' },
  { sampleId: 'S11', foodType: 'cheese', decision: 'TWEAK', issfScore: 56.34, confidence: 87.43, fingerprint: 'A64B995E646C91F0' },
  { sampleId: 'S12', foodType: 'cheese', decision: 'GO', issfScore: 84.86, confidence: 91.12, fingerprint: '5D0FFED7826DE8BB' },
  { sampleId: 'D1', foodType: 'cheese', decision: 'GO', issfScore: 90.18, confidence: 91.77, fingerprint: 'F30C2CFAAB7967FE' },
  { sampleId: 'D2', foodType: 'cheese', decision: 'GO', issfScore: 87.11, confidence: 91.24, fingerprint: '9605945CB3CD0CDA' },
  { sampleId: 'B1', foodType: 'bread', decision: 'GO', issfScore: 83.57, confidence: 89.92, fingerprint: '94BAA20F2F714BE1' },
  { sampleId: 'B2', foodType: 'bread', decision: 'GO', issfScore: 82.95, confidence: 90.15, fingerprint: 'F6DE68EDBACF8BF9' },
  { sampleId: 'B3', foodType: 'bread', decision: 'TWEAK', issfScore: 72.41, confidence: 91.31, fingerprint: '59DB6BF3B45F2FED' },
  { sampleId: 'B4', foodType: 'bread', decision: 'TWEAK', issfScore: 64.7, confidence: 84.58, fingerprint: '3CA3797BAE7569A1' },
  { sampleId: 'B5', foodType: 'bread', decision: 'GO', issfScore: 93.82, confidence: 91.2, fingerprint: '69E6890680476E86' },
  { sampleId: 'B6', foodType: 'bread', decision: 'GO', issfScore: 80.64, confidence: 90.44, fingerprint: '62D29F3E6D389BCA' },
  { sampleId: 'B7', foodType: 'bread', decision: 'TWEAK', issfScore: 64.08, confidence: 88.69, fingerprint: 'FF66C37F2A6D69F7' },
  { sampleId: 'B8', foodType: 'bread', decision: 'TWEAK', issfScore: 59.05, confidence: 85.73, fingerprint: '4AD1445F8A5E93F9' },
  { sampleId: 'B9', foodType: 'bread', decision: 'GO', issfScore: 87.53, confidence: 90.39, fingerprint: '4B6D0AD97D990117' },
  { sampleId: 'B10', foodType: 'bread', decision: 'GO', issfScore: 81.21, confidence: 88.27, fingerprint: '0B07418C76CA14B4' },
  { sampleId: 'B11', foodType: 'bread', decision: 'GO', issfScore: 87.92, confidence: 89.11, fingerprint: '93672AE094B3C760' },
  { sampleId: 'B12', foodType: 'bread', decision: 'GO', issfScore: 90.82, confidence: 90.22, fingerprint: 'E9FACA8376499E83' },
  { sampleId: 'M1', foodType: 'meat', decision: 'TWEAK', issfScore: 59.55, confidence: 86.9, fingerprint: '854FE29DE1978B4F' },
  { sampleId: 'M2', foodType: 'meat', decision: 'TWEAK', issfScore: 63.1, confidence: 86.2, fingerprint: '5FFE012C1BF25FB6' },
  { sampleId: 'M3', foodType: 'meat', decision: 'STOP', issfScore: 42.26, confidence: 84.8, fingerprint: 'BDCA6B3A5746049C' },
  { sampleId: 'M4', foodType: 'meat', decision: 'STOP', issfScore: 22.71, confidence: 73.15, fingerprint: '8BFEF00660435618' },
  { sampleId: 'M5', foodType: 'meat', decision: 'TWEAK', issfScore: 71.77, confidence: 91.71, fingerprint: 'CC3C1E424564F494' },
  { sampleId: 'M6', foodType: 'meat', decision: 'GO', issfScore: 75.35, confidence: 90.94, fingerprint: '98B80628638EACB2' },
  { sampleId: 'M7', foodType: 'meat', decision: 'TWEAK', issfScore: 58.6, confidence: 91.4, fingerprint: '17237957FA4EA03F' },
  { sampleId: 'M8', foodType: 'meat', decision: 'TWEAK', issfScore: 65.6, confidence: 91.8, fingerprint: '2AC961B3590AC039' },
  { sampleId: 'M9', foodType: 'meat', decision: 'TWEAK', issfScore: 54.96, confidence: 91.58, fingerprint: '4DE538BCC1865CBE' },
  { sampleId: 'M10', foodType: 'meat', decision: 'TWEAK', issfScore: 52.84, confidence: 92.01, fingerprint: '8183FA0EAF2F997C' },
  { sampleId: 'M11', foodType: 'meat', decision: 'TWEAK', issfScore: 71.97, confidence: 87.11, fingerprint: 'D6D4AA515C215695' },
  { sampleId: 'M12', foodType: 'meat', decision: 'TWEAK', issfScore: 48.6, confidence: 84.48, fingerprint: '17E846D98430DAD7' },
  { sampleId: 'YG-001', foodType: 'yogurt', decision: 'GO', issfScore: 87.1, confidence: 89.59, fingerprint: '6C7095F72A4FEB89' },
  { sampleId: 'YG-002', foodType: 'yogurt', decision: 'GO', issfScore: 85.88, confidence: 90.68, fingerprint: 'F20C5AB1294E1567' },
  { sampleId: 'YG-003', foodType: 'yogurt', decision: 'STOP', issfScore: 40.18, confidence: 85.8, fingerprint: '3FC9DD06B05B82A4' },
  { sampleId: 'YG-004', foodType: 'yogurt', decision: 'GO', issfScore: 86.28, confidence: 91.46, fingerprint: '835C8E67FE507AD9' },
  { sampleId: 'YG-005', foodType: 'yogurt', decision: 'TWEAK', issfScore: 65.44, confidence: 91.39, fingerprint: '64612AB947BD3233' },
  { sampleId: 'YG-006', foodType: 'yogurt', decision: 'TWEAK', issfScore: 54.63, confidence: 89.45, fingerprint: 'BBEAEC63579FC7E7' },
  { sampleId: 'YG-007', foodType: 'yogurt', decision: 'TWEAK', issfScore: 61.48, confidence: 87.42, fingerprint: '54FB3F052058CE51' },
  { sampleId: 'YG-008', foodType: 'yogurt', decision: 'GO', issfScore: 83.23, confidence: 89.52, fingerprint: '612F566F93C1FC97' },
] as const;

describe('GO / STOP / TWEAK engine — pinned outputs (NFI-GST-2.1)', () => {
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
      expect(result.methodVersion).toBe('NFI-GST-2.1');
    },
  );
});
