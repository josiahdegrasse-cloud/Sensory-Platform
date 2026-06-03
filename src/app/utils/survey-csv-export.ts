import { ENHANCED_SENSORY_DATA } from "../data/enhanced-sensory";
import type { LiveAggregation } from "../lib/use-survey-data";

export function sanitizeCsvCell(value: string | number): string {
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) return `'${str}`;
  return str;
}

interface SampleData {
  cata: Record<string, number>;
  intensity: Record<string, number>;
  hedonic: Record<string, number | undefined>;
}

interface ActiveEmotions {
  positive: number;
  negative: number;
}

export function buildSampleCSVRows(
  selectedData: SampleData,
  selectedSample: string,
  usingLiveData: boolean,
  activeEmotions: ActiveEmotions
): string {
  const headers = ['Attribute', 'Value', 'Type', 'Category'];
  const rows: string[] = [headers.join(',')];

  Object.entries(selectedData.cata).forEach(([attr, count]) => {
    rows.push(`${attr},${count},CATA,CheckAllThatApply`);
  });
  Object.entries(selectedData.intensity).forEach(([attr, value]) => {
    rows.push(`${attr},${value},Intensity,${usingLiveData ? 'Scale1to5' : 'Scale0to10'}`);
  });
  Object.entries(selectedData.hedonic).forEach(([attr, value]) => {
    rows.push(`${attr},${value},Hedonic,Scale1to9`);
  });
  rows.push(`Positive,${activeEmotions.positive},Emotion,Balance`);
  rows.push(`Negative,${activeEmotions.negative},Emotion,Balance`);

  return rows.join('\n');
}

export function buildAllDataCSVRows(liveAggregations: LiveAggregation[]): string {
  const headers = ['ProductID', 'ProductName', 'PanelistID', 'RunNumber', 'AttributeType', 'Attribute', 'Value'];
  const rows: string[] = [headers.join(',')];

  liveAggregations.forEach(agg => {
    const name = `"${sanitizeCsvCell(agg.productName)}"`;
    Object.entries(agg.cata).forEach(([attr, count]) =>
      rows.push([agg.productId, name, 'panel', 'latest', 'CATA', sanitizeCsvCell(attr), count].join(','))
    );
    Object.entries(agg.intensity).forEach(([attr, mean]) =>
      rows.push([agg.productId, name, 'panel', 'latest', 'Intensity', sanitizeCsvCell(attr), (mean as number).toFixed(2)].join(','))
    );
    Object.entries(agg.hedonic).forEach(([dim, mean]) =>
      rows.push([agg.productId, name, 'panel', 'latest', 'Hedonic', sanitizeCsvCell(dim), (mean as number).toFixed(2)].join(','))
    );
    rows.push([agg.productId, name, 'panel', 'latest', 'Emotion', 'positive', agg.emotions.positive.toFixed(2)].join(','));
    rows.push([agg.productId, name, 'panel', 'latest', 'Emotion', 'negative', agg.emotions.negative.toFixed(2)].join(','));
  });

  ENHANCED_SENSORY_DATA.forEach(sample => {
    const name = `"${sanitizeCsvCell(sample.sampleName)}"`;
    Object.entries(sample.cata).forEach(([attr, count]) =>
      rows.push([sample.sampleId, name, 'mock', 0, 'CATA', sanitizeCsvCell(attr), count].join(','))
    );
    Object.entries(sample.intensity).forEach(([attr, val]) =>
      rows.push([sample.sampleId, name, 'mock', 0, 'Intensity', sanitizeCsvCell(attr), val].join(','))
    );
    Object.entries(sample.hedonic).forEach(([dim, val]) =>
      rows.push([sample.sampleId, name, 'mock', 0, 'Hedonic', sanitizeCsvCell(dim), val].join(','))
    );
    rows.push([sample.sampleId, name, 'mock', 0, 'Emotion', 'positive', sample.emotions.positive].join(','));
    rows.push([sample.sampleId, name, 'mock', 0, 'Emotion', 'negative', sample.emotions.negative].join(','));
  });

  return rows.join('\n');
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}
