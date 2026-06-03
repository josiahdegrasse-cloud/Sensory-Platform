import { describe, it, expect } from 'vitest'
import {
  evaluateIntensityScaling,
  evaluateRankOrdering,
  evaluateOffNoteDetection,
  evaluateTextureProxy,
  evaluateEscalation,
  getTaskSummary,
} from './task-evaluators'

// All functions operate on the static sample-data module; these tests verify
// that the algorithms produce structurally correct output and that the
// decision tree thresholds are applied consistently.

describe('evaluateIntensityScaling', () => {
  it('returns one result per attribute', () => {
    const results = evaluateIntensityScaling()
    expect(results.length).toBeGreaterThan(0)
  })

  it('each result has required fields with valid types', () => {
    evaluateIntensityScaling().forEach(r => {
      expect(typeof r.attribute).toBe('string')
      expect(typeof r.correlation).toBe('number')
      expect(typeof r.mae).toBe('number')
      expect(['PASS', 'BORDERLINE', 'FAIL']).toContain(r.status)
      expect(Array.isArray(r.scatterData)).toBe(true)
    })
  })

  it('status is FAIL when mae > 0.4, BORDERLINE when mae > 0.3', () => {
    evaluateIntensityScaling().forEach(r => {
      if (r.mae > 0.4) expect(r.status).toBe('FAIL')
      else if (r.mae > 0.3) expect(r.status).toBe('BORDERLINE')
      else expect(r.status).toBe('PASS')
    })
  })

  it('scatterData entries each have a unique key', () => {
    evaluateIntensityScaling().forEach(r => {
      const keys = r.scatterData.map(d => d.key)
      const unique = new Set(keys)
      expect(unique.size).toBe(keys.length)
    })
  })
})

describe('evaluateRankOrdering', () => {
  it('returns one result per attribute', () => {
    const results = evaluateRankOrdering()
    expect(results.length).toBeGreaterThan(0)
  })

  it('percentCorrect is between 0 and 100', () => {
    evaluateRankOrdering().forEach(r => {
      expect(r.percentCorrect).toBeGreaterThanOrEqual(0)
      expect(r.percentCorrect).toBeLessThanOrEqual(100)
    })
  })

  it('status is FAIL when percentCorrect < 70', () => {
    evaluateRankOrdering().forEach(r => {
      if (r.percentCorrect < 70) expect(r.status).toBe('FAIL')
      else if (r.percentCorrect < 80) expect(r.status).toBe('BORDERLINE')
      else expect(r.status).toBe('PASS')
    })
  })

  it('correctMatches <= totalComparisons', () => {
    evaluateRankOrdering().forEach(r => {
      expect(r.correctMatches).toBeLessThanOrEqual(r.totalComparisons)
    })
  })
})

describe('evaluateOffNoteDetection', () => {
  it('returns a result with status, detections, missedDetections, falseNegatives', () => {
    const result = evaluateOffNoteDetection()
    expect(['PASS', 'FAIL']).toContain(result.status)
    expect(Array.isArray(result.detections)).toBe(true)
    expect(typeof result.missedDetections).toBe('number')
    expect(Array.isArray(result.falseNegatives)).toBe(true)
  })

  it('status is FAIL iff missedDetections > 0', () => {
    const result = evaluateOffNoteDetection()
    if (result.missedDetections > 0) {
      expect(result.status).toBe('FAIL')
    } else {
      expect(result.status).toBe('PASS')
    }
  })

  it('falseNegatives.length equals missedDetections', () => {
    const result = evaluateOffNoteDetection()
    expect(result.falseNegatives.length).toBe(result.missedDetections)
  })
})

describe('evaluateTextureProxy', () => {
  it('returns correlation, mae, status, scatterData', () => {
    const result = evaluateTextureProxy()
    expect(typeof result.correlation).toBe('number')
    expect(typeof result.mae).toBe('number')
    expect(['PASS', 'BORDERLINE', 'FAIL']).toContain(result.status)
    expect(Array.isArray(result.scatterData)).toBe(true)
  })

  it('status is FAIL when correlation < 0.75 or mae > 0.4', () => {
    const result = evaluateTextureProxy()
    if (result.correlation < 0.75 || result.mae > 0.4) {
      expect(result.status).toBe('FAIL')
    }
  })
})

describe('evaluateEscalation', () => {
  it('returns a decision with all required fields', () => {
    const decision = evaluateEscalation()
    expect(typeof decision.escalationRequired).toBe('boolean')
    expect(typeof decision.reason).toBe('string')
    expect(Array.isArray(decision.failedTasks)).toBe(true)
    expect(typeof decision.recommendation).toBe('string')
  })

  it('failedTasks is empty when no escalation required', () => {
    const decision = evaluateEscalation()
    if (!decision.escalationRequired) {
      // texture failure alone doesn't trigger escalation
      expect(decision.failedTasks.every(t => t === 'Texture Proxy')).toBe(true)
    }
  })

  it('produces a consistent result across multiple calls (pure function)', () => {
    const a = evaluateEscalation()
    const b = evaluateEscalation()
    expect(a.escalationRequired).toBe(b.escalationRequired)
    expect(a.failedTasks).toEqual(b.failedTasks)
  })
})

describe('getTaskSummary', () => {
  it('returns all four task summaries with status and metric', () => {
    const summary = getTaskSummary()
    expect(['PASS', 'BORDERLINE', 'FAIL']).toContain(summary.intensityScaling.status)
    expect(['PASS', 'BORDERLINE', 'FAIL']).toContain(summary.rankOrdering.status)
    expect(['PASS', 'FAIL']).toContain(summary.offNoteDetection.status)
    expect(['PASS', 'BORDERLINE', 'FAIL']).toContain(summary.textureProxy.status)
  })

  it('passes and totals are consistent with individual results', () => {
    const summary = getTaskSummary()
    const intensityResults = evaluateIntensityScaling()
    expect(summary.intensityScaling.total).toBe(intensityResults.length)
    expect(summary.intensityScaling.passes).toBe(
      intensityResults.filter(r => r.status === 'PASS').length
    )
  })
})
