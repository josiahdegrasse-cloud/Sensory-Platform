export const SURVEY_SECTION_IDS = ['cata', 'intensity', 'hedonic', 'emotions', 'comments'] as const;

export type SurveySection = typeof SURVEY_SECTION_IDS[number];

export const DEFAULT_SURVEY_SECTIONS: SurveySection[] = [...SURVEY_SECTION_IDS];

export const SURVEY_SECTION_LABELS: Record<SurveySection, string> = {
  cata: 'Flavor & aroma (CATA)',
  intensity: 'Intensity ratings',
  hedonic: 'Overall liking',
  emotions: 'Emotional response',
  comments: 'Additional comments',
};

export function normalizeSurveySections(value: unknown): SurveySection[] {
  if (!Array.isArray(value)) return [...DEFAULT_SURVEY_SECTIONS];
  const sections = SURVEY_SECTION_IDS.filter(section => value.includes(section));
  return sections.length > 0 ? sections : [...DEFAULT_SURVEY_SECTIONS];
}

export function toggleSurveySection(
  sections: SurveySection[],
  section: SurveySection,
): SurveySection[] {
  if (sections.includes(section)) {
    if (section === 'cata') return sections.filter(value => value !== 'cata' && value !== 'intensity');
    return sections.filter(value => value !== section);
  }
  if (section === 'intensity') {
    return SURVEY_SECTION_IDS.filter(value => [...sections, 'cata', 'intensity'].includes(value));
  }
  return SURVEY_SECTION_IDS.filter(value => [...sections, section].includes(value));
}

export function mergeSurveyAttributes(
  current: string[],
  input: string,
  standardAttributes: string[] = [],
): string[] {
  const standardByName = new Map(
    standardAttributes.map(attribute => [attribute.toLocaleLowerCase(), attribute]),
  );
  const existing = new Set(current.map(attribute => attribute.toLocaleLowerCase()));
  const additions: string[] = [];

  input.split(/[,\n]/).forEach(candidate => {
    const trimmed = candidate.trim();
    if (!trimmed) return;
    const attribute = standardByName.get(trimmed.toLocaleLowerCase()) ?? trimmed;
    const normalized = attribute.toLocaleLowerCase();
    if (existing.has(normalized)) return;
    existing.add(normalized);
    additions.push(attribute);
  });

  return [...current, ...additions];
}
