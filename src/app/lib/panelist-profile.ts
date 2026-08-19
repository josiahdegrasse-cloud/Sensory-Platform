import type { PanelistInfo } from './database';

export type PanelistReadiness =
  | 'ready'
  | 'renewal_due'
  | 'expired'
  | 'profile_needed'
  | 'invite_pending'
  | 'inactive';

const VALUE_LABELS: Record<string, string> = {
  woman: 'Female',
  man: 'Male',
  female: 'Female',
  male: 'Male',
  non_binary: 'Non-binary',
  self_describe: 'Self-described',
  prefer_not_to_say: 'Prefer not to say',
  no_specific_diet: 'Omnivore',
  omnivore: 'Omnivore',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  pescatarian: 'Pescatarian',
  flexitarian: 'Flexitarian',
  halal: 'Halal',
  kosher: 'Kosher',
  other: 'Other',
  main_shopper: 'Main shopper',
  shared_shopper: 'Shared shopper',
  occasional_shopper: 'Occasional shopper',
  not_involved: 'Not involved',
  daily: 'Daily',
  several_weekly: 'Several times a week',
  weekly: 'Weekly',
  monthly: 'Monthly',
  less_often: 'Less often',
  never: 'Never',
  asian: 'Asian or Asian British',
  black: 'Black, Black British, Caribbean or African',
  mixed: 'Mixed or Multiple ethnic groups',
  white: 'White',
  non_smoker: 'Non-smoker',
  former: 'Former smoker',
  occasional: 'Occasional smoker',
  regular: 'Regular smoker',
  under_20: 'Under £20',
  '20_40': '£20–40',
  '40_60': '£40–60',
  '60_80': '£60–80',
  '80_100': '£80–100',
  over_100: 'Over £100',
  manager_director: 'Manager or director',
  professional: 'Professional occupation',
  associate_professional: 'Associate professional or technical',
  administrative: 'Administrative or secretarial',
  skilled_trade: 'Skilled trade',
  caring_leisure: 'Caring, leisure or service',
  sales_customer_service: 'Sales or customer service',
  machine_operative: 'Process, plant or machine operative',
  elementary: 'Elementary occupation',
  student: 'Student',
  homemaker_carer: 'Homemaker or carer',
  retired: 'Retired',
  not_employed: 'Not employed',
  under_20k: 'Under £20k',
  '20_30k': '£20–30k',
  '30_40k': '£30–40k',
  '40_60k': '£40–60k',
  '60_80k': '£60–80k',
  over_80k: 'Over £80k',
};

export function panelistValueLabel(value: string | null | undefined): string {
  if (!value) return 'Not provided';
  return VALUE_LABELS[value] ?? value.replace(/_/g, ' ').replace(/^./, character => character.toUpperCase());
}

export function panelistReadiness(panelist: PanelistInfo, now = new Date()): PanelistReadiness {
  if (panelist.status !== 'active') return 'inactive';
  if (!panelist.profileCompletedAt) return 'invite_pending';
  if (!panelist.eligibilityCompletedAt || !panelist.declarationExpiresAt) return 'profile_needed';

  const expiresAt = new Date(panelist.declarationExpiresAt);
  if (expiresAt.getTime() < now.getTime()) return 'expired';

  const renewalWindow = new Date(now);
  renewalWindow.setDate(renewalWindow.getDate() + 30);
  if (expiresAt.getTime() <= renewalWindow.getTime()) return 'renewal_due';
  return 'ready';
}

export function panelistReadinessLabel(readiness: PanelistReadiness): string {
  return {
    ready: 'Ready for matching',
    renewal_due: 'Renewal due soon',
    expired: 'Declaration expired',
    profile_needed: 'Profile update needed',
    invite_pending: 'Invite pending',
    inactive: 'Inactive',
  }[readiness];
}

export function panelistDeliveryReady(panelist: PanelistInfo): boolean {
  return Boolean(
    panelist.phone
    && panelist.addressLine1
    && panelist.city
    && panelist.postalCode
    && panelist.country,
  );
}
