type DemographicOption = readonly [value: string, label: string];

interface EthnicityGroupOption {
  value: string;
  label: string;
  options: readonly DemographicOption[];
}

export const ETHNICITY_GROUPS: readonly EthnicityGroupOption[] = [
  {
    value: 'white',
    label: 'White',
    options: [
      ['white_british', 'English, Welsh, Scottish, Northern Irish or British'],
      ['white_irish', 'Irish'],
      ['white_gypsy_or_irish_traveller', 'Gypsy or Irish Traveller'],
      ['white_roma', 'Roma'],
      ['white_other', 'Another White background'],
    ],
  },
  {
    value: 'mixed',
    label: 'Mixed or Multiple ethnic groups',
    options: [
      ['mixed_white_black_caribbean', 'White and Black Caribbean'],
      ['mixed_white_black_african', 'White and Black African'],
      ['mixed_white_asian', 'White and Asian'],
      ['mixed_other', 'Another Mixed or Multiple ethnic background'],
    ],
  },
  {
    value: 'asian',
    label: 'Asian or Asian British',
    options: [
      ['asian_indian', 'Indian'],
      ['asian_pakistani', 'Pakistani'],
      ['asian_bangladeshi', 'Bangladeshi'],
      ['asian_chinese', 'Chinese'],
      ['asian_other', 'Another Asian background'],
    ],
  },
  {
    value: 'black',
    label: 'Black, Black British, Caribbean or African',
    options: [
      ['black_african', 'African'],
      ['black_caribbean', 'Caribbean'],
      ['black_other', 'Another Black, Black British, Caribbean or African background'],
    ],
  },
  {
    value: 'other',
    label: 'Another ethnic group',
    options: [
      ['other_arab', 'Arab'],
      ['other_ethnic_group', 'Another ethnic group'],
    ],
  },
] as const;

export const ETHNICITY_OPTIONS: readonly DemographicOption[] = [
  ...ETHNICITY_GROUPS.flatMap(group => [...group.options]),
  ['prefer_not_to_say', 'Prefer not to say'] as const,
];

const LEGACY_ETHNICITY_LABELS = new Map<string, string>(ETHNICITY_GROUPS.map(group => [group.value, group.label]));
const ETHNICITY_LABELS = new Map<string, string>(ETHNICITY_OPTIONS);

export function ethnicityGroup(value: string | null | undefined): string {
  if (!value || value === 'prefer_not_to_say') return value ?? '';
  return ETHNICITY_GROUPS.find(group => (
    group.value === value || group.options.some(([optionValue]) => optionValue === value)
  ))?.value ?? '';
}

export function ethnicityOptionsForGroup(groupValue: string) {
  return ETHNICITY_GROUPS.find(group => group.value === groupValue)?.options ?? [];
}

export function isDetailedEthnicity(value: string | null | undefined): boolean {
  return value === 'prefer_not_to_say' || ETHNICITY_LABELS.has(value ?? '');
}

export function isBroadEthnicity(value: string | null | undefined): boolean {
  return value === 'prefer_not_to_say' || ETHNICITY_GROUPS.some(group => group.value === value);
}

export function ethnicityLabel(value: string | null | undefined): string {
  if (!value) return 'Not provided';
  return ETHNICITY_LABELS.get(value) ?? LEGACY_ETHNICITY_LABELS.get(value) ?? 'Not provided';
}

export const SMOKER_STATUS_OPTIONS = [
  ['non_smoker', 'Non-smoker'],
  ['former', 'Former smoker'],
  ['occasional', 'Occasional smoker'],
  ['regular', 'Regular smoker'],
  ['prefer_not_to_say', 'Prefer not to say'],
] as const;

export const WEEKLY_FOOD_SHOP_OPTIONS = [
  ['under_20', 'Under £20'],
  ['20_40', '£20–40'],
  ['40_60', '£40–60'],
  ['60_80', '£60–80'],
  ['80_100', '£80–100'],
  ['over_100', 'Over £100'],
  ['prefer_not_to_say', 'Prefer not to say'],
] as const;

export const HOUSEHOLD_SIZE_OPTIONS = [
  ['1', '1 (just me)'],
  ['2', '2'],
  ['3', '3'],
  ['4', '4'],
  ['5', '5 or more'],
  ['prefer_not_to_say', 'Prefer not to say'],
] as const;

export const OCCUPATION_GROUP_OPTIONS = [
  ['manager_director', 'Manager or director'],
  ['professional', 'Professional occupation'],
  ['associate_professional', 'Associate professional or technical occupation'],
  ['administrative', 'Administrative or secretarial occupation'],
  ['skilled_trade', 'Skilled trade'],
  ['caring_leisure', 'Caring, leisure or service occupation'],
  ['sales_customer_service', 'Sales or customer service occupation'],
  ['machine_operative', 'Process, plant or machine operative'],
  ['elementary', 'Elementary occupation'],
  ['student', 'Student'],
  ['homemaker_carer', 'Homemaker or carer'],
  ['retired', 'Retired'],
  ['not_employed', 'Not employed'],
  ['prefer_not_to_say', 'Prefer not to say'],
] as const;

export const ANNUAL_INCOME_OPTIONS = [
  ['under_20k', 'Under £20k'],
  ['20_30k', '£20–30k'],
  ['30_40k', '£30–40k'],
  ['40_60k', '£40–60k'],
  ['60_80k', '£60–80k'],
  ['over_80k', 'Over £80k'],
  ['prefer_not_to_say', 'Prefer not to say'],
] as const;

const ISO_ALPHA_2_CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(' ');

export interface NationalityOption {
  value: string;
  label: string;
}

export function nationalityOptions(): NationalityOption[] {
  const names = new Intl.DisplayNames(['en-GB'], { type: 'region' });
  const countries = ISO_ALPHA_2_CODES
    .filter(code => code !== 'GB')
    .map(code => ({ value: code, label: names.of(code) ?? code }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en-GB'));
  return [
    { value: 'GB', label: 'United Kingdom' },
    ...countries,
    { value: 'other', label: 'Other' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
  ];
}
