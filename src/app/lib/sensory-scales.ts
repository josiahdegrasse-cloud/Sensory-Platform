export const INTENSITY_SCALE_MIN = 1;
export const INTENSITY_SCALE_MAX = 9;
export const INTENSITY_SCALE_MIDPOINT = 5;

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
