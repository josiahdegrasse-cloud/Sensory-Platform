import { CHART_CHROME } from '../styles/tokens';
import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { useFoodType } from "../contexts/food-type-context";
import { useAuth } from "../contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Textarea } from "./ui/textarea";
import { FlaskConical, AlertCircle, Upload, X, Check, BarChart3, ClipboardList, Lightbulb, ArrowRight, Pencil, Save, ShieldCheck, Plus } from "lucide-react";
import { formatFoodTypeLabel, getDefaultCataAttributesForFoodType, slugifyFoodType } from "../lib/food-intelligence";
import { useCreateImportSurveys, useInsertInstrumentalImport, useInstrumentalDataset, useUpdateIngredientStatement } from "../lib/hooks";
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
import { ProductListItem, ProductListPanel } from './product-list';
import { applyImportMappings, inferImportMappings } from "../lib/csv-import-mapping";
import { encodeBatchSelection } from "../lib/project-identity";
import {
  MAX_INSTRUMENTAL_COMPARISON_SAMPLES,
  instrumentalComparisonColor,
  toggleInstrumentalComparisonSample,
} from '../lib/instrumental-comparison';
import {
  DEFAULT_SURVEY_SECTIONS,
  mergeSurveyAttributes,
  SURVEY_SECTION_IDS,
  SURVEY_SECTION_LABELS,
  toggleSurveySection,
  type SurveySection,
} from '../lib/survey-sections';


import {
  type ColumnReport, type ImportCompletionSummary, type RetestImportContext,
  MAX_FILE_SIZE, DEMO_TYPES,
  parseCSVLine,
  getPointColor,
  buildImportedDataset, validateImportedDataset, applyImportedDataset, buildRetestBatchName,
} from "./stage1-instrumental-data";
import {
  useInstrumentalChartViewModel,
  useInstrumentalWorkspace,
} from './stage1-instrumental-hooks';
import { WorkflowPageHeader } from "./workflow-page-header";
import { FormulationProfilePanel } from './formulation-profile-panel';
import { projectPath, projectStudiesPath } from '../lib/project-journey-routes';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';


export function Stage1Instrumental() {
  const location = useLocation();
  const navigate = useNavigate();
  type LocationState = {
    retestImport?: RetestImportContext;
    pendingImportId?: string;
    pendingStoragePath?: string;
    matchedBatchName?: string;
    initialCsvFile?: File;
    configureSurveysImportBatchId?: string;
  } | null;
  const locationState = location.state as LocationState;
  const retestImport = locationState?.retestImport;
  const pendingImportId = locationState?.pendingImportId;
  const pendingStoragePath = locationState?.pendingStoragePath;
  const pendingMatchedBatchName = locationState?.matchedBatchName;
  const initialCsvFile = locationState?.initialCsvFile;
  const [configureSurveysImportBatchId] = useState(locationState?.configureSurveysImportBatchId ?? null);
  const [showConfigureSurveysPrompt, setShowConfigureSurveysPrompt] = useState(Boolean(locationState?.configureSurveysImportBatchId));
  const searchParams = new URLSearchParams(location.search);
  const newProjectIntent = searchParams.get('new') === 'project';
  const retestQuery = searchParams.get('retest');
  const { user } = useAuth();
  const instrumentalDatasetQuery = useInstrumentalDataset(user?.role === 'admin');
  const insertInstrumentalImport = useInsertInstrumentalImport();
  const createImportSurveys = useCreateImportSurveys();
  const updateIngredientStatement = useUpdateIngredientStatement();
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [batchName, setBatchName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [lastImportSummary, setLastImportSummary] = useState<ImportCompletionSummary | null>(null);
  const [columnReport, setColumnReport] = useState<ColumnReport | null>(null);
  const [foodTypeOverride, setFoodTypeOverride] = useState('');
  const [projectNameEdited, setProjectNameEdited] = useState(false);
  const [isLoadingFromQueue, setIsLoadingFromQueue] = useState(!!pendingStoragePath);
  const [aromaOpen, setAromaOpen] = useState(false);
  const [instrumentSummaryHeight, setInstrumentSummaryHeight] = useState<number | null>(null);
  const [editingIngredientSampleId, setEditingIngredientSampleId] = useState<string | null>(null);
  const [ingredientDraft, setIngredientDraft] = useState('');
  const [surveySections, setSurveySections] = useState<SurveySection[]>(DEFAULT_SURVEY_SECTIONS);
  const [surveyAttributes, setSurveyAttributes] = useState<string[]>([]);
  const [newSurveyAttributes, setNewSurveyAttributes] = useState('');
  const [surveysSent, setSurveysSent] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const instrumentSummaryRef = useRef<HTMLDivElement>(null);
  const { foodType, subCategory, setSelection, registerFoodTypes, archivedFoodTypes, deletedFoodTypes } = useFoodType();
  const {
    selectedSamples,
    setSelectedSamples,
    setETongueData,
    gcmsData,
    setGcmsData,
    compositionData,
    setCompositionData,
    compareMode,
    setCompareMode,
    filteredETongueData,
  } = useInstrumentalWorkspace({
    remoteDataset: instrumentalDatasetQuery.data,
    foodType,
    subCategory,
    archivedFoodTypes,
    deletedFoodTypes,
    registerFoodTypes,
    setSelection,
    onDeleteSuccess: setImportSuccess,
  });

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

  // Seed the batch name from the detected label on a fresh import, unless the
  // user has edited it or this is a retest (render-phase "adjust on change").
  const [batchNameSeed, setBatchNameSeed] = useState(importSummary);
  if (importSummary !== batchNameSeed) {
    setBatchNameSeed(importSummary);
    if (showPreview && importSummary && !projectNameEdited && !retestImport) {
      setBatchName(importSummary.detection.label);
    }
  }

  const validationReport = useMemo(() => {
    if (!showPreview || !importSummary) return null;
    return validateImportedDataset(previewData, importSummary, columnReport, importSummary.detection);
  }, [columnReport, importSummary, previewData, showPreview]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleFile = (file: File) => {
    setImportError(null);
    setFoodTypeOverride('');
    setProjectNameEdited(false);
    setImportSuccess(null);
    setLastImportSummary(null);
    setSurveysSent(false);

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

  // The Overview opens the native file picker directly. Once a file is chosen,
  // this screen receives it and moves straight into import review.
  useEffect(() => {
    if (!initialCsvFile) return;
    handleFile(initialCsvFile);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    // The file is intentionally consumed once from navigation state on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!configureSurveysImportBatchId) return;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    // The prompt remains open in local state while its one-time navigation flag is consumed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Function declaration (hoisted) so the queued-import effect above can call it
  // without a use-before-declaration warning from the compiler.
  function parseCSV(text: string, fileName: string, overrideBatchName?: string) {
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
    const parsed = buildImportedDataset(mappedData, fileName);
    const detectedProjectName = parsed.detection.label || formatFoodTypeLabel(parsed.detection.slug);
    setColumnReport({
      recognised: inferredMappings.filter(item => item.target !== 'ignore').map(item => item.source),
      ignored: inferredMappings.filter(item => item.target === 'ignore').map(item => item.source),
    });
    setPreviewData(mappedData);
    setUploadedFile(fileName);
    setBatchName(overrideBatchName ?? (retestImport ? buildRetestBatchName(retestImport) : detectedProjectName));
    setProjectNameEdited(Boolean(overrideBatchName || retestImport));
    setShowPreview(true);
    setImportStep(2);
    setImportError(null);
  }

  // Auto-load file from the import queue when navigated here via "Review".
  // Declared after parseCSV so the effect can call it without a
  // use-before-declaration warning. Legitimate one-time async load on mount.
  useEffect(() => {
    if (!pendingStoragePath) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time queued-import load on mount
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

  const importCSVData = async () => {
    const parsed = importSummary ?? buildImportedDataset(previewData, uploadedFile);
    const importedETongue = parsed.eTongueData;
    const importedGCMSCount = Object.keys(parsed.gcmsData).length;
    const importedCompCount = Object.keys(parsed.compositionData).length;
    const projectName = batchName.trim() || parsed.detection.label || uploadedFile?.replace(/\.csv$/i, '') || `${parsed.detection.label} import`;

    if (importedETongue.length === 0 && importedGCMSCount === 0 && importedCompCount === 0) {
      setImportError(
        "No data could be parsed. Check that the CSV includes supported sample, sensory, GC-MS, or composition columns."
      );
      return;
    }
    if (validationReport?.errors.length) {
      setImportError(validationReport.errors[0]);
      return;
    }

    let savedPermanently = true;
    let importedBatchId: string | undefined;

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
        ingredientStatements: parsed.ingredientStatements,
        reformulationNotes: retestImport
          ? [retestImport.target, retestImport.action].filter(Boolean).join(' — ') || undefined
          : undefined,
      });

      importedBatchId = savedDataset.importBatchId;
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
    }
    setSelection(
      parsed.detection.slug,
      importedBatchId ? encodeBatchSelection(importedBatchId) : null,
    );

    const parts: string[] = [];
    if (importedETongue.length > 0)
      parts.push(`${importedETongue.length} e-tongue sample${importedETongue.length > 1 ? "s" : ""}`);
    if (importedGCMSCount > 0)
      parts.push(`${importedGCMSCount} GC-MS record${importedGCMSCount > 1 ? "s" : ""}`);
    if (importedCompCount > 0)
      parts.push(`${importedCompCount} composition profile${importedCompCount > 1 ? "s" : ""}`);

    setImportSuccess(
      savedPermanently
        ? `Imported ${parts.join(", ")} into ${parsed.detection.label}. Review the questionnaire setup before sending surveys.`
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
      importBatchId: importedBatchId ?? null,
      retestParentDecisionId: retestImport?.parentDecisionId ?? null,
      groupedByFormulation: parsed.aggregation.groupedByFormulation,
      sourceSampleCount: parsed.aggregation.sourceSampleCount,
    });
    setSurveySections([...DEFAULT_SURVEY_SECTIONS]);
    setSurveyAttributes(getDefaultCataAttributesForFoodType(parsed.detection.slug));
    setNewSurveyAttributes('');
    setSurveysSent(false);
    setShowPreview(false);
    setUploadedFile(null);
    setColumnReport(null);
    setFoodTypeOverride('');
    setProjectNameEdited(false);
    setBatchName('');
    setImportStep(1);
    setImportError(null);

    // reset file input so the same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (savedPermanently && importedBatchId) {
      navigate(projectPath(importedBatchId, 'data'), {
        replace: true,
        state: { configureSurveysImportBatchId: importedBatchId },
      });
    }
  };

  const cancelPreview = () => {
    setShowPreview(false);
    setUploadedFile(null);
    setColumnReport(null);
    setFoodTypeOverride('');
    setProjectNameEdited(false);
    setBatchName('');
    setImportStep(1);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── derived display data ──────────────────────────────────────────────────

  const {
    displayedSamples,
    pcaData,
    selectedSampleData,
    selectedGCMSData,
    selectedCompositionData,
    selectedColor,
    activeFoodTypeLabel,
    radarData,
    compareRadarSeries,
    compareRadarChartData,
  } = useInstrumentalChartViewModel({
    filteredETongueData,
    gcmsData,
    compositionData,
    selectedSamples,
    compareMode,
    foodType,
  });
  const aromaThresholdExceedances = selectedGCMSData.filter(compound =>
    compound.threshold > 0 && compound.concentration >= compound.threshold
  );
  const aromaFlaggedCompounds = [...(aromaThresholdExceedances.length > 0 ? aromaThresholdExceedances : selectedGCMSData)].sort((a, b) => {
    const aRatio = a.threshold > 0 ? a.concentration / a.threshold : 0;
    const bRatio = b.threshold > 0 ? b.concentration / b.threshold : 0;
    return bRatio - aRatio || b.concentration - a.concentration;
  });
  const primaryAromaCompound = [...aromaFlaggedCompounds].sort((a, b) => b.concentration - a.concentration)[0];
  const aromaTotalConcentration = selectedGCMSData.reduce((sum, compound) => sum + compound.concentration, 0);
  const aromaWithThreshold = selectedGCMSData.filter(compound => compound.threshold > 0).length;
  const selectedIngredientStatement = selectedSampleData?.ingredientStatement;
  const selectedIngredientBatchId = selectedSampleData?.importBatchId;
  const selectedFormulationVersions = selectedSampleData
    ? instrumentalDatasetQuery.data?.formulationVersions?.[selectedSampleData.sampleId] ?? []
    : [];
  const ingredientEditing = Boolean(selectedSampleData && editingIngredientSampleId === selectedSampleData.sampleId);
  const comparisonLimit = Math.min(MAX_INSTRUMENTAL_COMPARISON_SAMPLES, Math.max(1, displayedSamples.length));
  const comparisonLimitReached = compareMode && selectedSamples.length >= comparisonLimit;

  const beginIngredientEdit = () => {
    if (!selectedSampleData) return;
    updateIngredientStatement.reset();
    setEditingIngredientSampleId(selectedSampleData.sampleId);
    setIngredientDraft(selectedIngredientStatement?.text ?? '');
  };

  const cancelIngredientEdit = () => {
    updateIngredientStatement.reset();
    setEditingIngredientSampleId(null);
    setIngredientDraft('');
  };

  const saveIngredientStatement = async () => {
    if (!selectedSampleData || !selectedIngredientBatchId) return;
    try {
      await updateIngredientStatement.mutateAsync({
        importBatchId: selectedIngredientBatchId,
        sampleId: selectedSampleData.sampleId,
        statement: ingredientDraft,
      });
      cancelIngredientEdit();
    } catch {
      // The mutation owns the visible error state; keep the editor open so the
      // administrator does not lose the exact statement they entered.
    }
  };

  useEffect(() => {
    const element = instrumentSummaryRef.current;
    if (!element) return;

    const updateHeight = () => {
      setInstrumentSummaryHeight(Math.ceil(element.getBoundingClientRect().height));
    };

    updateHeight();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);

    return () => observer.disconnect();
  }, [
    compareMode,
    displayedSamples.length,
    selectedCompositionData,
    selectedGCMSData.length,
    selectedSamples,
  ]);

  const viewImportedCharts = (summary: ImportCompletionSummary) => {
    setSelection(summary.foodTypeSlug, null);
    window.setTimeout(() => {
      document.getElementById('machine-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const openImportedWorkflow = (summary: ImportCompletionSummary, path: '/admin' | '/concept-testing' | '/decision') => {
    setSelection(summary.foodTypeSlug, null);
    navigate(path, {
      state: summary.retestParentDecisionId ? { retestParentDecisionId: summary.retestParentDecisionId } : undefined,
    });
  };

  const handleSendImportSurveys = async (summary: ImportCompletionSummary) => {
    if (!summary.importBatchId) {
      setImportError('This import is local-only, so draft surveys cannot be created until the database import is available.');
      return;
    }
    if (surveySections.length === 0) {
      setImportError('Select at least one questionnaire section.');
      return;
    }
    if (surveySections.includes('cata') && surveyAttributes.length === 0) {
      setImportError('Select at least one flavor and aroma attribute.');
      return;
    }
    setImportError(null);
    try {
      const result = await createImportSurveys.mutateAsync({
        batchId: summary.importBatchId,
        surveySections,
        customAttributes: surveySections.includes('cata') ? surveyAttributes : [],
      });
      setSurveysSent(true);
      setImportSuccess(
        `${result.surveyNames.length} draft survey${result.surveyNames.length === 1 ? '' : 's'} created. Check allergens once in Studies, select the eligible panel, preview, and launch.`,
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to create draft surveys.');
    }
  };

  const addSurveyAttributes = (summary: ImportCompletionSummary) => {
    if (!newSurveyAttributes.trim()) return;
    setSurveyAttributes(current => mergeSurveyAttributes(
      current,
      newSurveyAttributes,
      getDefaultCataAttributesForFoodType(summary.foodTypeSlug),
    ));
    setNewSurveyAttributes('');
  };

  const configureImportedSurveys = async () => {
    if (!configureSurveysImportBatchId) return;
    setImportError(null);
    try {
      const result = await createImportSurveys.mutateAsync({
        batchId: configureSurveysImportBatchId,
        surveySections: [...DEFAULT_SURVEY_SECTIONS],
        customAttributes: getDefaultCataAttributesForFoodType(foodType),
      });
      const firstSurveyId = result.surveyIds[0];
      if (!firstSurveyId) throw new Error('No sample surveys were created for this import.');
      setShowConfigureSurveysPrompt(false);
      navigate(projectStudiesPath(configureSurveysImportBatchId, 'studies', `?batchSurveySetup=${encodeURIComponent(configureSurveysImportBatchId)}`));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to prepare the surveys.');
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Dialog open={showConfigureSurveysPrompt} onOpenChange={setShowConfigureSurveysPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <ClipboardList className="size-5" aria-hidden />
            </div>
            <DialogTitle>Configure surveys</DialogTitle>
            <DialogDescription className="leading-6 text-slate-600">
              Your data is imported. Continue to verify the sample allergens, review the questionnaire, and choose eligible panelists.
            </DialogDescription>
          </DialogHeader>
          {importError && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{importError}</p>}
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setShowConfigureSurveysPrompt(false)} disabled={createImportSurveys.isPending}>Not now</Button>
            <Button
              type="button"
              className="bg-slate-900 hover:bg-slate-800"
              onClick={configureImportedSurveys}
              disabled={createImportSurveys.isPending}
            >
              {createImportSurveys.isPending ? 'Preparing surveys…' : 'Configure surveys'}
              {!createImportSurveys.isPending && <ArrowRight className="size-4" aria-hidden />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isLoadingFromQueue && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <div className="size-4 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
          Loading file from import queue…
        </div>
      )}

      {(retestImport || retestQuery) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-950">Retest import</p>
          <p className="mt-1 text-sm leading-6 text-amber-800">
            Import the reformulated batch into this same project so the next decision can compare it against the TWEAK evidence.
            {retestImport?.sampleName ? ` Source sample: ${retestImport.sampleName}.` : ''}
          </p>
        </div>
      )}

      <WorkflowPageHeader
        title="Machine Testing"
        description="Import machine and instrumental data for the active project."
        actions={(
          <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
            id="csv-upload-header"
          />
          <Button
            type="button"
            className="bg-slate-900 hover:bg-slate-700"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" />
            Import CSV
          </Button>
          </>
        )}
      />

      {newProjectIntent && !showPreview && !lastImportSummary && (
        <Card className="border-2 border-blue-200 bg-blue-50/60 shadow-sm">
          <CardContent className="p-5">
            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Create new project</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Upload the CSV, then review the detected project.</h2>
                <p className="mt-1 text-sm text-slate-700">
                  The platform will detect the food type, create the matching project folder, and turn each imported sample into a questionnaire-ready item.
                </p>
              </div>
              <div className="rounded-xl border border-blue-100 bg-white p-4">
                <p className="text-sm font-bold text-slate-900">CSV data</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  After upload, review the detected project name such as Yogurt, Cheese, or Bread before saving.
                </p>
              </div>
            </div>
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 h-10 w-full justify-center bg-blue-600 text-sm font-bold hover:bg-blue-700"
            >
              <Upload className="size-4" />
              Choose CSV
            </Button>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                {retestImport.decision === 'STOP' ? 'Reformulation import' : 'Retest import'}
              </p>
              <h2 className="mt-1 text-base font-semibold text-slate-900">{retestImport.sampleName}</h2>
              <p className="mt-1 text-sm text-slate-700">
                New data will be labeled as <span className="font-semibold">{buildRetestBatchName(retestImport)}</span>
                {' '}for sample {retestImport.sampleId}.
              </p>
              {retestImport.target && (
                <p className="mt-2 text-xs text-slate-700">
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
            <Card className="border-slate-300 bg-white">
              <CardContent className="space-y-5 p-4 sm:p-5">
                <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600">
                      <Check className="size-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{lastImportSummary.foodTypeLabel} project imported</p>
                      <p className="mt-0.5 text-xs text-slate-600">{lastImportSummary.projectName}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold text-slate-700">
                          {lastImportSummary.sampleCount} {lastImportSummary.groupedByFormulation ? 'formulations' : 'samples'}
                        </span>
                        {lastImportSummary.groupedByFormulation && lastImportSummary.sourceSampleCount ? (
                          <span className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold text-slate-700">Mean of {lastImportSummary.sourceSampleCount} samples</span>
                        ) : null}
                        <span className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold text-slate-700">{lastImportSummary.gcmsCount} GC-MS</span>
                        <span className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold text-slate-700">{lastImportSummary.compositionCount} composition</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => viewImportedCharts(lastImportSummary)}>
                    <BarChart3 className="size-4" />View machine data
                  </Button>
                </div>

                {!surveysSent ? (
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-start gap-2">
                        <ClipboardList className="mt-0.5 size-4 text-blue-700" />
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Choose what panelists will answer</h3>
                          <p className="mt-1 text-sm text-slate-700">This creates private drafts. Panelists see nothing until each study passes safety review and is launched.</p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                        {SURVEY_SECTION_IDS.map(section => (
                          <label key={section} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors ${surveySections.includes(section) ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                            <Checkbox
                              checked={surveySections.includes(section)}
                              onCheckedChange={() => setSurveySections(current => toggleSurveySection(current, section))}
                              aria-label={SURVEY_SECTION_LABELS[section]}
                            />
                            <span>
                              <span className="block text-sm font-semibold text-slate-900">{SURVEY_SECTION_LABELS[section]}</span>
                              {section === 'intensity' && <span className="mt-0.5 block text-xs text-slate-600">Includes CATA automatically</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {surveySections.includes('cata') && (
                      <div className="border-t border-slate-200 pt-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">Flavor and aroma attributes</h3>
                            <p className="mt-1 text-xs text-slate-600">Select the cues shown in every sample questionnaire.</p>
                          </div>
                          <div className="flex gap-1">
                            <Button type="button" size="sm" variant="ghost" onClick={() => setSurveyAttributes(getDefaultCataAttributesForFoodType(lastImportSummary.foodTypeSlug))}>Select defaults</Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setSurveyAttributes([])}>Clear</Button>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <Input
                            aria-label="Add CATA attributes"
                            placeholder="Add one or more attributes, separated by commas"
                            value={newSurveyAttributes}
                            onChange={event => setNewSurveyAttributes(event.target.value)}
                            onKeyDown={event => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                addSurveyAttributes(lastImportSummary);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => addSurveyAttributes(lastImportSummary)}
                            disabled={!newSurveyAttributes.trim()}
                            className="shrink-0"
                          >
                            <Plus className="size-4" />Add attributes
                          </Button>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-600">
                          <span>{surveyAttributes.length} selected</span>
                          <span>Press Enter to add</span>
                        </div>
                        <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-3">
                          {Array.from(new Set([
                            ...getDefaultCataAttributesForFoodType(lastImportSummary.foodTypeSlug),
                            ...surveyAttributes,
                          ])).map(attribute => (
                            <label key={attribute} className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 hover:border-blue-300">
                              <Checkbox
                                checked={surveyAttributes.includes(attribute)}
                                onCheckedChange={() => setSurveyAttributes(current => current.includes(attribute) ? current.filter(value => value !== attribute) : [...current, attribute])}
                              />
                              {attribute}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-slate-200 pt-4">
                      <div className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
                        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden />
                        <div><h3 className="text-sm font-semibold text-slate-900">Safety before launch</h3><p className="mt-1 text-xs leading-5 text-slate-600">Create these drafts, then check allergens once for the imported sample in Studies. Only eligible panelists can be selected.</p></div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-slate-700">
                        <strong>{lastImportSummary.sampleCount}</strong> surveys · <strong>{surveySections.length}</strong> sections · <strong>{surveyAttributes.length}</strong> CATA attributes
                      </p>
                      <Button
                        onClick={() => handleSendImportSurveys(lastImportSummary)}
                        disabled={createImportSurveys.isPending || !lastImportSummary.savedPermanently}
                        className="bg-slate-900 hover:bg-slate-800"
                      >
                        <Save className="size-4" />
                        {createImportSurveys.isPending ? 'Creating drafts…' : 'Create draft surveys'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-emerald-800">Draft surveys created</p>
                      <p className="mt-1 text-sm text-slate-700">Open Studies to check allergens once and assign the full survey set.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => openImportedWorkflow(lastImportSummary, '/admin')}><ClipboardList className="size-4" />Open Studies</Button>
                      {lastImportSummary.retestParentDecisionId && (
                        <Button variant="outline" size="sm" onClick={() => openImportedWorkflow(lastImportSummary, '/decision')}><ArrowRight className="size-4" />Re-run decision</Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => openImportedWorkflow(lastImportSummary, '/concept-testing')}><Lightbulb className="size-4" />Concepts</Button>
                    </div>
                  </div>
                )}
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
                    <p className="font-semibold text-slate-700 mb-1.5">Detected food type</p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-900">{importSummary.detection.label}</span>
                      <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 font-semibold text-slate-700">
                        {Math.round(importSummary.detection.confidence * 100)}%
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-1.5 text-[11px] text-slate-700">
                      <span className="rounded bg-white border border-slate-200 px-1.5 py-1">{importSummary.sampleCount} {importSummary.aggregation.groupedByFormulation ? 'formulations' : 'samples'}</span>
                      <span className="rounded bg-white border border-slate-200 px-1.5 py-1">{importSummary.gcmsCount} GC-MS</span>
                      <span className="rounded bg-white border border-slate-200 px-1.5 py-1">{importSummary.compositionCount} comp</span>
                    </div>
                    {importSummary.aggregation.groupedByFormulation && (
                      <p className="mt-2 rounded bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold leading-4 text-emerald-800 ring-1 ring-emerald-200">
                        {importSummary.aggregation.sourceSampleCount} individual samples will be averaged into {importSummary.aggregation.formulationCount} formulation profiles.
                      </p>
                    )}
                    <label className="mt-3 block text-[11px] font-semibold text-slate-700" htmlFor="food-type-override">
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
                      {importSummary.sampleCount} {importSummary.aggregation.groupedByFormulation ? `formulation${importSummary.sampleCount === 1 ? '' : 's'}` : `sample${importSummary.sampleCount === 1 ? '' : 's'}`} will be ready for survey setup
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
                    <p className="text-emerald-600 italic">None — check that the CSV uses supported import column names.</p>
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
                  <tr className="bg-slate-50 border-b">
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
                <p className="text-xs text-slate-500 mt-2 text-center">
                  Showing 10 of {previewData.length} rows
                </p>
              )}
            </div>

            {/* Name and confirm */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Name this food project</p>
              <p className="text-xs text-slate-500">Detected as {importSummary?.detection.label ?? 'this category'}. Keep that project name or edit it before importing the data.</p>
              <input
                type="text"
                value={batchName}
                onChange={e => { setBatchName(e.target.value); setProjectNameEdited(true); setImportStep(3); }}
                onFocus={() => setImportStep(3)}
                placeholder={importSummary?.detection.label ?? 'e.g., Yogurt'}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
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

      {!showPreview && (<>
      <div id="machine-results" className="grid grid-cols-4 gap-6 scroll-mt-6">
        <div
          className="min-h-0"
          style={instrumentSummaryHeight ? { height: instrumentSummaryHeight } : undefined}
        >
          <ProductListPanel
            title="Samples"
            className="h-full min-h-0"
            description={compareMode
              ? comparisonLimitReached
                ? `${selectedSamples.length}/${comparisonLimit} selected · Remove one to choose another`
                : `Choose up to ${comparisonLimit} samples (${selectedSamples.length}/${comparisonLimit} selected)`
              : 'Choose a sample to view detailed measurements'}
            actions={(
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
            )}
          >
            <div className="h-full min-h-0 space-y-1 overflow-y-auto pr-1">
              {displayedSamples.map((sample) => {
                const isSelected = selectedSamples.includes(sample.id);
                const comparisonIndex = selectedSamples.indexOf(sample.id);
                const selectionDisabled = comparisonLimitReached && !isSelected;

                return (
                  <ProductListItem
                    key={sample.uniqueKey}
                    active={isSelected}
                    title={sample.name}
                    meta={sample.id}
                    disabled={selectionDisabled}
                    trailing={compareMode && isSelected && (
                      <span
                        aria-label={`Comparison series ${comparisonIndex + 1}`}
                        className="flex size-5 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ backgroundColor: instrumentalComparisonColor(comparisonIndex) }}
                      >
                        {comparisonIndex + 1}
                      </span>
                    )}
                    onClick={() => {
                      setAromaOpen(false);
                      cancelIngredientEdit();
                      if (compareMode) {
                        setSelectedSamples(toggleInstrumentalComparisonSample(
                          selectedSamples,
                          sample.id,
                          comparisonLimit,
                        ));
                      } else {
                        setSelectedSamples([sample.id]);
                      }
                    }}
                  />
                );
              })}
            </div>
          </ProductListPanel>
        </div>

        <div ref={instrumentSummaryRef} className="col-span-3 space-y-6">
          <div>
            <Card className="border-2 border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-50 border-b rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FlaskConical className="size-5 text-slate-700" />
                  Electronic Tongue Analysis
                </CardTitle>
                <p className="text-xs text-slate-700 mt-1">
                  Quantitative measurement of five fundamental taste attributes
                </p>
              </CardHeader>
              <CardContent className="relative pt-2">
                <div className="absolute right-4 top-4 z-10">
                  <button
                    type="button"
                    onClick={() => setAromaOpen(open => !open)}
                    className={`rounded-md border px-3 py-2 text-left text-xs shadow-sm transition-colors ${
                      aromaFlaggedCompounds.length > 0
                        ? 'border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    aria-expanded={aromaOpen}
                  >
                    <span className="block font-bold">
                      {aromaThresholdExceedances.length > 0
                        ? `${aromaThresholdExceedances.length} threshold flag${aromaThresholdExceedances.length === 1 ? '' : 's'}`
                        : selectedGCMSData.length > 0
                          ? `${selectedGCMSData.length} compounds detected`
                          : 'No aroma flags'}
                    </span>
                    <span className="block max-w-44 truncate font-medium">
                      {primaryAromaCompound ? `${primaryAromaCompound.name} · ${primaryAromaCompound.aroma}` : 'GC-O clear'}
                    </span>
                  </button>
                  {aromaOpen && (
                    <div className="absolute right-0 mt-2 w-[48rem] max-w-[calc(100vw-24rem)] overflow-hidden rounded-lg border border-rose-200 bg-white shadow-xl">
                      <div className="border-b border-rose-100 bg-rose-50 px-3 py-2">
                        <p className="text-xs font-bold text-rose-950">Aroma compounds and threshold review</p>
                        <p className="mt-0.5 text-[11px] text-rose-800">
                          {aromaThresholdExceedances.length > 0
                            ? 'Compounds at or above sensory threshold are flagged first.'
                            : selectedGCMSData.length > 0
                              ? 'Detected compounds are shown; no threshold exceedance is marked.'
                              : 'No volatile off-notes detected.'}
                        </p>
                      </div>
                      {aromaFlaggedCompounds.length > 0 ? (
                        <>
                          <div className="grid grid-cols-[1.5fr_2fr] gap-3 border-b border-slate-100 p-3">
                            <div className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase text-rose-700">Primary aroma note</p>
                              <p className="mt-1 truncate text-sm font-bold text-rose-950">{primaryAromaCompound?.name ?? 'None'}</p>
                              <p className="truncate text-xs text-rose-800">
                                {primaryAromaCompound
                                  ? `${primaryAromaCompound.aroma || 'Unspecified'} · ${primaryAromaCompound.concentration.toFixed(1)} ppm`
                                  : 'No GC-O compound detected'}
                              </p>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                                <p className="text-[11px] font-semibold text-slate-500">Detected</p>
                                <p className="text-lg font-bold text-slate-950">{selectedGCMSData.length}</p>
                              </div>
                              <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2">
                                <p className="text-[11px] font-semibold text-rose-700">Flags</p>
                                <p className="text-lg font-bold text-rose-950">{aromaThresholdExceedances.length}</p>
                              </div>
                              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                                <p className="text-[11px] font-semibold text-slate-500">Limits</p>
                                <p className="text-lg font-bold text-slate-950">{aromaWithThreshold}</p>
                              </div>
                              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                                <p className="text-[11px] font-semibold text-slate-500">Total</p>
                                <p className="text-lg font-bold text-slate-950">{aromaTotalConcentration.toFixed(1)}</p>
                              </div>
                            </div>
                          </div>
                          <div className="max-h-80 overflow-y-auto">
                            <div className="grid grid-cols-[minmax(10rem,1.35fr)_minmax(9rem,1fr)_5.5rem_5.5rem_4.75rem_5.75rem] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase text-slate-500">
                              <span>Compound</span>
                              <span>Aroma note</span>
                              <span className="text-right">Conc.</span>
                              <span className="text-right">Threshold</span>
                              <span className="text-right">Ratio</span>
                              <span>Status</span>
                            </div>
                            {aromaFlaggedCompounds.map((compound, idx) => {
                              const hasThreshold = compound.threshold > 0;
                              const ratio = hasThreshold ? compound.concentration / compound.threshold : null;
                              const aboveThreshold = ratio !== null && ratio >= 1;
                              return (
                                <div key={`${compound.name}-${idx}`} className="grid grid-cols-[minmax(10rem,1.35fr)_minmax(9rem,1fr)_5.5rem_5.5rem_4.75rem_5.75rem] gap-2 border-b border-slate-100 px-3 py-2.5 text-xs last:border-b-0">
                                  <span className="min-w-0 truncate font-semibold text-slate-900">{compound.name}</span>
                                  <span className="min-w-0 truncate text-slate-600">{compound.aroma || 'Unspecified'}</span>
                                  <span className="text-right font-semibold text-slate-800">{compound.concentration.toFixed(1)} ppm</span>
                                  <span className="text-right text-slate-600">{hasThreshold ? `${compound.threshold.toFixed(1)} ppm` : 'None'}</span>
                                  <span className={`text-right font-semibold ${aboveThreshold ? 'text-rose-700' : 'text-slate-700'}`}>
                                    {ratio !== null ? `${ratio.toFixed(1)}x` : '—'}
                                  </span>
                                  <span className={`rounded px-1.5 py-0.5 text-center text-[11px] font-semibold ${
                                    aboveThreshold
                                      ? 'bg-rose-100 text-rose-800'
                                      : hasThreshold
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {aboveThreshold ? 'Flag' : hasThreshold ? 'Below' : 'No limit'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="px-3 py-4 text-xs text-slate-500">No aroma compounds need review for this sample.</div>
                      )}
                    </div>
                  )}
                </div>

                <ResponsiveContainer width="100%" height={470}>
                  <RadarChart
                    data={compareMode ? compareRadarChartData : radarData}
                    margin={{ top: 6, right: 20, bottom: 6, left: 20 }}
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
                          fillOpacity={compareRadarSeries.length > 2 ? 0.07 : 0.12}
                          strokeWidth={2.25}
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

                <div className="mt-2 flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1 text-xs">
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
                  ) : selectedSampleData ? (
                    displayedSamples
                      .filter(sample => sample.id === selectedSampleData.sampleId)
                      .slice(0, 1)
                      .map(sample => (
                      <div
                        key={sample.id}
                        className="flex items-center gap-2 rounded-md border px-3 py-2"
                        style={{ borderColor: `${selectedColor}40`, background: `${selectedColor}12` }}
                      >
                        <div className="h-3 w-3 rounded-full" style={{ background: selectedColor }} />
                        <span className="font-medium text-slate-700">{sample.name}</span>
                      </div>
                      ))
                  ) : null}
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
              <p className="text-xs text-slate-700 mt-1">Proximate analysis and key chemical properties</p>
            </CardHeader>
            <CardContent className="pt-4">
              <section className="mb-4 border-b border-slate-200 pb-4" aria-labelledby="ingredient-statement-heading">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 id="ingredient-statement-heading" className="text-sm font-bold text-slate-900">Ingredient statement</h3>
                      {selectedIngredientStatement && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {selectedIngredientStatement.source === 'csv_import' ? 'Imported from CSV' : 'Entered manually'}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Exact supplied wording and ingredient order for {selectedSampleData?.sampleName || selectedSampleData?.sampleId || 'the selected product'}.
                    </p>
                  </div>
                  {!ingredientEditing && selectedIngredientBatchId && (
                    <Button type="button" variant="outline" size="sm" onClick={beginIngredientEdit}>
                      <Pencil className="size-3.5" />
                      {selectedIngredientStatement ? 'Edit ingredients' : 'Add ingredients'}
                    </Button>
                  )}
                </div>

                {ingredientEditing ? (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      value={ingredientDraft}
                      onChange={event => setIngredientDraft(event.target.value)}
                      placeholder="List ingredients exactly as supplied, in descending order by weight."
                      maxLength={10000}
                      rows={4}
                      aria-label="Exact ingredient statement"
                      className="min-h-24 bg-white leading-6"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-500">Internal spacing and punctuation are preserved. Clearing this field marks the statement as not provided.</p>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={cancelIngredientEdit} disabled={updateIngredientStatement.isPending}>
                          Cancel
                        </Button>
                        <Button type="button" size="sm" onClick={() => void saveIngredientStatement()} disabled={updateIngredientStatement.isPending}>
                          <Save className="size-3.5" />
                          {updateIngredientStatement.isPending ? 'Saving' : 'Save ingredients'}
                        </Button>
                      </div>
                    </div>
                    {updateIngredientStatement.isError && (
                      <p className="text-xs font-medium text-rose-700" role="alert">The ingredient statement could not be saved. Try again.</p>
                    )}
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className={`whitespace-pre-wrap text-sm leading-6 ${selectedIngredientStatement ? 'text-slate-800' : 'italic text-slate-500'}`}>
                      {selectedIngredientStatement?.text || 'No ingredient statement has been provided for this product.'}
                    </p>
                    {selectedIngredientStatement?.updatedAt && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Updated {new Date(selectedIngredientStatement.updatedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </section>

              {selectedSampleData && selectedIngredientBatchId && selectedFormulationVersions.length > 0 && (
                <FormulationProfilePanel
                  key={selectedFormulationVersions.find(version => version.isCurrent)?.id ?? selectedSampleData.sampleId}
                  importBatchId={selectedIngredientBatchId}
                  sampleId={selectedSampleData.sampleId}
                  versions={selectedFormulationVersions}
                />
              )}

              {selectedCompositionData && Object.keys(selectedCompositionData).length > 0 ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  {[
                    { label: "Protein",  value: selectedCompositionData.protein?.toFixed(1),  unit: "%" },
                    { label: "Fat",      value: selectedCompositionData.fat?.toFixed(1),      unit: "%" },
                    { label: "Moisture", value: selectedCompositionData.moisture?.toFixed(1), unit: "%" },
                    { label: "pH",       value: selectedCompositionData.pH?.toFixed(1),       unit: ""  },
                    { label: "Salt",     value: selectedCompositionData.saltContent?.toFixed(1), unit: "%" },
                    { label: "Calcium",  value: selectedCompositionData.calciumMg?.toFixed(0), unit: "mg" },
                  ].map(({ label, value, unit }) => (
                    <div key={label} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-xs text-slate-700 mb-1">{label}</div>
                      <div className="text-2xl font-bold text-slate-900">
                        {value || "—"}
                        {unit && value && <span className="text-sm text-slate-700 ml-1">{unit}</span>}
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
          <p className="text-xs text-slate-700 mt-1">
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
            const useTypeLegend = uniqueCategories.length > 6;
            const legendEntries = useTypeLegend
              ? Array.from(new Map(pcaData.map(point => [point.type, {
                  label: formatFoodTypeLabel(point.type),
                  color: getPointColor(point.type),
                  count: pcaData.filter(candidate => candidate.type === point.type).length,
                }])).values())
              : uniqueCategories.map(([label, { color }]) => ({ label, color, count: null }));
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
                              <p className="text-xs text-slate-700 mt-1">{data.category}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {uniqueTypes.map(type => (
                      <Scatter key={type} data={pcaData.filter(d => d.type === type)}>
                        {pcaData.filter(d => d.type === type).map(entry => {
                          const selected = selectedSamples.includes(entry.sampleId);
                          const color = useTypeLegend
                            ? getPointColor(entry.type)
                            : getPointColor(entry.type, entry.category);
                          return (
                            <Cell
                              key={`cell-${entry.id}`}
                              fill={color}
                              fillOpacity={selected ? 1 : 0.68}
                              stroke={selected ? '#0f172a' : '#ffffff'}
                              strokeWidth={selected ? 2 : 1}
                            />
                          );
                        })}
                      </Scatter>
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>

                <div className="mt-6 flex flex-wrap gap-3 text-sm">
                  {legendEntries.map(({ label, color, count }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                      style={{ borderColor: `${color}40`, background: `${color}12` }}
                    >
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="font-semibold text-slate-700">
                        {label}{count !== null ? ` · ${count} samples` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>
      </>)}

    </div>
  );
}
