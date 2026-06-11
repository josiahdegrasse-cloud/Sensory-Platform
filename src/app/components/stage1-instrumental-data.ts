// Pure data + import-pipeline logic for the Instrumental (Stage 1) screen.
// Extracted from stage1-instrumental.tsx to keep the component file focused on
// rendering. No React here — everything is unit-testable in isolation.
import { matchFoodType } from "../contexts/food-type-context";
import { detectFoodType, formatFoodTypeLabel, slugifyFoodType } from "../lib/food-intelligence";
import { STATUS } from "../styles/tokens";

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
  savedPermanently: boolean;
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
  'type', 'category', 'samplename', 'name',
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
}

export function mergeInstrumentalData(imported: StoredImportedData | null | undefined): StoredImportedData {
  if (!imported) {
    return {
      eTongueData: MOCK_ETONGUE_DATA,
      gcmsData: MOCK_GCMS_DATA,
      compositionData: MOCK_COMPOSITION_DATA,
    };
  }

  const samplesById = new Map<string, ETongueMeasurement>();
  MOCK_ETONGUE_DATA.forEach(sample => samplesById.set(sample.sampleId, sample));
  imported.eTongueData.forEach(sample => samplesById.set(sample.sampleId, sample));

  return {
    eTongueData: [...samplesById.values()],
    gcmsData: { ...MOCK_GCMS_DATA, ...imported.gcmsData },
    compositionData: { ...MOCK_COMPOSITION_DATA, ...imported.compositionData },
  };
}

export function normalizeTypeLabel(value?: string, allowUnknown = false) {
  const normalized = normalize(value);
  if (!normalized) return "";
  const matchedFoodType = matchFoodType(normalized);
  if (matchedFoodType === "cheese") return "dairy";
  const normalizedSlug = slugifyFoodType(normalized);
  if (matchedFoodType !== normalizedSlug && matchedFoodType !== "generic") return slugifyFoodType(matchedFoodType);
  if (allowUnknown) return normalizedSlug;
  return "";
}

export function inferType(sampleId: string, csvType?: string, csvCategory?: string, sampleName?: string) {
  const explicitType = normalizeTypeLabel(csvType, true);
  if (explicitType) return explicitType;

  const categoryType = normalizeTypeLabel(csvCategory);
  if (categoryType) return categoryType;

  const nameType = normalizeTypeLabel(sampleName);
  if (nameType) return nameType;

  const prefix = sampleId.toUpperCase();
  if (prefix.startsWith("B")) return "bread";
  if (prefix.startsWith("M")) return "meat";
  return prefix.startsWith("D") ? "dairy" : "pbca";
}

export function inferCategory(sampleId: string, csvCategory?: string, type?: string) {
  const normalized = normalize(csvCategory);
  if (normalized) return normalized;
  if (type === "dairy") return "Dairy";
  if (type === "bread") return "Bread";
  if (type === "meat") return "Meat";
  if (type) return formatFoodTypeLabel(type);
  return "Coconut-based";
}

export function getPointColor(type?: string, category?: string) {
  if (type === "dairy" || category === "Dairy") return STATUS.go;
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

export function buildImportedDataset(previewData: Record<string, string>[], uploadedFile?: string | null) {
  const eTongueMap = new Map<string, ETongueMeasurement>();
  const gcmsMap: Record<string, GCMSCompound[]> = {};
  const compositionMap: Record<string, ChemicalComposition> = {};

  const detectionValues: string[] = [uploadedFile ?? ""];
  previewData.forEach((row, index) => {
    const sampleId =
      getRowValue(row, ["sampleId", "sample", "id", "sampleCode", "code"]) || `Imported-${index + 1}`;
    const sampleName = getRowValue(row, ["sampleName", "sampleLabel", "productName", "product", "food", "sample"]);
    const csvCategory = getRowValue(row, ["category", "foodType", "food_type", "productType", "product_type"]);
    const csvType = getRowValue(row, ["type", "foodType", "food_type", "productType", "product_type"]);
    const type = inferType(sampleId, csvType, csvCategory, sampleName);
    const category = inferCategory(sampleId, csvCategory, type);

    detectionValues.push(sampleId, sampleName, csvCategory, csvType, category, type);

    const sourness   = parseFloat(row.sourness   || row.Sourness   || row.SOURNESS   || "NaN");
    const bitterness = parseFloat(row.bitterness || row.Bitterness || row.BITTERNESS || "NaN");
    const saltiness  = parseFloat(row.saltiness  || row.Saltiness  || row.SALTINESS  || "NaN");
    const umami      = parseFloat(row.umami      || row.Umami      || row.UMAMI      || "NaN");
    const sweetness  = parseFloat(row.sweetness  || row.Sweetness  || row.SWEETNESS  || "NaN");

    const hasAnyTaste = [sourness, bitterness, saltiness, umami, sweetness].some((v) => !Number.isNaN(v));
    if (hasAnyTaste && !eTongueMap.has(sampleId)) {
      eTongueMap.set(sampleId, {
        sampleId,
        sampleName,
        sourness:   Number.isNaN(sourness)   ? 0 : sourness,
        bitterness: Number.isNaN(bitterness) ? 0 : bitterness,
        saltiness:  Number.isNaN(saltiness)  ? 0 : saltiness,
        umami:      Number.isNaN(umami)      ? 0 : umami,
        sweetness:  Number.isNaN(sweetness)  ? 0 : sweetness,
        type,
        category,
      });
    }

    const compoundName  = row.compound || row.Compound || row.name || row.Name;
    const concentration = parseFloat(row.concentration || row.Concentration || row.CONCENTRATION || "NaN");
    const aroma         = row.aroma || row.Aroma || row.odour || row.Odour || "";
    const threshold     = parseFloat(row.threshold || row.Threshold || row.THRESHOLD || "NaN");

    if (compoundName && !Number.isNaN(concentration)) {
      if (!gcmsMap[sampleId]) gcmsMap[sampleId] = [];
      const alreadyExists = gcmsMap[sampleId].some((c) => c.name === compoundName);
      if (!alreadyExists) {
        gcmsMap[sampleId].push({
          name: compoundName,
          concentration,
          aroma: aroma || "unknown",
          threshold: Number.isNaN(threshold) ? 0 : threshold,
        });
      }
    }

    const protein     = parseFloat(row.protein     || row.Protein     || "NaN");
    const fat         = parseFloat(row.fat         || row.Fat         || "NaN");
    const moisture    = parseFloat(row.moisture    || row.Moisture    || "NaN");
    const pH          = parseFloat(row.pH          || row.PH          || "NaN");
    const saltContent = parseFloat(row.saltContent || row.SaltContent || "NaN");
    const calciumMg   = parseFloat(row.calciumMg   || row.CalciumMg   || "NaN");

    const compFields = [protein, fat, moisture, pH, saltContent, calciumMg];
    const validCompCount = compFields.filter((v) => !Number.isNaN(v)).length;
    if (validCompCount >= 2 && !compositionMap[sampleId]) {
      compositionMap[sampleId] = {
        protein:     Number.isNaN(protein)     ? 0 : protein,
        fat:         Number.isNaN(fat)         ? 0 : fat,
        moisture:    Number.isNaN(moisture)    ? 0 : moisture,
        pH:          Number.isNaN(pH)          ? 0 : pH,
        saltContent: Number.isNaN(saltContent) ? 0 : saltContent,
        calciumMg:   Number.isNaN(calciumMg)   ? 0 : calciumMg,
      };
    }
  });

  const eTongueData = Array.from(eTongueMap.values());
  const detection = detectFoodType(...detectionValues);
  const explicitTypes = Array.from(new Set(eTongueData.map(sample => sample.type).filter(Boolean))) as string[];
  if (explicitTypes.length === 1 && explicitTypes[0] && !DEMO_TYPES.has(explicitTypes[0])) {
    const explicitSlug = slugifyFoodType(explicitTypes[0]);
    return {
      eTongueData,
      gcmsData: gcmsMap,
      compositionData: compositionMap,
      detection: {
        ...detection,
        slug: explicitSlug,
        label: formatFoodTypeLabel(explicitSlug),
        confidence: Math.max(detection.confidence, 0.88),
      },
    };
  }

  return { eTongueData, gcmsData: gcmsMap, compositionData: compositionMap, detection };
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
  if (dataset.eTongueData.length === 0) errors.push('No e-tongue taste values found. Include at least one of sourness, bitterness, saltiness, umami, or sweetness.');
  if (!columnReport || columnReport.recognised.length === 0) errors.push('No recognized columns found.');
  if (duplicates.length > 0) warnings.push(`Duplicate sample IDs detected: ${Array.from(new Set(duplicates)).join(', ')}.`);
  if ((columnReport?.ignored.length ?? 0) > 0) warnings.push(`${columnReport?.ignored.length} column${columnReport?.ignored.length === 1 ? '' : 's'} will be ignored.`);
  if (detection && detection.confidence < 0.75) warnings.push(`Food type detection is low confidence (${Math.round(detection.confidence * 100)}%). Confirm ${detection.label} before importing.`);
  if (Object.keys(dataset.gcmsData).length === 0) warnings.push('No GC-MS compounds found. Aroma/off-note panels will be empty for this batch.');
  if (Object.keys(dataset.compositionData).length === 0) warnings.push('No composition profiles found. Nutrition/composition cards will be empty for this batch.');

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
