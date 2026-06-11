/**
 * Design tokens for chart props and inline styles.
 *
 * Tailwind classes cover styled DOM, but recharts fills/strokes and dynamic
 * inline styles need JS color values. Import from here instead of writing
 * hex literals so the palette stays consistent (and themeable) app-wide.
 * Values mirror the Tailwind palette already used across the app.
 */

/** GO / TWEAK / STOP decision + generic status colors. */
export const STATUS = {
  go: '#10b981',        // emerald-500
  goDark: '#059669',    // emerald-600
  tweak: '#f59e0b',     // amber-500
  tweakDark: '#d97706', // amber-600
  stop: '#ef4444',      // red-500
  stopDark: '#e11d48',  // rose-600
  info: '#3b82f6',      // blue-500
  infoDark: '#2563eb',  // blue-600
  selected: '#1d4ed8',  // blue-700 — selection rings/highlights
} as const;

/** Neutral chart chrome: axes, grids, secondary text. */
export const CHART_CHROME = {
  axis: '#475569',      // slate-600
  grid: '#e2e8f0',      // slate-200
  muted: '#94a3b8',     // slate-400
  mutedDark: '#64748b', // slate-500
  surface: '#f1f5f9',   // slate-100
} as const;

/** Categorical series palette for multi-series charts. */
export const CHART_SERIES = [
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#ec4899', // pink-500
  '#ea580c', // orange-600
  '#9333ea', // purple-600
  '#64748b', // slate-500
] as const;

/** Analysis-type accents (single / multi / concept) used on type cards. */
export const ANALYSIS_ACCENT = {
  single: '#2563eb',  // blue-600
  multi: '#7c3aed',   // violet-600
  concept: '#ea580c', // orange-600
} as const;
