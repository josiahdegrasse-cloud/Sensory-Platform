export type FormulationReviewStatus = 'pending_review' | 'reviewed' | 'needs_revision';
export type IngredientReviewStatus = 'suggested' | 'verified' | 'rejected';

export interface StructuredIngredient {
  id?: string;
  position: number;
  suppliedName: string;
  canonicalName: string;
  functionalRole: string;
  percentage: number | null;
  supplier: string;
  specification: string;
  allergenTags: string[];
  dietaryTags: string[];
  confidence: number;
  reviewStatus: IngredientReviewStatus;
  notes: string;
}

export interface FormulationVersion {
  id: string;
  instrumentalSampleId: string;
  projectId: string | null;
  importBatchId: string;
  sampleId: string;
  sampleName: string | null;
  versionNumber: number;
  exactStatement: string;
  statementSource: 'csv_import' | 'manual';
  fingerprint: string;
  isCurrent: boolean;
  reviewStatus: FormulationReviewStatus;
  changeSummary: string | null;
  createdAt: string;
  reviewedAt: string | null;
  ingredients: StructuredIngredient[];
}

const ROLE_HINTS: Array<[RegExp, string]> = [
  [/\b(water|aqua)\b/i, 'Carrier'],
  [/\b(salt|sodium chloride)\b/i, 'Seasoning'],
  [/\b(sugar|syrup|honey|dextrose|fructose|maltodextrin)\b/i, 'Sweetener'],
  [/\b(oil|fat|butter|shortening)\b/i, 'Fat system'],
  [/\b(flour|starch)\b/i, 'Structure'],
  [/\b(protein|casein|whey|gluten)\b/i, 'Protein system'],
  [/\b(culture|starter|yeast|ferment)\b/i, 'Fermentation'],
  [/\b(gum|pectin|carrageenan|cellulose|lecithin|emulsifier|stabiliser|stabilizer)\b/i, 'Texture / stability'],
  [/\b(acid|citrate|citric|lactic|vinegar)\b/i, 'Acidity control'],
  [/\b(flavour|flavor|extract|spice|herb)\b/i, 'Flavouring'],
  [/\b(preservative|sorbate|benzoate|nitrite|nitrate)\b/i, 'Preservation'],
  [/\b(colou?r|carotene|anthocyanin)\b/i, 'Colour'],
];

const ALLERGEN_HINTS: Array<[RegExp, string]> = [
  [/\b(wheat|barley|rye|oat|spelt|kamut|gluten)\b/i, 'Cereals containing gluten'],
  [/\b(milk|whey|casein|caseinate|cream|butter|cheese|lactose|yogh?urt)\b/i, 'Milk'],
  [/\b(egg|albumen|mayonnaise)\b/i, 'Egg'],
  [/\b(soy|soya|tofu|edamame|miso|tempeh)\b/i, 'Soya'],
  [/\b(peanut|groundnut)\b/i, 'Peanuts'],
  [/\b(almond|hazelnut|walnut|cashew|pecan|brazil nut|pistachio|macadamia)\b/i, 'Tree nuts'],
  [/\b(sesame|tahini)\b/i, 'Sesame'],
  [/\b(mustard)\b/i, 'Mustard'],
  [/\b(celery|celeriac)\b/i, 'Celery'],
  [/\b(lupin)\b/i, 'Lupin'],
  [/\b(fish|anchov|salmon|tuna|cod)\b/i, 'Fish'],
  [/\b(crab|prawn|shrimp|lobster|crayfish|crustacean)\b/i, 'Crustaceans'],
  [/\b(mollusc|mussel|oyster|squid|octopus|snail)\b/i, 'Molluscs'],
  [/\b(sulphite|sulfite|sulphur dioxide|sulfur dioxide)\b/i, 'Sulphites'],
];

const ANIMAL_DERIVED_HINT = /\b(milk|whey|casein|cream|butter|cheese|yogh?urt|egg|gelatin|gelatine|honey|fish|anchov|meat|beef|pork|chicken)\b/i;

/** Split an ingredient statement without breaking parenthetical sub-ingredients. */
export function splitIngredientStatement(statement: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < statement.length; index += 1) {
    const char = statement[index];
    if (char === '(' || char === '[' || char === '{') depth += 1;
    if (char === ')' || char === ']' || char === '}') depth = Math.max(0, depth - 1);
    if ((char === ',' || char === ';') && depth === 0) {
      const value = statement.slice(start, index).trim();
      if (value) parts.push(value);
      start = index + 1;
    }
  }
  const tail = statement.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function explicitPercentage(value: string): number | null {
  const match = value.match(/(?:^|[\s(])(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
}

function canonicalName(value: string): string {
  return value
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*%\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, first => first.toUpperCase());
}

/**
 * Produces review candidates only. Tags and roles are suggestions, percentages
 * are copied only when explicitly supplied, and the exact statement is untouched.
 */
export function deriveStructuredIngredients(statement: string): StructuredIngredient[] {
  return splitIngredientStatement(statement).map((suppliedName, index) => {
    const functionalRole = ROLE_HINTS.find(([pattern]) => pattern.test(suppliedName))?.[1] ?? 'Review role';
    const allergenTags = ALLERGEN_HINTS
      .filter(([pattern]) => pattern.test(suppliedName))
      .map(([, tag]) => tag);
    const dietaryTags = ANIMAL_DERIVED_HINT.test(suppliedName) ? ['Animal-derived candidate'] : [];
    const percentage = explicitPercentage(suppliedName);
    const hasStrongRole = functionalRole !== 'Review role';
    return {
      position: index + 1,
      suppliedName,
      canonicalName: canonicalName(suppliedName),
      functionalRole,
      percentage,
      supplier: '',
      specification: '',
      allergenTags,
      dietaryTags,
      confidence: allergenTags.length > 0 || hasStrongRole || percentage !== null ? 0.78 : 0.45,
      reviewStatus: 'suggested',
      notes: '',
    };
  });
}

export function verifiedAllergenTags(version: FormulationVersion | null | undefined): string[] {
  if (!version || version.reviewStatus !== 'reviewed') return [];
  return [...new Set(version.ingredients
    .filter(ingredient => ingredient.reviewStatus === 'verified')
    .flatMap(ingredient => ingredient.allergenTags))]
    .sort();
}

export function formulationReadiness(version: FormulationVersion | null | undefined): {
  status: 'missing' | 'review-needed' | 'verified';
  label: string;
  detail: string;
} {
  if (!version) {
    return { status: 'missing', label: 'Ingredients missing', detail: 'Add the exact ingredient statement in Data.' };
  }
  const suggestedCount = version.ingredients.filter(item => item.reviewStatus === 'suggested').length;
  if (version.reviewStatus !== 'reviewed' || suggestedCount > 0) {
    return {
      status: 'review-needed',
      label: 'Ingredient review needed',
      detail: `${suggestedCount || version.ingredients.length} structured ingredient${suggestedCount === 1 ? '' : 's'} still need human verification.`,
    };
  }
  return {
    status: 'verified',
    label: `Formulation v${version.versionNumber} reviewed`,
    detail: `${version.ingredients.length} ingredient${version.ingredients.length === 1 ? '' : 's'} tied to this formulation snapshot.`,
  };
}

export function compareFormulationVersions(current: FormulationVersion, previous: FormulationVersion | null): {
  added: string[];
  removed: string[];
  reordered: string[];
} {
  if (!previous) return { added: current.ingredients.map(item => item.suppliedName), removed: [], reordered: [] };
  const before = previous.ingredients.map(item => item.canonicalName.toLowerCase());
  const after = current.ingredients.map(item => item.canonicalName.toLowerCase());
  const added = current.ingredients.filter(item => !before.includes(item.canonicalName.toLowerCase())).map(item => item.suppliedName);
  const removed = previous.ingredients.filter(item => !after.includes(item.canonicalName.toLowerCase())).map(item => item.suppliedName);
  const reordered = current.ingredients.filter(item => {
    const key = item.canonicalName.toLowerCase();
    return before.includes(key) && before.indexOf(key) !== after.indexOf(key);
  }).map(item => item.suppliedName);
  return { added, removed, reordered };
}
