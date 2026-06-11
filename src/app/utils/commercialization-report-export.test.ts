import { describe, expect, it } from 'vitest';
import { buildCommercializationReportFilename } from './commercialization-report-export';

describe('commercialization report filename', () => {
  it('builds a readable client, product, and decision filename', () => {
    expect(buildCommercializationReportFilename({
      clientName: 'New Food Innovation',
      productName: 'Coconut Cheddar v3.0',
      decision: 'GO',
      generatedAt: '2026-06-11T14:30:00.000Z',
      version: 1,
    })).toBe('new-food-innovation-coconut-cheddar-v3-commercialization-report-go-2026-06-11.pdf');
  });

  it('falls back to the food platform slug when no client name is available', () => {
    expect(buildCommercializationReportFilename({
      productName: 'Coconut Cheddar v3.0',
      decision: 'GO',
      generatedAt: '2026-06-11T14:30:00.000Z',
    })).toBe('food-platform-coconut-cheddar-v3-commercialization-report-go-2026-06-11.pdf');
  });

  it('retains meaningful later report revisions', () => {
    expect(buildCommercializationReportFilename({
      clientName: 'New Food Innovation',
      productName: 'Sample S4',
      decision: 'GO',
      generatedAt: new Date('2026-06-11T00:00:00.000Z'),
      version: 3,
    })).toBe('new-food-innovation-sample-s4-commercialization-report-go-2026-06-11-r3.pdf');
  });
});
