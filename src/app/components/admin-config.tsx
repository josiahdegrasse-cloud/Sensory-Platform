import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { type Product, getDefaultCataAttributes } from '../data/survey-domain';
import { useFoodType, matchFoodType } from '../contexts/food-type-context';
import { parseBatchSelection } from '../lib/project-identity';
import { conceptBelongsToProject } from '../lib/concept-project-scope';
import {
  useProducts, usePanelists,
  useInsertProduct, useUpdateProduct, useDeleteProduct,
  useAllResponses, useImportBatches,
  useUpdateImportBatchStatus, useDeleteImportBatch,
  useStudyConceptTests, useConceptResponseCounts,
  useUpdateConceptTestStatus,
  useCreateImportSurveys, useUpdateProductAssignments,
  queryKeys,
} from '../lib/hooks';
import type { ConceptTest } from '../lib/database';
import {
  Plus, Settings, Trash2, Save, CheckCircle2, Layers,
  ClipboardList, Users, AlertCircle, Search, Activity, Archive, RotateCcw,
  Upload, Database, Eye, ArrowRight, Lightbulb, Edit2, ShieldCheck, MoreHorizontal,
} from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { PanelistPerformancePanel } from './panelist-performance';
import { formatFoodTypeLabel } from '../lib/food-intelligence';
import { notifyPanelistsOfSurveys } from '../lib/database';
import { filterAssignablePanelists } from '../lib/assignments';
import { SurveyConfigurationSheet } from './survey-configuration-sheet';
import {
  buildStudySummaries,
  TRIANGLE_TEST_UNDERLYING_SAMPLE_COUNT,
  type StudyLifecycleStatus,
  type StudyType,
} from '../lib/studies';
import { generateBlindCode, isValidBlindCode, withBlindSampleCodes } from '../lib/blind-study';
import { WorkflowPageHeader } from './workflow-page-header';
import { PanelistInviteForm } from './panelist-invite-form';
import { PanelistDirectory } from './panelist-directory';
import { ImportedSurveyBatchConfiguration } from './imported-survey-batch-configuration';
import { DEFAULT_SURVEY_SECTIONS, toggleSurveySection, type SurveySection } from '../lib/survey-sections';
import { deleteConceptStudy } from '../lib/db/study-deletion';

type AdminTab = 'products' | 'panelists' | 'imports';
type StudyStatusFilter = 'all' | StudyLifecycleStatus;
type StudyTypeFilter = 'all' | StudyType;
type PendingStudyDeletion = {
  id: string;
  name: string;
  kind: 'product' | 'concept';
};

const studyStatusStyles: Record<StudyLifecycleStatus, string> = {
  draft: 'bg-white text-slate-700 border-slate-200',
  active: 'bg-white text-emerald-700 border-emerald-300',
  closed: 'bg-white text-slate-700 border-slate-200',
  archived: 'bg-white text-amber-700 border-amber-300',
};

function getStudyTypeMeta(type: StudyType): {
  label: string;
  shortLabel: string;
  description: string;
  className: string;
  iconClassName: string;
  cardClassName: string;
  railClassName: string;
  actionClassName: string;
  icon: React.ElementType;
} {
  // Study-method colors are a local taxonomy, not status colors. The mapping is
  // documented in DESIGN.md and must always be paired with an icon and label.
  if (type === 'multi_sample') {
    return {
      label: 'Triangle Test',
      shortLabel: 'Multi',
      description: 'Presents three coded samples and asks panelists to identify the odd sample.',
      className: 'border-purple-300 bg-purple-50 text-purple-800',
      iconClassName: 'bg-purple-600 text-white',
      cardClassName: 'border-purple-200 hover:border-purple-400',
      railClassName: 'bg-purple-500',
      actionClassName: 'bg-purple-700 hover:bg-purple-800',
      icon: Layers,
    };
  }
  if (type === 'concept_test') {
    return {
      label: 'Concept Test',
      shortLabel: 'Concept',
      description: 'Tests positioning, imagery, pricing, claims, and purchase intent before product work.',
      className: 'border-teal-300 bg-teal-50 text-teal-800',
      iconClassName: 'bg-teal-600 text-white',
      cardClassName: 'border-teal-200 hover:border-teal-400',
      railClassName: 'bg-teal-500',
      actionClassName: 'bg-teal-700 hover:bg-teal-800',
      icon: Lightbulb,
    };
  }
  return {
    label: 'Product Sensory Survey',
    shortLabel: 'Product',
    description: 'Evaluates one product sample with administrator-selected questionnaire sections.',
    className: 'border-blue-300 bg-blue-50 text-blue-800',
    iconClassName: 'bg-blue-600 text-white',
    cardClassName: 'border-blue-200 hover:border-blue-400',
    railClassName: 'bg-blue-500',
    actionClassName: 'bg-blue-700 hover:bg-blue-800',
    icon: ClipboardList,
  };
}

export function AdminConfig({
  mode = 'studies',
  secondaryNavigation,
}: {
  mode?: 'studies' | 'responses' | 'admin' | 'panelists';
  secondaryNavigation?: React.ReactNode;
}) {
  const isResponsesMode = mode === 'responses';
  const isPanelistsMode = mode === 'panelists';
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedTab = searchParams.get('tab');
  const initialTab: AdminTab = isPanelistsMode
    ? 'panelists'
    : mode === 'admin' && requestedTab === 'imports'
    ? 'imports'
    : mode === 'admin' && requestedTab === 'panelists'
      ? 'panelists'
      : 'products';
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const { data: products = [] } = useProducts();
  const { data: panelists = [] } = usePanelists();
  const { data: allResponses = [] } = useAllResponses();
  const { data: importBatches = [] } = useImportBatches(activeTab === 'products' || activeTab === 'imports');
  const { data: conceptStudies = [] } = useStudyConceptTests();
  const { data: conceptResponseCounts = {} } = useConceptResponseCounts();

  const insertProductMutation = useInsertProduct();
  const updateProductMutation = useUpdateProduct();
  const updateProductAssignmentsMutation = useUpdateProductAssignments();
  const deleteProductMutation = useDeleteProduct();
  const updateImportBatchStatusMutation = useUpdateImportBatchStatus();
  const deleteImportBatchMutation = useDeleteImportBatch();
  const updateConceptStatusMutation = useUpdateConceptTestStatus();
  const deleteConceptStudyMutation = useMutation({
    mutationFn: deleteConceptStudy,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.adminConceptTests }),
        queryClient.invalidateQueries({ queryKey: queryKeys.studyConceptTests }),
        queryClient.invalidateQueries({ queryKey: queryKeys.conceptResponseCounts }),
        queryClient.invalidateQueries({ queryKey: ['conceptTests'] }),
        queryClient.invalidateQueries({ queryKey: ['conceptTest'] }),
      ]);
    },
  });
  const createImportSurveysMutation = useCreateImportSurveys();
  const deletingStudy = deleteProductMutation.isPending || deleteConceptStudyMutation.isPending;
  const [pendingStudyDeletion, setPendingStudyDeletion] = useState<PendingStudyDeletion | null>(null);
  const [deleteStudyError, setDeleteStudyError] = useState('');
  const [confirmImportDeleteId, setConfirmImportDeleteId] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<string | null>(() => searchParams.get('survey'));
  const [batchSurveySetupId, setBatchSurveySetupId] = useState<string | null>(() => searchParams.get('batchSurveySetup'));
  const [customAttributes, setCustomAttributes] = useState<string[]>([]);
  const [surveySections, setSurveySections] = useState<SurveySection[]>(DEFAULT_SURVEY_SECTIONS);
  const [draftPanelistIds, setDraftPanelistIds] = useState<string[]>([]);
  const [newAttribute, setNewAttribute] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [mutationError, setMutationError] = useState('');

  const { foodType, subCategory } = useFoodType();
  const currentFoodTypeLabel = formatFoodTypeLabel(foodType);
  const selectedBatchId = parseBatchSelection(subCategory);
  const scopedDefaultCategory = selectedBatchId ? currentFoodTypeLabel : subCategory ?? currentFoodTypeLabel;

  // List filters
  const [filterStatus, setFilterStatus] = useState<StudyStatusFilter>('all');
  const [filterType, setFilterType] = useState<StudyTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<'form' | 'review' | 'configure'>('form');
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [productType, setProductType] = useState<'single' | 'multi'>('single');
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [blindedStudy, setBlindedStudy] = useState(false);
  const [samples, setSamples] = useState<{ id: string; code: string; label: string }[]>([
    { id: '1', code: generateBlindCode('manual-sample:1'), label: '' },
  ]);

  // Reset the editable attribute set when the selected product changes.
  // React's render-phase "adjust state on change" pattern — no effect needed,
  // and unlike the old effect a products refetch no longer clobbers edits.
  const [attrSeedProduct, setAttrSeedProduct] = useState<string | null>(null);
  if (selectedProduct !== attrSeedProduct) {
    setAttrSeedProduct(selectedProduct);
    if (selectedProduct) {
      const product = products.find(p => p.id === selectedProduct);
      setCustomAttributes(product?.customAttributes || getDefaultCataAttributes(product?.category ?? ''));
      setSurveySections(product?.surveySections ?? DEFAULT_SURVEY_SECTIONS);
      setDraftPanelistIds(product?.assignedPanelistIds ?? []);
    }
  }

  // Clear a selection that no longer matches the active food type.
  const [foodTypeForSelection, setFoodTypeForSelection] = useState(foodType);
  if (foodType !== foodTypeForSelection) {
    setFoodTypeForSelection(foodType);
    if (selectedProduct) {
      const product = products.find(p => p.id === selectedProduct);
      if (product && matchFoodType(product.category) !== foodType) setSelectedProduct(null);
    }
  }

  // ── Computed stats ────────────────────────────────────────────────────────────

  // Category-aware attribute sets for the sidebar editor and create modal
  const selectedProductCategory = products.find(p => p.id === selectedProduct)?.category ?? '';
  const selectedProductRecord = products.find(p => p.id === selectedProduct) ?? null;
  const selectedProductStdAttrs = getDefaultCataAttributes(selectedProductCategory);
  const modalStdAttrs = getDefaultCataAttributes(newProductCategory);
  const activePanelists = filterAssignablePanelists(panelists);
  const configuredSampleCount = samples.filter(sample => sample.code.trim() && sample.label.trim()).length;
  const canReviewStudy = Boolean(newProductName && newProductCategory && (productType !== 'multi' || configuredSampleCount === TRIANGLE_TEST_UNDERLYING_SAMPLE_COUNT));
  const selectedProjectId = selectedBatchId
    ? importBatches.find(batch => batch.id === selectedBatchId)?.projectId ?? null
    : null;
  const batchesAwaitingSurveySetup = importBatches.filter(batch =>
    batch.status === 'active'
    && batch.sampleCount > 0
    && (!selectedBatchId || batch.id === selectedBatchId)
    && !products.some(product => product.sourceImportBatchId === batch.id),
  );
  const batchSurveySetup = importBatches.find(batch => batch.id === batchSurveySetupId) ?? null;
  const batchSurveyProducts = products.filter(product => product.sourceImportBatchId === batchSurveySetupId);

  const allStudySummaries = useMemo(() => buildStudySummaries({
    products,
    concepts: conceptStudies,
    responses: allResponses,
    conceptResponseCounts,
    importBatches,
    activePanelistCount: activePanelists.length,
  }), [activePanelists.length, allResponses, conceptResponseCounts, conceptStudies, importBatches, products]);
  const scopedConceptStudyIds = useMemo(() => new Set(
    conceptStudies
      .filter(concept => {
        if (!conceptBelongsToProject(concept, selectedProjectId)) return false;
        if (concept.foodTypeSlug && concept.foodTypeSlug !== foodType) return false;
        if (subCategory && parseBatchSelection(subCategory) === null && concept.category !== subCategory) return false;
        return true;
      })
      .map(concept => concept.id)
  ), [conceptStudies, foodType, selectedProjectId, subCategory]);
  const scopedStudySummaries = allStudySummaries.filter(study => {
    if (study.type === 'concept_test') return scopedConceptStudyIds.has(study.id);
    const product = products.find(p => p.id === study.id);
    if (!product) return false;
    if (selectedBatchId) return product.sourceImportBatchId === selectedBatchId || (selectedProjectId ? product.projectId === selectedProjectId : false);
    if (matchFoodType(product.category) !== foodType) return false;
    if (subCategory && product.category !== subCategory) return false;
    return true;
  });
  const filteredStudies = scopedStudySummaries
    .filter(study => filterStatus === 'all' ? study.status !== 'archived' : study.status === filterStatus)
    .filter(study => filterType === 'all' || study.type === filterType)
    .filter(study =>
      !searchQuery.trim() ||
      study.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      study.linkedLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      study.sourceImportBatchName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  const studyCounts = scopedStudySummaries.reduce<Record<StudyStatusFilter, number>>((counts, study) => {
    counts[study.status] += 1;
    if (study.status !== 'archived') counts.all += 1;
    return counts;
  }, { all: 0, draft: 0, active: 0, closed: 0, archived: 0 });
  const activeStudyCount = scopedStudySummaries.filter(study => study.status === 'active').length;
  const closedStudyCount = scopedStudySummaries.filter(study => study.status === 'closed').length;
  const blockerCount = scopedStudySummaries.reduce(
    (sum, study) => sum + study.blockers.filter(blocker => blocker.severity === 'blocker').length,
    0
  );
  const totalStudyResponses = scopedStudySummaries.reduce((sum, study) => sum + study.completedCount, 0);
  const productById = new Map(products.map(product => [product.id, product]));
  const recoverableImportCount = importBatches.filter(batch => batch.status !== 'active').length;
  const selectableSourceSamples = products
    .filter(product => {
      if (product.status === 'archived' || product.isMultiSample || !product.sourceSampleId) return false;
      if (selectedBatchId) return product.sourceImportBatchId === selectedBatchId || (selectedProjectId ? product.projectId === selectedProjectId : false);
      return matchFoodType(product.category) === foodType;
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const selectedSampleIds = new Set(samples.map(sample => sample.id));
  const selectedImportedSampleCount = selectableSourceSamples.filter(product =>
    selectedSampleIds.has(product.sourceSampleId ?? product.id)
  ).length;

  // ── Sample handlers ───────────────────────────────────────────────────────────

  const handleAddSample = () =>
    setSamples(prev => {
      if (prev.length >= TRIANGLE_TEST_UNDERLYING_SAMPLE_COUNT) return prev;
      const id = `manual-${prev.length + 1}`;
      return [...prev, { id, code: generateBlindCode(`manual-sample:${id}`, prev.map(sample => sample.code)), label: '' }];
    });

  const handleRemoveSample = (index: number) => {
    if (samples.length <= 1) return;
    setSamples(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateSample = (index: number, field: 'code' | 'label', value: string) =>
    setSamples(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));

  const buildTrianglePresentationSamples = (candidateSamples: NonNullable<Product['samples']>, seed: string): NonNullable<Product['samples']> => {
    if (candidateSamples.length !== TRIANGLE_TEST_UNDERLYING_SAMPLE_COUNT) return candidateSamples;
    const duplicateIndex = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % TRIANGLE_TEST_UNDERLYING_SAMPLE_COUNT;
    const replicate = candidateSamples[duplicateIndex];
    return [
      ...candidateSamples,
      {
        ...replicate,
        id: `${replicate.id}-replicate`,
      },
    ];
  };

  const handleToggleSourceSample = (product: Product) => {
    const sampleId = product.sourceSampleId ?? product.id;
    setSamples(prev => {
      if (prev.some(sample => sample.id === sampleId)) {
        const next = prev.filter(sample => sample.id !== sampleId);
        return next.length > 0 ? next : [{ id: '1', code: generateBlindCode('manual-sample:1'), label: '' }];
      }
      if (prev.length >= TRIANGLE_TEST_UNDERLYING_SAMPLE_COUNT) return prev;
      const reusableBlankIndex = prev.findIndex(sample => !sample.label.trim());
      const nextSample = {
        id: sampleId,
        code: generateBlindCode(`source-sample:${product.sourceImportBatchId ?? 'project'}:${sampleId}`, prev.map(sample => sample.code)),
        label: product.name,
      };
      if (reusableBlankIndex >= 0) {
        return prev.map((sample, index) => index === reusableBlankIndex ? nextSample : sample);
      }
      return [...prev, nextSample];
    });
  };

  // ── Modal helpers ─────────────────────────────────────────────────────────────

  const openCreateModal = (initialType: 'single' | 'multi' = 'single') => {
    setShowCreateModal(true);
    setCreateStep('form');
    setPendingProduct(null);
    setNewProductName('');
    setNewProductCategory(scopedDefaultCategory);
    setProductType(initialType);
    setSamples([{ id: '1', code: generateBlindCode('manual-sample:1'), label: '' }]);
    setBlindedStudy(false);
    setCustomAttributes(getDefaultCataAttributes(scopedDefaultCategory));
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateStep('form');
    setPendingProduct(null);
    setNewProductName('');
    setNewProductCategory('');
    setProductType('single');
    setSamples([{ id: '1', code: generateBlindCode('manual-sample:1'), label: '' }]);
    setBlindedStudy(false);
    setCustomAttributes(getDefaultCataAttributes('generic'));
  };

  const handleCreateProduct = () => {
    if (!newProductName || !newProductCategory) return;
    const productId = `prod${Date.now()}`;
    let configuredSamples: Product['samples'];

    if (productType === 'multi') {
      const candidateSamples = samples
        .map((sample, index) => ({
          id: sample.id || String(index + 1),
          code: sample.code.trim(),
          label: sample.label.trim(),
        }))
        .filter(sample => sample.label);

      if (candidateSamples.length !== TRIANGLE_TEST_UNDERLYING_SAMPLE_COUNT) {
        alert('Triangle tests require exactly 2 selected samples. The third coded serving is generated as a duplicate.');
        return;
      }

      configuredSamples = withBlindSampleCodes(
        buildTrianglePresentationSamples(candidateSamples, `${productId}:${newProductName}`),
        `${productId}:${newProductName}`,
      );

      if (configuredSamples.some(sample => !isValidBlindCode(sample.code))) {
        alert('Each sample code must be a 3-digit number.');
        return;
      }

      const codes = configuredSamples.map(sample => sample.code);
      if (new Set(codes).size !== codes.length) {
        alert('Each sample must have a unique code.');
        return;
      }
    }

    const p: Product = {
      id: productId,
      name: newProductName,
      category: newProductCategory,
      createdDate: new Date().toISOString(),
      status: 'draft',
      customAttributes: getDefaultCataAttributes(newProductCategory),
      surveySections: [...DEFAULT_SURVEY_SECTIONS],
      isMultiSample: productType === 'multi',
      samples: configuredSamples,
      isCalibration: false,
      referenceScores: null,
      blinded: blindedStudy,
      blindCode: blindedStudy && productType !== 'multi'
        ? generateBlindCode(`${productId}:${newProductName}:${newProductCategory}`)
        : null,
      assignedPanelistIds: [],
      sourceImportBatchId: selectedBatchId ?? null,
      sourceSampleId: null,
    };
    setPendingProduct(p);
    setCustomAttributes(getDefaultCataAttributes(newProductCategory));
    setSurveySections([...DEFAULT_SURVEY_SECTIONS]);
    setCreateStep('review');
  };

  const finalizeProductCreation = async () => {
    if (!pendingProduct) return;
    setMutationError('');
    try {
      await insertProductMutation.mutateAsync({
        name: pendingProduct.name,
        category: pendingProduct.category,
        status: 'draft',
        customAttributes,
        surveySections,
        isMultiSample: pendingProduct.isMultiSample,
        samples: pendingProduct.samples,
        isCalibration: pendingProduct.isCalibration,
        referenceScores: pendingProduct.referenceScores,
        blinded: pendingProduct.blinded,
        blindCode: pendingProduct.blindCode,
        assignedPanelistIds: [],
        sourceImportBatchId: pendingProduct.sourceImportBatchId,
        sourceSampleId: pendingProduct.sourceSampleId,
      });
      closeCreateModal();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to create product. Please try again.');
    }
  };

  // ── Attribute handlers ────────────────────────────────────────────────────────

  const persistSelectedProductConfiguration = async (panelistIds: string[]) => {
    if (!selectedProduct) throw new Error('Select a study before saving.');
    await updateProductMutation.mutateAsync({ id: selectedProduct, updates: { customAttributes, surveySections } });
    await updateProductAssignmentsMutation.mutateAsync({
      productIds: [selectedProduct],
      assignedPanelistIds: panelistIds,
    });
    setDraftPanelistIds(panelistIds);
  };

  const handleSaveAttributes = async (panelistIds: string[]) => {
    setMutationError('');
    try {
      await persistSelectedProductConfiguration(panelistIds);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to save attributes.');
    }
  };

  const handleLaunchProduct = async (panelistIds: string[]) => {
    if (!selectedProduct || !selectedProductRecord) return;
    setMutationError('');
    try {
      await persistSelectedProductConfiguration(panelistIds);
      await updateProductMutation.mutateAsync({ id: selectedProduct, updates: { status: 'active' } });
      void notifyPanelistsOfSurveys(panelistIds, [selectedProductRecord.name]);
      setShowSuccess(true);
      setSelectedProduct(null);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to launch the study.');
    }
  };

  const handlePreviewProduct = async (panelistIds: string[]) => {
    if (!selectedProduct || !selectedProductRecord) return;
    setMutationError('');
    try {
      await persistSelectedProductConfiguration(panelistIds);
      const previewPath = selectedProductRecord.isMultiSample
        ? `/multi-sample-info/${selectedProduct}`
        : `/questionnaire-info/${selectedProduct}`;
      setSelectedProduct(null);
      navigate(previewPath);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to save the draft before preview.');
    }
  };

  const startImportedBatchConfiguration = async (batchId: string) => {
    const batch = importBatches.find(item => item.id === batchId);
    if (!batch) return;
    setMutationError('');
    try {
      const result = await createImportSurveysMutation.mutateAsync({
        batchId,
        surveySections: [...DEFAULT_SURVEY_SECTIONS],
        customAttributes: getDefaultCataAttributes(batch.foodTypeSlug),
      });
      if (result.surveyIds.length === 0) throw new Error('No sample surveys were created for this import.');
      setBatchSurveySetupId(batchId);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('batchSurveySetup', batchId);
      setSearchParams(nextParams, { replace: true });
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to prepare the imported surveys.');
    }
  };

  const handleToggleAttribute = (attr: string) =>
    setCustomAttributes(prev => prev.includes(attr) ? prev.filter(a => a !== attr) : [...prev, attr]);

  const handleAddCustomAttribute = () => {
    if (!newAttribute || customAttributes.includes(newAttribute)) return;
    setCustomAttributes(prev => [...prev, newAttribute]);
    setNewAttribute('');
  };

  const handleRemoveAttribute = (attr: string) =>
    setCustomAttributes(prev => prev.filter(a => a !== attr));

  const handleCloseProduct = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product || product.status !== 'active') return;
    setMutationError('');
    try {
      await updateProductMutation.mutateAsync({ id: productId, updates: { status: 'completed' } });
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const handleUpdateConceptStatus = async (conceptId: string, status: ConceptTest['status']) => {
    setMutationError('');
    try {
      await updateConceptStatusMutation.mutateAsync({ id: conceptId, status });
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to update concept study status.');
    }
  };

  const handleCloseConcept = async (conceptId: string) => {
    const concept = conceptStudies.find(test => test.id === conceptId);
    if (!concept || concept.status !== 'active') return;
    await handleUpdateConceptStatus(conceptId, 'completed');
  };

  const requestStudyDeletion = (deletion: PendingStudyDeletion) => {
    setDeleteStudyError('');
    setPendingStudyDeletion(deletion);
  };

  const handleDeleteStudy = async () => {
    if (!pendingStudyDeletion) return;
    setDeleteStudyError('');
    try {
      if (pendingStudyDeletion.kind === 'product') {
        await deleteProductMutation.mutateAsync(pendingStudyDeletion.id);
        if (selectedProduct === pendingStudyDeletion.id) setSelectedProduct(null);
      } else {
        await deleteConceptStudyMutation.mutateAsync(pendingStudyDeletion.id);
      }
      setPendingStudyDeletion(null);
    } catch (err) {
      setDeleteStudyError(err instanceof Error ? err.message : 'Failed to delete the study.');
    }
  };

  const handleUpdateImportBatchStatus = async (id: string, status: 'active' | 'archived' | 'deleted') => {
    setMutationError('');
    try {
      await updateImportBatchStatusMutation.mutateAsync({ id, status });
      if (status === 'deleted') setConfirmImportDeleteId(null);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : `Failed to ${status} import.`);
    }
  };

  const handleDeleteImportBatch = async (id: string) => {
    setMutationError('');
    try {
      await deleteImportBatchMutation.mutateAsync(id);
      setConfirmImportDeleteId(null);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to delete import.');
    }
  };

  const selectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    if (mode !== 'admin') return;
    const nextParams = new URLSearchParams(searchParams);
    if (tab === 'products') nextParams.delete('tab');
    else nextParams.set('tab', tab);
    setSearchParams(nextParams, { replace: true });
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const tabs: { id: AdminTab; label: string; icon: React.ElementType }[] = mode === 'admin' ? [
    { id: 'products',  label: 'Studies',  icon: ClipboardList },
    { id: 'panelists', label: 'Panelists', icon: Users },
    { id: 'imports',   label: 'Data & imports', icon: Upload },
  ] : isPanelistsMode ? [
    { id: 'panelists', label: 'Panelists', icon: Users },
  ] : [
    { id: 'products', label: isResponsesMode ? 'Responses' : 'Studies', icon: isResponsesMode ? Activity : ClipboardList },
  ];

  return (
    <div className="space-y-6">
      <WorkflowPageHeader
        title={isResponsesMode ? 'Responses' : isPanelistsMode ? 'Panelists' : 'Studies'}
        description={isResponsesMode
          ? 'Track fielding progress, response targets, and blockers before insights are used for decision review.'
          : isPanelistsMode
            ? 'Invite panelists and track required research, safety, consent, and delivery-profile completion before study assignment.'
          : 'Create, configure, launch, and review product sensory studies and triangle tests.'}
      />

      {secondaryNavigation}

      {tabs.length > 1 && (
        <div className="flex items-center border-b border-slate-200 gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => selectTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-slate-800 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
                }`}
              >
                <Icon className="size-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {showSuccess && (
        <Alert className="border-emerald-300 bg-emerald-50">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <AlertDescription className="text-emerald-700">Changes saved successfully!</AlertDescription>
        </Alert>
      )}
      {mutationError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{mutationError}</AlertDescription>
        </Alert>
      )}

      {/* ── Studies tab ── */}
      {activeTab === 'products' && <>

      {!isResponsesMode && <div className="grid gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => openCreateModal('single')}
          className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-left transition hover:border-blue-400 hover:bg-blue-100"
        >
          <div className="flex items-center gap-2 font-semibold text-blue-950"><ClipboardList className="size-4 text-blue-700" />Product Sensory Survey</div>
          <p className="mt-1 text-xs leading-5 text-blue-800">One sample, one sensory profile: CATA, intensity, liking, and emotional response.</p>
        </button>
        <button
          type="button"
          onClick={() => openCreateModal('multi')}
          className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-left transition hover:border-purple-400 hover:bg-purple-100"
        >
          <div className="flex items-center gap-2 font-semibold text-purple-950"><Layers className="size-4 text-purple-700" />Triangle Test</div>
          <p className="mt-1 text-xs leading-5 text-purple-800">Three coded samples with one odd-sample discrimination choice.</p>
        </button>
        <Link
          to="/concept-testing"
          className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-left transition hover:border-teal-400 hover:bg-teal-100"
        >
          <div className="flex items-center gap-2 font-semibold text-teal-950"><Lightbulb className="size-4 text-teal-700" />Concept Test</div>
          <p className="mt-1 text-xs leading-5 text-teal-800">Market-facing idea validation: claims, imagery, pricing, and purchase intent.</p>
        </Link>
      </div>}

      {!isResponsesMode && batchesAwaitingSurveySetup.length > 0 && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4" aria-labelledby="imports-awaiting-surveys-heading">
          <div className="flex items-start gap-3">
            <ClipboardList className="mt-0.5 size-5 shrink-0 text-blue-700" />
            <div className="min-w-0 flex-1">
              <h2 id="imports-awaiting-surveys-heading" className="text-sm font-bold text-blue-950">Imported samples awaiting survey setup</h2>
              <p className="mt-1 text-sm text-blue-800">Choose sections and recipients before these questionnaires become visible to panelists.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {batchesAwaitingSurveySetup.map(batch => (
                  <Button key={batch.id} type="button" size="sm" variant="outline" onClick={() => void startImportedBatchConfiguration(batch.id)} disabled={createImportSurveysMutation.isPending} className="border-blue-300 bg-white text-blue-900 hover:bg-blue-100">
                    Configure {batch.projectName ?? batch.fileName.replace(/\.csv$/i, '')}
                    <ArrowRight className="size-3.5" />
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {isResponsesMode && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 font-semibold text-slate-900"><Activity className="size-4 text-slate-500" />Response target</div>
            <p className="mt-1 text-xs leading-5 text-slate-700">Use this stage to confirm each active study has enough panelist evidence before opening Insights.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 font-semibold text-slate-900"><Users className="size-4 text-slate-500" />Panelist coverage</div>
            <p className="mt-1 text-xs leading-5 text-slate-700">Assignment labels and response counts below show which studies still need fielding attention.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 font-semibold text-slate-900"><ArrowRight className="size-4 text-slate-500" />Next handoff</div>
            <p className="mt-1 text-xs leading-5 text-slate-700">When response targets are met, continue to Insights for evidence interpretation.</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-5 px-5 py-3 bg-white border border-slate-200 rounded-lg flex-wrap">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${activeStudyCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
          <span className="text-sm font-bold text-slate-900">{activeStudyCount}</span>
          <span className="text-sm text-slate-500">active studies</span>
        </div>
        <div className="w-px h-4 bg-slate-200" />
        <div className="flex items-center gap-2">
          <Users className="size-3.5 text-slate-500" />
          <span className="text-sm font-bold text-slate-900">{activePanelists.length}</span>
          <span className="text-sm text-slate-500">active panelists</span>
        </div>
        <div className="w-px h-4 bg-slate-200" />
        <div className="flex items-center gap-2">
          <Activity className="size-3.5 text-slate-500" />
          <span className="text-sm font-bold text-slate-900">{totalStudyResponses}</span>
          <span className="text-sm text-slate-500">total responses</span>
        </div>
        <div className="w-px h-4 bg-slate-200" />
        <span className="text-sm text-slate-500">{closedStudyCount} closed · {blockerCount} launch blocker{blockerCount !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 bg-slate-50/60 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs bg-white">
              {(['all', 'draft', 'active', 'closed', 'archived'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 font-semibold capitalize transition-colors border-r border-slate-200 last:border-r-0 ${
                    filterStatus === s ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {s === 'all' ? `All (${studyCounts.all})` : `${s} (${studyCounts[s]})`}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs bg-white">
              {(['all', 'product_sensory', 'multi_sample', 'concept_test'] as const).map(type => {
                const label = type === 'all' ? 'All types' : getStudyTypeMeta(type).shortLabel;
                return (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 font-semibold transition-colors border-r border-slate-200 last:border-r-0 ${
                    filterType === type
                      ? type === 'product_sensory' ? 'bg-blue-700 text-white' : type === 'multi_sample' ? 'bg-purple-700 text-white' : type === 'concept_test' ? 'bg-teal-700 text-white' : 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
                );
              })}
            </div>
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Search studies…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm w-56"
              />
            </div>
          </div>
          {!isResponsesMode && <Button onClick={() => openCreateModal('single')} className="bg-slate-900 hover:bg-slate-800 h-8 text-sm">
            <Plus className="size-3.5 mr-1.5" />New Study
          </Button>}
        </div>

        <div className="p-4">
          {filteredStudies.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
              <ClipboardList className="size-10 mb-3 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">
                {scopedStudySummaries.length === 0 ? `No ${currentFoodTypeLabel.toLowerCase()} studies yet` : 'No studies match the current filters'}
              </p>
              <p className="mt-1 max-w-md text-xs text-slate-500">
                {isResponsesMode
                  ? 'Create and launch a study before response collection can begin.'
                  : 'Start with a product sensory study, a triangle test, or a concept test. Each template stays structured for scoring and reporting.'}
              </p>
              {!isResponsesMode && <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => openCreateModal('single')}><Plus className="size-3.5 mr-1" />Product sensory</Button>
                <Button size="sm" variant="outline" onClick={() => openCreateModal('multi')}><Layers className="size-3.5 mr-1" />Triangle test</Button>
                <Button size="sm" variant="outline" asChild><Link to="/concept-testing"><Lightbulb className="size-3.5 mr-1" />Concept test</Link></Button>
              </div>}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {filteredStudies.map(study => {
                const meta = getStudyTypeMeta(study.type);
                const Icon = meta.icon;
                const product = productById.get(study.id);
                const isProductStudy = study.type !== 'concept_test' && product;
                const concept = study.type === 'concept_test'
                  ? conceptStudies.find(test => test.id === study.id)
                  : null;
                const blockerPreview = study.blockers.slice(0, 3);
                return (
                  <div key={`${study.type}-${study.id}`} className={`relative overflow-hidden rounded-lg border bg-white p-4 pl-5 transition ${meta.cardClassName}`}>
                    <div className={`absolute bottom-0 left-0 top-0 w-1 ${meta.railClassName}`} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={`text-[11px] ${meta.className}`}><Icon className="mr-1 size-3" />{meta.label}</Badge>
                          <Badge variant="outline" className={`text-[11px] capitalize ${studyStatusStyles[study.status]}`}>{study.status}</Badge>
                          {product?.blinded && <Badge variant="outline" className="border-slate-400 bg-white text-[11px] text-slate-700">Blinded</Badge>}
                        </div>
                        <h2 className="truncate text-base font-bold text-slate-900">{study.name}</h2>
                        <p className="mt-1 text-xs text-slate-700">{meta.description}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>{study.linkedLabel}</span>
                          <span>{study.assignmentLabel}</span>
                          {study.sourceImportBatchName && <span className="truncate">Source: {study.sourceImportBatchName.replace(/\.csv$/i, '')}</span>}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8 shrink-0 text-slate-500 hover:text-slate-900"
                            aria-label={`More actions for ${study.name}`}
                          >
                            <MoreHorizontal className="size-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => requestStudyDeletion({
                              id: study.id,
                              name: study.name,
                              kind: isProductStudy ? 'product' : 'concept',
                            })}
                          >
                            <Trash2 className="size-4" aria-hidden />
                            Delete study
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-slate-700">Panel completion</span>
                        <span className="text-xs font-semibold text-slate-500">{study.responseProgressLabel}</span>
                      </div>
                      <Progress value={study.completionPercent} className="h-1.5 bg-slate-50" />
                    </div>

                    {blockerPreview.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {blockerPreview.map(blocker => (
                          <span key={blocker.id} className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            blocker.severity === 'blocker'
                              ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                              : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                          }`}>
                            {blocker.label}
                          </span>
                        ))}
                        {study.blockers.length > blockerPreview.length && (
                          <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">+{study.blockers.length - blockerPreview.length} more</span>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" asChild className="h-8 text-xs">
                        <Link to={study.previewPath}><Eye className="mr-1 size-3.5" />Preview as panelist</Link>
                      </Button>
                      {isProductStudy && product.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateProductMutation.isPending}
                          onClick={() => handleCloseProduct(product.id)}
                          className="h-8 text-xs"
                        >
                          Close study
                        </Button>
                      )}
                      {concept?.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateConceptStatusMutation.isPending}
                          onClick={() => handleCloseConcept(concept.id)}
                          className="h-8 text-xs"
                        >
                          Close study
                        </Button>
                      )}
                      {isProductStudy ? (
                        <Button size="sm" onClick={() => setSelectedProduct(product.id)} className="h-8 bg-slate-900 text-xs hover:bg-slate-800">
                          <Edit2 className="mr-1 size-3.5" />Edit
                        </Button>
                      ) : (
                        <Button size="sm" asChild className={`h-8 text-xs ${meta.actionClassName}`}>
                          <Link to="/concept-testing"><Edit2 className="mr-1 size-3.5" />Edit</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AlertDialog
        open={pendingStudyDeletion !== null}
        onOpenChange={open => {
          if (!open && !deletingStudy) {
            setPendingStudyDeletion(null);
            setDeleteStudyError('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingStudyDeletion?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the study and its collected responses. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteStudyError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {deleteStudyError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingStudy}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={deletingStudy}
              onClick={() => void handleDeleteStudy()}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              <Trash2 className="size-4" aria-hidden />
              {deletingStudy ? 'Deleting…' : 'Delete study'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SurveyConfigurationSheet
        product={selectedProductRecord}
        shipOutProjectId={selectedProjectId}
        panelists={activePanelists}
        standardAttributes={selectedProductStdAttrs}
        customAttributes={customAttributes}
        surveySections={surveySections}
        assignedPanelistIds={draftPanelistIds}
        newAttribute={newAttribute}
        onOpenChange={open => {
          if (!open) {
            setSelectedProduct(null);
            if (searchParams.has('survey')) {
              const nextParams = new URLSearchParams(searchParams);
              nextParams.delete('survey');
              setSearchParams(nextParams, { replace: true });
            }
          }
        }}
        onNewAttributeChange={setNewAttribute}
        onAddAttribute={handleAddCustomAttribute}
        onRemoveAttribute={handleRemoveAttribute}
        onToggleAttribute={handleToggleAttribute}
        onResetAttributes={() => setCustomAttributes(selectedProductStdAttrs)}
        onClearAttributes={() => setCustomAttributes([])}
        onToggleSection={section => setSurveySections(current => toggleSurveySection(current, section))}
        onSaveAttributes={panelistIds => void handleSaveAttributes(panelistIds)}
        onPreview={panelistIds => void handlePreviewProduct(panelistIds)}
        onLaunch={panelistIds => void handleLaunchProduct(panelistIds)}
        onSetPanelists={setDraftPanelistIds}
        saving={updateProductMutation.isPending || updateProductAssignmentsMutation.isPending}
      />

      {batchSurveySetup && batchSurveyProducts.length > 0 && (
        <ImportedSurveyBatchConfiguration
          batchName={batchSurveySetup.projectName ?? batchSurveySetup.fileName.replace(/\.csv$/i, '')}
          products={batchSurveyProducts}
          onClose={() => {
            setBatchSurveySetupId(null);
            if (searchParams.has('batchSurveySetup')) {
              const nextParams = new URLSearchParams(searchParams);
              nextParams.delete('batchSurveySetup');
              setSearchParams(nextParams, { replace: true });
            }
          }}
          onAssigned={() => {
            setBatchSurveySetupId(null);
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('batchSurveySetup');
            setSearchParams(nextParams, { replace: true });
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
          }}
        />
      )}

      </> /* end products tab */}

      {/* ── Panelists tab ── */}
      {activeTab === 'panelists' && <>

      <PanelistInviteForm />

      {panelists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <Users className="size-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No panelists registered yet.</p>
          </CardContent>
        </Card>
      ) : (
        <PanelistDirectory panelists={panelists} />
      )}

      <PanelistPerformancePanel />

      </> /* end panelists tab */}


      {/* ── Imports tab ── */}
      {activeTab === 'imports' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="size-4 text-slate-500" />
              Import history and data hygiene
            </CardTitle>
            <p className="text-sm text-slate-500">Review CSV instrument imports, restore archived data, and perform deliberate cleanup with an audit trail.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {recoverableImportCount > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Recovery available</p>
                  <p className="text-xs text-slate-700">
                    {recoverableImportCount} archived or deleted project{recoverableImportCount === 1 ? '' : 's'} can be restored below.
                  </p>
                </div>
                <RotateCcw className="size-5 shrink-0 text-slate-500" />
              </div>
            )}
            {importBatches.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <Database className="size-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No imports yet. Upload a CSV in Machine Testing to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200 bg-slate-50 text-left">
                      <th className="py-2.5 px-3 font-semibold text-slate-700">File</th>
                      <th className="py-2.5 px-3 font-semibold text-slate-700">Food Type</th>
                      <th className="py-2.5 px-3 font-semibold text-slate-700">Rows</th>
                      <th className="py-2.5 px-3 font-semibold text-slate-700">Imported by</th>
                      <th className="py-2.5 px-3 font-semibold text-slate-700">Date</th>
                      <th className="py-2.5 px-3 font-semibold text-slate-700">Status</th>
                      <th className="py-2.5 px-3 font-semibold text-slate-700 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importBatches.map(batch => (
                      <tr key={batch.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-slate-700 max-w-[200px] truncate">{batch.fileName}</td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="text-xs">{batch.foodTypeLabel}</Badge>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{batch.rowCount}</td>
                        <td className="py-2.5 px-3 text-slate-700">{batch.importedByName ?? '—'}</td>
                        <td className="py-2.5 px-3 text-slate-500 text-xs">
                          {new Date(batch.createdAt).toLocaleDateString()} {new Date(batch.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge className={batch.status === 'active' ? 'bg-emerald-600 text-xs' : 'bg-slate-400 text-xs'}>
                            {batch.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex justify-end gap-1.5">
                            {batch.status !== 'active' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-emerald-300 text-emerald-700"
                                disabled={updateImportBatchStatusMutation.isPending}
                                onClick={() => handleUpdateImportBatchStatus(batch.id, 'active')}
                              >
                                <RotateCcw className="size-3 mr-1" />Restore
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                disabled={updateImportBatchStatusMutation.isPending}
                                onClick={() => handleUpdateImportBatchStatus(batch.id, 'archived')}
                              >
                                <Archive className="size-3 mr-1" />Archive
                              </Button>
                            )}
                            {confirmImportDeleteId === batch.id ? (
                              <>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-rose-600 hover:bg-rose-700"
                                  disabled={deleteImportBatchMutation.isPending}
                                  onClick={() => handleDeleteImportBatch(batch.id)}
                                >
                                  Confirm
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmImportDeleteId(null)}>
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-rose-300 text-rose-600 hover:bg-rose-50"
                                disabled={batch.status === 'deleted'}
                                onClick={() => setConfirmImportDeleteId(batch.id)}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Product Modal */}
      <Dialog open={showCreateModal} onOpenChange={open => !open && closeCreateModal()}>
        <DialogContent className="h-[min(90vh,820px)] w-[calc(100vw-2rem)] max-w-6xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-center justify-between gap-4 pr-8">
              <DialogTitle className="flex items-center gap-2">
                {createStep === 'form' && <><Plus className="size-5 text-slate-700" />New Study</>}
                {createStep === 'review' && <><CheckCircle2 className="size-5 text-slate-700" />Step 1: Review Details</>}
                {createStep === 'configure' && <><Settings className="size-5 text-slate-700" />Step 2: Configure Questionnaire</>}
              </DialogTitle>
              {createStep !== 'form' && (
                <Badge variant="outline" className="border-slate-200 text-slate-700">{createStep === 'review' ? '1 of 2' : '2 of 2'}</Badge>
              )}
            </div>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto">

            {/* FORM STEP */}
            {createStep === 'form' && (
              <div className="flex min-h-full flex-col">
                <div className="flex-1 space-y-5 p-6">
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
                    <section className="space-y-4">
                      <div>
                        <Label className="text-base font-bold text-slate-900">Study Type</Label>
                        <p className="mt-1 text-sm text-slate-500">Choose how panelists will evaluate this study.</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                        {([
                          { type: 'single' as const, icon: ClipboardList, label: 'Single Sample', desc: 'Full evaluation: CATA, intensity, hedonic, and emotional response' },
                          { type: 'multi' as const, icon: Layers, label: 'Triangle Test', desc: 'Select two samples; panelists receive three coded servings and identify the odd one out' },
                        ]).map(({ type, icon: Icon, label, desc }) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setProductType(type)}
                            className={`flex min-h-40 flex-col justify-between rounded-lg border-2 p-4 text-left transition-all ${
                              productType === type
                                ? 'border-slate-900 bg-slate-50'
                                : 'border-slate-200 bg-white hover:border-slate-400'
                            }`}
                          >
                            <span className="space-y-3">
                              <span className={`flex size-11 items-center justify-center rounded-lg ${productType === type ? 'bg-slate-900' : 'bg-slate-50'}`}>
                                <Icon className={`size-5 ${productType === type ? 'text-white' : 'text-slate-500'}`} />
                              </span>
                              <span className="block">
                                <span className="block text-sm font-bold text-slate-900">{label}</span>
                                <span className="mt-1 block text-xs leading-5 text-slate-700">{desc}</span>
                              </span>
                            </span>
                            <span className={`mt-4 flex min-h-5 items-center gap-1 text-xs font-medium ${productType === type ? 'text-slate-700' : 'text-transparent'}`}>
                              <CheckCircle2 className="size-3" />Selected
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-5">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Study Details</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Name the study and choose what panelists can see.</p>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="productName">Study Name</Label>
                          <Input id="productName" placeholder={productType === 'single' ? 'e.g., Coconut Cheddar v3.0' : 'e.g., Coconut Cheddar Triangle Test'} value={newProductName} onChange={e => setNewProductName(e.target.value)} className="bg-white" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="productCategory">Category</Label>
                          <Input id="productCategory" placeholder={productType === 'single' ? 'e.g., Coconut-based' : 'e.g., Triangle test'} value={newProductCategory} onChange={e => setNewProductCategory(e.target.value)} className="bg-white" />
                        </div>
                      </div>

                      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
                        <Checkbox
                          id="blindedStudy"
                          checked={blindedStudy}
                          onCheckedChange={v => setBlindedStudy(!!v)}
                        />
                        <div>
                          <Label htmlFor="blindedStudy" className="cursor-pointer font-semibold text-slate-700">Blinded study</Label>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Panelists will see sample codes only — product name and category will not be disclosed during evaluation.
                          </p>
                        </div>
                      </div>
                    </section>
                  </div>

                  {productType === 'multi' && (
                    <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <Label className="text-sm font-bold text-slate-900">Triangle Test Samples</Label>
                          <p className="mt-1 text-xs leading-5 text-slate-700">
                            Select exactly two underlying samples. The third coded serving is generated as a duplicate.
                          </p>
                        </div>
                        <Button size="sm" onClick={handleAddSample} variant="outline" disabled={samples.length >= TRIANGLE_TEST_UNDERLYING_SAMPLE_COUNT}><Plus className="size-4 mr-1" />Add Sample</Button>
                      </div>
                      {selectableSourceSamples.length > 0 && (
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold text-slate-700">Imported samples</p>
                            <span className="text-[11px] font-medium text-slate-500">{selectedImportedSampleCount}/{TRIANGLE_TEST_UNDERLYING_SAMPLE_COUNT} selected</span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {selectableSourceSamples.map(product => {
                              const sampleId = product.sourceSampleId ?? product.id;
                              const selectedSample = samples.find(sample => sample.id === sampleId);
                              const selectionDisabled = !selectedSample && samples.length >= TRIANGLE_TEST_UNDERLYING_SAMPLE_COUNT;
                              return (
                                <button
                                  key={product.id}
                                  type="button"
                                  onClick={() => handleToggleSourceSample(product)}
                                  disabled={selectionDisabled}
                                  className={`flex min-h-14 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                                    selectedSample
                                      ? 'border-slate-900 bg-slate-50'
                                      : selectionDisabled
                                        ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                                      : 'border-slate-200 bg-white hover:border-slate-400'
                                  }`}
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold text-slate-900">{product.name}</span>
                                    <span className="mt-0.5 block truncate text-xs text-slate-500">{sampleId}</span>
                                  </span>
                                  <span className="flex shrink-0 items-center gap-2">
                                    {selectedSample && (
                                      <span className="rounded bg-slate-900 px-2 py-1 font-mono text-xs font-bold text-white">{selectedSample.code}</span>
                                    )}
                                    <span
                                      aria-hidden
                                      className={`flex size-4 items-center justify-center rounded border ${
                                        selectedSample ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-white'
                                      }`}
                                    >
                                      {selectedSample && <CheckCircle2 className="size-3 text-white" />}
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="space-y-2">
                        {samples.map((sample, index) => (
                          <div key={index} className="grid gap-2 rounded border border-slate-200 bg-white p-3 sm:grid-cols-[32px_128px_minmax(0,1fr)_auto] sm:items-center">
                            <div className="flex size-8 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">{index + 1}</div>
                            <Input placeholder="3-digit code" value={sample.code} onChange={e => handleUpdateSample(index, 'code', e.target.value.replace(/\D/g, '').slice(0, 3))} maxLength={3} />
                            <Input placeholder="Sample label" value={sample.label} onChange={e => handleUpdateSample(index, 'label', e.target.value)} />
                            {samples.length > 1 && (
                              <Button size="sm" variant="ghost" onClick={() => handleRemoveSample(index)} className="text-rose-600 hover:text-rose-700"><Trash2 className="size-4" /></Button>
                            )}
                          </div>
                        ))}
                      </div>
                      {configuredSampleCount === TRIANGLE_TEST_UNDERLYING_SAMPLE_COUNT && (
                        <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 sm:grid-cols-3">
                          <p><strong>2 underlying samples</strong> selected</p>
                          <p>3 coded servings generated</p>
                          <p>Odd-sample triangle choice</p>
                        </div>
                      )}
                    </section>
                  )}
                </div>

                <div className="sticky bottom-0 flex flex-col gap-3 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={closeCreateModal} className="sm:w-40">Cancel</Button>
                  <Button
                    onClick={handleCreateProduct}
                    className="sm:w-64 bg-slate-900 hover:bg-slate-800"
                    disabled={!canReviewStudy}
                  >
                    {productType === 'multi' ? <Layers className="size-4 mr-2" /> : <Plus className="size-4 mr-2" />}
                    Review & Configure
                  </Button>
                </div>
              </div>
            )}

            {/* REVIEW STEP */}
            {createStep === 'review' && pendingProduct && (
              <>
                <div className="space-y-4 p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-sm text-slate-700 mb-1">Study Name</div>
                      <div className="font-bold text-slate-900 text-lg flex items-center gap-2 flex-wrap">
                        {pendingProduct.name}
                        {pendingProduct.isMultiSample && <Badge variant="outline" className="border-slate-200 text-slate-700"><Layers className="size-3 mr-1" />Triangle Test</Badge>}
                        {pendingProduct.blinded && <Badge variant="outline" className="border-slate-200 text-slate-700">Blinded</Badge>}
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-sm text-slate-700 mb-1">Category</div>
                      <div className="font-bold text-slate-900 text-lg">{pendingProduct.category}</div>
                    </div>
                  </div>
                  {pendingProduct.blinded && !pendingProduct.isMultiSample && pendingProduct.blindCode && (
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-sm text-slate-500 mb-1">Panelist-facing sample code</div>
                      <div className="text-2xl font-bold tracking-wider text-slate-900">{pendingProduct.blindCode}</div>
                    </div>
                  )}
                  {pendingProduct.isMultiSample && pendingProduct.samples && (
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-sm font-bold text-slate-900 mb-3">Coded servings ({pendingProduct.samples.length})</div>
                      <div className="space-y-2">
                        {pendingProduct.samples.map((sample, idx) => (
                          <div key={sample.id} className="flex items-center gap-3 p-3 bg-white rounded border border-slate-200">
                            <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm">{idx + 1}</div>
                            <div><div className="font-bold text-slate-900">Code: {sample.code}</div><div className="text-sm text-slate-700">{sample.label}</div></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-sm font-semibold text-slate-700 mb-3">What happens next</div>
                    <ul className="text-sm text-slate-700 space-y-2">
                      <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-emerald-600 flex-shrink-0 mt-0.5" />Study created through the existing product questionnaire flow and set active</li>
                      <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-emerald-600 flex-shrink-0 mt-0.5" />Configure which attributes panelists will evaluate</li>
                      <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-emerald-600 flex-shrink-0 mt-0.5" />{pendingProduct.isMultiSample ? 'Panelists evaluate three coded servings and identify the odd sample' : 'Panelists see this product in their questionnaire'}</li>
                    </ul>
                  </div>
                </div>
                <div className="flex gap-3 border-t border-slate-200 px-6 pb-6 pt-4">
                  <Button variant="outline" onClick={() => setCreateStep('form')} className="flex-1">Back</Button>
                  <Button onClick={() => setCreateStep('configure')} className="flex-1 bg-slate-900 hover:bg-slate-800">
                    Next: Configure Questionnaire<Settings className="size-4 ml-2" />
                  </Button>
                </div>
              </>
            )}

            {/* CONFIGURE STEP */}
            {createStep === 'configure' && pendingProduct && (
              <>
                <div className="space-y-5 p-6">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Configuring:</div>
                    <div className="font-bold text-slate-900 text-lg flex items-center gap-2 flex-wrap">
                      {pendingProduct.name}
                      {pendingProduct.isMultiSample && <Badge variant="outline" className="border-slate-200 text-slate-700"><Layers className="size-3 mr-1" />Triangle Test</Badge>}
                    </div>
                    {pendingProduct.isMultiSample && (
                      <div className="text-xs text-slate-500 mt-1">All {pendingProduct.samples?.length} coded servings use the same questionnaire attributes</div>
                    )}
                  </div>

                  <div className="p-4 bg-white rounded-lg border border-slate-200">
                    <Label htmlFor="newAttrModal" className="text-sm font-bold text-slate-900 mb-2 block">Add Product-Specific Attribute</Label>
                    <p className="text-xs text-slate-700 mb-3">Custom attributes relevant to this product (e.g., "Smoky" for smoked varieties)</p>
                    <div className="flex gap-2">
                      <Input id="newAttrModal" placeholder="e.g., Smoky, Herbal, Peppery" value={newAttribute} onChange={e => setNewAttribute(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCustomAttribute()} />
                      <Button onClick={handleAddCustomAttribute} className="bg-slate-900 hover:bg-slate-800"><Plus className="size-4 mr-1" />Add</Button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-base font-bold text-slate-900">Select Attributes ({customAttributes.length} selected)</Label>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setCustomAttributes(modalStdAttrs)}>Reset</Button>
                        <Button size="sm" variant="outline" onClick={() => setCustomAttributes([])}>Clear</Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 max-h-72 overflow-y-auto p-4 bg-slate-50 rounded-lg border border-slate-200">
                      {modalStdAttrs.map(attr => (
                        <div key={attr} className="flex items-center space-x-2 p-2 bg-white rounded border border-slate-200">
                          <Checkbox id={`attr-modal-${attr}`} checked={customAttributes.includes(attr)} onCheckedChange={() => handleToggleAttribute(attr)} />
                          <Label htmlFor={`attr-modal-${attr}`} className="text-sm cursor-pointer flex-1">{attr}</Label>
                        </div>
                      ))}
                      {customAttributes.filter(attr => !modalStdAttrs.includes(attr)).map(attr => (
                        <div key={attr} className="flex items-center space-x-2 p-2 bg-slate-50 rounded border border-slate-200">
                          <Checkbox id={`attr-modal-${attr}`} checked disabled />
                          <Label htmlFor={`attr-modal-${attr}`} className="text-sm flex-1 font-medium text-slate-900">{attr}</Label>
                          <button onClick={() => handleRemoveAttribute(attr)} className="text-rose-600 hover:text-rose-700"><Trash2 className="size-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="size-5 text-emerald-700 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-slate-700">
                        <strong>Ready to save:</strong> The study will remain private as a draft with {customAttributes.length} attributes. Open it next to verify the exact sample declaration, choose eligible panelists, preview, and launch.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 border-t border-slate-200 px-6 pb-6 pt-4">
                  <Button variant="outline" onClick={closeCreateModal} className="flex-1">Cancel</Button>
                  <Button
                    onClick={finalizeProductCreation}
                    disabled={insertProductMutation.isPending}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-60"
                  >
                    <Save className="size-5 mr-2" />
                    {insertProductMutation.isPending ? 'Creating draft…' : 'Create draft study'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
