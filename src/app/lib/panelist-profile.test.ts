import { describe, expect, it } from 'vitest';
import type { PanelistInfo } from './database';
import { panelistDeliveryReady, panelistReadiness, panelistValueLabel } from './panelist-profile';

const readyPanelist: PanelistInfo = {
  id: 'panelist-1',
  name: 'Avery',
  email: 'avery@example.com',
  panelistId: 'NFI-001',
  status: 'active',
  consentAcceptedAt: '2026-01-01T00:00:00Z',
  consentVersion: 'v1',
  completedCount: 4,
  trainingLevel: 'screened',
  phone: '+44 7700 900123',
  addressLine1: '12 Market Street',
  addressLine2: null,
  city: 'Leeds',
  region: 'West Yorkshire',
  postalCode: 'LS1 1AA',
  country: 'United Kingdom',
  profileCompletedAt: '2026-01-01T00:00:00Z',
  eligibilityCompletedAt: '2026-01-01T00:00:00Z',
  ageYears: 31,
  ageBand: '25–34',
  gender: 'prefer_not_to_say',
  genderSelfDescription: null,
  nationalityCode: 'GB',
  ethnicity: 'prefer_not_to_say',
  householdSize: 2,
  householdSizePreferNotToSay: false,
  childrenInHousehold: false,
  dietaryPattern: 'flexitarian',
  dietaryOther: null,
  groceryRole: 'shared_shopper',
  categoryUsageFrequency: 'weekly',
  smokerStatus: 'non_smoker',
  weeklyFoodSpend: '40_60',
  occupationGroup: 'professional',
  annualIncomeRange: 'prefer_not_to_say',
  declarationConfirmedAt: '2026-01-01T00:00:00Z',
  declarationExpiresAt: '2027-01-01T00:00:00Z',
  researchProfileUpdatedAt: '2026-01-01T00:00:00Z',
  lastActivityAt: '2026-02-01T00:00:00Z',
};

describe('panelist profile presentation', () => {
  it('reports a current completed profile as ready', () => {
    expect(panelistReadiness(readyPanelist, new Date('2026-08-19T00:00:00Z'))).toBe('ready');
  });

  it('distinguishes expired, incomplete, and inactive panelists', () => {
    expect(panelistReadiness({ ...readyPanelist, declarationExpiresAt: '2026-08-18T00:00:00Z' }, new Date('2026-08-19T00:00:00Z'))).toBe('expired');
    expect(panelistReadiness({ ...readyPanelist, eligibilityCompletedAt: null }, new Date('2026-08-19T00:00:00Z'))).toBe('profile_needed');
    expect(panelistReadiness({ ...readyPanelist, status: 'archived' }, new Date('2026-08-19T00:00:00Z'))).toBe('inactive');
  });

  it('requires a complete operational delivery record', () => {
    expect(panelistDeliveryReady(readyPanelist)).toBe(true);
    expect(panelistDeliveryReady({ ...readyPanelist, postalCode: null })).toBe(false);
  });

  it('uses readable research-profile labels', () => {
    expect(panelistValueLabel('shared_shopper')).toBe('Shared shopper');
    expect(panelistValueLabel('prefer_not_to_say')).toBe('Prefer not to say');
  });
});
