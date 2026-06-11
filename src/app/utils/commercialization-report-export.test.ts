import { describe, expect, it } from 'vitest';
import { buildCommercializationReportFilename } from './commercialization-report-export';

describe('commercialization report filename', () => {
  it('builds a readable client and product filename', () => {
    expect(buildCommercializationReportFilename({
      productName: 'Coconut Cheddar v3.0',
      generatedAt: '2026-06-11T14:30:00.000Z',
      version: 1,
    })).toBe('coconut-cheddar-v3-2026-06-11.pdf');
  });

  it('retains meaningful later report revisions', () => {
    expect(buildCommercializationReportFilename({
      productName: 'Sample S4',
      generatedAt: new Date('2026-06-11T00:00:00.000Z'),
      version: 3,
    })).toBe('sample-s4-2026-06-11-r3.pdf');
  });
});
