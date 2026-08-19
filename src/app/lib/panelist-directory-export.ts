import type { PanelistInfo } from './db/panelists';
import { ethnicityLabel, nationalityOptions } from './panelist-demographics';
import {
  panelistDeliveryReady,
  panelistReadiness,
  panelistReadinessLabel,
  panelistValueLabel,
} from './panelist-profile';

const NATIONALITY_LABELS = new Map(nationalityOptions().map(option => [option.value, option.label]));

export const PANELIST_DIRECTORY_EXPORT_HEADERS = [
  'Panelist ID',
  'Name',
  'Email',
  'Account status',
  'Readiness',
  'Training level',
  'Completed studies',
  'Last activity',
  'Delivery ready',
  'City',
  'Region',
  'Postal code',
  'Country',
  'Age',
  'Age band',
  'Gender',
  'Nationality',
  'Ethnicity',
  'Household size',
  'Children in household',
  'Dietary pattern',
  'Grocery role',
  'Category usage frequency',
  'Smoker status',
  'Weekly food spend',
  'Occupation group',
  'Annual income range',
  'Profile completed',
  'Eligibility completed',
  'Safety declaration confirmed',
  'Safety declaration expires',
] as const;

function isoDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function householdSize(panelist: PanelistInfo) {
  if (panelist.householdSizePreferNotToSay) return 'Prefer not to say';
  return panelist.householdSize ?? '';
}

function yesNo(value: boolean | null) {
  if (value === null) return 'Not provided';
  return value ? 'Yes' : 'No';
}

export function panelistDirectoryCsvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildPanelistDirectoryCsv(panelists: PanelistInfo[], now = new Date()) {
  const rows = panelists.map(panelist => {
    const readiness = panelistReadiness(panelist, now);
    const gender = panelist.gender === 'self_describe'
      ? panelist.genderSelfDescription || 'Self-described'
      : panelistValueLabel(panelist.gender);
    const diet = panelist.dietaryPattern === 'other'
      ? panelist.dietaryOther || 'Other'
      : panelistValueLabel(panelist.dietaryPattern);

    return [
      panelist.panelistId ?? '',
      panelist.name,
      panelist.email ?? '',
      panelistValueLabel(panelist.status),
      panelistReadinessLabel(readiness),
      panelistValueLabel(panelist.trainingLevel),
      panelist.completedCount,
      isoDate(panelist.lastActivityAt),
      panelistDeliveryReady(panelist) ? 'Yes' : 'No',
      panelist.city ?? '',
      panelist.region ?? '',
      panelist.postalCode ?? '',
      panelist.country ?? '',
      panelist.ageYears ?? '',
      panelist.ageBand ?? '',
      gender,
      NATIONALITY_LABELS.get(panelist.nationalityCode ?? '') ?? 'Not provided',
      ethnicityLabel(panelist.ethnicity),
      householdSize(panelist),
      yesNo(panelist.childrenInHousehold),
      diet,
      panelistValueLabel(panelist.groceryRole),
      panelistValueLabel(panelist.categoryUsageFrequency),
      panelistValueLabel(panelist.smokerStatus),
      panelistValueLabel(panelist.weeklyFoodSpend),
      panelistValueLabel(panelist.occupationGroup),
      panelistValueLabel(panelist.annualIncomeRange),
      isoDate(panelist.profileCompletedAt),
      isoDate(panelist.eligibilityCompletedAt),
      isoDate(panelist.declarationConfirmedAt),
      isoDate(panelist.declarationExpiresAt),
    ];
  });

  return [PANELIST_DIRECTORY_EXPORT_HEADERS, ...rows]
    .map(row => row.map(value => panelistDirectoryCsvCell(value)).join(','))
    .join('\r\n');
}

export function downloadPanelistDirectoryCsv(content: string, filename: string) {
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
