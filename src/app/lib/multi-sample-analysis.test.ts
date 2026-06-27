import { describe, expect, it } from 'vitest';
import { analyzeMultiSampleStudy, type MultiSampleSessionLike } from './multi-sample-analysis';

function session(
  id: string,
  differentSample: string,
  ranking: string[],
  liking: Record<string, number>,
  attributes: Record<string, string[]> = {},
): MultiSampleSessionLike {
  return {
    id,
    userId: `panelist-${id}`,
    productId: 'study-1',
    differentSample,
    ranking,
    samples: Object.entries(liking).map(([sampleCode, overall]) => ({
      sampleCode,
      cataAttributes: attributes[sampleCode] ?? [],
      intensityRatings: {},
      hedonicScores: { overall },
      emotionalProfile: {},
    })),
  };
}

describe('analyzeMultiSampleStudy', () => {
  it('returns an empty summary before responses arrive', () => {
    const result = analyzeMultiSampleStudy([], 3);

    expect(result.summary.evidenceTone).toBe('empty');
    expect(result.summary.differenceLeader).toBeNull();
    expect(result.summary.nextAction).toMatch(/Field the study/);
  });

  it('marks evidence as limited below the response threshold', () => {
    const result = analyzeMultiSampleStudy([
      session('1', '341', ['341', '872'], { '341': 7, '872': 6 }),
    ], 3);

    expect(result.summary.evidenceTone).toBe('limited');
    expect(result.summary.evidenceLabel).toContain('1/3');
    expect(result.summary.nextAction).toMatch(/Collect more responses/);
  });

  it('identifies difference consensus without claiming formal accuracy', () => {
    const result = analyzeMultiSampleStudy([
      session('1', '341', ['341', '872', '529'], { '341': 8, '872': 6, '529': 5 }),
      session('2', '341', ['341', '872', '529'], { '341': 7, '872': 6, '529': 5 }),
      session('3', '872', ['341', '872', '529'], { '341': 8, '872': 7, '529': 6 }),
    ], 3);

    expect(result.summary.evidenceTone).toBe('ready');
    expect(result.summary.differenceLeader).toBe('341');
    expect(result.summary.differenceSignal).toContain('most often identified as different');
    expect(result.summary.differenceSignal).not.toMatch(/accur/i);
  });

  it('promotes a preference leader when ranking and liking agree', () => {
    const result = analyzeMultiSampleStudy([
      session('1', '341', ['341', '872', '529'], { '341': 8, '872': 6, '529': 5 }, { '341': ['Creamy'] }),
      session('2', '341', ['341', '872', '529'], { '341': 7, '872': 6, '529': 5 }, { '341': ['Creamy'] }),
      session('3', '872', ['341', '529', '872'], { '341': 8, '872': 7, '529': 6 }, { '341': ['Smooth'] }),
    ], 3);

    expect(result.summary.preferenceAgreement).toBe(true);
    expect(result.summary.preferenceLeader).toBe('341');
    expect(result.summary.likingLeader).toBe('341');
    expect(result.summary.preferenceSignal).toContain('leads both preference ranking and average liking');
    expect(result.summary.driverSignal).toContain('341');
  });

  it('flags a preference conflict when rank and liking leaders differ', () => {
    const result = analyzeMultiSampleStudy([
      session('1', '341', ['341', '872', '529'], { '341': 6, '872': 8, '529': 5 }),
      session('2', '341', ['341', '529', '872'], { '341': 6, '872': 8, '529': 5 }),
      session('3', '529', ['872', '341', '529'], { '341': 6, '872': 8, '529': 5 }),
    ], 3);

    expect(result.summary.preferenceAgreement).toBe(false);
    expect(result.summary.preferenceLeader).toBe('341');
    expect(result.summary.likingLeader).toBe('872');
    expect(result.summary.nextAction).toMatch(/Resolve the preference conflict/);
  });

  it('supports more than three samples in ranking output', () => {
    const result = analyzeMultiSampleStudy([
      session('1', '444', ['111', '222', '333', '444', '555'], { '111': 7, '222': 6, '333': 5, '444': 4, '555': 3 }),
      session('2', '444', ['222', '111', '333', '444', '555'], { '111': 6, '222': 7, '333': 5, '444': 4, '555': 3 }),
      session('3', '555', ['111', '333', '222', '444', '555'], { '111': 7, '222': 6, '333': 6, '444': 4, '555': 3 }),
    ], 3);

    expect(result.sampleCodes).toHaveLength(5);
    expect(result.rankingRows[0].rankCounts).toHaveLength(5);
    expect(result.rankingRows.some(row => row.sampleCode === '555')).toBe(true);
  });
});
