import { describe, expect, it } from 'vitest';
import {
  ANNUAL_INCOME_OPTIONS,
  ETHNICITY_GROUPS,
  ETHNICITY_OPTIONS,
  HOUSEHOLD_SIZE_OPTIONS,
  OCCUPATION_GROUP_OPTIONS,
  SMOKER_STATUS_OPTIONS,
  WEEKLY_FOOD_SHOP_OPTIONS,
  ethnicityGroup,
  ethnicityLabel,
  isBroadEthnicity,
  isDetailedEthnicity,
  nationalityOptions,
} from './panelist-demographics';

describe('panelist demographic vocabularies', () => {
  it('pins the United Kingdom above the ISO country list', () => {
    const options = nationalityOptions();
    expect(options[0]).toEqual({ value: 'GB', label: 'United Kingdom' });
    expect(options).toContainEqual({ value: 'FR', label: 'France' });
    expect(options.slice(-2).map(option => option.value)).toEqual(['other', 'prefer_not_to_say']);
  });

  it('offers the requested controlled research-profile choices', () => {
    expect(ETHNICITY_GROUPS).toHaveLength(5);
    expect(ETHNICITY_OPTIONS).toHaveLength(20);
    expect(SMOKER_STATUS_OPTIONS).toHaveLength(5);
    expect(WEEKLY_FOOD_SHOP_OPTIONS).toHaveLength(7);
    expect(HOUSEHOLD_SIZE_OPTIONS).toHaveLength(6);
    expect(OCCUPATION_GROUP_OPTIONS).toHaveLength(14);
    expect(ANNUAL_INCOME_OPTIONS).toHaveLength(7);
  });

  it('keeps a detailed ethnicity response while deriving its reporting group', () => {
    expect(ethnicityGroup('mixed_white_asian')).toBe('mixed');
    expect(ethnicityGroup('asian_chinese')).toBe('asian');
    expect(ethnicityLabel('white_roma')).toBe('Roma');
    expect(isDetailedEthnicity('other_arab')).toBe(true);
    expect(isDetailedEthnicity('asian')).toBe(false);
    expect(isBroadEthnicity('asian')).toBe(true);
    expect(isBroadEthnicity('asian_indian')).toBe(false);
  });
});
