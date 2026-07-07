import { describe, expect, it } from 'vitest';
import { creditsTone, daysUntilReset, nextMonthStartIso } from './concept-credits';

describe('creditsTone', () => {
  it('is ok below 70% usage', () => {
    expect(creditsTone(0)).toBe('ok');
    expect(creditsTone(0.5)).toBe('ok');
    expect(creditsTone(0.69)).toBe('ok');
  });

  it('is warn from 70% up to 90%', () => {
    expect(creditsTone(0.7)).toBe('warn');
    expect(creditsTone(0.89)).toBe('warn');
  });

  it('is critical at 90% and above, including over-budget', () => {
    expect(creditsTone(0.9)).toBe('critical');
    expect(creditsTone(1)).toBe('critical');
    expect(creditsTone(1.4)).toBe('critical');
  });
});

describe('nextMonthStartIso', () => {
  it('returns UTC midnight on the 1st of the following month', () => {
    const iso = nextMonthStartIso(new Date('2026-03-15T10:00:00Z'));
    expect(iso).toBe('2026-04-01T00:00:00.000Z');
  });

  it('rolls over the year at December', () => {
    const iso = nextMonthStartIso(new Date('2026-12-20T00:00:00Z'));
    expect(iso).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('daysUntilReset', () => {
  it('counts whole days remaining, rounding up', () => {
    const from = new Date('2026-03-30T00:00:00Z');
    const resetsAt = '2026-04-01T00:00:00.000Z';
    expect(daysUntilReset(resetsAt, from)).toBe(2);
  });

  it('never goes negative once the reset instant has passed', () => {
    const from = new Date('2026-04-05T00:00:00Z');
    const resetsAt = '2026-04-01T00:00:00.000Z';
    expect(daysUntilReset(resetsAt, from)).toBe(0);
  });
});
