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
});
