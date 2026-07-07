// Pure helpers for the "concept image credits" display: an abstraction over
// the monthly image-generation budget so admins see a usage bar (like a
// credits meter) instead of a running dollar total. The real dollar budget
// still lives in Settings for whoever configures it — this is only the
// operational, generation-time view.

export type CreditsTone = 'ok' | 'warn' | 'critical';

/** Tone thresholds mirror the server's own soft/hard budget behavior. */
export function creditsTone(fraction: number): CreditsTone {
  if (fraction >= 0.9) return 'critical';
  if (fraction >= 0.7) return 'warn';
  return 'ok';
}

/** ISO start (UTC midnight) of the month after `from`. */
export function nextMonthStartIso(from: Date = new Date()): string {
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  return next.toISOString();
}

/** Whole days remaining until `resetsAtIso`, floored at 0. */
export function daysUntilReset(resetsAtIso: string, from: Date = new Date()): number {
  const diffMs = new Date(resetsAtIso).getTime() - from.getTime();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}
