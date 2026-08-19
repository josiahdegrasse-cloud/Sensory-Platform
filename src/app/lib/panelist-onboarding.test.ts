import { describe, expect, it } from 'vitest';
import { panelistResearchProfileError } from './panelist-onboarding';

const completeProfile = {
  gender: 'prefer_not_to_say',
  genderSelfDescription: '',
  nationalityCode: 'GB',
  ethnicity: 'prefer_not_to_say',
  dietaryPattern: 'omnivore',
  dietaryOther: '',
  smokerStatus: 'non_smoker',
  weeklyFoodSpend: '40_60',
  householdSizeChoice: '2',
  occupationGroup: 'professional',
  annualIncomeRange: 'prefer_not_to_say',
  groceryRole: 'shared_shopper',
};

describe('panelistResearchProfileError', () => {
  it('accepts a completed research profile including prefer-not-to-say', () => {
    expect(panelistResearchProfileError(completeProfile)).toBe('');
  });

  it.each(['gender', 'nationalityCode', 'ethnicity', 'dietaryPattern', 'smokerStatus', 'weeklyFoodSpend', 'householdSizeChoice', 'occupationGroup', 'annualIncomeRange', 'groceryRole'] as const)(
    'blocks onboarding when %s is unanswered',
    field => {
      expect(panelistResearchProfileError({ ...completeProfile, [field]: '' })).toMatch(/Complete the required research profile/);
    },
  );

  it('requires conditional self-described answers', () => {
    expect(panelistResearchProfileError({ ...completeProfile, gender: 'self_describe' })).toMatch(/Describe your gender/);
    expect(panelistResearchProfileError({ ...completeProfile, dietaryPattern: 'other' })).toMatch(/Describe your dietary preference/);
  });

  it('accepts a broad ethnicity without requesting a specific background', () => {
    expect(panelistResearchProfileError({ ...completeProfile, ethnicity: 'asian' })).toBe('');
    expect(panelistResearchProfileError({ ...completeProfile, ethnicity: 'asian_indian' })).toMatch(/Choose an ethnic group/);
  });
});
