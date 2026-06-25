import { CHART_CHROME } from '../styles/tokens';
import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { useFoodType } from "../contexts/food-type-context";
import { parseBatchSelection } from "../lib/project-identity";
import { useAuth } from "../contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { FlaskConical, AlertCircle, Upload, X, Check, Download, BarChart3, ClipboardList, Lightbulb, ArrowRight } from "lucide-react";
import { SAMPLES } from "../data/samples";
import { formatFoodTypeLabel, slugifyFoodType } from "../lib/food-intelligence";
import { useInsertInstrumentalImport, useInstrumentalDataset } from "../lib/hooks";
import { isMissingFoodImportSchema, downloadPendingImportFile, markPendingImportImported } from "../lib/database";
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
import { ProjectHeader } from "./project-header";
import { applyImportMappings, inferImportMappings } from "../lib/csv-import-mapping";


import {
  type ETongueMeasurement, type GCMSCompound, type ChemicalComposition,
  type ColumnReport, type ImportCompletionSummary, type RetestImportContext,
  MAX_FILE_SIZE, DEMO_TYPES, RETEST_PARENT_DECISION_KEY,
  parseCSVLine, mergeInstrumentalData,
  inferType, inferCategory, getPointColor,
  buildImportedDataset, validateImportedDataset, applyImportedDataset, buildRetestBatchName,
} from "./stage1-instrumental-data";


export function Stage1Instrumental() {
  const storedImportedData = useMemo(() => null, []);
  const initialDataset = useMemo(() => mergeInstrumentalData(storedImportedData), [storedImportedData]);
  const location = useLocation();
  const navigate = useNavigate();
  type LocationState = {
    retestImport?: RetestImportContext;
    pendingImportId?: string;
    pendingStoragePath?: string;
    matchedBatchName?: string;
  } | null;
  const locationState = location.state as LocationState;
  const retestImport = locationState?.retestImport;
  const pendingImportId = locationState?.pendingImportId;
  const pendingStoragePath = locationState?.pendingStoragePath;
  const pendingMatchedBatchName = locationState?.matchedBatchName;
  const newProjectIntent = new URLSearchParams(location.search).get('new') === 'project';
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
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [batchName, setBatchName] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [lastImportSummary, setLastImportSummary] = useState<ImportCompletionSummary | null>(null);
  const [columnReport, setColumnReport] = useState<ColumnReport | null>(null);
  const [foodTypeOverride, setFoodTypeOverride] = useState('');
  const [, setUsingDemoData] = useState(!storedImportedData);
  const [isLoadingFromQueue, setIsLoadingFromQueue] = useState(!!pendingStoragePath);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const { foodType, subCategory, setSelection, registerFoodTypes, archivedFoodTypes, deletedFoodTypes } = useFoodType();

  useEffect(() => {
    if (!newProjectIntent) return;
    window.setTimeout(() => projectNameInputRef.current?.focus(), 0);
  }, [newProjectIntent]);

  // Auto-load file from the import queue when navigated here via "Review"
  useEffect(() => {
    if (!pendingStoragePath) return;
    setIsLoadingFromQueue(true);
    downloadPendingImportFile(pendingStoragePath)
      .then(({ text, fileName }) => {
        parseCSV(text, fileName, pendingMatchedBatchName);
      })
      .catch((err) => {
        setImportError(err instanceof Error ? err.message : 'Failed to load file from import queue.');
      })
      .finally(() => setIsLoadingFromQueue(false));
    // run once on mount — pendingStoragePath comes from router state, never changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importSummary = useMemo(() => {
    if (!showPreview || previewData.length === 0) return null;
    const parsed = buildImportedDataset(previewData, uploadedFile);
    const overrideSlug = slugifyFoodType(foodTypeOverride);
    if (foodTypeOverride.trim()) {
      parsed.detection = {
        ...parsed.detection,
        slug: overrideSlug,
        label: formatFoodTypeLabel(overrideSlug),
        confidence: 1,
        evidence: [...parsed.detection.evidence, 'Confirmed by administrator'],
      };
      parsed.eTongueData = parsed.eTongueData.map(sample => ({ ...sample, type: overrideSlug }));
    }
    return {
      ...parsed,
      sampleCount: parsed.eTongueData.length,
      gcmsCount: Object.keys(parsed.gcmsData).length,
      compositionCount: Object.keys(parsed.compositionData).length,
    };
  }, [foodTypeOverride, previewData, showPreview, uploadedFile]);
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
    registerFoodTypes(importedFoodTypes);
  }, [importedFoodTypes, registerFoodTypes]);

  const filteredETongueData = eTongueData.filter(s => {
    const t = (s.type || inferType(s.sampleId)).toLowerCase();
    const canonicalType = t === 'dairy' || t === 'pbca' ? 'cheese' : t;
    if (archivedFoodTypes.includes(canonicalType)) return false;
    if (deletedFoodTypes.includes(canonicalType)) return false;
    const batchSelection = parseBatchSelection(subCategory);
    if (batchSelection) return s.importBatchId === batchSelection;
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
    setFoodTypeOverride('');
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

  const parseCSV = (text: string, fileName: string, overrideBatchName?: string) => {
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

    const inferredMappings = inferImportMappings(headers);
    const mappedData = applyImportMappings(data, inferredMappings);
    setColumnReport({
      recognised: inferredMappings.filter(item => item.target !== 'ignore').map(item => item.source),
      ignored: inferredMappings.filter(item => item.target === 'ignore').map(item => item.source),
    });
    setPreviewData(mappedData);
    setUploadedFile(fileName);
    setBatchName(overrideBatchName ?? (retestImport ? buildRetestBatchName(retestImport) : batchName.trim() || fileName.replace(/\.csv$/i, '')));
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
        reformulationNotes: retestImport
          ? [retestImport.target, retestImport.action].filter(Boolean).join(' — ') || undefined
          : undefined,
      });

      if (retestImport?.parentDecisionId) {
        localStorage.setItem(RETEST_PARENT_DECISION_KEY, retestImport.parentDecisionId);
      }
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

    if (pendingImportId) {
      markPendingImportImported(pendingImportId).catch(() => {});
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
    setFoodTypeOverride('');
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
    setFoodTypeOverride('');
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

  // Listen for cross-component delete requests. Declared after
  // deleteImportedFoodTypeData so the handler can call it without a TDZ hazard.
  useEffect(() => {
    const handleDelete = (event: Event) => {
      const type = (event as CustomEvent<{ type?: string }>).detail?.type;
      if (!type) return;
      deleteImportedFoodTypeData(type);
    };

    window.addEventListener('sensory-food-type-delete', handleDelete);
    return () => window.removeEventListener('sensory-food-type-delete', handleDelete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eTongueData, foodType]);

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
      <ProjectHeader />

      {isLoadingFromQueue && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <div className="size-4 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
          Loading file from import queue…
        </div>
      )}

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

      {newProjectIntent && !showPreview && !lastImportSummary && (
        <Card className="border-2 border-blue-200 bg-blue-50/60 shadow-sm">
          <CardContent className="p-5">
            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Create new project</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">Name the project, then upload the CSV data.</h2>
                <p className="mt-1 text-sm text-slate-600">
                  This creates a project folder and turns each imported sample into a questionnaire-ready item.
                </p>
                <label htmlFor="new-project-name" className="mt-4 block text-xs font-semibold text-slate-700">
                  Project name
                </label>
                <Input
                  ref={projectNameInputRef}
                  id="new-project-name"
                  value={batchName}
                  onChange={event => setBatchName(event.target.value)}
                  placeholder="e.g., Coconut Cheddar June Trial"
                  className="mt-1 bg-white"
                />
              </div>
              <div className="rounded-xl border border-blue-100 bg-white p-4">
                <p className="text-sm font-bold text-slate-900">CSV data</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Upload machine data with sample IDs, food type/category, e-tongue values, GC-MS compounds, and composition fields.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!batchName.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Upload className="size-4" />
                    Choose CSV
                  </Button>
                  <Button variant="outline" onClick={downloadCSVTemplate}>
                    <Download className="size-4" />
                    Template
                  </Button>
                </div>
                {!batchName.trim() && (
                  <p className="mt-2 text-xs font-medium text-blue-700">Enter a project name to unlock CSV upload.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {retestImport && (
        <div className={`rounded-lg border p-4 ${
          retestImport.decision === 'STOP'
            ? 'border-rose-200 bg-rose-50'
            : 'border-amber-200 bg-amber-50'
        }`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                {retestImport.decision === 'STOP' ? 'Reformulation import' : 'Retest import'}
              </p>
              <h2 className="mt-1 text-base font-semibold text-slate-950">{retestImport.sampleName}</h2>
              <p className="mt-1 text-sm text-slate-700">
                New data will be labeled as <span className="font-semibold">{buildRetestBatchName(retestImport)}</span>
                {' '}for sample {retestImport.sampleId}.
              </p>
              {retestImport.target && (
                <p className="mt-2 text-xs text-slate-600">
                  <span className="font-semibold">Change to verify:</span> {retestImport.target}
                  {retestImport.action ? ` — ${retestImport.action}` : ''}
                </p>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 bg-slate-900 text-white hover:bg-slate-700"
            >
              <Upload className="size-4" />
              Choose CSV for {retestImport.sampleName}
            </Button>
          </div>
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
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Recommended next step</span>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => openImportedWorkflow(lastImportSummary, '/admin')}>
                        <ClipboardList className="size-4 mr-1.5" />Send surveys to your panel
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => viewImportedCharts(lastImportSummary)}>
                        <BarChart3 className="size-4 mr-1.5" />View charts
                      </Button>
                      <Button variant="outline" size="sm" className="text-slate-500" onClick={() => openImportedWorkflow(lastImportSummary, '/concept-testing')}>
                        <Lightbulb className="size-4 mr-1.5" />Concepts (after panel feedback)
                      </Button>
                    </div>
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
                  {(['Upload', 'Detect', 'Confirm'] as const).map((label, i) => (
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
                    <label className="mt-3 block text-[11px] font-semibold text-slate-600" htmlFor="food-type-override">
                      Correct classification
                    </label>
                    <Input
                      id="food-type-override"
                      value={foodTypeOverride}
                      onChange={event => setFoodTypeOverride(event.target.value)}
                      placeholder={importSummary.detection.slug}
                      className="mt-1 h-8 bg-white text-xs"
                    />
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

            {/* Name and confirm */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Name this food project</p>
              <p className="text-xs text-slate-500">This becomes a project group in Studies, with one questionnaire created per sample.</p>
              <input
                type="text"
                value={batchName}
                onChange={e => { setBatchName(e.target.value); setImportStep(3); }}
                onFocus={() => setImportStep(3)}
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
                    <PolarGrid stroke={CHART_CHROME.grid} strokeWidth={1} />
                    <PolarAngleAxis dataKey="taste" tick={{ fill: CHART_CHROME.axis, fontSize: 13, fontWeight: 500 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fill: CHART_CHROME.muted, fontSize: 11 }} tickCount={6} />
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
                                  {payload.map((entry: { stroke?: string; name?: unknown; value?: unknown }, idx: number) => (
                                    <p key={idx} className="font-semibold text-xs" style={{ color: entry.stroke }}>
                                      {String(entry.name)}: {Number(entry.value).toFixed(2)} / 5.0
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
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_CHROME.grid} />
                    <XAxis
                      type="number"
                      dataKey="pc1"
                      name="Savory Dimension"
                      domain={['auto', 'auto']}
                      tick={{ fill: CHART_CHROME.axis, fontSize: 12 }}
                      label={{ value: "PC1 - Savory/Salt Dimension", position: "insideBottom", offset: -5, style: { fill: CHART_CHROME.axis, fontSize: 12, fontWeight: 500 } }}
                    />
                    <YAxis
                      type="number"
                      dataKey="pc2"
                      name="Bitter-Sour Dimension"
                      domain={['auto', 'auto']}
                      tick={{ fill: CHART_CHROME.axis, fontSize: 12 }}
                      label={{ value: "PC2 - Acid/Bitter Dimension", angle: -90, position: "insideLeft", offset: 5, style: { fill: CHART_CHROME.axis, fontSize: 12, fontWeight: 500 } }}
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
