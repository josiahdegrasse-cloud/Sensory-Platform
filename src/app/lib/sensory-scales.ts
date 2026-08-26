export const INTENSITY_SCALE_MIN = 1;
export const INTENSITY_SCALE_MAX = 9;
export const INTENSITY_SCALE_MIDPOINT = 5;

export function isAnsweredNinePointScale(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= INTENSITY_SCALE_MIN
    && value <= INTENSITY_SCALE_MAX;
}

/**
 * Keeps only values the panelist actually supplied. An untouched scale must
 * never be converted into a neutral midpoint because that fabricates evidence.
 */
export function answeredNinePointValues(
  keys: readonly string[],
  values: Readonly<Record<string, number | undefined>>,
): Record<string, number> {
  return Object.fromEntries(
    keys.flatMap(key => isAnsweredNinePointScale(values[key]) ? [[key, values[key]]] : []),
  );
}

export function toNinePointIntensity(value: number, sourceScale: 9 | 10) {
  const normalized = sourceScale === 10
    ? INTENSITY_SCALE_MIN + (value / 10) * (INTENSITY_SCALE_MAX - INTENSITY_SCALE_MIN)
    : value;
  return Math.max(INTENSITY_SCALE_MIN, Math.min(INTENSITY_SCALE_MAX, normalized));
}

export function intensityScalePercentage(value: number) {
  const clamped = toNinePointIntensity(value, 9);
  return ((clamped - INTENSITY_SCALE_MIN) / (INTENSITY_SCALE_MAX - INTENSITY_SCALE_MIN)) * 100;
}
