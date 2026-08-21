import { describe, expect, it } from 'vitest';
import {
  CLIENT_REPORT_V2_PAGE_COUNT,
  CLIENT_REPORT_V2_PAGE_HEADINGS,
  CLIENT_REPORT_V2_PAGES,
} from './report-v2';

describe('client report V2 page contract', () => {
  it('keeps the client report fixed, short, and ordered by decision need', () => {
    expect(CLIENT_REPORT_V2_PAGE_COUNT).toBe(8);
    expect(CLIENT_REPORT_V2_PAGES.map(page => page.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(CLIENT_REPORT_V2_PAGE_HEADINGS).toEqual([
      'Client product decision report',
      'Executive recommendation',
      'Product performance',
      'Consumer and concept response',
      'Panel and study profile',
      'Scientific literature and evidence map',
      'Recommended action plan',
      'Evidence and release record',
    ]);
    expect(new Set(CLIENT_REPORT_V2_PAGE_HEADINGS).size).toBe(CLIENT_REPORT_V2_PAGE_COUNT);
  });
});
