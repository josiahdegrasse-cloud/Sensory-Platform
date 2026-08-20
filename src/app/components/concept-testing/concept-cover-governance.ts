export const COVER_QA_FIELDS = [
  { key: 'shapeAccuracy', label: 'Product shape', detail: 'Geometry and form match the tested product.' },
  { key: 'colorAccuracy', label: 'Colour', detail: 'Exterior and interior colour remain truthful.' },
  { key: 'surfaceTexture', label: 'Surface texture', detail: 'Moisture, gloss, crumb and texture are credible.' },
  { key: 'interiorAccuracy', label: 'Interior', detail: 'Cut face or interior is accurate when visible.' },
  { key: 'scaleAccuracy', label: 'Portion and scale', detail: 'Serving size and proportions are believable.' },
  { key: 'servingContext', label: 'Serving context', detail: 'Props and usage occasion do not overpromise.' },
  { key: 'brandAlignment', label: 'Client brand fit', detail: 'Palette and atmosphere fit the active brand kit.' },
  { key: 'coverSafeArea', label: 'Cover safe area', detail: 'Top and left remain clear for report typography.' },
] as const;

export type CoverQaKey = (typeof COVER_QA_FIELDS)[number]['key'];
export type CoverQaScores = Partial<Record<CoverQaKey, number>>;

export const COVER_QA_PASS_SCORE = 4;

export function normalizeCoverQaScore(value: unknown): number {
  const score = Number(value);
  if (!Number.isFinite(score)) return 1;
  return Math.max(1, Math.min(5, Math.round(score)));
}

export function coverQaFailures(scores: CoverQaScores): CoverQaKey[] {
  return COVER_QA_FIELDS
    .map(field => field.key)
    .filter(key => normalizeCoverQaScore(scores[key]) < COVER_QA_PASS_SCORE);
}

export function coverQaReady(scores: CoverQaScores): boolean {
  return coverQaFailures(scores).length === 0;
}
