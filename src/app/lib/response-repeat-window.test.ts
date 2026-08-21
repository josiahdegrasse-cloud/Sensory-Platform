import { describe, expect, it } from 'vitest';
import type { QuestionnaireResponse } from '../data/survey-domain';
import { firstResponseTimestamp, RESPONSE_REPEAT_WINDOW_MS, responseRepeatWindow } from './response-repeat-window';

const submittedAt = '2026-08-20T10:00:00.000Z';
const submittedAtMs = Date.parse(submittedAt);

describe('responseRepeatWindow', () => {
  it('keeps another run open for exactly 30 minutes after the first submission', () => {
    expect(responseRepeatWindow(submittedAt, submittedAtMs + RESPONSE_REPEAT_WINDOW_MS - 1)).toMatchObject({ isOpen: true });
    expect(responseRepeatWindow(submittedAt, submittedAtMs + RESPONSE_REPEAT_WINDOW_MS)).toMatchObject({ isOpen: false, remainingMs: 0 });
  });

  it('fails closed for an invalid saved timestamp', () => {
    expect(responseRepeatWindow('not-a-date', submittedAtMs)).toMatchObject({ isOpen: false });
  });
});

describe('firstResponseTimestamp', () => {
  const response = (runNumber: number, timestamp: string): QuestionnaireResponse => ({
    id: `response-${runNumber}`,
    userId: 'panelist-1',
    productId: 'product-1',
    timestamp,
    runNumber,
    cataAttributes: [],
    intensityRatings: {},
    hedonicScores: {},
    emotionalProfile: {},
  });

  it('anchors the window to run one even when later runs exist', () => {
    expect(firstResponseTimestamp([
      response(3, '2026-08-20T10:20:00.000Z'),
      response(1, submittedAt),
      response(2, '2026-08-20T10:10:00.000Z'),
    ], 'product-1')).toBe(submittedAt);
  });

  it('falls back to the earliest timestamp for legacy run numbering', () => {
    expect(firstResponseTimestamp([
      response(3, '2026-08-20T10:20:00.000Z'),
      response(2, '2026-08-20T10:10:00.000Z'),
    ], 'product-1')).toBe('2026-08-20T10:10:00.000Z');
  });
});
