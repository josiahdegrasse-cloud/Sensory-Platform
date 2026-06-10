import { describe, expect, it } from 'vitest';
import { ENHANCED_SENSORY_DATA } from '../data/enhanced-sensory';
import { calculateGoStopTweakDecision } from './go-stop-tweak-engine';

const weights = { hedonic: 30, texture: 25, cata: 25, emotional: 15 };

describe('GO / STOP / TWEAK engine', () => {
  it('hard-stops samples with critical aroma gates even if weighted scoring is tempted upward', () => {
    const sample = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'S3');
    expect(sample).toBeTruthy();

    const decision = calculateGoStopTweakDecision(sample!, weights, 'cheese');

    expect(decision.decision).toBe('STOP');
    expect(decision.issfScore).toBeLessThanOrEqual(54);
    expect(decision.gates.find(gate => gate.id === 'off-note')?.status).toBe('fail');
    expect(decision.prescriptions[0]?.target).toBe('Aroma defect control');
  });

  it('allows strong clean samples to advance only when all gates pass', () => {
    const sample = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'S4');
    expect(sample).toBeTruthy();

    const decision = calculateGoStopTweakDecision(sample!, weights, 'cheese');

    expect(decision.decision).toBe('GO');
    expect(decision.gates.every(gate => gate.status === 'pass')).toBe(true);
    expect(decision.confidenceScore).toBeGreaterThanOrEqual(72);
    expect(decision.decisionFingerprint).toMatch(/^[A-F0-9]{8}$/);
  });

  it('returns tweak prescriptions for acceptable but improvable samples', () => {
    const sample = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'S2');
    expect(sample).toBeTruthy();

    const decision = calculateGoStopTweakDecision(sample!, weights, 'cheese');

    expect(decision.decision).toBe('TWEAK');
    expect(decision.prescriptions.length).toBeGreaterThan(0);
    expect(decision.recommendation).toContain('Tweak before advancing');
  });

  it('honors workspace decision thresholds without bypassing hard safety gates', () => {
    const sample = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'S4');
    expect(sample).toBeTruthy();

    const conservative = calculateGoStopTweakDecision(sample!, weights, 'cheese', {
      stop: 45,
      go: 99,
    });
    const standard = calculateGoStopTweakDecision(sample!, weights, 'cheese', {
      stop: 45,
      go: 75,
    });

    expect(conservative.decision).toBe('TWEAK');
    expect(standard.decision).toBe('GO');
  });

  it('scores bread profiles with the bread decision model', () => {
    const sample = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'B1');
    expect(sample).toBeTruthy();

    const decision = calculateGoStopTweakDecision(sample!, weights, 'bread');

    expect(['GO', 'TWEAK', 'STOP']).toContain(decision.decision);
    expect(decision.issfScore).toBeGreaterThan(0);
    expect(decision.details.some(detail => detail.includes('Instrument signal'))).toBe(true);
  });
});

describe('GO / STOP / TWEAK engine — invariants', () => {
  const sample = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'S4')!;

  it('is deterministic: identical inputs yield an identical decision and fingerprint', () => {
    const a = calculateGoStopTweakDecision(sample, weights, 'cheese');
    const b = calculateGoStopTweakDecision(sample, weights, 'cheese');
    expect(a).toEqual(b);
    expect(a.decisionFingerprint).toBe(b.decisionFingerprint);
  });

  it('falls back to default weights when every weight is zero (no divide-by-zero)', () => {
    const zeroed = calculateGoStopTweakDecision(sample, { hedonic: 0, texture: 0, cata: 0, emotional: 0 }, 'cheese');
    const defaulted = calculateGoStopTweakDecision(sample, { hedonic: 30, texture: 25, cata: 25, emotional: 15 }, 'cheese');
    expect(Number.isFinite(zeroed.issfScore)).toBe(true);
    expect(zeroed.issfScore).toBe(defaulted.issfScore);
    expect(zeroed.decision).toBe(defaulted.decision);
  });

  it('keeps the GO threshold above the STOP threshold even when callers invert them', () => {
    const inverted = calculateGoStopTweakDecision(sample, weights, 'cheese', { go: 10, stop: 90 });
    expect(['GO', 'TWEAK', 'STOP']).toContain(inverted.decision);
    // A near-impossible STOP floor of 90 must not let a borderline sample pass as GO.
    expect(inverted.decision).not.toBe('GO');
  });

  it('clamps the ISSF score to [0, 100] and caps prescriptions at 3 for every sample', () => {
    for (const item of ENHANCED_SENSORY_DATA) {
      const decision = calculateGoStopTweakDecision(item, weights, 'cheese');
      expect(decision.issfScore).toBeGreaterThanOrEqual(0);
      expect(decision.issfScore).toBeLessThanOrEqual(100);
      expect(decision.confidenceScore).toBeGreaterThanOrEqual(35);
      expect(decision.confidenceScore).toBeLessThanOrEqual(98);
      expect(decision.prescriptions.length).toBeLessThanOrEqual(3);
      // Prescriptions are ordered by descending expected lift, priorities renumbered 1..n.
      const lifts = decision.prescriptions.map(p => p.expectedLift);
      expect([...lifts].sort((a, b) => b - a)).toEqual(lifts);
      decision.prescriptions.forEach((p, index) => expect(p.priority).toBe(index + 1));
    }
  });

  it('hard-stops on a quality-floor breach even without a failed gate', () => {
    // overall hedonic below 3.8 is a hard stop regardless of weighted scoring.
    const floored = { ...sample, hedonic: { ...sample.hedonic, overall: 2 } };
    const decision = calculateGoStopTweakDecision(floored, weights, 'cheese');
    expect(decision.decision).toBe('STOP');
    expect(decision.issfScore).toBeLessThanOrEqual(54);
  });
});
