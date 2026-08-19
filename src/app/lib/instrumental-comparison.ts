export const MAX_INSTRUMENTAL_COMPARISON_SAMPLES = 5;

export const INSTRUMENTAL_COMPARISON_COLORS = [
  '#2563eb',
  '#d97706',
  '#0f766e',
  '#7c3aed',
  '#db2777',
] as const;

export function normaliseInstrumentalComparisonSelection(
  sampleIds: string[],
  limit = MAX_INSTRUMENTAL_COMPARISON_SAMPLES,
): string[] {
  const safeLimit = Math.max(1, limit);
  return [...new Set(sampleIds.filter(Boolean))].slice(0, safeLimit);
}

export function toggleInstrumentalComparisonSample(
  selectedSampleIds: string[],
  sampleId: string,
  limit = MAX_INSTRUMENTAL_COMPARISON_SAMPLES,
): string[] {
  const selection = normaliseInstrumentalComparisonSelection(selectedSampleIds, limit);
  if (!sampleId) return selection;

  if (selection.includes(sampleId)) {
    return selection.length > 1
      ? selection.filter(selectedId => selectedId !== sampleId)
      : selection;
  }

  if (selection.length >= Math.max(1, limit)) return selection;
  return [...selection, sampleId];
}

export function instrumentalComparisonColor(index: number): string {
  return INSTRUMENTAL_COMPARISON_COLORS[index % INSTRUMENTAL_COMPARISON_COLORS.length];
}
