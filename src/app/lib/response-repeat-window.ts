import type { QuestionnaireResponse } from '../data/survey-domain';

export const RESPONSE_REPEAT_WINDOW_MS = 30 * 60 * 1000;

export interface ResponseRepeatWindow {
  closesAt: number;
  isOpen: boolean;
  remainingMs: number;
}

export function responseRepeatWindow(
  firstResponseAt: string | null | undefined,
  nowMs = Date.now(),
): ResponseRepeatWindow | null {
  if (!firstResponseAt) return null;
  const submittedAt = Date.parse(firstResponseAt);
  if (!Number.isFinite(submittedAt)) {
    return { closesAt: nowMs, isOpen: false, remainingMs: 0 };
  }
  const closesAt = submittedAt + RESPONSE_REPEAT_WINDOW_MS;
  const remainingMs = Math.max(0, closesAt - nowMs);
  return { closesAt, isOpen: nowMs < closesAt, remainingMs };
}

export function firstResponseTimestamp(
  responses: QuestionnaireResponse[],
  productId: string,
): string | null {
  const matching = responses.filter(response => response.productId === productId);
  const runOne = matching.find(response => response.runNumber === 1);
  if (runOne) return runOne.timestamp;
  return matching.reduce<string | null>((earliest, response) => {
    if (!earliest) return response.timestamp;
    return Date.parse(response.timestamp) < Date.parse(earliest) ? response.timestamp : earliest;
  }, null);
}
