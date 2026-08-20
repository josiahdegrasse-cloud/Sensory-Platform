import type { EligiblePanelist, PanelistInfo } from '../../lib/database';
import { panelistReadiness } from '../../lib/panelist-profile';

export function buildConceptPanelRoster(
  panelists: PanelistInfo[],
  now = new Date(),
): EligiblePanelist[] {
  return panelists
    .filter(panelist => {
      const readiness = panelistReadiness(panelist, now);
      return (readiness === 'ready' || readiness === 'renewal_due')
        && panelist.ageYears !== null
        && panelist.ageYears >= 18;
    })
    .map(panelist => ({
      id: panelist.id,
      name: panelist.name,
      email: panelist.email,
      panelistId: panelist.panelistId,
      completedCount: panelist.completedCount,
      ageYears: panelist.ageYears as number,
      ageBand: panelist.ageBand ?? '18+',
      gender: panelist.gender,
      genderSelfDescription: panelist.genderSelfDescription,
      nationalityCode: panelist.nationalityCode,
      ethnicity: panelist.ethnicity,
      region: panelist.region,
      householdSize: panelist.householdSize,
      householdSizePreferNotToSay: panelist.householdSizePreferNotToSay,
      childrenInHousehold: panelist.childrenInHousehold,
      dietaryPattern: panelist.dietaryPattern,
      dietaryOther: panelist.dietaryOther,
      groceryRole: panelist.groceryRole,
      categoryUsageFrequency: panelist.categoryUsageFrequency,
      smokerStatus: panelist.smokerStatus,
      weeklyFoodSpend: panelist.weeklyFoodSpend,
      occupationGroup: panelist.occupationGroup,
      annualIncomeRange: panelist.annualIncomeRange,
    }));
}
