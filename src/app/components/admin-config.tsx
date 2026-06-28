import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { type Product, getDefaultCataAttributes } from '../data/survey-domain';
import { useFoodType, matchFoodType } from '../contexts/food-type-context';
import { parseBatchSelection } from '../lib/project-identity';
import {
  useProducts, usePanelists,
  useInsertProduct, useUpdateProduct, useDeleteProduct,
  useUpdatePanelistId, useAllResponses, useImportBatches,
  useUpdateImportBatchStatus, useDeleteImportBatch,
  useStudyConceptTests, useConceptResponseCounts,
  useUpdateConceptTestStatus,
} from '../lib/hooks';
import type { ConceptTest } from '../lib/database';
import {
  Plus, Settings, Trash2, Save, CheckCircle2, Layers,
  ClipboardList, Users, AlertCircle, Search, Activity, FlaskConical, Archive, RotateCcw,
  Upload, Database, Eye, ArrowRight, Lightbulb, PlayCircle, Edit2,
} from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { PanelistPerformancePanel } from './panelist-performance';
import { formatFoodTypeLabel } from '../lib/food-intelligence';
import { notifyPanelistsOfSurveys } from '../lib/database';
import { filterAssignablePanelists } from '../lib/assignments';
import { SurveyConfigurationSheet } from './survey-configuration-sheet';
import { buildStudySummaries, type StudyLifecycleStatus, type StudyType } from '../lib/studies';
import { generateBlindCode, isValidBlindCode, withBlindSampleCodes } from '../lib/blind-study';

type AdminTab = 'products' | 'panelists' | 'imports';
type StudyStatusFilter = 'all' | StudyLifecycleStatus;
type StudyTypeFilter = 'all' | StudyType;

const studyStatusStyles: Record<StudyLifecycleStatus, string> = {
  draft: 'bg-white text-slate-600 border-slate-300',
  active: 'bg-white text-emerald-700 border-emerald-300',
  closed: 'bg-white text-slate-700 border-slate-300',
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
  if (type === 'multi_sample') {
    return {
      label: 'Multi-Sample Comparison',
      shortLabel: 'Multi',
      description: 'Compares coded samples with ranking, difference consensus, and preference drivers.',
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
    description: 'Evaluates one product sample with CATA, intensity, liking, and emotional response.',
    className: 'border-blue-300 bg-blue-50 text-blue-800',
    iconClassName: 'bg-blue-600 text-white',
    cardClassName: 'border-blue-200 hover:border-blue-400',
    railClassName: 'bg-blue-500',
    actionClassName: 'bg-blue-700 hover:bg-blue-800',
    icon: ClipboardList,
  };
}

export function AdminConfig({ mode = 'studies' }: { mode?: 'studies' | 'responses' | 'admin' }) {
  const isResponsesMode = mode === 'responses';
  const [activeTab, setActiveTab] = useState<AdminTab>('products');
  const { data: products = [] } = useProducts();
  const { data: panelists = [] } = usePanelists();
  const { data: allResponses = [] } = useAllResponses();
  const { data: importBatches = [] } = useImportBatches(activeTab === 'products' || activeTab === 'imports');
  const { data: conceptStudies = [] } = useStudyConceptTests();
  const { data: conceptResponseCounts = {} } = useConceptResponseCounts();

  const insertProductMutation = useInsertProduct();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();
  const updatePanelistIdMutation = useUpdatePanelistId();
  const updateImportBatchStatusMutation = useUpdateImportBatchStatus();
  const deleteImportBatchMutation = useDeleteImportBatch();
  const updateConceptStatusMutation = useUpdateConceptTestStatus();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmImportDeleteId, setConfirmImportDeleteId] = useState<string | null>(null);

  const [editingPanelistId, setEditingPanelistId] = useState<string | null>(null);
  const [panelistIdInput, setPanelistIdInput] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [customAttributes, setCustomAttributes] = useState<string[]>([]);
  const [newAttribute, setNewAttribute] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [mutationError, setMutationError] = useState('');

  const { foodType, subCategory } = useFoodType();
  const currentFoodTypeLabel = formatFoodTypeLabel(foodType);
  const selectedBatchId = parseBatchSelection(subCategory);

  // List filters
  const [filterStatus, setFilterStatus] = useState<StudyStatusFilter>('all');
  const [filterType, setFilterType] = useState<StudyTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<'form' | 'review' | 'configure'>('form');
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [productType, setProductType] = useState<'single' | 'multi' | 'calibration'>('single');
  const [referenceScores, setReferenceScores] = useState({ overall: 5, appearance: 5, aroma: 5, flavor: 5, texture: 5 });
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [blindedStudy, setBlindedStudy] = useState(false);
  const [samples, setSamples] = useState<{ id: string; code: string; label: string }[]>([
    { id: '1', code: '', label: '' },
  ]);

  useEffect(() => {
    if (selectedProduct) {
      const product = products.find(p => p.id === selectedProduct);
      setCustomAttributes(product?.customAttributes || getDefaultCataAttributes(product?.category ?? ''));
    }
  }, [selectedProduct, products]);

  useEffect(() => {
    if (!selectedProduct) return;
    const product = products.find(p => p.id === selectedProduct);
    if (product && matchFoodType(product.category) !== foodType) setSelectedProduct(null);
  }, [foodType, products, selectedProduct]);

  // ── Computed stats ────────────────────────────────────────────────────────────

  // Category-aware attribute sets for the sidebar editor and create modal
  const selectedProductCategory = products.find(p => p.id === selectedProduct)?.category ?? '';
  const selectedProductRecord = products.find(p => p.id === selectedProduct) ?? null;
  const selectedProductStdAttrs = getDefaultCataAttributes(selectedProductCategory);
  const modalStdAttrs = getDefaultCataAttributes(newProductCategory);
  const activePanelists = filterAssignablePanelists(panelists);
  const configuredSampleCount = blindedStudy
    ? samples.filter(sample => sample.label.trim()).length
    : samples.filter(sample => sample.code.trim() && sample.label.trim()).length;

  const allStudySummaries = useMemo(() => buildStudySummaries({
    products,
    concepts: conceptStudies,
    responses: allResponses,
    conceptResponseCounts,
    importBatches,
  }), [allResponses, conceptResponseCounts, conceptStudies, importBatches, products]);
  const scopedConceptStudyIds = useMemo(() => new Set(
    conceptStudies
      .filter(concept => {
        if (concept.foodTypeSlug && concept.foodTypeSlug !== foodType) return false;
        if (subCategory && parseBatchSelection(subCategory) === null && concept.category !== subCategory) return false;
        return true;
      })
      .map(concept => concept.id)
  ), [conceptStudies, foodType, subCategory]);
  const scopedStudySummaries = allStudySummaries.filter(study => {
    if (study.type === 'concept_test') return scopedConceptStudyIds.has(study.id);
    const product = products.find(p => p.id === study.id);
    if (!product || matchFoodType(product.category) !== foodType) return false;
    if (selectedBatchId) return product.sourceImportBatchId === selectedBatchId;
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
  const totalStudyResponses = scopedStudySummaries.reduce((sum, study) => sum + study.responseCount, 0);
  const productById = new Map(products.map(product => [product.id, product]));
  const recoverableImportCount = importBatches.filter(batch => batch.status !== 'active').length;

  // ── Sample handlers ───────────────────────────────────────────────────────────

  const handleAddSample = () =>
    setSamples(prev => prev.length >= 8 ? prev : [...prev, { id: String(prev.length + 1), code: '', label: '' }]);

  const handleRemoveSample = (index: number) => {
    if (samples.length <= 1) return;
    setSamples(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateSample = (index: number, field: 'code' | 'label', value: string) =>
    setSamples(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));

  // ── Modal helpers ─────────────────────────────────────────────────────────────

  const openCreateModal = (initialType: 'single' | 'multi' | 'calibration' = 'single') => {
    setShowCreateModal(true);
    setCreateStep('form');
    setPendingProduct(null);
    setNewProductName('');
    setNewProductCategory(currentFoodTypeLabel);
    setProductType(initialType);
    setSamples([{ id: '1', code: '', label: '' }]);
    setBlindedStudy(false);
    setCustomAttributes(getDefaultCataAttributes(currentFoodTypeLabel));
    setReferenceScores({ overall: 5, appearance: 5, aroma: 5, flavor: 5, texture: 5 });
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateStep('form');
    setPendingProduct(null);
    setNewProductName('');
    setNewProductCategory('');
    setProductType('single');
    setSamples([{ id: '1', code: '', label: '' }]);
    setBlindedStudy(false);
    setCustomAttributes(getDefaultCataAttributes('generic'));
    setReferenceScores({ overall: 5, appearance: 5, aroma: 5, flavor: 5, texture: 5 });
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
        .filter(sample => blindedStudy ? sample.label : sample.code && sample.label);

      if (candidateSamples.length < 2) {
        alert(blindedStudy
          ? 'Multi-sample blinded studies require at least 2 sample labels.'
          : 'Multi-sample products require at least 2 samples with code and label.');
        return;
      }

      configuredSamples = blindedStudy
        ? withBlindSampleCodes(candidateSamples, `${productId}:${newProductName}`)
        : candidateSamples;

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
      status: 'active',
      customAttributes: getDefaultCataAttributes(newProductCategory),
      isMultiSample: productType === 'multi',
      samples: configuredSamples,
      isCalibration: productType === 'calibration',
      referenceScores: productType === 'calibration' ? { ...referenceScores } : null,
      blinded: blindedStudy,
      blindCode: blindedStudy && productType !== 'multi'
        ? generateBlindCode(`${productId}:${newProductName}:${newProductCategory}`)
        : null,
      assignedPanelistIds: [],
    };
    setPendingProduct(p);
    setCustomAttributes(getDefaultCataAttributes(newProductCategory));
    setCreateStep('review');
  };

  const finalizeProductCreation = async () => {
    if (!pendingProduct) return;
    setMutationError('');
    try {
      await insertProductMutation.mutateAsync({
        name: pendingProduct.name,
        category: pendingProduct.category,
        status: 'active',
        customAttributes,
        isMultiSample: pendingProduct.isMultiSample,
        samples: pendingProduct.samples,
        isCalibration: pendingProduct.isCalibration,
        referenceScores: pendingProduct.referenceScores,
        blinded: pendingProduct.blinded,
        blindCode: pendingProduct.blindCode,
        assignedPanelistIds: pendingProduct.assignedPanelistIds,
      });
      closeCreateModal();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      const recipientIds = pendingProduct.assignedPanelistIds?.length
        ? pendingProduct.assignedPanelistIds
        : activePanelists.map(panelist => panelist.id);
      void notifyPanelistsOfSurveys(recipientIds, [pendingProduct.name]);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to create product. Please try again.');
    }
  };

  // ── Attribute handlers ────────────────────────────────────────────────────────

  const handleSaveAttributes = async () => {
    if (!selectedProduct) return;
    setMutationError('');
    try {
      await updateProductMutation.mutateAsync({ id: selectedProduct, updates: { customAttributes } });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to save attributes.');
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

  const handleToggleProductStatus = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const newStatus: 'active' | 'completed' = product.status === 'active' ? 'completed' : 'active';
    setMutationError('');
    try {
      await updateProductMutation.mutateAsync({ id: productId, updates: { status: newStatus } });
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

  const handleToggleConceptStatus = async (conceptId: string) => {
    const concept = conceptStudies.find(test => test.id === conceptId);
    if (!concept) return;
    const newStatus: ConceptTest['status'] = concept.status === 'active' ? 'completed' : 'active';
    await handleUpdateConceptStatus(conceptId, newStatus);
  };

  const handleArchiveProduct = async (productId: string) => {
    setMutationError('');
    try {
      await updateProductMutation.mutateAsync({ id: productId, updates: { status: 'archived' } });
      if (selectedProduct === productId) setSelectedProduct(null);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to archive product.');
    }
  };

  const handleArchiveConcept = async (conceptId: string) => {
    await handleUpdateConceptStatus(conceptId, 'archived');
  };

  const handleUnarchiveConcept = async (conceptId: string) => {
    await handleUpdateConceptStatus(conceptId, 'active');
  };

  const handleUnarchiveProduct = async (productId: string) => {
    setMutationError('');
    try {
      await updateProductMutation.mutateAsync({ id: productId, updates: { status: 'active' } });
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to restore product.');
    }
  };

  const handleToggleSurveyAssignment = async (productId: string, panelistUserId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const current = product.assignedPanelistIds ?? [];
    if (current.length === 1 && current[0] === panelistUserId) {
      setMutationError('A selected assignment cannot be empty because an empty product assignment means open to all. Use “Open to all” if that is your intent.');
      return;
    }
    const adding = !current.includes(panelistUserId);
    const next = adding
      ? [...current, panelistUserId]
      : current.filter(id => id !== panelistUserId);
    setMutationError('');
    try {
      await updateProductMutation.mutateAsync({ id: productId, updates: { assignedPanelistIds: next } });
      if (adding) void notifyPanelistsOfSurveys([panelistUserId], [product.name]);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to update panel assignments.');
    }
  };

  const handleAssignAllPanelists = async (productId: string) => {
    setMutationError('');
    try {
      await updateProductMutation.mutateAsync({
        id: productId,
        updates: { assignedPanelistIds: activePanelists.map(panelist => panelist.id) },
      });
      const product = products.find(p => p.id === productId);
      if (product) void notifyPanelistsOfSurveys(activePanelists.map(panelist => panelist.id), [product.name]);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to assign panelists.');
    }
  };

  const handleClearPanelAssignments = async (productId: string) => {
    setMutationError('');
    try {
      await updateProductMutation.mutateAsync({ id: productId, updates: { assignedPanelistIds: [] } });
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to clear panel assignments.');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    setMutationError('');
    try {
      await deleteProductMutation.mutateAsync(productId);
      if (selectedProduct === productId) setSelectedProduct(null);
      setConfirmDeleteId(null);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to delete product.');
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

  const handleEditPanelistId = (userId: string, currentId: string | null) => {
    setEditingPanelistId(userId);
    setPanelistIdInput(currentId ?? '');
  };

  const handleSavePanelistId = async (userId: string) => {
    setMutationError('');
    try {
      await updatePanelistIdMutation.mutateAsync({ userId, panelistId: panelistIdInput });
      setEditingPanelistId(null);
      setPanelistIdInput('');
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to update panelist ID.');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const tabs: { id: AdminTab; label: string; icon: React.ElementType }[] = mode === 'admin' ? [
    { id: 'products',  label: 'Studies',  icon: ClipboardList },
    { id: 'panelists', label: 'Panelists', icon: Users },
    { id: 'imports',   label: 'Imports',   icon: Upload },
  ] : [
    { id: 'products', label: isResponsesMode ? 'Responses' : 'Studies', icon: isResponsesMode ? Activity : ClipboardList },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{isResponsesMode ? 'Responses' : 'Studies'}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {isResponsesMode
            ? 'Track fielding progress, response targets, and blockers before insights are used for decision review.'
            : 'Create, configure, launch, and review product sensory and multi-sample studies.'}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center border-b border-slate-200 gap-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              disabled={tabs.length === 1}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? 'border-slate-800 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              } ${tabs.length === 1 ? 'cursor-default' : ''}`}
            >
              <Icon className="size-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

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
          <div className="flex items-center gap-2 font-semibold text-purple-950"><Layers className="size-4 text-purple-700" />Multi-Sample Comparison</div>
          <p className="mt-1 text-xs leading-5 text-purple-800">Multiple coded samples, ranked together with difference and preference signals.</p>
        </button>
        <Link
          to="/concept-testing"
          className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-left transition hover:border-teal-400 hover:bg-teal-100"
        >
          <div className="flex items-center gap-2 font-semibold text-teal-950"><Lightbulb className="size-4 text-teal-700" />Concept Test</div>
          <p className="mt-1 text-xs leading-5 text-teal-800">Market-facing idea validation: claims, imagery, pricing, and purchase intent.</p>
        </Link>
      </div>}

      {isResponsesMode && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 font-semibold text-slate-950"><Activity className="size-4 text-slate-500" />Response target</div>
            <p className="mt-1 text-xs leading-5 text-slate-600">Use this stage to confirm each active study has enough panelist evidence before opening Insights.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 font-semibold text-slate-950"><Users className="size-4 text-slate-500" />Panelist coverage</div>
            <p className="mt-1 text-xs leading-5 text-slate-600">Assignment labels and response counts below show which studies still need fielding attention.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 font-semibold text-slate-950"><ArrowRight className="size-4 text-slate-500" />Next handoff</div>
            <p className="mt-1 text-xs leading-5 text-slate-600">When response targets are met, continue to Insights for evidence interpretation.</p>
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
          <Users className="size-3.5 text-slate-400" />
          <span className="text-sm font-bold text-slate-900">{activePanelists.length}</span>
          <span className="text-sm text-slate-500">active panelists</span>
        </div>
        <div className="w-px h-4 bg-slate-200" />
        <div className="flex items-center gap-2">
          <Activity className="size-3.5 text-slate-400" />
          <span className="text-sm font-bold text-slate-900">{totalStudyResponses}</span>
          <span className="text-sm text-slate-500">total responses</span>
        </div>
        <div className="w-px h-4 bg-slate-200" />
        <span className="text-sm text-slate-500">{closedStudyCount} closed · {blockerCount} launch blocker{blockerCount !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs bg-white">
              {(['all', 'draft', 'active', 'closed', 'archived'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 font-semibold capitalize transition-colors border-r border-slate-200 last:border-r-0 ${
                    filterStatus === s ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
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
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
                );
              })}
            </div>
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
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
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
              <ClipboardList className="size-10 mb-3 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">
                {scopedStudySummaries.length === 0 ? `No ${currentFoodTypeLabel.toLowerCase()} studies yet` : 'No studies match the current filters'}
              </p>
              <p className="mt-1 max-w-md text-xs text-slate-500">
                {isResponsesMode
                  ? 'Create and launch a study before response collection can begin.'
                  : 'Start with a product sensory study, a multi-sample comparison, or a concept test. Each template stays structured for scoring and reporting.'}
              </p>
              {!isResponsesMode && <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => openCreateModal('single')}><Plus className="size-3.5 mr-1" />Product sensory</Button>
                <Button size="sm" variant="outline" onClick={() => openCreateModal('multi')}><Layers className="size-3.5 mr-1" />Multi-sample</Button>
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
                          <Badge variant="outline" className={`text-[10px] ${meta.className}`}><Icon className="mr-1 size-3" />{meta.label}</Badge>
                          <Badge variant="outline" className={`text-[10px] capitalize ${studyStatusStyles[study.status]}`}>{study.status}</Badge>
                          {product?.blinded && <Badge variant="outline" className="border-slate-400 bg-white text-[10px] text-slate-700">Blinded</Badge>}
                        </div>
                        <h2 className="truncate text-base font-bold text-slate-900">{study.name}</h2>
                        <p className="mt-1 text-xs text-slate-600">{meta.description}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>{study.linkedLabel}</span>
                          <span>{study.assignmentLabel}</span>
                          <span>{study.responseCount} response{study.responseCount !== 1 ? 's' : ''}</span>
                          {study.sourceImportBatchName && <span className="truncate">Source: {study.sourceImportBatchName.replace(/\.csv$/i, '')}</span>}
                        </div>
                      </div>
                      {isProductStudy && (
                        <button onClick={() => setSelectedProduct(study.id)} className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                          <Edit2 className="mr-1 inline size-3" />Edit
                        </button>
                      )}
                    </div>

                    <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-start gap-2">
                        <PlayCircle className="mt-0.5 size-4 shrink-0 text-slate-500" />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{study.nextAction.label}</p>
                          <p className="text-xs text-slate-500">{study.nextAction.description}</p>
                        </div>
                      </div>
                    </div>

                    {blockerPreview.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {blockerPreview.map(blocker => (
                          <span key={blocker.id} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            blocker.severity === 'blocker'
                              ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                              : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                          }`}>
                            {blocker.label}
                          </span>
                        ))}
                        {study.blockers.length > blockerPreview.length && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">+{study.blockers.length - blockerPreview.length} more</span>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" asChild className="h-8 text-xs">
                        <Link to={study.previewPath}><Eye className="mr-1 size-3.5" />Preview as Panelist</Link>
                      </Button>
                      {isProductStudy ? (
                        <>
                          {product.status === 'archived' ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleUnarchiveProduct(product.id)} className="h-8 text-xs border-emerald-300 text-emerald-700">
                                <RotateCcw className="mr-1 size-3.5" />Restore
                              </Button>
                              {confirmDeleteId === product.id ? (
                                <>
                                  <Button size="sm" onClick={() => handleDeleteProduct(product.id)} className="h-8 text-xs bg-rose-600 hover:bg-rose-700">Confirm delete</Button>
                                  <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)} className="h-8 text-xs">Cancel</Button>
                                </>
                              ) : (
                                <Button size="sm" variant="outline" onClick={() => setConfirmDeleteId(product.id)} className="h-8 text-xs border-rose-300 text-rose-600 hover:bg-rose-50">
                                  <Trash2 className="mr-1 size-3.5" />Delete
                                </Button>
                              )}
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleToggleProductStatus(product.id)} className="h-8 text-xs">
                                {product.status === 'active' ? 'Close study' : 'Reopen study'}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleArchiveProduct(product.id)} className="h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50">
                                <Archive className="mr-1 size-3.5" />Archive
                              </Button>
                              <Button size="sm" onClick={() => setSelectedProduct(product.id)} className="h-8 text-xs bg-slate-900 hover:bg-slate-800">
                                <Edit2 className="mr-1 size-3.5" />Edit survey
                              </Button>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          {concept?.status === 'archived' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updateConceptStatusMutation.isPending}
                              onClick={() => handleUnarchiveConcept(concept.id)}
                              className="h-8 text-xs border-emerald-300 text-emerald-700"
                            >
                              <RotateCcw className="mr-1 size-3.5" />Restore
                            </Button>
                          ) : concept ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updateConceptStatusMutation.isPending}
                                onClick={() => handleToggleConceptStatus(concept.id)}
                                className="h-8 text-xs"
                              >
                                {concept.status === 'active' ? 'Close study' : 'Reopen study'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updateConceptStatusMutation.isPending}
                                onClick={() => handleArchiveConcept(concept.id)}
                                className="h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                              >
                                <Archive className="mr-1 size-3.5" />Archive
                              </Button>
                            </>
                          ) : null}
                          <Button size="sm" asChild className={`h-8 text-xs ${meta.actionClassName}`}>
                            <Link to="/concept-testing"><Edit2 className="mr-1 size-3.5" />Edit concept<ArrowRight className="ml-1 size-3.5" /></Link>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <SurveyConfigurationSheet
        product={selectedProductRecord}
        panelists={activePanelists}
        standardAttributes={selectedProductStdAttrs}
        customAttributes={customAttributes}
        newAttribute={newAttribute}
        onOpenChange={open => {
          if (!open) setSelectedProduct(null);
        }}
        onNewAttributeChange={setNewAttribute}
        onAddAttribute={handleAddCustomAttribute}
        onRemoveAttribute={handleRemoveAttribute}
        onToggleAttribute={handleToggleAttribute}
        onResetAttributes={() => setCustomAttributes(selectedProductStdAttrs)}
        onClearAttributes={() => setCustomAttributes([])}
        onSaveAttributes={handleSaveAttributes}
        onTogglePanelist={panelistId => {
          if (selectedProduct) void handleToggleSurveyAssignment(selectedProduct, panelistId);
        }}
        onAssignAll={() => {
          if (selectedProduct) void handleAssignAllPanelists(selectedProduct);
        }}
        onOpenToAll={() => {
          if (selectedProduct) void handleClearPanelAssignments(selectedProduct);
        }}
        saving={updateProductMutation.isPending}
      />

      </> /* end products tab */}

      {/* ── Panelists tab ── */}
      {activeTab === 'panelists' && <>

      {panelists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <Users className="size-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No panelists registered yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-slate-500" />
              Panelist IDs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {panelists.map(p => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-sm font-medium text-slate-800">{p.name}</span>
                  {editingPanelistId === p.id ? (
                    <div className="flex gap-1">
                      {/* eslint-disable-next-line jsx-a11y/no-autofocus -- inline edit field appears on user action; focusing it is the expected behaviour */}
                      <Input value={panelistIdInput} onChange={e => setPanelistIdInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSavePanelistId(p.id)} className="h-6 text-xs w-24" maxLength={20} autoFocus />
                      <Button size="sm" className="h-6 text-xs px-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleSavePanelistId(p.id)}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs px-1" onClick={() => setEditingPanelistId(null)}>×</Button>
                    </div>
                  ) : (
                    <>
                      <span className={`font-mono text-xs ${p.panelistId ? 'text-slate-600' : 'text-slate-400 italic'}`}>{p.panelistId ?? 'no ID'}</span>
                      <Button size="sm" variant="ghost" className="h-6 text-xs px-1" onClick={() => handleEditPanelistId(p.id, p.panelistId)}>Edit</Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <PanelistPerformancePanel />

      </> /* end panelists tab */}


      {/* ── Imports tab ── */}
      {activeTab === 'imports' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="size-4 text-slate-500" />
              Import History
            </CardTitle>
            <p className="text-sm text-slate-500">All CSV instrument data imports with metadata and audit trail.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {recoverableImportCount > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Recovery available</p>
                  <p className="text-xs text-slate-600">
                    {recoverableImportCount} archived or deleted project{recoverableImportCount === 1 ? '' : 's'} can be restored below.
                  </p>
                </div>
                <RotateCcw className="size-5 shrink-0 text-slate-500" />
              </div>
            )}
            {importBatches.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
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
                      <tr key={batch.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-slate-800 max-w-[200px] truncate">{batch.fileName}</td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="text-xs">{batch.foodTypeLabel}</Badge>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{batch.rowCount}</td>
                        <td className="py-2.5 px-3 text-slate-600">{batch.importedByName ?? '—'}</td>
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
                {createStep === 'form' && <><Plus className="size-5 text-slate-600" />New Study</>}
                {createStep === 'review' && <><CheckCircle2 className="size-5 text-slate-600" />Step 1: Review Details</>}
                {createStep === 'configure' && <><Settings className="size-5 text-slate-600" />Step 2: Configure Questionnaire</>}
              </DialogTitle>
              {createStep !== 'form' && (
                <Badge variant="outline" className="border-slate-300 text-slate-700">{createStep === 'review' ? '1 of 2' : '2 of 2'}</Badge>
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
                      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                        {([
                          { type: 'single' as const, icon: ClipboardList, label: 'Single Sample', desc: 'Full evaluation: CATA, intensity, hedonic, and emotional response' },
                          { type: 'multi' as const, icon: Layers, label: 'Multi-Sample', desc: 'Compare samples with discrimination test and preference ranking' },
                          { type: 'calibration' as const, icon: FlaskConical, label: 'Calibration Session', desc: 'Panel training: set reference scores to measure panelist accuracy' },
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
                              <span className={`flex size-11 items-center justify-center rounded-lg ${productType === type ? 'bg-slate-900' : 'bg-slate-100'}`}>
                                <Icon className={`size-5 ${productType === type ? 'text-white' : 'text-slate-500'}`} />
                              </span>
                              <span className="block">
                                <span className="block text-sm font-bold text-slate-900">{label}</span>
                                <span className="mt-1 block text-xs leading-5 text-slate-600">{desc}</span>
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
                          <Input id="productName" placeholder={productType === 'single' ? 'e.g., Coconut Cheddar v3.0' : 'e.g., Coconut Cheddar Comparison'} value={newProductName} onChange={e => setNewProductName(e.target.value)} className="bg-white" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="productCategory">Category</Label>
                          <Input id="productCategory" placeholder={productType === 'single' ? 'e.g., Coconut-based' : 'e.g., Multi-sample comparison'} value={newProductCategory} onChange={e => setNewProductCategory(e.target.value)} className="bg-white" />
                        </div>
                      </div>

                      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
                        <Checkbox
                          id="blindedStudy"
                          checked={blindedStudy}
                          onCheckedChange={v => setBlindedStudy(!!v)}
                        />
                        <div>
                          <Label htmlFor="blindedStudy" className="cursor-pointer font-semibold text-slate-800">Blinded study</Label>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Panelists will see sample codes only — product name and category will not be disclosed during evaluation.
                          </p>
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Reference scores for calibration type */}
                  {productType === 'calibration' && (
                    <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-5">
                      <div>
                        <Label className="text-sm font-bold text-slate-900">Reference Scores (known correct answers)</Label>
                        <p className="mt-1 text-xs leading-5 text-slate-600">Set the expected hedonic scores for this calibration product. Panelists are scored by how closely they match these values.</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-5">
                        {(['overall', 'appearance', 'aroma', 'flavor', 'texture'] as const).map(key => (
                          <div key={key} className="space-y-1">
                            <Label className="text-xs capitalize text-slate-600">{key}</Label>
                            <Input
                              type="number"
                              min={1} max={9} step={0.5}
                              value={referenceScores[key]}
                              onChange={e => setReferenceScores(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 5 }))}
                              className="h-9 bg-white text-center text-sm"
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-500">Scale: 1 (Dislike extremely) → 9 (Like extremely)</p>
                    </section>
                  )}

                  {productType === 'multi' && (
                    <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <Label className="text-sm font-bold text-slate-900">Sample Configuration</Label>
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            {blindedStudy
                              ? 'Define each internal sample label. Missing or invalid codes will be generated before panelists see the study.'
                              : 'Define each sample with a 3-digit code and label. Minimum 2 required.'}
                          </p>
                        </div>
                        <Button size="sm" onClick={handleAddSample} variant="outline"><Plus className="size-4 mr-1" />Add Sample</Button>
                      </div>
                      <div className="space-y-2">
                        {samples.map((sample, index) => (
                          <div key={index} className="grid gap-2 rounded border border-slate-200 bg-white p-3 sm:grid-cols-[32px_128px_minmax(0,1fr)_auto] sm:items-center">
                            <div className="flex size-8 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">{index + 1}</div>
                            <Input placeholder="3-digit code" value={sample.code} onChange={e => handleUpdateSample(index, 'code', e.target.value)} maxLength={3} />
                            <Input placeholder="Sample label" value={sample.label} onChange={e => handleUpdateSample(index, 'label', e.target.value)} />
                            {samples.length > 1 && (
                              <Button size="sm" variant="ghost" onClick={() => handleRemoveSample(index)} className="text-rose-600 hover:text-rose-700"><Trash2 className="size-4" /></Button>
                            )}
                          </div>
                        ))}
                      </div>
                      {configuredSampleCount >= 2 && (
                        <div className="grid gap-2 rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-700 sm:grid-cols-3">
                          <p><strong>{configuredSampleCount} samples</strong> evaluated sequentially</p>
                          <p>Full questionnaire per sample</p>
                          <p>Discrimination test + preference ranking</p>
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
                    disabled={!newProductName || !newProductCategory}
                  >
                    {productType === 'multi' ? <Layers className="size-4 mr-2" /> : productType === 'calibration' ? <FlaskConical className="size-4 mr-2" /> : <Plus className="size-4 mr-2" />}
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
                      <div className="text-sm text-slate-600 mb-1">Study Name</div>
                      <div className="font-bold text-slate-900 text-lg flex items-center gap-2 flex-wrap">
                        {pendingProduct.name}
                        {pendingProduct.isMultiSample && <Badge variant="outline" className="border-slate-300 text-slate-700"><Layers className="size-3 mr-1" />Multi-Sample</Badge>}
                        {pendingProduct.blinded && <Badge variant="outline" className="border-slate-300 text-slate-700">Blinded</Badge>}
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-sm text-slate-600 mb-1">Category</div>
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
                      <div className="text-sm font-bold text-slate-900 mb-3">Samples ({pendingProduct.samples.length})</div>
                      <div className="space-y-2">
                        {pendingProduct.samples.map((sample, idx) => (
                          <div key={sample.id} className="flex items-center gap-3 p-3 bg-white rounded border border-slate-200">
                            <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm">{idx + 1}</div>
                            <div><div className="font-bold text-slate-900">Code: {sample.code}</div><div className="text-sm text-slate-600">{sample.label}</div></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-sm font-semibold text-slate-700 mb-3">What happens next</div>
                    <ul className="text-sm text-slate-600 space-y-2">
                      <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-emerald-600 flex-shrink-0 mt-0.5" />Study created through the existing product questionnaire flow and set active</li>
                      <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-emerald-600 flex-shrink-0 mt-0.5" />Configure which attributes panelists will evaluate</li>
                      <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-emerald-600 flex-shrink-0 mt-0.5" />{pendingProduct.isMultiSample ? 'Panelists evaluate each sample and rank them' : 'Panelists see this product in their questionnaire'}</li>
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
                      {pendingProduct.isMultiSample && <Badge variant="outline" className="border-slate-300 text-slate-700"><Layers className="size-3 mr-1" />Multi-Sample</Badge>}
                    </div>
                    {pendingProduct.isMultiSample && (
                      <div className="text-xs text-slate-500 mt-1">All {pendingProduct.samples?.length} samples use the same questionnaire attributes</div>
                    )}
                  </div>

                  <div className="p-4 bg-white rounded-lg border border-slate-200">
                    <Label htmlFor="newAttrModal" className="text-sm font-bold text-slate-900 mb-2 block">Add Product-Specific Attribute</Label>
                    <p className="text-xs text-slate-600 mb-3">Custom attributes relevant to this product (e.g., "Smoky" for smoked varieties)</p>
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
                        <div key={attr} className="flex items-center space-x-2 p-2 bg-slate-50 rounded border border-slate-300">
                          <Checkbox id={`attr-modal-${attr}`} checked disabled />
                          <Label htmlFor={`attr-modal-${attr}`} className="text-sm flex-1 font-medium text-slate-900">{attr}</Label>
                          <button onClick={() => handleRemoveAttribute(attr)} className="text-rose-600 hover:text-rose-700"><Trash2 className="size-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="size-5 text-slate-500 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-slate-700">
                        <strong>Ready to finalize:</strong> Product will be created with {customAttributes.length} attributes for {pendingProduct.name}.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 border-t border-slate-200 px-6 pb-6 pt-4">
                  <Button variant="outline" onClick={closeCreateModal} className="flex-1">Cancel</Button>
                  <Button onClick={finalizeProductCreation} className="flex-1 bg-slate-900 hover:bg-slate-800">
                    <Save className="size-5 mr-2" />Create Study & Save Configuration
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
