import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { matchFoodType, useFoodType } from "../contexts/food-type-context";
import { useAuth } from "../contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { FlaskConical, AlertCircle, Upload, X, Check, Download, BarChart3, ClipboardList, Lightbulb, ArrowRight } from "lucide-react";
import { SAMPLES } from "../data/samples";
import { detectFoodType, formatFoodTypeLabel, slugifyFoodType } from "../lib/food-intelligence";
import { useInsertInstrumentalImport, useInstrumentalDataset } from "../lib/hooks";
import { isMissingFoodImportSchema } from "../lib/database";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { JargonTooltip } from "./jargon-tooltip";

interface ETongueMeasurement {
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

interface GCMSCompound {
  name: string;
  concentration: number;
  aroma: string;
  threshold: number;
}

interface ChemicalComposition {
  protein: number;
  fat: number;
  moisture: number;
  pH: number;
  saltContent: number;
  calciumMg: number;
}

interface ColumnReport {
  recognised: string[];
  ignored: string[];
}

interface ImportValidationReport {
  errors: string[];
  warnings: string[];
}

interface ImportCompletionSummary {
  foodTypeSlug: string;
  foodTypeLabel: string;
  projectName: string;
  sampleCount: number;
  gcmsCount: number;
  compositionCount: number;
  savedPermanently: boolean;
}

const MOCK_ETONGUE_DATA: ETongueMeasurement[] = [
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

const MOCK_GCMS_DATA: Record<string, GCMSCompound[]> = {
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

const MOCK_COMPOSITION_DATA: Record<string, ChemicalComposition> = {
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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// Known column aliases for recognition report
const KNOWN_ALIASES = [
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
    const normalised = h.toLowerCase().replace(/[\s_\-]/g, '');
    const matched = KNOWN_ALIASES.some((a) => normalised === a || normalised.includes(a) || a.includes(normalised));
    if (matched) recognised.push(h);
    else ignored.push(h);
  });
  return { recognised, ignored };
}

function parseCSVLine(line: string) {
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

function normalize(value?: string) {
  return (value || "").trim();
}

function getRowValue(row: Record<string, string>, aliases: string[]) {
  const entries = Object.entries(row).map(([key, value]) => [
    key.toLowerCase().replace(/[\s_\-]/g, ""),
    value,
  ]);

  for (const alias of aliases) {
    const normalizedAlias = alias.toLowerCase().replace(/[\s_\-]/g, "");
    const found = entries.find(([key]) => key === normalizedAlias);
    if (found) return found[1];
  }

  return "";
}

const DEMO_TYPES = new Set<string>();
const IMPORTED_DATA_STORAGE_KEY = 'sensory-dashboard-imported-machine-data';

interface StoredImportedData {
  eTongueData: ETongueMeasurement[];
  gcmsData: Record<string, GCMSCompound[]>;
  compositionData: Record<string, ChemicalComposition>;
}

function mergeInstrumentalData(imported: StoredImportedData | null | undefined): StoredImportedData {
  return imported ?? { eTongueData: [], gcmsData: {}, compositionData: {} };
}

function loadImportedData(): StoredImportedData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(IMPORTED_DATA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.eTongueData)) return null;
    return {
      eTongueData: parsed.eTongueData,
      gcmsData: parsed.gcmsData ?? {},
      compositionData: parsed.compositionData ?? {},
    };
  } catch {
    return null;
  }
}

function normalizeTypeLabel(value?: string, allowUnknown = false) {
  const normalized = normalize(value);
  if (!normalized) return "";
  const matchedFoodType = matchFoodType(normalized);
  if (matchedFoodType === "cheese") return "dairy";
  const normalizedSlug = slugifyFoodType(normalized);
  if (matchedFoodType !== normalizedSlug && matchedFoodType !== "generic") return slugifyFoodType(matchedFoodType);
  if (allowUnknown) return normalizedSlug;
  return "";
}

function inferType(sampleId: string, csvType?: string, csvCategory?: string, sampleName?: string) {
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

function inferCategory(sampleId: string, csvCategory?: string, type?: string) {
  const normalized = normalize(csvCategory);
  if (normalized) return normalized;
  if (type === "dairy") return "Dairy";
  if (type === "bread") return "Bread";
  if (type === "meat") return "Meat";
  if (type) return formatFoodTypeLabel(type);
  return "Coconut-based";
}

function getPointColor(type?: string, category?: string) {
  if (type === "dairy" || category === "Dairy") return "#10b981";
  if (type === "bread") {
    const c = (category || "").toLowerCase();
    if (c.includes("sourdough")) return "#d97706";
    if (c.includes("rye") || c.includes("seeded")) return "#92400e";
    if (c.includes("brioche") || c.includes("enriched")) return "#f59e0b";
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
  if (category === "Cashew-based") return "#f59e0b";
  return "#3b82f6";
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

function applyImportedDataset(
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

export function Stage1Instrumental() {
  const storedImportedData = useMemo(() => null, []);
  const initialDataset = useMemo(() => mergeInstrumentalData(storedImportedData), [storedImportedData]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const instrumentalDatasetQuery = useInstrumentalDataset(user?.role === 'admin');
  const insertInstrumentalImport = useInsertInstrumentalImport();
  const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
  const [eTongueData, setETongueData] = useState<ETongueMeasurement[]>(initialDataset.eTongueData);
  const [gcmsData, setGcmsData] = useState<Record<string, GCMSCompound[]>>(initialDataset.gcmsData);
  const [compositionData, setCompositionData] = useState<Record<string, ChemicalComposition>>(initialDataset.compositionData);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3 | 4>(1);
  const [batchName, setBatchName] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [lastImportSummary, setLastImportSummary] = useState<ImportCompletionSummary | null>(null);
  const [columnReport, setColumnReport] = useState<ColumnReport | null>(null);
  const [usingDemoData, setUsingDemoData] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { foodType, subCategory, setSelection, registerFoodTypes, archivedFoodTypes, clearExtraFoodTypes } = useFoodType();

  const importSummary = useMemo(() => {
    if (!showPreview || previewData.length === 0) return null;
    const parsed = buildImportedDataset(previewData, uploadedFile);
    return {
      ...parsed,
      sampleCount: parsed.eTongueData.length,
      gcmsCount: Object.keys(parsed.gcmsData).length,
      compositionCount: Object.keys(parsed.compositionData).length,
    };
  }, [previewData, showPreview, uploadedFile]);
  const existingProjectCount = useMemo(() => {
    if (!importSummary) return 0;
    return (instrumentalDatasetQuery.data?.eTongueData ?? [])
      .filter(sample => sample.type === importSummary.detection.slug)
      .reduce((ids, sample) => {
        if (sample.importBatchId) ids.add(sample.importBatchId);
        return ids;
      }, new Set<string>()).size;
  }, [importSummary, instrumentalDatasetQuery.data]);

  const validationReport = useMemo(() => {
    if (!showPreview || !importSummary) return null;
    return validateImportedDataset(previewData, importSummary, columnReport, importSummary.detection);
  }, [columnReport, importSummary, previewData, showPreview]);

  useEffect(() => {
    const dataset = instrumentalDatasetQuery.data;
    if (!dataset || dataset.eTongueData.length === 0) return;
    const mergedDataset = mergeInstrumentalData(dataset);
    setETongueData(mergedDataset.eTongueData);
    setGcmsData(mergedDataset.gcmsData);
    setCompositionData(mergedDataset.compositionData);
    setUsingDemoData(false);
    if (!mergedDataset.eTongueData.find(sample => sample.sampleId === selectedSamples[0])) {
      setSelectedSamples([mergedDataset.eTongueData[0].sampleId]);
    }
  }, [instrumentalDatasetQuery.data, selectedSamples]);

  const importedFoodTypes = useMemo(() => [...new Set(
    eTongueData.map(s => s.type).filter((t): t is string => !!t && !DEMO_TYPES.has(t))
  )].sort(), [eTongueData]);

  // Reactively register any novel food types whenever imported data changes
  useEffect(() => {
    if (usingDemoData) {
      clearExtraFoodTypes();
      return;
    }
    registerFoodTypes(importedFoodTypes);
  }, [clearExtraFoodTypes, importedFoodTypes, registerFoodTypes, usingDemoData]);

  useEffect(() => {
    if (usingDemoData) return;
    window.localStorage.setItem(IMPORTED_DATA_STORAGE_KEY, JSON.stringify({ eTongueData, gcmsData, compositionData }));
  }, [compositionData, eTongueData, gcmsData, usingDemoData]);

  useEffect(() => {
    const handleDelete = (event: Event) => {
      const type = (event as CustomEvent<{ type?: string }>).detail?.type;
      if (!type) return;
      deleteImportedFoodTypeData(type);
    };

    window.addEventListener('sensory-food-type-delete', handleDelete);
    return () => window.removeEventListener('sensory-food-type-delete', handleDelete);
  }, [eTongueData, foodType]);

  const filteredETongueData = eTongueData.filter(s => {
    const t = (s.type || inferType(s.sampleId)).toLowerCase();
    if (archivedFoodTypes.includes(t)) return false;
    if (subCategory?.startsWith('batch:')) return s.importBatchId === subCategory.replace('batch:', '');
    if (foodType === 'all') return true;
    if (foodType === 'bread')  return t === 'bread'  || s.sampleId.toUpperCase().startsWith('B');
    if (foodType === 'cheese') return t === 'dairy'  || t === 'pbca' || s.sampleId.toUpperCase().startsWith('S') || s.sampleId.toUpperCase().startsWith('D');
    if (foodType === 'meat') return t === 'meat' || s.sampleId.toUpperCase().startsWith('M');
    // Custom food type: direct match
    return t === foodType.toLowerCase();
  });

  useEffect(() => {
    if (filteredETongueData.length > 0 && !filteredETongueData.find(s => s.sampleId === selectedSamples[0])) {
      setSelectedSamples([filteredETongueData[0].sampleId]);
    }
  }, [filteredETongueData, selectedSamples]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const downloadCSVTemplate = () => {
    const rows = [
      ['sampleId', 'sampleName', 'foodType', 'category', 'sourness', 'bitterness', 'saltiness', 'umami', 'sweetness', 'compound', 'concentration', 'aroma', 'threshold', 'protein', 'fat', 'moisture', 'pH', 'saltContent', 'calciumMg'],
      ['M1', 'Plant-Based Burger v1', 'meat', 'Burger', '1.2', '1.8', '2.6', '4.2', '0.8', 'Hexanal', '2.1', 'green/fatty', '5', '18.4', '12.2', '54.1', '6.1', '1.2', '42'],
      ['M2', 'Plant-Based Burger v2', 'meat', 'Burger', '1.0', '1.4', '2.4', '4.8', '0.7', '2-methyl-3-furanthiol', '0.6', 'meaty', '0', '19.1', '11.8', '53.6', '6.0', '1.3', '44'],
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sensory-machine-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (file: File) => {
    setImportError(null);
    setImportSuccess(null);
    setLastImportSummary(null);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setImportError("Only .csv files are supported. Please export your data as CSV first.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setImportError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 5 MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text, file.name);
    };
    // explicit UTF-8 — handles most exports; guards against Windows-1252 garbling
    reader.readAsText(file, "UTF-8");
  };

  const parseCSV = (text: string, fileName: string) => {
    // handle \r\n (Windows), \r-only (old Mac), \n (Unix)
    const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      setImportError("File appears to be empty or contains no data rows.");
      return;
    }

    const headers = parseCSVLine(lines[0]);
    if (headers.length === 0 || (headers.length === 1 && !headers[0])) {
      setImportError("Could not read column headers. Make sure the first row contains column names.");
      return;
    }

    const data: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => { row[header] = values[idx] ?? ""; });
      data.push(row);
    }

    setColumnReport(recogniseColumns(headers));
    setPreviewData(data);
    setUploadedFile(fileName);
    setBatchName(fileName.replace(/\.csv$/i, ''));
    setShowPreview(true);
    setImportStep(2);
    setImportError(null);
  };

  const importCSVData = async () => {
    const parsed = importSummary ?? buildImportedDataset(previewData, uploadedFile);
    const importedETongue = parsed.eTongueData;
    const importedGCMSCount = Object.keys(parsed.gcmsData).length;
    const importedCompCount = Object.keys(parsed.compositionData).length;
    const projectName = batchName.trim() || uploadedFile?.replace(/\.csv$/i, '') || `${parsed.detection.label} import`;

    if (importedETongue.length === 0 && importedGCMSCount === 0 && importedCompCount === 0) {
      setImportError(
        "No data could be parsed. Column names may not match the template — download it to check."
      );
      return;
    }
    if (validationReport?.errors.length) {
      setImportError(validationReport.errors[0]);
      return;
    }

    let savedPermanently = true;

    try {
      const savedDataset = await insertInstrumentalImport.mutateAsync({
        fileName: projectName,
        rowCount: previewData.length,
        recognizedColumns: columnReport?.recognised ?? [],
        ignoredColumns: columnReport?.ignored ?? [],
        detection: parsed.detection,
        importedBy: user?.id ?? null,
        eTongueData: importedETongue,
        gcmsData: parsed.gcmsData,
        compositionData: parsed.compositionData,
      });

      const nextDataset = savedDataset.eTongueData.length > 0 ? savedDataset : parsed;
      applyImportedDataset(nextDataset, setETongueData, setGcmsData, setCompositionData, setSelectedSamples);
    } catch (err) {
      if (isMissingFoodImportSchema(err)) {
        savedPermanently = false;
        applyImportedDataset(parsed, setETongueData, setGcmsData, setCompositionData, setSelectedSamples);
      } else {
        setImportError(err instanceof Error ? err.message : "Import failed while saving to the database.");
        return;
      }
    }

    if (!DEMO_TYPES.has(parsed.detection.slug)) {
      registerFoodTypes([parsed.detection.slug]);
      setSelection(parsed.detection.slug, null);
    }

    const parts: string[] = [];
    if (importedETongue.length > 0)
      parts.push(`${importedETongue.length} e-tongue sample${importedETongue.length > 1 ? "s" : ""}`);
    if (importedGCMSCount > 0)
      parts.push(`${importedGCMSCount} GC-MS record${importedGCMSCount > 1 ? "s" : ""}`);
    if (importedCompCount > 0)
      parts.push(`${importedCompCount} composition profile${importedCompCount > 1 ? "s" : ""}`);

    setImportSuccess(
      savedPermanently
        ? `Imported ${parts.join(", ")} into ${parsed.detection.label} and created panel surveys for the samples.`
        : `${parsed.detection.label} imported locally. Apply the Supabase food intelligence migration to make it permanent for everyone.`
    );
    setLastImportSummary({
      foodTypeSlug: parsed.detection.slug,
      foodTypeLabel: parsed.detection.label,
      projectName,
      sampleCount: importedETongue.length,
      gcmsCount: importedGCMSCount,
      compositionCount: importedCompCount,
      savedPermanently,
    });
    setShowPreview(false);
    setUploadedFile(null);
    setColumnReport(null);
    setBatchName('');
    setImportStep(1);
    setUsingDemoData(false);
    setImportError(null);

    // reset file input so the same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const cancelPreview = () => {
    setShowPreview(false);
    setUploadedFile(null);
    setColumnReport(null);
    setBatchName('');
    setImportStep(1);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const deleteImportedFoodTypeData = (type: string) => {
    const sampleIds = eTongueData.filter(sample => sample.type === type).map(sample => sample.sampleId);
    const remainingETongueData = eTongueData.filter(sample => sample.type !== type);
    if (remainingETongueData.length === 0) {
      setETongueData([]);
      setGcmsData({});
      setCompositionData({});
      setSelectedSamples([]);
      setUsingDemoData(false);
      window.localStorage.removeItem(IMPORTED_DATA_STORAGE_KEY);
      if (foodType === type) setSelection('', null);
      return;
    }
    setETongueData(remainingETongueData);
    setGcmsData(prev => {
      const next = { ...prev };
      sampleIds.forEach(sampleId => { delete next[sampleId]; });
      return next;
    });
    setCompositionData(prev => {
      const next = { ...prev };
      sampleIds.forEach(sampleId => { delete next[sampleId]; });
      return next;
    });
    setImportSuccess(`Deleted ${formatFoodTypeLabel(type)} data.`);
    if (foodType === type) setSelection('', null);
  };

  // ── derived display data ──────────────────────────────────────────────────

  const displayedSamples = filteredETongueData.map((sample, idx) => {
    const sampleInfo = SAMPLES.find((s) => s.id === sample.sampleId);
    const type = sample.type || sampleInfo?.type || inferType(sample.sampleId);
    const category = sample.category || sampleInfo?.category || inferCategory(sample.sampleId, "", type);
    return { id: sample.sampleId, uniqueKey: `${sample.sampleId}-${idx}`, name: sample.sampleName || sampleInfo?.name || sample.sampleId, category, type };
  });

  const pcaData = filteredETongueData.map((sample, idx) => {
    const pc1 = sample.saltiness * 0.5 + sample.umami * 0.4 - sample.sourness * 0.3;
    const pc2 = sample.bitterness * 0.4 + sample.sourness * 0.35 - sample.sweetness * 0.25;
    const sampleInfo = SAMPLES.find((s) => s.id === sample.sampleId);
    const type = sample.type || sampleInfo?.type || inferType(sample.sampleId);
    const category = sample.category || sampleInfo?.category || inferCategory(sample.sampleId, "", type);
    return {
      id: `pca-${sample.sampleId}-${idx}`,
      sampleId: sample.sampleId,
      uniqueKey: `${sample.sampleId}-${idx}`,
      name: sample.sampleName || sampleInfo?.name || sample.sampleId,
      pc1: Number(pc1.toFixed(2)),
      pc2: Number(pc2.toFixed(2)),
      category,
      type,
    };
  });

  const selectedSampleData      = filteredETongueData.find((s) => s.sampleId === selectedSamples[0]);
  const selectedGCMSData        = gcmsData[selectedSamples[0]] || [];
  const selectedCompositionData = compositionData[selectedSamples[0]] || {};
  const selectedSampleInfo      = displayedSamples.find((s) => s.id === selectedSamples[0]);
  const selectedColor           = getPointColor(selectedSampleInfo?.type, selectedSampleInfo?.category);
  const comparisonColors        = ["#9333ea", "#ec4899"];
  const activeFoodTypeLabel     = foodType === 'all' ? 'all sample types' : formatFoodTypeLabel(foodType);

  const viewImportedCharts = (summary: ImportCompletionSummary) => {
    setSelection(summary.foodTypeSlug, null);
    window.setTimeout(() => {
      document.getElementById('machine-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const openImportedWorkflow = (summary: ImportCompletionSummary, path: '/admin' | '/concept-testing') => {
    setSelection(summary.foodTypeSlug, null);
    navigate(path);
  };

  const radarData = selectedSampleData
    ? [
        { id: "sourness",   taste: "Sourness",   value: selectedSampleData.sourness,   fullMark: 5 },
        { id: "bitterness", taste: "Bitterness", value: selectedSampleData.bitterness, fullMark: 5 },
        { id: "saltiness",  taste: "Saltiness",  value: selectedSampleData.saltiness,  fullMark: 5 },
        { id: "umami",      taste: "Umami",      value: selectedSampleData.umami,      fullMark: 5 },
        { id: "sweetness",  taste: "Sweetness",  value: selectedSampleData.sweetness,  fullMark: 5 },
      ]
    : [];

  const compareRadarSeries = compareMode
    ? selectedSamples
        .map((sampleId, idx) => {
          const sample = filteredETongueData.find((s) => s.sampleId === sampleId);
          if (!sample) return null;
          return {
            sampleId,
            name: displayedSamples.find((s) => s.id === sampleId)?.name || sampleId,
            color: comparisonColors[idx % comparisonColors.length],
            dataKey: `sample_${idx}`,
            values: {
              Sourness: sample.sourness, Bitterness: sample.bitterness,
              Saltiness: sample.saltiness, Umami: sample.umami, Sweetness: sample.sweetness,
            },
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : [];

  const compareRadarChartData = compareMode
    ? [
        { id: "sourness",   taste: "Sourness",   fullMark: 5 },
        { id: "bitterness", taste: "Bitterness", fullMark: 5 },
        { id: "saltiness",  taste: "Saltiness",  fullMark: 5 },
        { id: "umami",      taste: "Umami",      fullMark: 5 },
        { id: "sweetness",  taste: "Sweetness",  fullMark: 5 },
      ].map((row) => {
        const nextRow: Record<string, string | number> = { ...row };
        compareRadarSeries.forEach((series) => {
          nextRow[series.dataKey] = series.values[row.taste as keyof typeof series.values];
        });
        return nextRow;
      })
    : [];

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Machine Testing</h1>
          <p className="text-sm text-slate-600 mt-1">
            High-precision sensory analysis using electronic tongue and GC-O equipment
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadCSVTemplate} className="flex items-center gap-2">
            <Download className="size-4" />
            CSV template
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
            id="csv-upload-header"
          />
          <label htmlFor="csv-upload-header">
            <Button className="cursor-pointer bg-slate-900 hover:bg-slate-700" asChild>
              <span className="flex items-center gap-2">
                <Upload className="size-4" />
                Import CSV
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* Drop zone — visible when not previewing */}
      {!showPreview && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 flex items-center justify-center gap-3 transition-colors cursor-default ${
            dragActive
              ? "border-slate-500 bg-slate-50"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <Upload className="size-5 text-slate-400 shrink-0" />
          <p className="text-sm text-slate-500">
            Drop a <span className="font-medium text-slate-700">.csv</span> file here or use the{" "}
            <label htmlFor="csv-upload-header" className="font-medium text-slate-700 underline underline-offset-2 cursor-pointer">
              Import CSV
            </label>{" "}
            button above
          </p>
        </div>
      )}

      {/* Error banner */}
      {importError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="size-4 text-rose-600 mt-0.5 shrink-0" />
          <span className="text-sm text-rose-700">{importError}</span>
          <button onClick={() => setImportError(null)} className="ml-auto text-rose-400 hover:text-rose-700">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Success banner */}
      {importSuccess && (
        <div className="space-y-3">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
            <span className="text-sm text-emerald-700 flex items-center gap-1"><Check className="size-3.5" />{importSuccess}</span>
            <button
              onClick={() => { setImportSuccess(null); setLastImportSummary(null); }}
              className="text-emerald-400 hover:text-emerald-700"
            >
              <X className="size-4" />
            </button>
          </div>
          {lastImportSummary && (
            <Card className="border-emerald-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600">
                        <Check className="size-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{lastImportSummary.foodTypeLabel} project is ready</p>
                        <p className="text-xs text-slate-500">{lastImportSummary.projectName}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-slate-200 px-2.5 py-1 font-semibold text-slate-700">{lastImportSummary.sampleCount} surveys</span>
                      <span className="rounded-full border border-slate-200 px-2.5 py-1 font-semibold text-slate-700">{lastImportSummary.gcmsCount} GC-MS</span>
                      <span className="rounded-full border border-slate-200 px-2.5 py-1 font-semibold text-slate-700">{lastImportSummary.compositionCount} composition</span>
                      <span className={`rounded-full px-2.5 py-1 font-semibold ${lastImportSummary.savedPermanently ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {lastImportSummary.savedPermanently ? 'Saved to platform' : 'Local only'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => viewImportedCharts(lastImportSummary)}>
                      <BarChart3 className="size-4 mr-1.5" />View charts
                    </Button>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => openImportedWorkflow(lastImportSummary, '/admin')}>
                      <ClipboardList className="size-4 mr-1.5" />Configure surveys
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openImportedWorkflow(lastImportSummary, '/concept-testing')}>
                      <Lightbulb className="size-4 mr-1.5" />Concepts
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Preview card */}
      {showPreview && (
        <Card className="border-2 border-slate-900">
          <CardHeader className="bg-slate-50 border-b rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  {(['Upload', 'Detect', 'Map', 'Confirm'] as const).map((label, i) => (
                    <div key={label} className="flex items-center gap-1.5">
                      {i > 0 && <div className="w-6 h-px bg-slate-300" />}
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        importStep === i + 1 ? 'bg-slate-900 text-white' :
                        importStep > i + 1 ? 'bg-emerald-600 text-white' :
                        'bg-slate-200 text-slate-500'
                      }`}>
                        {i + 1}. {label}
                      </span>
                    </div>
                  ))}
                </div>
                <CardTitle className="text-base">{uploadedFile}</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={cancelPreview}>
                <X className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">

            {/* Column recognition report */}
            {columnReport && (
              <div className="grid grid-cols-1 gap-3 text-xs lg:grid-cols-4">
                {importSummary && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="font-semibold text-slate-800 mb-1.5">Detected food type</p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-900">{importSummary.detection.label}</span>
                      <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 font-semibold text-slate-600">
                        {Math.round(importSummary.detection.confidence * 100)}%
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-1.5 text-[11px] text-slate-600">
                      <span className="rounded bg-white border border-slate-200 px-1.5 py-1">{importSummary.sampleCount} samples</span>
                      <span className="rounded bg-white border border-slate-200 px-1.5 py-1">{importSummary.gcmsCount} GC-MS</span>
                      <span className="rounded bg-white border border-slate-200 px-1.5 py-1">{importSummary.compositionCount} comp</span>
                    </div>
                  </div>
                )}
                {importSummary && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="font-semibold text-blue-900 mb-1.5">Project destination</p>
                    <p className="text-sm font-bold text-blue-950">
                      {existingProjectCount > 0 ? `Add under ${importSummary.detection.label}` : `Create ${importSummary.detection.label}`}
                    </p>
                    <p className="mt-1 text-[11px] text-blue-700">
                      {existingProjectCount > 0
                        ? `${existingProjectCount} existing project${existingProjectCount === 1 ? '' : 's'} found. This upload becomes the next project folder.`
                        : 'This food type will appear after the import saves.'}
                    </p>
                    <p className="mt-2 rounded bg-white px-2 py-1 text-[11px] font-semibold text-blue-800 ring-1 ring-blue-200">
                      {importSummary.sampleCount} sample survey{importSummary.sampleCount === 1 ? '' : 's'} will be created
                    </p>
                  </div>
                )}
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="font-semibold text-emerald-800 mb-1.5">
                    Recognised ({columnReport.recognised.length})
                  </p>
                  {columnReport.recognised.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {columnReport.recognised.map((col) => (
                        <span key={col} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-mono">
                          {col}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-emerald-600 italic">None — check column names match the template.</p>
                  )}
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="font-semibold text-amber-800 mb-1.5">
                    Ignored ({columnReport.ignored.length})
                  </p>
                  {columnReport.ignored.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {columnReport.ignored.map((col) => (
                        <span key={col} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-mono">
                          {col}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-amber-600 italic">All columns recognised.</p>
                  )}
                </div>
              </div>
            )}

            {validationReport && (validationReport.errors.length > 0 || validationReport.warnings.length > 0) && (
              <div className="space-y-2">
                {validationReport.errors.map(error => (
                  <div key={error} className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                ))}
                {validationReport.warnings.map(warning => (
                  <div key={warning} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Data table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b">
                    {previewData.length > 0 && Object.keys(previewData[0]).map((key) => (
                      <th key={key} className="px-4 py-2 text-left font-semibold whitespace-nowrap">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-slate-50">
                      {Object.values(row).map((val, vidx) => (
                        <td key={vidx} className="px-4 py-2 whitespace-nowrap">{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 10 && (
                <p className="text-xs text-slate-400 mt-2 text-center">
                  Showing 10 of {previewData.length} rows
                </p>
              )}
            </div>

            {/* Step 4: Name and confirm */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Step 4 — Name this food project</p>
              <p className="text-xs text-slate-500">This becomes the project folder in Configure, with one questionnaire created per sample.</p>
              <input
                type="text"
                value={batchName}
                onChange={e => { setBatchName(e.target.value); setImportStep(4); }}
                onFocus={() => setImportStep(4)}
                placeholder="e.g., Plant-Based Meat June Trial"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={importCSVData}
                disabled={insertInstrumentalImport.isPending || !!validationReport?.errors.length}
                className="bg-slate-900 hover:bg-slate-700 disabled:opacity-60"
              >
                {insertInstrumentalImport.isPending ? "Importing…" : (
                  <span className="flex items-center gap-1.5">Create project <ArrowRight className="size-4" /></span>
                )}
              </Button>
              <Button variant="outline" onClick={cancelPreview}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main grid — no drag handlers; drop zone above handles it */}
      <div id="machine-results" className="grid grid-cols-4 gap-6 scroll-mt-6">
        <Card className="border-2 border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50 border-b rounded-t-lg">
            <div className="flex items-center justify-between mb-1">
              <CardTitle className="text-lg">Sample Selection</CardTitle>
              <Button
                variant={compareMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (compareMode) {
                    setCompareMode(false);
                    setSelectedSamples([selectedSamples[0]]);
                  } else {
                    setCompareMode(true);
                    if (selectedSamples.length === 0) setSelectedSamples(["S3"]);
                  }
                }}
                className={compareMode ? "bg-slate-900 hover:bg-slate-700" : ""}
              >
                {compareMode ? "Comparing" : "Compare"}
              </Button>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {compareMode
                ? `Select one comparison sample (${selectedSamples.length}/2 selected)`
                : "Choose a sample to view detailed measurements"}
            </p>
          </CardHeader>
          <CardContent className="pt-4 pr-2">
            <div className="space-y-2 h-[620px] overflow-y-auto pr-2">
              {displayedSamples.map((sample) => {
                const hasOffNotes = gcmsData[sample.id]?.some(
                  (c) => c.threshold > 0 && c.concentration > c.threshold
                );
                const isSelected = selectedSamples.includes(sample.id);

                return (
                  <button
                    key={sample.uniqueKey}
                    onClick={() => {
                      if (compareMode) {
                        if (isSelected) {
                          if (selectedSamples.length > 1)
                            setSelectedSamples(selectedSamples.filter((id) => id !== sample.id));
                        } else {
                          if (selectedSamples.length === 0) setSelectedSamples([sample.id]);
                          else setSelectedSamples([selectedSamples[0], sample.id]);
                        }
                      } else {
                        setSelectedSamples([sample.id]);
                      }
                    }}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all relative ${
                      isSelected
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-bold text-slate-900">{sample.name}</div>
                        <div className="text-xs text-slate-500">{sample.id}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasOffNotes && <AlertCircle className="size-5 text-rose-600" />}
                        {compareMode && isSelected && (
                          <div className="w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center">
                            <Check className="size-3 text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="col-span-3 space-y-6">
          <div className="grid grid-cols-3 gap-6">
            <Card className="col-span-2 border-2 border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-50 border-b rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FlaskConical className="size-5 text-slate-700" />
                  Electronic Tongue Analysis
                </CardTitle>
                <p className="text-xs text-slate-600 mt-1">
                  Quantitative measurement of five fundamental taste attributes
                </p>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={380}>
                  <RadarChart
                    data={compareMode ? compareRadarChartData : radarData}
                    margin={{ top: 30, right: 50, bottom: 30, left: 50 }}
                  >
                    <PolarGrid stroke="#e2e8f0" strokeWidth={1} />
                    <PolarAngleAxis dataKey="taste" tick={{ fill: "#475569", fontSize: 13, fontWeight: 500 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fill: "#94a3b8", fontSize: 11 }} tickCount={6} />
                    {compareMode ? (
                      compareRadarSeries.map((series) => (
                        <Radar
                          key={`radar-${series.sampleId}`}
                          name={series.name}
                          dataKey={series.dataKey}
                          stroke={series.color}
                          fill={series.color}
                          fillOpacity={0.15}
                          strokeWidth={2}
                        />
                      ))
                    ) : (
                      <Radar
                        name={selectedSampleData?.sampleId || "Sample"}
                        dataKey="value"
                        stroke={selectedColor}
                        fill={selectedColor}
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                    )}
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 shadow-lg rounded-lg border border-slate-200">
                              <p className="font-semibold text-slate-900 text-sm">{data.taste}</p>
                              {compareMode ? (
                                <div className="space-y-1 mt-1">
                                  {payload.map((entry: any, idx: number) => (
                                    <p key={idx} className="font-semibold text-xs" style={{ color: entry.stroke }}>
                                      {entry.name}: {Number(entry.value).toFixed(2)} / 5.0
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <p className="font-semibold text-sm" style={{ color: selectedColor }}>
                                  {data.value.toFixed(2)} / 5.0
                                </p>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  {compareMode && compareRadarSeries.length > 0 ? (
                    compareRadarSeries.map((series) => (
                      <div
                        key={`legend-${series.sampleId}`}
                        className="flex items-center gap-2 rounded-md border px-2 py-1.5"
                        style={{ borderColor: `${series.color}40`, backgroundColor: `${series.color}10` }}
                      >
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: series.color }} />
                        <span className="font-medium text-slate-700">{series.name}</span>
                      </div>
                    ))
                  ) : (
                    Array.from(new Map(displayedSamples.map(s => [s.category, getPointColor(s.type, s.category)]))).map(([cat, color]) => (
                      <div
                        key={cat}
                        className="flex items-center gap-2 rounded-md border px-3 py-2"
                        style={{ borderColor: `${color}40`, background: `${color}12` }}
                      >
                        <div className="h-3 w-3 rounded-full" style={{ background: color }} />
                        <span className="font-medium text-slate-700">{cat}</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-rose-300 shadow-sm">
              <CardHeader className="bg-rose-50 border-b rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FlaskConical className="size-5 text-rose-600" />
                  Aroma Compound Detection
                </CardTitle>
                <p className="text-xs text-slate-600 mt-1">Volatile off-notes detected by GC-O</p>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-2">
                  {selectedGCMSData.length > 0 ? (
                    selectedGCMSData.map((compound, idx) => {
                      const overThreshold = compound.threshold > 0 ? compound.concentration > compound.threshold : false;
                      return (
                        <div
                          key={`${compound.name}-${idx}`}
                          className={`p-2 rounded-lg border text-xs ${overThreshold ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}
                        >
                          <div className="font-semibold text-slate-900 mb-0.5">{compound.name}</div>
                          <div className="text-slate-600 mb-0.5">{compound.aroma}</div>
                          <div className="flex items-center justify-between">
                            <span className={overThreshold ? "text-rose-600 font-semibold" : "text-slate-700"}>
                              {compound.concentration.toFixed(1)} ppm
                            </span>
                            {compound.threshold > 0 && (
                              <span className="text-slate-500">↑ {compound.threshold}</span>
                            )}
                          </div>
                          {overThreshold && (
                            <div className="mt-1 font-semibold text-rose-700 flex items-center gap-1">
                              <AlertCircle className="size-3" />
                              Over threshold
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8">
                      <FlaskConical className="size-12 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No off-notes detected</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-2 border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b rounded-t-lg">
              <CardTitle className="text-lg flex items-center gap-2">
                <FlaskConical className="size-5 text-slate-700" />
                Chemical Composition Analysis
              </CardTitle>
              <p className="text-xs text-slate-600 mt-1">Proximate analysis and key chemical properties</p>
            </CardHeader>
            <CardContent className="pt-4">
              {selectedCompositionData && Object.keys(selectedCompositionData).length > 0 ? (
                <div className="grid grid-cols-6 gap-4">
                  {[
                    { label: "Protein",  value: selectedCompositionData.protein?.toFixed(1),  unit: "%" },
                    { label: "Fat",      value: selectedCompositionData.fat?.toFixed(1),      unit: "%" },
                    { label: "Moisture", value: selectedCompositionData.moisture?.toFixed(1), unit: "%" },
                    { label: "pH",       value: selectedCompositionData.pH?.toFixed(1),       unit: ""  },
                    { label: "Salt",     value: selectedCompositionData.saltContent?.toFixed(1), unit: "%" },
                    { label: "Calcium",  value: selectedCompositionData.calciumMg?.toFixed(0), unit: "mg" },
                  ].map(({ label, value, unit }) => (
                    <div key={label} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-xs text-slate-600 mb-1">{label}</div>
                      <div className="text-2xl font-bold text-slate-900">
                        {value || "—"}
                        {unit && value && <span className="text-sm text-slate-600 ml-1">{unit}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FlaskConical className="size-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No composition data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-2 border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50 border-b rounded-t-lg">
          <CardTitle className="text-lg flex items-center gap-2">
            Taste Similarity Analysis (PCA)
          </CardTitle>
          <p className="text-xs text-slate-600 mt-1">
            {foodType === 'all'
              ? 'Principal component analysis across all sample types'
              : foodType === 'bread'
              ? 'E-Tongue principal component analysis across bread formulations'
              : foodType === 'cheese'
              ? 'Comparison of plant-based formulations against dairy reference standards'
              : `E-Tongue principal component analysis across ${activeFoodTypeLabel} formulations`}
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {(() => {
            const uniqueTypes = Array.from(new Set(pcaData.map(d => d.type)));
            const uniqueCategories = Array.from(
              new Map(pcaData.map(d => [d.category, { type: d.type, color: getPointColor(d.type, d.category) }]))
            );
            return (
              <>
                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      type="number"
                      dataKey="pc1"
                      name="Savory Dimension"
                      domain={['auto', 'auto']}
                      tick={{ fill: "#475569", fontSize: 12 }}
                      label={{ value: "PC1 - Savory/Salt Dimension", position: "insideBottom", offset: -5, style: { fill: "#475569", fontSize: 12, fontWeight: 500 } }}
                    />
                    <YAxis
                      type="number"
                      dataKey="pc2"
                      name="Bitter-Sour Dimension"
                      domain={['auto', 'auto']}
                      tick={{ fill: "#475569", fontSize: 12 }}
                      label={{ value: "PC2 - Acid/Bitter Dimension", angle: -90, position: "insideLeft", offset: 5, style: { fill: "#475569", fontSize: 12, fontWeight: 500 } }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 shadow-lg rounded-lg border border-slate-200">
                              <p className="font-semibold text-slate-900">{data.name}</p>
                              <p className="text-xs text-slate-500 mt-1">PC1: {data.pc1} | PC2: {data.pc2}</p>
                              <p className="text-xs text-slate-600 mt-1">{data.category}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {uniqueTypes.map(type => (
                      <Scatter key={type} data={pcaData.filter(d => d.type === type)}>
                        {pcaData.filter(d => d.type === type).map(entry => (
                          <Cell key={`cell-${entry.id}`} fill={getPointColor(entry.type, entry.category)} />
                        ))}
                      </Scatter>
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>

                <div className="mt-6 flex flex-wrap gap-3 text-sm">
                  {uniqueCategories.map(([cat, { color }]) => (
                    <div
                      key={cat}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                      style={{ borderColor: `${color}40`, background: `${color}12` }}
                    >
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="font-semibold text-slate-700">{cat}</span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>

    </div>
  );
}
