import type { EligiblePanelist } from '../lib/database';
import { ethnicityGroup, ethnicityLabel, nationalityOptions } from '../lib/panelist-demographics';
import { panelistValueLabel } from '../lib/panelist-profile';

const NATIONALITY_LABELS = new Map(nationalityOptions().map(option => [option.value, option.label]));

function counts(values: Array<string | null | undefined>) {
  return Array.from(values.reduce((map, value) => {
    if (value) map.set(value, (map.get(value) ?? 0) + 1);
    return map;
  }, new Map<string, number>())).sort((a, b) => b[1] - a[1]);
}

function humanize(value: string) {
  return value.replace(/_/g, ' ').replace(/^./, (character: string) => character.toUpperCase());
}

export function EligiblePanelSummary({ panelists, selectedIds }: { panelists: EligiblePanelist[]; selectedIds: string[] }) {
  const selected = panelists.filter(panelist => selectedIds.includes(panelist.id));
  const source = selected.length ? selected : panelists;
  if (!source.length) return null;
  const ageBands = counts(source.map(panelist => panelist.ageBand));
  const regions = counts(source.map(panelist => panelist.region));
  const genders = counts(source.map(panelist => panelist.gender));
  const nationalities = counts(source.map(panelist => panelist.nationalityCode));
  const ethnicities = counts(source.map(panelist => ethnicityGroup(panelist.ethnicity)));
  const dietary = counts(source.map(panelist => panelist.dietaryPattern));
  const smoking = counts(source.map(panelist => panelist.smokerStatus));
  const weeklySpend = counts(source.map(panelist => panelist.weeklyFoodSpend));
  const occupations = counts(source.map(panelist => panelist.occupationGroup));
  const incomes = counts(source.map(panelist => panelist.annualIncomeRange));
  const groceryRoles = counts(source.map(panelist => panelist.groceryRole));
  const households = counts(source.map(panelist => panelist.householdSize ? `${panelist.householdSize} ${panelist.householdSize === 1 ? 'person' : 'people'}` : null));

  const summarize = (items: Array<[string, number]>, transform = (label: string) => label) => (
    items.slice(0, 3).map(([label, count]) => `${transform(label)} (${count})`).join(' · ') || 'Not provided'
  );

  return (
    <div className="border-t border-slate-200 pt-3" aria-label="Panel demographic summary">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{selected.length ? 'Selected panel composition' : 'Eligible pool composition'}</p>
        <p className="text-xs text-slate-500">{source.length} adult panelist{source.length === 1 ? '' : 's'}</p>
      </div>
      <dl className="mt-3 grid gap-x-5 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="font-medium text-slate-500">Age</dt><dd className="mt-0.5 leading-5 text-slate-800">{summarize(ageBands)}</dd></div>
        <div><dt className="font-medium text-slate-500">Gender</dt><dd className="mt-0.5 leading-5 text-slate-800">{summarize(genders, panelistValueLabel)}</dd></div>
        <div><dt className="font-medium text-slate-500">Nationality</dt><dd className="mt-0.5 leading-5 text-slate-800">{summarize(nationalities, label => NATIONALITY_LABELS.get(label) ?? humanize(label))}</dd></div>
        <div><dt className="font-medium text-slate-500">Ethnic group</dt><dd className="mt-0.5 leading-5 text-slate-800">{summarize(ethnicities, ethnicityLabel)}</dd></div>
        <div><dt className="font-medium text-slate-500">Region</dt><dd className="mt-0.5 leading-5 text-slate-800">{summarize(regions)}</dd></div>
        <div><dt className="font-medium text-slate-500">Dietary pattern</dt><dd className="mt-0.5 leading-5 text-slate-800">{summarize(dietary, panelistValueLabel)}</dd></div>
        <div><dt className="font-medium text-slate-500">Smoking</dt><dd className="mt-0.5 leading-5 text-slate-800">{summarize(smoking, panelistValueLabel)}</dd></div>
        <div><dt className="font-medium text-slate-500">Weekly food shop</dt><dd className="mt-0.5 leading-5 text-slate-800">{summarize(weeklySpend, panelistValueLabel)}</dd></div>
        <div><dt className="font-medium text-slate-500">Household</dt><dd className="mt-0.5 leading-5 text-slate-800">{summarize(households)}</dd></div>
        <div><dt className="font-medium text-slate-500">Occupation</dt><dd className="mt-0.5 leading-5 text-slate-800">{summarize(occupations, panelistValueLabel)}</dd></div>
        <div><dt className="font-medium text-slate-500">Income</dt><dd className="mt-0.5 leading-5 text-slate-800">{summarize(incomes, panelistValueLabel)}</dd></div>
        <div><dt className="font-medium text-slate-500">Grocery role</dt><dd className="mt-0.5 leading-5 text-slate-800">{summarize(groceryRoles, panelistValueLabel)}</dd></div>
      </dl>
    </div>
  );
}
