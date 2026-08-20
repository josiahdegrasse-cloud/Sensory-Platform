import { describe, expect, it } from 'vitest';
import type { PanelistInfo } from '../../lib/database';
import { buildConceptPanelRoster } from './concept-panel-roster';

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
  phone: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  region: 'West Yorkshire',
  postalCode: null,
  country: null,
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

const now = new Date('2026-08-20T00:00:00Z');

describe('concept panel roster', () => {
  it('includes research-ready adults without requiring a formulation', () => {
    const roster = buildConceptPanelRoster([readyPanelist], now);

    expect(roster).toHaveLength(1);
    expect(roster[0]).toMatchObject({
      id: 'panelist-1',
      ageYears: 31,
      ageBand: '25–34',
      dietaryPattern: 'flexitarian',
    });
  });

  it('keeps adults whose profile is approaching renewal available', () => {
    const roster = buildConceptPanelRoster([{
      ...readyPanelist,
      declarationExpiresAt: '2026-09-01T00:00:00Z',
    }], now);

    expect(roster.map(panelist => panelist.id)).toEqual(['panelist-1']);
  });

  it('excludes underage, expired, incomplete, and inactive accounts', () => {
    const roster = buildConceptPanelRoster([
      { ...readyPanelist, id: 'underage', ageYears: 17 },
      { ...readyPanelist, id: 'expired', declarationExpiresAt: '2026-08-19T00:00:00Z' },
      { ...readyPanelist, id: 'incomplete', eligibilityCompletedAt: null },
      { ...readyPanelist, id: 'inactive', status: 'inactive' },
    ], now);

    expect(roster).toEqual([]);
  });
});
