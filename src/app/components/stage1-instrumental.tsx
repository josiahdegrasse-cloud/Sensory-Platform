import { useState, useCallback, useRef, useEffect } from "react";
import { useFoodType } from "../contexts/food-type-context";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { FlaskConical, AlertCircle, Upload, X, Check, Download, RotateCcw } from "lucide-react";
import { SAMPLES } from "../data/samples";
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
  sourness: number;
  bitterness: number;
  saltiness: number;
  umami: number;
  sweetness: number;
  type?: string;
  category?: string;
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
  S3: [
    { name: "Butyric acid", concentration: 12.4, aroma: "rancid", threshold: 8.0 },
    { name: "Hexanal", concentration: 6.8, aroma: "cardboard", threshold: 5.0 },
  ],
  S7: [
    { name: "Acetaldehyde", concentration: 8.1, aroma: "fermented", threshold: 3.5 },
  ],
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
  'type', 'category',
  'sourness', 'bitterness', 'saltiness', 'umami', 'sweetness',
  'compound', 'name', 'concentration', 'aroma', 'odour', 'threshold',
  'protein', 'fat', 'moisture', 'ph', 'saltcontent', 'calciummg',
];

function recogniseColumns(headers: string[]): ColumnReport {
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

function inferType(sampleId: string, csvType?: string) {
  const normalized = normalize(csvType).toLowerCase();
  if (normalized === "dairy") return "dairy";
  if (normalized === "bread") return "bread";
  if (normalized === "pbca" || normalized === "plant-based" || normalized === "plant base") return "pbca";
  if (sampleId.toUpperCase().startsWith("B")) return "bread";
  return sampleId.toUpperCase().startsWith("D") ? "dairy" : "pbca";
}

function inferCategory(sampleId: string, csvCategory?: string, type?: string) {
  const normalized = normalize(csvCategory);
  if (normalized) return normalized;
  if (type === "dairy") return "Dairy";
  if (type === "bread") return "Bread";
  return "Coconut-based";
}

function getPointColor(type?: string, category?: string) {
  if (type === "dairy" || category === "Dairy") return "#10b981";
  if (type === "bread" || category === "Bread") return "#d97706";
  if (category === "Cashew-based") return "#f59e0b";
  return "#3b82f6";
}

export function Stage1Instrumental() {
  const [selectedSamples, setSelectedSamples] = useState<string[]>(["S3"]);
  const [eTongueData, setETongueData] = useState<ETongueMeasurement[]>(MOCK_ETONGUE_DATA);
  const [gcmsData, setGcmsData] = useState<Record<string, GCMSCompound[]>>(MOCK_GCMS_DATA);
  const [compositionData, setCompositionData] = useState<Record<string, ChemicalComposition>>(MOCK_COMPOSITION_DATA);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [columnReport, setColumnReport] = useState<ColumnReport | null>(null);
  const [usingDemoData, setUsingDemoData] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { foodType } = useFoodType();

  const filteredETongueData = eTongueData.filter(s => {
    if (foodType === 'all') return true;
    const t = (s.type || inferType(s.sampleId)).toLowerCase();
    if (foodType === 'bread') return t === 'bread' || s.sampleId.toUpperCase().startsWith('B');
    if (foodType === 'cheese') return t === 'dairy' || t === 'pbca' || s.sampleId.toUpperCase().startsWith('S') || s.sampleId.toUpperCase().startsWith('D');
    return true;
  });

  useEffect(() => {
    if (filteredETongueData.length > 0 && !filteredETongueData.find(s => s.sampleId === selectedSamples[0])) {
      setSelectedSamples([filteredETongueData[0].sampleId]);
    }
  }, [foodType]);

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

  const handleFile = (file: File) => {
    setImportError(null);
    setImportSuccess(null);

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
    setShowPreview(true);
    setImportError(null);
  };

  const importCSVData = () => {
    const eTongueMap = new Map<string, ETongueMeasurement>();
    const gcmsMap: Record<string, GCMSCompound[]> = {};
    const compositionMap: Record<string, ChemicalComposition> = {};

    previewData.forEach((row, index) => {
      const sampleId =
        row.sampleId || row.SampleID || row.sample || row.Sample || row.id || `Imported-${index + 1}`;
      const type = inferType(sampleId, row.type || row.Type);
      const category = inferCategory(sampleId, row.category || row.Category, type);

      // E-tongue: accept partial taste data — require at least one valid taste field
      const sourness   = parseFloat(row.sourness   || row.Sourness   || row.SOURNESS   || "NaN");
      const bitterness = parseFloat(row.bitterness || row.Bitterness || row.BITTERNESS || "NaN");
      const saltiness  = parseFloat(row.saltiness  || row.Saltiness  || row.SALTINESS  || "NaN");
      const umami      = parseFloat(row.umami      || row.Umami      || row.UMAMI      || "NaN");
      const sweetness  = parseFloat(row.sweetness  || row.Sweetness  || row.SWEETNESS  || "NaN");

      const hasAnyTaste = [sourness, bitterness, saltiness, umami, sweetness].some((v) => !Number.isNaN(v));

      if (hasAnyTaste && !eTongueMap.has(sampleId)) {
        eTongueMap.set(sampleId, {
          sampleId,
          sourness:   Number.isNaN(sourness)   ? 0 : sourness,
          bitterness: Number.isNaN(bitterness) ? 0 : bitterness,
          saltiness:  Number.isNaN(saltiness)  ? 0 : saltiness,
          umami:      Number.isNaN(umami)      ? 0 : umami,
          sweetness:  Number.isNaN(sweetness)  ? 0 : sweetness,
          type,
          category,
        });
      }

      // GC-MS: append compounds per sample, deduplicate by compound name
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

      // Composition: accept partial data — require at least 2 valid fields
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

    const importedETongue     = Array.from(eTongueMap.values());
    const importedGCMSCount   = Object.keys(gcmsMap).length;
    const importedCompCount   = Object.keys(compositionMap).length;

    if (importedETongue.length === 0 && importedGCMSCount === 0 && importedCompCount === 0) {
      setImportError(
        "No data could be parsed. Column names may not match the template — download it to check."
      );
      return;
    }

    if (importedETongue.length > 0) {
      setETongueData(importedETongue);
      setSelectedSamples([importedETongue[0].sampleId]);
    }
    if (importedGCMSCount > 0) setGcmsData(gcmsMap);
    if (importedCompCount  > 0) setCompositionData(compositionMap);

    const parts: string[] = [];
    if (importedETongue.length > 0)
      parts.push(`${importedETongue.length} e-tongue sample${importedETongue.length > 1 ? "s" : ""}`);
    if (importedGCMSCount > 0)
      parts.push(`${importedGCMSCount} GC-MS record${importedGCMSCount > 1 ? "s" : ""}`);
    if (importedCompCount > 0)
      parts.push(`${importedCompCount} composition profile${importedCompCount > 1 ? "s" : ""}`);

    setImportSuccess(`Imported ${parts.join(", ")}.`);
    setShowPreview(false);
    setUploadedFile(null);
    setColumnReport(null);
    setUsingDemoData(false);
    setImportError(null);

    // reset file input so the same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const cancelPreview = () => {
    setShowPreview(false);
    setUploadedFile(null);
    setColumnReport(null);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetToDemo = () => {
    setETongueData(MOCK_ETONGUE_DATA);
    setGcmsData(MOCK_GCMS_DATA);
    setCompositionData(MOCK_COMPOSITION_DATA);
    setSelectedSamples(["S3"]);
    setUsingDemoData(true);
    setImportSuccess(null);
    setImportError(null);
    setUploadedFile(null);
    setShowPreview(false);
    setColumnReport(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadTemplate = () => {
    const headers = "sampleId,type,category,sourness,bitterness,saltiness,umami,sweetness,protein,fat,moisture,pH,saltContent,calciumMg,compound,concentration,aroma,threshold";
    const example = "S1,pbca,Coconut-based,2.3,3.1,4.2,2.8,1.5,18.2,22.5,42.1,5.8,1.8,485,,,, ";
    const blob = new Blob([[headers, example].join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "nfi_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── derived display data ──────────────────────────────────────────────────

  const displayedSamples = filteredETongueData.map((sample, idx) => {
    const sampleInfo = SAMPLES.find((s) => s.id === sample.sampleId);
    const type = sample.type || sampleInfo?.type || inferType(sample.sampleId);
    const category = sample.category || sampleInfo?.category || inferCategory(sample.sampleId, "", type);
    return { id: sample.sampleId, uniqueKey: `${sample.sampleId}-${idx}`, name: sampleInfo?.name || sample.sampleId, category, type };
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
      name: sampleInfo?.name || sample.sampleId,
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
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="flex items-center gap-2 text-slate-600">
            <Download className="size-4" />
            Download template
          </Button>
          <a href="/sample_import.csv" download>
            <Button variant="outline" size="sm" className="flex items-center gap-2 text-slate-600">
              <Download className="size-4" />
              Download sample data
            </Button>
          </a>
          {!usingDemoData && (
            <Button variant="outline" size="sm" onClick={resetToDemo} className="flex items-center gap-2 text-slate-600">
              <RotateCcw className="size-4" />
              Reset to demo
            </Button>
          )}
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
            Drop a <span className="font-medium text-slate-700">.csv</span> file here, or use{" "}
            <label htmlFor="csv-upload-header" className="font-medium text-slate-700 underline underline-offset-2 cursor-pointer">
              Import CSV
            </label>{" "}
            above.{" "}
            <button onClick={downloadTemplate} className="text-slate-500 underline underline-offset-2 hover:text-slate-800">
              Download template
            </button>
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
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
          <span className="text-sm text-emerald-700 flex items-center gap-1"><Check className="size-3.5" />{importSuccess}</span>
          <button onClick={() => setImportSuccess(null)} className="text-emerald-400 hover:text-emerald-700">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Preview card */}
      {showPreview && (
        <Card className="border-2 border-slate-900">
          <CardHeader className="bg-slate-50 border-b rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Preview — {uploadedFile}</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">Review before importing. Showing up to 10 rows.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={cancelPreview}>
                <X className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">

            {/* Column recognition report */}
            {columnReport && (
              <div className="grid grid-cols-2 gap-3 text-xs">
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

            <div className="flex gap-3">
              <Button onClick={importCSVData} className="bg-slate-900 hover:bg-slate-700">
                Confirm Import
              </Button>
              <Button variant="outline" onClick={cancelPreview}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main grid — no drag handlers; drop zone above handles it */}
      <div className="grid grid-cols-4 gap-6">
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
                    <>
                      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                        <div className="h-3 w-3 rounded-full bg-emerald-600" />
                        <span className="font-medium text-slate-700">Dairy</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
                        <div className="h-3 w-3 rounded-full bg-blue-600" />
                        <span className="font-medium text-slate-700">Coconut-based</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                        <div className="h-3 w-3 rounded-full bg-amber-600" />
                        <span className="font-medium text-slate-700">Cashew-based</span>
                      </div>
                    </>
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
            Comparison of plant-based formulations against dairy reference standards
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                dataKey="pc1"
                name="Savory Dimension"
                domain={[-2, 2]}
                tick={{ fill: "#475569", fontSize: 12 }}
                label={{ value: "PC1 - Savory Dimension", position: "insideBottom", offset: -5, style: { fill: "#475569", fontSize: 12, fontWeight: 500 } }}
              />
              <YAxis
                type="number"
                dataKey="pc2"
                name="Bitter-Sour Dimension"
                domain={[-2, 2]}
                tick={{ fill: "#475569", fontSize: 12 }}
                label={{ value: "PC2 - Bitter-Sour Dimension", angle: -90, position: "insideLeft", offset: 5, style: { fill: "#475569", fontSize: 12, fontWeight: 500 } }}
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
              <Scatter data={pcaData.filter((d) => d.type === "pbca")}>
                {pcaData.filter((d) => d.type === "pbca").map((entry) => (
                  <Cell key={`cell-${entry.id}`} fill={getPointColor(entry.type, entry.category)} />
                ))}
              </Scatter>
              <Scatter data={pcaData.filter((d) => d.type === "dairy")}>
                {pcaData.filter((d) => d.type === "dairy").map((entry) => (
                  <Cell key={`cell-${entry.id}`} fill={getPointColor(entry.type, entry.category)} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>

          <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-emerald-600" />
                <span className="font-semibold">Dairy Reference</span>
              </div>
              <p className="text-xs text-slate-600">Real cheese baseline</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-blue-600" />
                <span className="font-semibold">Coconut-based</span>
              </div>
              <p className="text-xs text-slate-600">Coconut oil formulation</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-amber-600" />
                <span className="font-semibold">Cashew-based</span>
              </div>
              <p className="text-xs text-slate-600">Cashew nut formulation</p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
