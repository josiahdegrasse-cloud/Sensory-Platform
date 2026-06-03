export function getSampleColor(sampleName: string): string {
  const n = sampleName.toLowerCase();
  if (n.includes('dairy') || n.includes('control')) return '#dc2626';  // red
  if (n.includes('sourdough') || n.includes('multigrain') || n.includes('sandwich bread') || n.includes('brioche') || n.includes('loaf') || n.includes('bread')) return '#d97706'; // amber-600
  if (n.includes('coconut'))  return '#f59e0b';  // amber
  if (n.includes('cashew'))   return '#3b82f6';  // blue
  if (n.includes('almond'))   return '#8b5cf6';  // purple
  if (n.includes('oat'))      return '#10b981';  // emerald
  if (n.includes('mixed'))    return '#6366f1';  // indigo
  return '#64748b';                              // slate fallback
}

export const SAMPLE_TYPE_LEGEND = [
  { label: 'Dairy Control',  color: '#dc2626' },
  { label: 'Bread',          color: '#d97706' },
  { label: 'Coconut-based',  color: '#f59e0b' },
  { label: 'Cashew-based',   color: '#3b82f6' },
  { label: 'Almond-based',   color: '#8b5cf6' },
  { label: 'Oat-based',      color: '#10b981' },
  { label: 'Mixed base',     color: '#6366f1' },
];
