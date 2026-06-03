import { describe, it, expect } from 'vitest'
import {
  computePanelistMetrics,
  suggestTrainingTier,
  repeatabilityLabel,
  fRatioLabel,
  deviationLabel,
} from './panelist-metrics'
import type { QuestionnaireResponse } from '../data/mock-users'

function makeResponse(overrides: Partial<QuestionnaireResponse> = {}): QuestionnaireResponse {
  return {
    id: 'r1',
    userId: 'u1',
    productId: 'p1',
    timestamp: '2024-01-01T00:00:00Z',
    runNumber: 1,
    cataAttributes: [],
    intensityRatings: {},
    hedonicScores: { overall: 5, appearance: 5, aroma: 5, flavor: 5, texture: 5 },
    emotionalProfile: {},
    ...overrides,
  }
}

// ─── computePanelistMetrics ───────────────────────────────────────────────────

describe('computePanelistMetrics', () => {
  it('returns null metrics for a panelist with no responses', () => {
    const metrics = computePanelistMetrics([], 'u1')
    expect(metrics.completedCount).toBe(0)
    expect(metrics.repeatability).toBeNull()
    expect(metrics.discriminationFRatio).toBeNull()
    expect(metrics.meanDeviation).toBeNull()
    expect(metrics.rogueFlag).toBe(false)
  })

  it('counts only this panelist\'s responses', () => {
    const all = [
      makeResponse({ userId: 'u1', productId: 'p1' }),
      makeResponse({ userId: 'u1', productId: 'p2' }),
      makeResponse({ userId: 'u2', productId: 'p1' }),
    ]
    const metrics = computePanelistMetrics(all, 'u1')
    expect(metrics.completedCount).toBe(2)
  })

  it('computes repeatability when run1 and run2 exist for ≥3 products', () => {
    const all = ['p1', 'p2', 'p3'].flatMap(pid => [
      makeResponse({ userId: 'u1', productId: pid, runNumber: 1, hedonicScores: { overall: 7, appearance: 6, aroma: 6, flavor: 7, texture: 6 } }),
      makeResponse({ userId: 'u1', productId: pid, runNumber: 2, hedonicScores: { overall: 7, appearance: 6, aroma: 6, flavor: 7, texture: 6 } }),
    ])
    const metrics = computePanelistMetrics(all, 'u1')
    // Perfect repeatability: run1 === run2 for every product → Pearson r = 1 (or null if zero variance)
    // Identical values → denominator = 0 → pearsonR returns null
    expect(metrics.repeatability === null || metrics.repeatability === 1).toBe(true)
  })

  it('computes F-ratio when panelist has ≥3 products with ≥2 runs each', () => {
    // F-ratio requires within-group variance (multiple runs per product).
    // With only 1 run per product ssWithin=0 and the ratio is undefined.
    const all = [
      // u1: run1 and run2 for three products with very different group means
      makeResponse({ userId: 'u1', productId: 'p1', runNumber: 1, hedonicScores: { overall: 2, appearance: 2, aroma: 2, flavor: 2, texture: 2 } }),
      makeResponse({ userId: 'u1', productId: 'p1', runNumber: 2, hedonicScores: { overall: 3, appearance: 3, aroma: 3, flavor: 3, texture: 3 } }),
      makeResponse({ userId: 'u1', productId: 'p2', runNumber: 1, hedonicScores: { overall: 5, appearance: 5, aroma: 5, flavor: 5, texture: 5 } }),
      makeResponse({ userId: 'u1', productId: 'p2', runNumber: 2, hedonicScores: { overall: 6, appearance: 6, aroma: 6, flavor: 6, texture: 6 } }),
      makeResponse({ userId: 'u1', productId: 'p3', runNumber: 1, hedonicScores: { overall: 8, appearance: 8, aroma: 8, flavor: 8, texture: 8 } }),
      makeResponse({ userId: 'u1', productId: 'p3', runNumber: 2, hedonicScores: { overall: 9, appearance: 9, aroma: 9, flavor: 9, texture: 9 } }),
    ]
    const metrics = computePanelistMetrics(all, 'u1')
    // Between-group variance (3→5.5→8.5) is large relative to within-group → high F
    expect(metrics.discriminationFRatio).not.toBeNull()
    expect(metrics.discriminationFRatio!).toBeGreaterThan(1)
  })

  it('excludes calibration products from performance metrics', () => {
    const calibId = 'calib1'
    const all = [
      makeResponse({ userId: 'u1', productId: calibId }),
      makeResponse({ userId: 'u1', productId: 'p1' }),
    ]
    const withCalib = computePanelistMetrics(all, 'u1', new Set([calibId]))
    const withoutCalib = computePanelistMetrics(all, 'u1')
    // calibration product excluded → fewer responses counted
    expect(withCalib.completedCount).toBe(1)
    expect(withoutCalib.completedCount).toBe(2)
  })

  it('computes calibration deviation when reference scores provided', () => {
    const calibId = 'calib1'
    const all = [
      makeResponse({
        userId: 'u1',
        productId: calibId,
        hedonicScores: { overall: 7, appearance: 7, aroma: 7, flavor: 7, texture: 7 },
      }),
    ]
    const ref = { [calibId]: { overall: 5, appearance: 5, aroma: 5, flavor: 5, texture: 5 } }
    const metrics = computePanelistMetrics(all, 'u1', new Set([calibId]), ref)
    expect(metrics.calibrationDeviation).not.toBeNull()
    expect(metrics.calibrationDeviation).toBe(2) // |7 - 5| = 2 for every key
  })

  it('builds a scale distribution across 9 bins', () => {
    const all = [1, 3, 5, 7, 9].map((score, i) =>
      makeResponse({ userId: 'u1', productId: `p${i}`, hedonicScores: { overall: score, appearance: score, aroma: score, flavor: score, texture: score } })
    )
    const metrics = computePanelistMetrics(all, 'u1')
    expect(metrics.scaleDistribution).toHaveLength(9)
    expect(metrics.scaleDistribution.reduce((a, b) => a + b, 0)).toBe(5)
  })
})

// ─── suggestTrainingTier ──────────────────────────────────────────────────────

describe('suggestTrainingTier', () => {
  const baseMetrics = {
    userId: 'u1',
    completedCount: 10,
    repeatability: 0.9,
    discriminationFRatio: 3.5,
    meanDeviation: 0.8,
    attributeDeviations: {},
    scaleUsageRange: 6,
    scaleUsageMean: 5,
    scaleUsageSD: 1.5,
    scaleDistribution: [],
    driftData: [],
    rogueFlag: false,
    rogueCount: 0,
    calibrationDeviation: null,
  }

  it('returns screened when completedCount < 3', () => {
    expect(suggestTrainingTier({ ...baseMetrics, completedCount: 2 })).toBe('screened')
  })

  it('returns expert for excellent metrics', () => {
    expect(suggestTrainingTier(baseMetrics)).toBe('expert')
  })

  it('returns certified for good but not excellent metrics', () => {
    expect(suggestTrainingTier({ ...baseMetrics, repeatability: 0.80, discriminationFRatio: 2.5, meanDeviation: 1.2 })).toBe('certified')
  })

  it('returns trained for acceptable metrics with no rogue flag', () => {
    expect(suggestTrainingTier({ ...baseMetrics, repeatability: null, discriminationFRatio: null, meanDeviation: 2.0, completedCount: 6 })).toBe('trained')
  })

  it('returns screened when rogue flag set', () => {
    expect(suggestTrainingTier({ ...baseMetrics, rogueFlag: true })).toBe('screened')
  })
})

// ─── label helpers ────────────────────────────────────────────────────────────

describe('repeatabilityLabel', () => {
  it.each([
    [0.90, 'Excellent'],
    [0.85, 'Excellent'],
    [0.80, 'Good'],
    [0.75, 'Good'],
    [0.70, 'Acceptable'],
    [0.60, 'Acceptable'],
    [0.55, 'Poor'],
  ])('r=%f → %s', (r, expected) => {
    expect(repeatabilityLabel(r)).toBe(expected)
  })
})

describe('fRatioLabel', () => {
  it.each([
    [4.5, 'Excellent'],
    [4.0, 'Excellent'],
    [3.0, 'Good'],
    [2.5, 'Good'],
    [2.0, 'Acceptable'],
    [1.5, 'Acceptable'],
    [1.0, 'Poor'],
  ])('f=%f → %s', (f, expected) => {
    expect(fRatioLabel(f)).toBe(expected)
  })
})

describe('deviationLabel', () => {
  it.each([
    [0.5, 'Excellent'],
    [1.0, 'Good'],   // boundary: < 1.0 is Excellent, exactly 1.0 is Good
    [1.4, 'Good'],
    [1.5, 'Acceptable'],
    [2.4, 'Acceptable'],
    [2.5, 'High'],
    [3.0, 'High'],
  ])('d=%f → %s', (d, expected) => {
    expect(deviationLabel(d)).toBe(expected)
  })
})
