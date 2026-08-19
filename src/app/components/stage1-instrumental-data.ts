// Pure data + import-pipeline logic for the Instrumental (Stage 1) screen.
// Extracted from stage1-instrumental.tsx to keep the component file focused on
// rendering. No React here — everything is unit-testable in isolation.
import {
  formatFoodTypeLabel,
  getFoodTypeProfile,
  resolveDeclaredFoodType,
  slugifyFoodType,
  type FoodTypeDetection,
} from "../lib/food-intelligence";
import { getRawImportColumns } from "../lib/csv-import-mapping";
import { STATUS } from "../styles/tokens";

export interface InstrumentalMeasurement {
  key: string;
  label: string;
  unit: string;
  mean: number;
  observationCount: number;
}

export interface ETongueMeasurement {
  sampleId: string;
  sampleName?: string;
  sourness: number;
  bitterness: number;
  saltiness: number;
  umami: number;
  sweetness: number;
  type?: string;
  category?: string;
  importBatchId?: string;
  ingredientStatement?: IngredientStatement;
  hasETongueData?: boolean;
  measurements?: InstrumentalMeasurement[];
}

export interface GCMSCompound {
  name: string;
  concentration: number;
  aroma: string;
  threshold: number;
}

export interface ChemicalComposition {
  protein: number;
  fat: number;
  moisture: number;
  pH: number;
  saltContent: number;
  calciumMg: number;
}

export interface IngredientStatement {
  text: string;
  source: 'csv_import' | 'manual';
  updatedAt: string | null;
}

export interface ColumnReport {
  recognised: string[];
  ignored: string[];
}

export interface ImportValidationReport {
  errors: string[];
  warnings: string[];
}

export interface ImportCompletionSummary {
  foodTypeSlug: string;
  foodTypeLabel: string;
  projectName: string;
  sampleCount: number;
  gcmsCount: number;
  compositionCount: number;
  measurementCount?: number;
  savedPermanently: boolean;
  importBatchId?: string | null;
  retestParentDecisionId?: string | null;
  groupedByFormulation?: boolean;
  sourceSampleCount?: number;
}

export interface ImportAggregationSummary {
  groupedByFormulation: boolean;
  sourceRowCount: number;
  sourceSampleCount: number;
  formulationCount: number;
  averagedFormulationCount: number;
}

export interface ImportFoodTypeResolution {
  status: 'matched' | 'confirmed' | 'missing' | 'unrecognized' | 'conflicting';
  declaredValues: string[];
}

export interface RetestImportContext {
  sampleId: string;
  sampleName: string;
  decision: 'TWEAK' | 'STOP';
  target?: string;
  action?: string;
  parentDecisionId?: string;
}

export function buildRetestBatchName(context: RetestImportContext) {
  const suffix = context.decision === 'STOP' ? 'reformulation' : 'retest';
  return `${context.sampleName} ${suffix}`;
}

export const MOCK_ETONGUE_DATA: ETongueMeasurement[] = [
  { sampleId: "S1", sourness: 2.3, bitterness: 3.1, saltiness: 4.2, umami: 2.8, sweetness: 1.5, type: "pbca", category: "Coconut-based" },
  { sampleId: "S2", sourness: 2.8, bitterness: 3.4, saltiness: 3.9, umami: 3.1, sweetness: 1.3, type: "pbca", category: "Coconut-based" },
  { sampleId: "S3", sourness: 4.5, bitterness: 2.9, saltiness: 3.6, umami: 2.4, sweetness: 1.8, type: "pbca", category: "Coconut-based" },
  { sampleId: "S4", sourness: 2.1, bitterness: 3.6, saltiness: 4.1, umami: 3.3, sweetness: 1.4, type: "pbca", category: "Coconut-based" },
  { sampleId: "S5", sourness: 3.2, bitterness: 2.7, saltiness: 3.4, umami: 3.8, sweetness: 2.1, type: "pbca", category: "Cashew-based" },
  { sampleId: "S6", sourness: 3.5, bitterness: 2.9, saltiness: 3.6, umami: 3.5, sweetness: 2.3, type: "pbca", category: "Cashew-based" },
  { sampleId: "S7", sourness: 3.8, bitterness: 3.2, saltiness: 3.3, umami: 3.6, sweetness: 2.0, type: "pbca", category: "Cashew-based" },
  { sampleId: "S8", sourness: 3.1, bitterness: 2.5, saltiness: 3.7, umami: 4.1, sweetness: 2.4, type: "pbca", category: "Coconut-based" },
  { sampleId: "S9", sourness: 2.9, bitterness: 3.3, saltiness: 3.8, umami: 2.9, sweetness: 1.7, type: "pbca", category: "Coconut-based" },
  { sampleId: "S10", sourness: 3.4, bitterness: 3.0, saltiness: 3.5, umami: 3.2, sweetness: 1.9, type: "pbca", category: "Cashew-based" },
  { sampleId: "S11", sourness: 2.6, bitterness: 3.5, saltiness: 4.0, umami: 2.7, sweetness: 1.6, type: "pbca", category: "Coconut-based" },
  { sampleId: "S12", sourness: 3.7, bitterness: 2.8, saltiness: 3.4, umami: 3.4, sweetness: 2.2, type: "pbca", category: "Cashew-based" },
  { sampleId: "D1", sourness: 2.2, bitterness: 2.1, saltiness: 4.5, umami: 4.3, sweetness: 2.0, type: "dairy", category: "Dairy" },
  { sampleId: "D2", sourness: 2.4, bitterness: 2.3, saltiness: 4.4, umami: 4.2, sweetness: 2.1, type: "dairy", category: "Dairy" },
  { sampleId: "B1", sourness: 4.2, bitterness: 2.1, saltiness: 2.8, umami: 2.2, sweetness: 1.6, type: "bread", category: "Bread" },
  { sampleId: "B2", sourness: 1.4, bitterness: 1.2, saltiness: 2.4, umami: 1.6, sweetness: 3.2, type: "bread", category: "Bread" },
  { sampleId: "B3", sourness: 2.8, bitterness: 3.4, saltiness: 3.1, umami: 2.8, sweetness: 2.2, type: "bread", category: "Bread" },
  { sampleId: "B4", sourness: 5.8, bitterness: 3.2, saltiness: 3.2, umami: 2.6, sweetness: 1.4, type: "bread", category: "Bread" },
  { sampleId: "B5", sourness: 1.1, bitterness: 1.0, saltiness: 2.0, umami: 2.1, sweetness: 5.4, type: "bread", category: "Bread" },
  { sampleId: "B6", sourness: 1.8, bitterness: 1.4, saltiness: 2.6, umami: 2.4, sweetness: 1.8, type: "bread", category: "Bread" },
  { sampleId: "B7", sourness: 2.2, bitterness: 2.8, saltiness: 2.6, umami: 2.8, sweetness: 2.4, type: "bread", category: "Bread" },
  { sampleId: "B8", sourness: 4.8, bitterness: 3.6, saltiness: 3.4, umami: 3.2, sweetness: 1.6, type: "bread", category: "Bread" },
  { sampleId: "B9", sourness: 1.6, bitterness: 1.2, saltiness: 2.8, umami: 1.8, sweetness: 1.6, type: "bread", category: "Bread" },
  { sampleId: "B10", sourness: 1.4, bitterness: 1.6, saltiness: 4.2, umami: 3.8, sweetness: 1.8, type: "bread", category: "Bread" },
  { sampleId: "B11", sourness: 3.6, bitterness: 1.8, saltiness: 3.0, umami: 2.4, sweetness: 2.2, type: "bread", category: "Bread" },
  { sampleId: "B12", sourness: 0.9, bitterness: 0.8, saltiness: 2.2, umami: 1.8, sweetness: 4.8, type: "bread", category: "Bread" },
];

export const MOCK_GCMS_DATA: Record<string, GCMSCompound[]> = {
  // Cheese / plant-based
  S1:  [{ name: "Diacetyl",   concentration: 3.2,  aroma: "buttery",          threshold: 10.0 }, { name: "Vanillin",    concentration: 1.1, aroma: "vanilla",      threshold: 0 }],
  S2:  [{ name: "Diacetyl",   concentration: 2.8,  aroma: "buttery",          threshold: 10.0 }, { name: "Limonene",   concentration: 0.4, aroma: "citrus",       threshold: 0 }],
  S3:  [{ name: "Butyric acid", concentration: 12.4, aroma: "rancid",         threshold: 8.0  }, { name: "Hexanal",    concentration: 6.8, aroma: "cardboard",    threshold: 5.0 }, { name: "Acetaldehyde", concentration: 2.1, aroma: "fermented", threshold: 7.0 }],
  S4:  [{ name: "Diacetyl",   concentration: 3.6,  aroma: "buttery",          threshold: 10.0 }, { name: "Benzaldehyde", concentration: 1.4, aroma: "nutty/almond", threshold: 0 }],
  S5:  [{ name: "Benzaldehyde", concentration: 2.3, aroma: "nutty/almond",   threshold: 0    }, { name: "Vanillin",   concentration: 1.6, aroma: "vanilla",      threshold: 0 }, { name: "Diacetyl", concentration: 2.1, aroma: "buttery", threshold: 10.0 }],
  S6:  [{ name: "Benzaldehyde", concentration: 2.0, aroma: "nutty/almond",   threshold: 0    }, { name: "Limonene",   concentration: 0.6, aroma: "citrus",       threshold: 0 }],
  S7:  [{ name: "Acetaldehyde", concentration: 8.1, aroma: "fermented",       threshold: 3.5  }, { name: "Butyric acid", concentration: 4.2, aroma: "rancid",     threshold: 8.0 }],
  S8:  [{ name: "Diacetyl",   concentration: 3.4,  aroma: "buttery",          threshold: 10.0 }, { name: "Benzaldehyde", concentration: 1.6, aroma: "nutty",      threshold: 0 }],
  S9:  [{ name: "Diacetyl",   concentration: 2.2,  aroma: "buttery",          threshold: 10.0 }, { name: "Vanillin",   concentration: 1.8, aroma: "vanilla",      threshold: 0 }],
  S10: [{ name: "Benzaldehyde", concentration: 3.1, aroma: "nutty",           threshold: 0    }, { name: "Diacetyl",   concentration: 1.9, aroma: "buttery",      threshold: 10.0 }],
  S11: [{ name: "Diacetyl",   concentration: 2.6,  aroma: "buttery",          threshold: 10.0 }, { name: "Acetaldehyde", concentration: 1.4, aroma: "fermented",  threshold: 7.0 }],
  S12: [{ name: "Diacetyl",   concentration: 3.0,  aroma: "buttery",          threshold: 10.0 }, { name: "Limonene",   concentration: 0.8, aroma: "citrus",       threshold: 0 }],
  D1:  [{ name: "Diacetyl",   concentration: 4.8,  aroma: "buttery",          threshold: 10.0 }, { name: "Butyric acid", concentration: 3.2, aroma: "dairy/tangy", threshold: 8.0 }],
  D2:  [{ name: "Diacetyl",   concentration: 4.6,  aroma: "buttery",          threshold: 10.0 }, { name: "Hexanal",    concentration: 1.8, aroma: "fresh dairy",  threshold: 5.0 }],
  // Bread
  B1:  [{ name: "Acetic acid",           concentration: 9.2,  aroma: "sour/vinegary",   threshold: 6.0  }, { name: "Acetaldehyde",       concentration: 5.8, aroma: "yeasty/fermented", threshold: 7.0 }, { name: "Furfural",   concentration: 3.1, aroma: "caramel/toasted", threshold: 0 }, { name: "Diacetyl", concentration: 1.2, aroma: "buttery", threshold: 10.0 }],
  B2:  [{ name: "Diacetyl",              concentration: 2.1,  aroma: "buttery",          threshold: 10.0 }, { name: "Furfural",           concentration: 1.8, aroma: "caramel/sweet",    threshold: 0 }, { name: "Acetaldehyde", concentration: 1.6, aroma: "yeasty",        threshold: 7.0 }],
  B3:  [{ name: "Furfural",              concentration: 4.6,  aroma: "caramel/toasted",  threshold: 0    }, { name: "Benzaldehyde",       concentration: 1.5, aroma: "nutty/almond",     threshold: 0 }, { name: "Acetaldehyde", concentration: 3.2, aroma: "yeasty",        threshold: 7.0 }, { name: "Hexanal", concentration: 1.3, aroma: "grassy/grain", threshold: 5.0 }],
  B4:  [{ name: "Acetic acid",           concentration: 14.2, aroma: "sour/vinegary",    threshold: 6.0  }, { name: "Propionic acid",     concentration: 8.1, aroma: "pungent/rye",      threshold: 0 }, { name: "Furfural",   concentration: 4.1, aroma: "caramel/toasted", threshold: 0 }, { name: "Acetaldehyde", concentration: 3.4, aroma: "yeasty/fermented", threshold: 7.0 }],
  B5:  [{ name: "Diacetyl",              concentration: 7.2,  aroma: "buttery/rich",     threshold: 10.0 }, { name: "Vanillin",           concentration: 3.8, aroma: "vanilla/sweet",    threshold: 0 }, { name: "Ethyl butanoate", concentration: 2.1, aroma: "fruity/sweet", threshold: 0 }, { name: "2-Phenylethanol", concentration: 1.8, aroma: "rose/honey", threshold: 0 }],
  B6:  [{ name: "Furfural",              concentration: 2.6,  aroma: "caramel/toasted",  threshold: 0    }, { name: "Diacetyl",           concentration: 1.4, aroma: "buttery/mild",     threshold: 10.0 }, { name: "Acetaldehyde", concentration: 1.8, aroma: "yeasty",      threshold: 7.0 }, { name: "1-Octen-3-ol", concentration: 0.8, aroma: "mushroom/earthy", threshold: 0 }],
  B7:  [{ name: "Furfural",              concentration: 3.4,  aroma: "caramel/wholegrain", threshold: 0  }, { name: "Benzaldehyde",       concentration: 1.8, aroma: "nutty/almond",     threshold: 0 }, { name: "Hexanal",    concentration: 1.6, aroma: "grassy/grain",    threshold: 5.0 }, { name: "Acetaldehyde", concentration: 1.4, aroma: "yeasty",        threshold: 7.0 }],
  B8:  [{ name: "Acetic acid",           concentration: 11.4, aroma: "sour/vinegary",    threshold: 6.0  }, { name: "Limonene",           concentration: 6.2, aroma: "caraway/citrus",   threshold: 0 }, { name: "Benzaldehyde", concentration: 2.4, aroma: "nutty/seed",    threshold: 0 }, { name: "Furfural", concentration: 4.2, aroma: "toasted/malty",   threshold: 0 }],
  B9:  [{ name: "2-Acetyl-1-pyrroline",  concentration: 6.8,  aroma: "popcorn/crust",    threshold: 0    }, { name: "Furfural",           concentration: 6.2, aroma: "caramel/toasted",  threshold: 0 }, { name: "Diacetyl",   concentration: 1.1, aroma: "buttery/mild",    threshold: 10.0 }, { name: "Acetaldehyde", concentration: 1.0, aroma: "yeasty/fresh",  threshold: 7.0 }],
  B10: [{ name: "Linalool",              concentration: 4.8,  aroma: "floral/herby",     threshold: 0    }, { name: "Hexanal",            concentration: 2.8, aroma: "olive/green",       threshold: 5.0 }, { name: "Furfural",   concentration: 2.4, aroma: "caramel/toasted", threshold: 0 }, { name: "Diacetyl", concentration: 1.6, aroma: "buttery",          threshold: 10.0 }],
  B11: [{ name: "Acetic acid",           concentration: 7.6,  aroma: "sour/balanced",    threshold: 6.0  }, { name: "2-Acetyl-1-pyrroline", concentration: 4.4, aroma: "popcorn/crust",  threshold: 0 }, { name: "Furfural",   concentration: 3.8, aroma: "caramel/toasted", threshold: 0 }, { name: "Diacetyl", concentration: 1.8, aroma: "buttery",          threshold: 10.0 }],
  B12: [{ name: "Diacetyl",              concentration: 5.8,  aroma: "buttery/rich",     threshold: 10.0 }, { name: "Vanillin",           concentration: 2.8, aroma: "vanilla/sweet",    threshold: 0 }, { name: "Furfural",   concentration: 1.8, aroma: "caramel/mild",    threshold: 0 }, { name: "Acetaldehyde", concentration: 1.0, aroma: "yeasty/mild",   threshold: 7.0 }],
};

export const MOCK_COMPOSITION_DATA: Record<string, ChemicalComposition> = {
  S1: { protein: 18.2, fat: 22.5, moisture: 42.1, pH: 5.8, saltContent: 1.8, calciumMg: 485 },
  S2: { protein: 19.1, fat: 23.8, moisture: 40.5, pH: 5.7, saltContent: 1.9, calciumMg: 502 },
  S3: { protein: 17.5, fat: 21.2, moisture: 43.8, pH: 5.9, saltContent: 1.7, calciumMg: 468 },
  S4: { protein: 18.8, fat: 22.1, moisture: 41.2, pH: 5.8, saltContent: 1.8, calciumMg: 491 },
  S5: { protein: 16.4, fat: 24.5, moisture: 44.2, pH: 6.0, saltContent: 1.6, calciumMg: 445 },
  S6: { protein: 17.2, fat: 25.1, moisture: 43.5, pH: 6.1, saltContent: 1.7, calciumMg: 458 },
  S7: { protein: 16.8, fat: 24.8, moisture: 44.0, pH: 6.0, saltContent: 1.6, calciumMg: 452 },
  S8: { protein: 18.5, fat: 22.8, moisture: 41.8, pH: 5.8, saltContent: 1.8, calciumMg: 488 },
  S9: { protein: 19.0, fat: 23.2, moisture: 41.0, pH: 5.7, saltContent: 1.9, calciumMg: 498 },
  S10: { protein: 17.0, fat: 24.2, moisture: 43.8, pH: 6.0, saltContent: 1.7, calciumMg: 460 },
  S11: { protein: 18.6, fat: 22.4, moisture: 41.5, pH: 5.8, saltContent: 1.8, calciumMg: 490 },
  S12: { protein: 16.9, fat: 24.6, moisture: 43.9, pH: 6.0, saltContent: 1.7, calciumMg: 455 },
  D1: { protein: 24.9, fat: 33.1, moisture: 37.0, pH: 5.2, saltContent: 1.8, calciumMg: 721 },
  D2: { protein: 25.2, fat: 33.5, moisture: 36.5, pH: 5.1, saltContent: 1.9, calciumMg: 735 },
  B1: { protein: 9.4,  fat: 3.2,  moisture: 38.4, pH: 4.2, saltContent: 1.8, calciumMg: 28 },
  B2: { protein: 8.1,  fat: 5.8,  moisture: 40.2, pH: 5.8, saltContent: 1.4, calciumMg: 42 },
  B3: { protein: 10.8, fat: 4.6,  moisture: 36.8, pH: 5.1, saltContent: 1.9, calciumMg: 38 },
  B4: { protein: 9.8,  fat: 2.1,  moisture: 35.6, pH: 3.9, saltContent: 2.0, calciumMg: 24 },
  B5: { protein: 9.6,  fat: 18.4, moisture: 32.4, pH: 6.2, saltContent: 1.2, calciumMg: 68 },
  B6: { protein: 8.4,  fat: 2.8,  moisture: 41.8, pH: 5.6, saltContent: 1.6, calciumMg: 31 },
  B7: { protein: 11.4, fat: 4.2,  moisture: 37.2, pH: 5.4, saltContent: 1.6, calciumMg: 52 },
  B8: { protein: 11.2, fat: 5.6,  moisture: 34.8, pH: 4.1, saltContent: 1.9, calciumMg: 44 },
  B9: { protein: 8.8,  fat: 1.4,  moisture: 32.6, pH: 6.0, saltContent: 1.8, calciumMg: 22 },
  B10: { protein: 8.6, fat: 12.8, moisture: 38.6, pH: 5.8, saltContent: 2.2, calciumMg: 48 },
  B11: { protein: 9.8, fat: 3.6,  moisture: 37.8, pH: 4.4, saltContent: 1.9, calciumMg: 32 },
  B12: { protein: 8.2, fat: 8.2,  moisture: 40.4, pH: 5.9, saltContent: 1.4, calciumMg: 54 },
};

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// Known column aliases for recognition report
export const KNOWN_ALIASES = [
  'sampleid', 'sample', 'id',
  'formulationid', 'formulationcode', 'formulaid', 'formulacode',
  'formulation', 'formulationname', 'formulaname', 'recipe',
  'type', 'category', 'samplename', 'name',
  'ingredientstatement', 'ingredientlist', 'ingredients',
  'sourness', 'bitterness', 'saltiness', 'umami', 'sweetness',
  'compound', 'name', 'concentration', 'aroma', 'odour', 'threshold',
  'protein', 'fat', 'moisture', 'ph', 'saltcontent', 'calciummg',
];

export function recogniseColumns(headers: string[]): ColumnReport {
  const recognised: string[] = [];
  const ignored: string[] = [];
  headers.forEach((h) => {
    const normalised = h.toLowerCase().replace(/[\s_-]/g, '');
    const matched = KNOWN_ALIASES.some((a) => normalised === a || normalised.includes(a) || a.includes(normalised));
    if (matched) recognised.push(h);
    else ignored.push(h);
  });
  return { recognised, ignored };
}

export function parseCSVLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') { current += '"'; i++; }
    else if (char === '"') { inQuotes = !inQuotes; }
    else if (char === "," && !inQuotes) { result.push(current.trim()); current = ""; }
    else { current += char; }
  }
  result.push(current.trim());
  return result.map((v) => v.replace(/^"(.*)"$/, "$1"));
}

export function normalize(value?: string) {
  return (value || "").trim();
}

export function getRowValue(row: Record<string, string>, aliases: string[]) {
  const entries = Object.entries(row).map(([key, value]) => [
    key.toLowerCase().replace(/[\s_-]/g, ""),
    value,
  ]);

  for (const alias of aliases) {
    const normalizedAlias = alias.toLowerCase().replace(/[\s_-]/g, "");
    const found = entries.find(([key]) => key === normalizedAlias);
    if (found) return found[1];
  }

  return "";
}

export const DEMO_TYPES = new Set(['bread', 'dairy', 'pbca']);
export interface StoredImportedData {
  eTongueData: ETongueMeasurement[];
  gcmsData: Record<string, GCMSCompound[]>;
  compositionData: Record<string, ChemicalComposition>;
  ingredientStatements?: Record<string, IngredientStatement>;
  aggregation?: ImportAggregationSummary;
  foodTypeResolution?: ImportFoodTypeResolution;
}

export function mergeInstrumentalData(imported: StoredImportedData | null | undefined): StoredImportedData {
  if (!imported) {
    return {
      eTongueData: MOCK_ETONGUE_DATA,
      gcmsData: MOCK_GCMS_DATA,
      compositionData: MOCK_COMPOSITION_DATA,
      ingredientStatements: {},
    };
  }

  const samplesById = new Map<string, ETongueMeasurement>();
  MOCK_ETONGUE_DATA.forEach(sample => samplesById.set(sample.sampleId, sample));
  imported.eTongueData.forEach(sample => samplesById.set(sample.sampleId, sample));

  return {
    eTongueData: [...samplesById.values()],
    gcmsData: { ...MOCK_GCMS_DATA, ...imported.gcmsData },
    compositionData: { ...MOCK_COMPOSITION_DATA, ...imported.compositionData },
    ingredientStatements: { ...(imported.ingredientStatements ?? {}) },
  };
}

export function normalizeTypeLabel(value?: string, allowUnknown = false) {
  const normalized = normalize(value);
  if (!normalized) return "";
  const matchedFoodType = resolveDeclaredFoodType(normalized);
  if (matchedFoodType) return matchedFoodType.slug;
  if (allowUnknown) return slugifyFoodType(normalized);
  return "";
}

function resolveImportFoodType(rows: Record<string, string>[]): {
  detection: FoodTypeDetection;
  resolution: ImportFoodTypeResolution;
} {
  const declaredValues = Array.from(new Set(rows
    .map(row => getRowValue(row, ['foodType', 'food_type', 'productType', 'product_type', 'type']).trim())
    .filter(Boolean)));

  const unresolvedDetection: FoodTypeDetection = {
    slug: 'generic',
    label: 'Product type needed',
    confidence: 0,
    evidence: [],
    aliases: [],
    modifiers: [],
  };
  if (declaredValues.length === 0) {
    return {
      detection: unresolvedDetection,
      resolution: { status: 'missing', declaredValues },
    };
  }

  const resolved = declaredValues.map(value => resolveDeclaredFoodType(value));
  if (resolved.some(profile => profile === null)) {
    return {
      detection: unresolvedDetection,
      resolution: { status: 'unrecognized', declaredValues },
    };
  }

  const familySlugs = Array.from(new Set(resolved.map(profile => profile!.parentSlug ?? profile!.slug)));
  if (familySlugs.length !== 1) {
    return {
      detection: unresolvedDetection,
      resolution: { status: 'conflicting', declaredValues },
    };
  }

  const profile = getFoodTypeProfile(familySlugs[0]);
  return {
    detection: {
      slug: profile.slug,
      label: profile.label,
      confidence: 1,
      evidence: declaredValues.map(value => `Food type column: ${value}`),
      aliases: profile.aliases,
      modifiers: [],
    },
    resolution: { status: 'matched', declaredValues },
  };
}

export function inferType(_sampleId: string, csvType?: string, csvCategory?: string, _sampleName?: string) {
  const explicitType = normalizeTypeLabel(csvType);
  if (explicitType) return explicitType;

  const categoryType = normalizeTypeLabel(csvCategory);
  if (categoryType) return categoryType;
  return "generic";
}

export function inferYogurtCategory(sampleName?: string, csvCategory?: string) {
  const text = `${csvCategory ?? ""} ${sampleName ?? ""}`.toLowerCase();
  if (!text.trim()) return "";
  if (text.includes("coconut")) return "Coconut cultured";
  if (text.includes("oat")) return "Oat cultured";
  if (text.includes("skyr")) return "Low sugar skyr";
  if (text.includes("greek") || text.includes("strained")) return "Greek strained";
  if (text.includes("kefir")) return "Lemon kefir";
  if (text.includes("strawberry") || text.includes("fruit")) return "Strawberry fruit";
  if (text.includes("vanilla") || text.includes("high protein") || text.includes("protein")) return "High protein vanilla";
  if (text.includes("whole milk") || text.includes("plain")) return "Whole milk plain";
  return "";
}

export function inferCategory(sampleId: string, csvCategory?: string, type?: string, sampleName?: string) {
  const normalized = normalize(csvCategory);
  const yogurtCategory = type === "yogurt" ? inferYogurtCategory(sampleName, normalized) : "";
  if (yogurtCategory) return yogurtCategory;
  if (normalized) return normalized;
  if (type === "dairy") return "Dairy";
  if (type === "yogurt") return "Yogurt";
  if (type === "bread") return "Bread";
  if (type === "meat") return "Meat";
  if (type) return formatFoodTypeLabel(type);
  return "Coconut-based";
}

export function getPointColor(type?: string, category?: string) {
  if (type === "dairy" || category === "Dairy") return STATUS.go;
  // Yogurt styles are sample identities, not semantic chart categories. A
  // shared family color keeps large yogurt projects readable; selection and
  // tooltips carry the individual sample identity.
  if (type === "yogurt") return "#0f766e";
  if (type === "bread") {
    const c = (category || "").toLowerCase();
    if (c.includes("sourdough")) return "#d97706";
    if (c.includes("rye") || c.includes("seeded")) return "#92400e";
    if (c.includes("brioche") || c.includes("enriched")) return STATUS.tweak;
    if (c.includes("ciabatta")) return "#ea580c";
    if (c.includes("baguette")) return "#b45309";
    if (c.includes("focaccia")) return "#16a34a";
    if (c.includes("wheat") || c.includes("multigrain")) return "#78350f";
    if (c.includes("white") || c.includes("sandwich")) return "#fbbf24";
    return "#d97706";
  }
  if (type === "meat") {
    const c = (category || "").toLowerCase();
    if (c.includes("chicken") || c.includes("poultry") || c.includes("turkey")) return "#ca8a04";
    if (c.includes("pork") || c.includes("bacon") || c.includes("ham")) return "#db2777";
    if (c.includes("fish") || c.includes("seafood") || c.includes("salmon") || c.includes("tuna")) return "#0891b2";
    if (c.includes("lamb")) return "#7c3aed";
    return "#b91c1c";
  }
  if (category === "Oat-based")   return "#8b5cf6";
  if (category === "Almond-based") return "#ec4899";
  if (category === "Mixed base")  return "#6366f1";
  if (category === "Cashew-based") return STATUS.tweak;
  return STATUS.info;
}

type NumericTotal = { sum: number; count: number };

const TASTE_FIELDS = ['sourness', 'bitterness', 'saltiness', 'umami', 'sweetness'] as const;
const COMPOSITION_FIELDS = ['protein', 'fat', 'moisture', 'pH', 'saltContent', 'calciumMg'] as const;

type TasteField = typeof TASTE_FIELDS[number];
type CompositionField = typeof COMPOSITION_FIELDS[number];

function emptyNumericTotals<T extends string>(fields: readonly T[]): Record<T, NumericTotal> {
  return Object.fromEntries(fields.map(field => [field, { sum: 0, count: 0 }])) as Record<T, NumericTotal>;
}

function addNumeric(total: NumericTotal, value: string) {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return;
  total.sum += numeric;
  total.count += 1;
}

function numericMean(total: NumericTotal) {
  return total.count > 0 ? total.sum / total.count : null;
}

interface ReplicateTotals {
  taste: Record<TasteField, NumericTotal>;
  composition: Record<CompositionField, NumericTotal>;
  measurements: Map<string, MetricTotal>;
}

interface MetricTotal extends NumericTotal {
  key: string;
  label: string;
  unit: string;
}

interface CompoundReplicateTotals {
  concentration: NumericTotal;
  threshold: NumericTotal;
  aroma: string;
}

interface FormulationTotals {
  sampleId: string;
  sampleName: string;
  type: string;
  category: string;
  replicates: Map<string, ReplicateTotals>;
  compounds: Map<string, Map<string, CompoundReplicateTotals>>;
  ingredientStatement: string;
}

const NON_MEASUREMENT_COLUMNS = new Set([
  'sampleid', 'sample', 'id', 'samplecode', 'code', 'samplename', 'samplelabel',
  'productname', 'product', 'food', 'formulationid', 'formulationcode', 'formulaid',
  'formulacode', 'formulationname', 'formulation', 'formulaname', 'recipe',
  'foodtype', 'type', 'producttype', 'category', 'subcategory',
  'ingredientstatement', 'ingredientlist', 'ingredients',
  'compound', 'compoundname', 'analyte', 'concentration', 'concentrationppm',
  'amount', 'aroma', 'odour', 'odor', 'descriptor', 'threshold', 'odourthreshold',
  'odorthreshold',
]);

function normalizedColumn(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function metricKey(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'measurement';
}

export function parseMeasurementHeader(header: string) {
  const trimmed = header.trim();
  const match = trimmed.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  return {
    key: metricKey(trimmed),
    label: (match?.[1] || trimmed).trim(),
    unit: (match?.[2] || '').trim(),
  };
}

function rowMeasurements(row: Record<string, string>) {
  const source = getRawImportColumns(row) ?? row;
  return Object.entries(source).flatMap(([header, value]) => {
    if (NON_MEASUREMENT_COLUMNS.has(normalizedColumn(header))) return [];
    const numeric = Number(value);
    if (!value.trim() || !Number.isFinite(numeric)) return [];
    return [{ ...parseMeasurementHeader(header), value: numeric }];
  });
}

function meanAcrossReplicates(
  replicates: Iterable<ReplicateTotals>,
  section: 'taste' | 'composition',
  field: TasteField | CompositionField,
) {
  const replicateMeans = [...replicates]
    .map(replicate => numericMean((replicate[section] as Record<string, NumericTotal>)[field]))
    .filter((value): value is number => value !== null);
  return replicateMeans.length > 0
    ? replicateMeans.reduce((sum, value) => sum + value, 0) / replicateMeans.length
    : null;
}

export function buildImportedDataset(previewData: Record<string, string>[], _uploadedFile?: string | null) {
  const formulations = new Map<string, FormulationTotals>();
  const foodType = resolveImportFoodType(previewData);
  const declaredFoodType = foodType.resolution.status === 'matched' ? foodType.detection.slug : null;
  let groupedByFormulation = false;

  previewData.forEach((row, index) => {
    const explicitReplicateId = getRowValue(row, ["sampleId", "sample", "id", "sampleCode", "code"]);
    const replicateId = explicitReplicateId || `Imported-${index + 1}`;
    const replicateName = getRowValue(row, ["sampleName", "sampleLabel", "productName", "product", "food", "sample"]);
    const formulationId = getRowValue(row, ["formulationId", "formulationCode", "formulaId", "formulaCode"]);
    const formulationName = getRowValue(row, ["formulationName", "formulation", "formulaName", "recipe"]);
    const implicitFormulationName = !explicitReplicateId && !formulationId && !formulationName
      ? normalize(replicateName)
      : '';
    const sampleId = normalize(formulationId) || normalize(formulationName) || implicitFormulationName || replicateId;
    const sampleName = normalize(formulationName) || implicitFormulationName || replicateName || sampleId;
    groupedByFormulation ||= Boolean(normalize(formulationId) || normalize(formulationName) || implicitFormulationName);

    const csvCategory = getRowValue(row, ["category", "foodType", "food_type", "productType", "product_type"]);
    const type = declaredFoodType ?? 'generic';
    const category = declaredFoodType
      ? inferCategory(sampleId, csvCategory, type, sampleName)
      : 'Unconfirmed';

    let formulation = formulations.get(sampleId);
    if (!formulation) {
      formulation = {
        sampleId,
        sampleName,
        type,
        category,
        replicates: new Map(),
        compounds: new Map(),
        ingredientStatement: '',
      };
      formulations.set(sampleId, formulation);
    }

    let replicate = formulation.replicates.get(replicateId);
    if (!replicate) {
      replicate = {
        taste: emptyNumericTotals(TASTE_FIELDS),
        composition: emptyNumericTotals(COMPOSITION_FIELDS),
        measurements: new Map(),
      };
      formulation.replicates.set(replicateId, replicate);
    }

    TASTE_FIELDS.forEach(field => addNumeric(replicate!.taste[field], getRowValue(row, [field])));
    COMPOSITION_FIELDS.forEach(field => addNumeric(replicate!.composition[field], getRowValue(row, [field])));
    rowMeasurements(row).forEach(measurement => {
      const existing = replicate!.measurements.get(measurement.key) ?? {
        key: measurement.key,
        label: measurement.label,
        unit: measurement.unit,
        sum: 0,
        count: 0,
      };
      existing.sum += measurement.value;
      existing.count += 1;
      replicate!.measurements.set(measurement.key, existing);
    });

    const ingredientStatement = getRowValue(row, [
      'ingredientStatement', 'ingredient_statement', 'ingredientList', 'ingredient_list', 'ingredients',
    ]).trim();
    if (ingredientStatement && !formulation.ingredientStatement) formulation.ingredientStatement = ingredientStatement;

    const compoundName = getRowValue(row, ['compound', 'compoundName', 'analyte', 'name']).trim();
    const concentration = getRowValue(row, ['concentration', 'concentrationPpm', 'amount']);
    if (compoundName && Number.isFinite(Number.parseFloat(concentration))) {
      let compoundReplicates = formulation.compounds.get(compoundName);
      if (!compoundReplicates) {
        compoundReplicates = new Map();
        formulation.compounds.set(compoundName, compoundReplicates);
      }
      let compound = compoundReplicates.get(replicateId);
      if (!compound) {
        compound = {
          concentration: { sum: 0, count: 0 },
          threshold: { sum: 0, count: 0 },
          aroma: getRowValue(row, ['aroma', 'odour', 'odor', 'descriptor']) || 'unknown',
        };
        compoundReplicates.set(replicateId, compound);
      }
      addNumeric(compound.concentration, concentration);
      addNumeric(compound.threshold, getRowValue(row, ['threshold', 'odourThreshold', 'odorThreshold']));
    }
  });

  const eTongueData: ETongueMeasurement[] = [];
  const gcmsData: Record<string, GCMSCompound[]> = {};
  const compositionData: Record<string, ChemicalComposition> = {};
  const ingredientStatements: Record<string, IngredientStatement> = {};

  formulations.forEach(formulation => {
    const tasteMeans = Object.fromEntries(TASTE_FIELDS.map(field => [
      field,
      meanAcrossReplicates(formulation.replicates.values(), 'taste', field),
    ])) as Record<TasteField, number | null>;
    const hasTaste = Object.values(tasteMeans).some(value => value !== null);

    if (formulation.ingredientStatement) {
      ingredientStatements[formulation.sampleId] = {
        text: formulation.ingredientStatement,
        source: 'csv_import',
        updatedAt: null,
      };
    }

    const metricDefinitions = new Map<string, Pick<MetricTotal, 'key' | 'label' | 'unit'>>();
    formulation.replicates.forEach(replicate => replicate.measurements.forEach(metric => {
      if (!metricDefinitions.has(metric.key)) metricDefinitions.set(metric.key, metric);
    }));
    const measurements = [...metricDefinitions.values()].map(definition => {
      const replicateMeans = [...formulation.replicates.values()]
        .map(replicate => replicate.measurements.get(definition.key))
        .filter((metric): metric is MetricTotal => Boolean(metric?.count))
        .map(metric => metric.sum / metric.count);
      return {
        ...definition,
        mean: replicateMeans.reduce((sum, value) => sum + value, 0) / replicateMeans.length,
        observationCount: replicateMeans.length,
      };
    });

    if (hasTaste || measurements.length > 0) {
      eTongueData.push({
        sampleId: formulation.sampleId,
        sampleName: formulation.sampleName,
        sourness: tasteMeans.sourness ?? 0,
        bitterness: tasteMeans.bitterness ?? 0,
        saltiness: tasteMeans.saltiness ?? 0,
        umami: tasteMeans.umami ?? 0,
        sweetness: tasteMeans.sweetness ?? 0,
        type: formulation.type,
        category: formulation.category,
        ingredientStatement: ingredientStatements[formulation.sampleId],
        hasETongueData: hasTaste,
        measurements,
      });
    }

    const compositionMeans = Object.fromEntries(COMPOSITION_FIELDS.map(field => [
      field,
      meanAcrossReplicates(formulation.replicates.values(), 'composition', field),
    ])) as Record<CompositionField, number | null>;
    if (Object.values(compositionMeans).filter(value => value !== null).length >= 2) {
      compositionData[formulation.sampleId] = {
        protein: compositionMeans.protein ?? 0,
        fat: compositionMeans.fat ?? 0,
        moisture: compositionMeans.moisture ?? 0,
        pH: compositionMeans.pH ?? 0,
        saltContent: compositionMeans.saltContent ?? 0,
        calciumMg: compositionMeans.calciumMg ?? 0,
      };
    }

    const compounds = [...formulation.compounds.entries()].map(([name, replicateMap]) => {
      const replicateCompounds = [...replicateMap.values()];
      const concentrationMeans = replicateCompounds
        .map(compound => numericMean(compound.concentration))
        .filter((value): value is number => value !== null);
      const thresholdMeans = replicateCompounds
        .map(compound => numericMean(compound.threshold))
        .filter((value): value is number => value !== null);
      return {
        name,
        concentration: concentrationMeans.reduce((sum, value) => sum + value, 0) / concentrationMeans.length,
        aroma: replicateCompounds.find(compound => compound.aroma)?.aroma || 'unknown',
        threshold: thresholdMeans.length > 0
          ? thresholdMeans.reduce((sum, value) => sum + value, 0) / thresholdMeans.length
          : 0,
      };
    });
    if (compounds.length > 0) gcmsData[formulation.sampleId] = compounds;
  });

  const detection = foodType.detection;
  const aggregation = {
    groupedByFormulation,
    sourceRowCount: previewData.length,
    sourceSampleCount: [...formulations.values()].reduce((total, formulation) => total + formulation.replicates.size, 0),
    formulationCount: formulations.size,
    averagedFormulationCount: [...formulations.values()].filter(formulation => formulation.replicates.size > 1).length,
  };
  return {
    eTongueData,
    gcmsData,
    compositionData,
    ingredientStatements,
    aggregation,
    detection,
    foodTypeResolution: foodType.resolution,
  };
}

export function validateImportedDataset(
  rows: Record<string, string>[],
  dataset: StoredImportedData,
  columnReport: ColumnReport | null,
  detection?: { confidence: number; label: string },
): ImportValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sampleIds = rows.map((row, index) =>
    getRowValue(row, ["sampleId", "sample", "id", "sampleCode", "code"]) || `Imported-${index + 1}`
  );
  const duplicates = sampleIds.filter((id, index) => sampleIds.indexOf(id) !== index);

  if (rows.length === 0) errors.push('No data rows found.');
  if (dataset.eTongueData.length === 0) errors.push('No numeric formulation measurements were found.');
  if (!columnReport || columnReport.recognised.length === 0) errors.push('No recognized columns found.');
  if (dataset.foodTypeResolution && !['matched', 'confirmed'].includes(dataset.foodTypeResolution.status)) {
    errors.push('Confirm the product type before creating this project.');
  }
  if (duplicates.length > 0 && !dataset.aggregation?.groupedByFormulation) warnings.push(`Duplicate sample IDs detected: ${Array.from(new Set(duplicates)).join(', ')}.`);
  if ((columnReport?.ignored.length ?? 0) > 0) warnings.push(`${columnReport?.ignored.length} column${columnReport?.ignored.length === 1 ? '' : 's'} will be ignored.`);
  if (!dataset.foodTypeResolution && detection && detection.confidence < 0.75) warnings.push(`Food type detection is low confidence (${Math.round(detection.confidence * 100)}%). Confirm ${detection.label} before importing.`);
  const hasGenericMeasurements = dataset.eTongueData.some(sample => (sample.measurements?.length ?? 0) > 0);
  if (Object.keys(dataset.gcmsData).length === 0 && !hasGenericMeasurements) warnings.push('No GC-MS compounds found. Aroma/off-note panels will be empty for this batch.');
  if (Object.keys(dataset.compositionData).length === 0 && !hasGenericMeasurements) warnings.push('No composition profiles found. Nutrition/composition cards will be empty for this batch.');

  return { errors, warnings };
}

export function applyImportedDataset(
  dataset: StoredImportedData,
  setETongueData: (data: ETongueMeasurement[]) => void,
  setGcmsData: (data: Record<string, GCMSCompound[]>) => void,
  setCompositionData: (data: Record<string, ChemicalComposition>) => void,
  setSelectedSamples: (samples: string[]) => void,
) {
  const mergedDataset = mergeInstrumentalData(dataset);
  if (mergedDataset.eTongueData.length > 0) {
    setETongueData(mergedDataset.eTongueData);
    setSelectedSamples([dataset.eTongueData[0]?.sampleId ?? mergedDataset.eTongueData[0].sampleId]);
  }
  setGcmsData(mergedDataset.gcmsData);
  setCompositionData(mergedDataset.compositionData);
}
