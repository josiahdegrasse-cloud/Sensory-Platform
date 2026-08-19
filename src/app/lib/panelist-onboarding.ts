import { isBroadEthnicity } from './panelist-demographics';

export interface PanelistResearchProfileDraft {
  gender: string;
  genderSelfDescription: string;
  nationalityCode: string;
  ethnicity: string;
  dietaryPattern: string;
  dietaryOther: string;
  smokerStatus: string;
  weeklyFoodSpend: string;
  householdSizeChoice: string;
  occupationGroup: string;
  annualIncomeRange: string;
  groceryRole: string;
}

export function panelistResearchProfileError(draft: PanelistResearchProfileDraft): string {
  if (
    !draft.gender
    || !draft.nationalityCode
    || !draft.ethnicity
    || !draft.dietaryPattern
    || !draft.smokerStatus
    || !draft.weeklyFoodSpend
    || !draft.householdSizeChoice
    || !draft.occupationGroup
    || !draft.annualIncomeRange
    || !draft.groceryRole
  ) {
    return 'Complete the required research profile questions. You can choose “Prefer not to say” where available.';
  }
  if (draft.gender === 'self_describe' && draft.genderSelfDescription.trim().length < 2) {
    return 'Describe your gender, or choose another answer.';
  }
  if (!isBroadEthnicity(draft.ethnicity)) {
    return 'Choose an ethnic group, or choose “Prefer not to say”.';
  }
  if (draft.dietaryPattern === 'other' && draft.dietaryOther.trim().length < 2) {
    return 'Describe your dietary preference, or choose another answer.';
  }
  return '';
}
