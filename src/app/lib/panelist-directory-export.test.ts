import { describe, expect, it } from 'vitest';
import type { PanelistInfo } from './db/panelists';
import {
  buildPanelistDirectoryCsv,
  PANELIST_DIRECTORY_EXPORT_HEADERS,
  panelistDirectoryCsvCell,
} from './panelist-directory-export';

const panelist: PanelistInfo = {
  id: 'user-1',
  name: 'Taylor "T" Smith',
  email: '=unsafe@example.com',
  panelistId: 'P-104',
  status: 'active',
  consentAcceptedAt: '2026-01-01T00:00:00.000Z',
  consentVersion: 'v1',
  completedCount: 7,
  trainingLevel: 'screened',
  phone: '07123 456789',
  addressLine1: '12 Private Street',
  addressLine2: null,
  city: 'London',
  region: 'Greater London',
  postalCode: 'SW1A 1AA',
  country: 'United Kingdom',
  profileCompletedAt: '2026-01-02T12:00:00.000Z',
  eligibilityCompletedAt: '2026-01-03T12:00:00.000Z',
  ageYears: 34,
  ageBand: '30–39',
  gender: 'self_describe',
  genderSelfDescription: 'Non-binary, trans',
  nationalityCode: 'GB',
  ethnicity: 'mixed',
  householdSize: 3,
  householdSizePreferNotToSay: false,
  childrenInHousehold: true,
  dietaryPattern: 'vegetarian',
  dietaryOther: null,
  groceryRole: 'main_shopper',
  categoryUsageFrequency: 'weekly',
  smokerStatus: 'non_smoker',
  weeklyFoodSpend: '40_60',
  occupationGroup: 'professional',
  annualIncomeRange: '40_60k',
  declarationConfirmedAt: '2026-01-04T12:00:00.000Z',
  declarationExpiresAt: '2027-01-04T12:00:00.000Z',
  researchProfileUpdatedAt: '2026-01-03T12:00:00.000Z',
  lastActivityAt: '2026-08-18T09:30:00.000Z',
};

describe('panelist directory CSV export', () => {
  it('quotes values and neutralizes spreadsheet formulas', () => {
    expect(panelistDirectoryCsvCell('Taylor "T", Smith')).toBe('"Taylor ""T"", Smith"');
    expect(panelistDirectoryCsvCell('=SUM(1,1)')).toBe('"\'=SUM(1,1)"');
  });

  it('exports operational and research directory fields without hidden contact details', () => {
    const csv = buildPanelistDirectoryCsv([panelist], new Date('2026-08-19T12:00:00.000Z'));
    const [header, row] = csv.split('\r\n');

    expect(header).toBe(PANELIST_DIRECTORY_EXPORT_HEADERS.map(value => `"${value}"`).join(','));
    expect(row).toContain('"P-104"');
    expect(row).toContain('"Taylor ""T"" Smith"');
    expect(row).toContain('"\'=unsafe@example.com"');
    expect(row).toContain('"Ready for matching"');
    expect(row).toContain('"Non-binary, trans"');
    expect(row).toContain('"2026-08-18"');
    expect(csv).not.toContain(panelist.phone!);
    expect(csv).not.toContain(panelist.addressLine1!);
    expect(csv).not.toContain(panelist.id);
  });
});
