import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { type Product, DEFAULT_CATA_ATTRIBUTES, getDefaultCataAttributes } from '../data/mock-users';
import { useFoodType, matchFoodType } from '../contexts/food-type-context';
import {
  useProducts, usePanelists,
  useInsertProduct, useUpdateProduct, useUpdateProductAssignments, useDeleteProduct,
  useUpdatePanelistId, useAllResponses, useImportBatches,
  useInstrumentalDataset, useUpdateImportBatchStatus, useDeleteImportBatch,
} from '../lib/hooks';
import {
  Plus, Settings, Trash2, Save, CheckCircle2, FolderOpen, Layers,
  ClipboardList, Users, AlertCircle, Search, Activity, FlaskConical, Archive, RotateCcw,
  Upload, Database,
} from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { PanelistPerformancePanel } from './panelist-performance';
import { formatFoodTypeLabel } from '../lib/food-intelligence';
import {
  filterAssignablePanelists,
  getAssignmentSummary,
  getProductAssignmentMode,
} from '../lib/assignments';
import { SurveyConfigurationSheet } from './survey-configuration-sheet';

type AdminTab = 'products' | 'panelists' | 'imports';

export function AdminConfig() {
  const [activeTab, setActiveTab] = useState<AdminTab>('products');
  const { data: products = [] } = useProducts();
  const { data: panelists = [] } = usePanelists();
  const { data: allResponses = [] } = useAllResponses();
  const { data: importBatches = [] } = useImportBatches(activeTab === 'products' || activeTab === 'imports');
  const { data: instrumentalDataset } = useInstrumentalDataset(activeTab === 'products' || activeTab === 'imports');

  const insertProductMutation = useInsertProduct();
  const updateProductMutation = useUpdateProduct();
  const updateProductAssignmentsMutation = useUpdateProductAssignments();
  const deleteProductMutation = useDeleteProduct();
  const updatePanelistIdMutation = useUpdatePanelistId();
  const updateImportBatchStatusMutation = useUpdateImportBatchStatus();
  const deleteImportBatchMutation = useDeleteImportBatch();
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
  const selectedBatchId = subCategory?.startsWith('batch:') ? subCategory.replace('batch:', '') : null;

  // List filters
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'archived'>('all');
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
      setCustomAttributes(product?.customAttributes || [...DEFAULT_CATA_ATTRIBUTES]);
    }
  }, [selectedProduct, products]);

  useEffect(() => {
    if (!selectedProduct) return;
    const product = products.find(p => p.id === selectedProduct);
    if (product && matchFoodType(product.category) !== foodType) setSelectedProduct(null);
  }, [foodType, products, selectedProduct]);

  // ── Computed stats ────────────────────────────────────────────────────────────

  const sessionsByProduct = allResponses.reduce<Record<string, number>>((acc, r) => {
    acc[r.productId] = (acc[r.productId] ?? 0) + 1;
    return acc;
  }, {});

  const lastActivityByProduct = allResponses.reduce<Record<string, string>>((acc, r) => {
    if (!acc[r.productId] || r.timestamp > acc[r.productId]) acc[r.productId] = r.timestamp;
    return acc;
  }, {});

  // Category-aware attribute sets for the sidebar editor and create modal
  const selectedProductCategory = products.find(p => p.id === selectedProduct)?.category ?? '';
  const selectedProductRecord = products.find(p => p.id === selectedProduct) ?? null;
  const selectedProductStdAttrs = getDefaultCataAttributes(selectedProductCategory);
  const modalStdAttrs = getDefaultCataAttributes(newProductCategory);
  const activePanelists = filterAssignablePanelists(panelists);

  const importedSamples = (instrumentalDataset?.eTongueData ?? []).filter(sample =>
    sample.type === foodType &&
    (!selectedBatchId || sample.importBatchId === selectedBatchId)
  );
  const importedSampleIds = new Set(importedSamples.map(sample => sample.sampleId));
  const importedGcmsCount = Object.keys(instrumentalDataset?.gcmsData ?? {}).filter(id => importedSampleIds.has(id)).length;
  const importedCompositionCount = Object.keys(instrumentalDataset?.compositionData ?? {}).filter(id => importedSampleIds.has(id)).length;
  const normaliseProductName = (value: string) => value.trim().toLowerCase();
  const importedSamplesWithoutQuestionnaires = importedSamples.filter(sample => {
    const name = sample.sampleName || sample.sampleId;
    const generatedName = name === sample.sampleId ? sample.sampleId : `${name} (${sample.sampleId})`;
    return !products.some(product =>
      normaliseProductName(product.name) === normaliseProductName(name) ||
      normaliseProductName(product.name) === normaliseProductName(generatedName)
    );
  });

  const foodTypeProducts = products.filter(p => matchFoodType(p.category) === foodType);
  const scopedProducts = foodTypeProducts.filter(p => !selectedBatchId || p.sourceImportBatchId === selectedBatchId);
  const scopedActiveCount = scopedProducts.filter(p => p.status === 'active').length;
  const scopedCompletedCount = scopedProducts.filter(p => p.status === 'completed').length;
  const scopedArchivedCount = scopedProducts.filter(p => p.status === 'archived').length;
  const scopedSessions = scopedProducts.reduce((sum, product) => sum + (sessionsByProduct[product.id] ?? 0), 0);
  const filteredProducts = products
    .filter(p => filterStatus === 'archived' ? p.status === 'archived' : (filterStatus === 'all' ? p.status !== 'archived' : p.status === filterStatus))
    .filter(p =>
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(p => {
      if (matchFoodType(p.category) !== foodType) return false;
      if (selectedBatchId) return p.sourceImportBatchId === selectedBatchId;
      if (subCategory && p.category !== subCategory) return false;
      return true;
    });
  const importBatchById = new Map(importBatches.map(batch => [batch.id, batch]));
  const productProjectGroups = filteredProducts.reduce<Array<{ key: string; label: string; products: Product[]; source: 'import' | 'manual' }>>((groups, product) => {
    const key = product.sourceImportBatchId ?? 'manual';
    const existing = groups.find(group => group.key === key);
    const batch = product.sourceImportBatchId ? importBatchById.get(product.sourceImportBatchId) : null;
    const label = batch
      ? `${batch.fileName.replace(/\.csv$/i, '')}`
      : `${currentFoodTypeLabel} manual surveys`;
    if (existing) existing.products.push(product);
    else groups.push({ key, label, products: [product], source: batch ? 'import' : 'manual' });
    return groups;
  }, []);

  const getSurveyWorkflowStatus = (product: Product) => {
    if (product.status === 'archived') {
      return { label: 'Archived', className: 'bg-amber-100 text-amber-700 border-amber-200' };
    }
    if (product.status === 'completed') {
      return { label: 'Complete', className: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
    if (getProductAssignmentMode(product) === 'selected') {
      return { label: 'Assigned', className: 'bg-blue-100 text-blue-700 border-blue-200' };
    }
    return { label: 'Open to all', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  };
  const getSmartAttributesForSample = (sample: NonNullable<typeof instrumentalDataset>['eTongueData'][number]) => {
    const base = getDefaultCataAttributes(sample.type || sample.category || currentFoodTypeLabel);
    const suggested: string[] = [];
    const tasteScores = [
      { attr: 'Sour', value: sample.sourness },
      { attr: 'Bitter', value: sample.bitterness },
      { attr: 'Salty', value: sample.saltiness },
      { attr: 'Umami', value: sample.umami },
      { attr: 'Sweet', value: sample.sweetness },
    ];
    tasteScores
      .filter(item => item.value >= 3.5)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .forEach(item => suggested.push(item.attr));

    (instrumentalDataset?.gcmsData?.[sample.sampleId] ?? [])
      .filter(compound => compound.aroma && (compound.threshold === 0 || compound.concentration >= compound.threshold))
      .slice(0, 4)
      .forEach(compound => {
        compound.aroma
          .split(/[/,]+/)
          .map(aroma => aroma.trim())
          .filter(Boolean)
          .forEach(aroma => suggested.push(formatFoodTypeLabel(aroma)));
      });

    const composition = instrumentalDataset?.compositionData?.[sample.sampleId];
    if (composition?.protein && composition.protein >= 15) suggested.push('High Protein');
    if (composition?.fat && composition.fat >= 10) suggested.push('Rich');
    if (composition?.saltContent && composition.saltContent >= 1.5) suggested.push('Salty');

    return Array.from(new Set([...base, ...suggested])).slice(0, 32);
  };
  const readyForAssignmentProducts = scopedProducts.filter(product =>
    product.status === 'active' &&
    getProductAssignmentMode(product) === 'open'
  );
  const selectedProject = selectedBatchId ? importBatches.find(batch => batch.id === selectedBatchId) : null;
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

  const openCreateModal = () => {
    setShowCreateModal(true);
    setCreateStep('form');
    setPendingProduct(null);
    setNewProductName('');
    setNewProductCategory(currentFoodTypeLabel);
    setProductType('single');
    setSamples([{ id: '1', code: '', label: '' }]);
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
    setCustomAttributes(getDefaultCataAttributes('generic'));
    setReferenceScores({ overall: 5, appearance: 5, aroma: 5, flavor: 5, texture: 5 });
  };

  const handleCreateProduct = () => {
    if (!newProductName || !newProductCategory) return;
    if (productType === 'multi') {
      const valid = samples.filter(s => s.code && s.label);
      if (valid.length < 2) { alert('Multi-sample products require at least 2 samples with code and label'); return; }
      const codes = valid.map(s => s.code);
      if (new Set(codes).size !== codes.length) { alert('Each sample must have a unique code'); return; }
    }
    const p: Product = {
      id: `prod${Date.now()}`,
      name: newProductName,
      category: newProductCategory,
      createdDate: new Date().toISOString(),
      status: 'active',
      customAttributes: getDefaultCataAttributes(newProductCategory),
      isMultiSample: productType === 'multi',
      samples: productType === 'multi' ? samples.filter(s => s.code && s.label) : undefined,
      isCalibration: productType === 'calibration',
      referenceScores: productType === 'calibration' ? { ...referenceScores } : null,
      blinded: blindedStudy,
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
        assignedPanelistIds: pendingProduct.assignedPanelistIds,
      });
      closeCreateModal();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
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

  const handleArchiveProduct = async (productId: string) => {
    setMutationError('');
    try {
      await updateProductMutation.mutateAsync({ id: productId, updates: { status: 'archived' } });
      if (selectedProduct === productId) setSelectedProduct(null);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to archive product.');
    }
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
    const next = current.includes(panelistUserId)
      ? current.filter(id => id !== panelistUserId)
      : [...current, panelistUserId];
    setMutationError('');
    try {
      await updateProductMutation.mutateAsync({ id: productId, updates: { assignedPanelistIds: next } });
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

  const handleAssignCurrentScopeToAllPanelists = async () => {
    setMutationError('');
    try {
      await updateProductAssignmentsMutation.mutateAsync({
        productIds: readyForAssignmentProducts.map(product => product.id),
        assignedPanelistIds: activePanelists.map(panelist => panelist.id),
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to assign current surveys.');
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

  const handleAddBreadStarterSet = async () => {
    const breadProducts = [
      { name: 'Sourdough Loaf v1.0',       category: 'Bread' },
      { name: 'White Sandwich Bread v2.1', category: 'Bread' },
      { name: 'Multigrain Artisan v1.0',   category: 'Bread' },
    ];
    setMutationError('');
    try {
      for (const p of breadProducts) {
        await insertProductMutation.mutateAsync({
          name: p.name, category: p.category, status: 'active',
          customAttributes: getDefaultCataAttributes(p.category),
        });
      }
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to add bread starter products.');
    }
  };

  const handleCreateQuestionnairesFromImports = async () => {
    if (importedSamplesWithoutQuestionnaires.length === 0) {
      setMutationError('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      return;
    }

    setMutationError('');
    try {
      let firstCreatedId: string | null = null;
      for (const sample of importedSamplesWithoutQuestionnaires) {
        const name = sample.sampleName || sample.sampleId;
        const category = sample.type === 'dairy' || sample.type === 'pbca'
          ? 'Cheese'
          : formatFoodTypeLabel(sample.type || sample.category || 'generic');
        const created = await insertProductMutation.mutateAsync({
          name: name === sample.sampleId ? sample.sampleId : `${name} (${sample.sampleId})`,
          category,
          status: 'active',
          customAttributes: getSmartAttributesForSample(sample),
          assignedPanelistIds: [],
          sourceImportBatchId: sample.importBatchId,
          sourceSampleId: sample.sampleId,
        });
        firstCreatedId = firstCreatedId ?? created.id;
      }
      if (firstCreatedId) setSelectedProduct(firstCreatedId);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to create questionnaires from imported samples.');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const tabs: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: 'products',  label: 'Surveys',  icon: ClipboardList },
    { id: 'panelists', label: 'Panelists', icon: Users },
    { id: 'imports',   label: 'Imports',   icon: Upload },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Configure {currentFoodTypeLabel} Surveys</h1>
        <p className="text-sm text-slate-500 mt-1">Build, assign, archive, and tune panel questionnaires by food type.</p>
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
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? 'border-slate-800 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
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

      {/* ── Products tab ── */}
      {activeTab === 'products' && <>

      {/* Stats strip */}
      <div className="flex items-center gap-5 px-5 py-3 bg-white border border-slate-200 rounded-xl shadow-sm flex-wrap">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${scopedActiveCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
          <span className="text-sm font-bold text-slate-900">{scopedActiveCount}</span>
          <span className="text-sm text-slate-500">active {currentFoodTypeLabel.toLowerCase()} survey{scopedActiveCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="w-px h-4 bg-slate-200" />
        <div className="flex items-center gap-2">
          <Users className="size-3.5 text-slate-400" />
          <span className="text-sm font-bold text-slate-900">{activePanelists.length}</span>
          <span className="text-sm text-slate-500">active panelist{activePanelists.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="w-px h-4 bg-slate-200" />
        <div className="flex items-center gap-2">
          <Activity className="size-3.5 text-slate-400" />
          <span className="text-sm font-bold text-slate-900">{scopedSessions}</span>
          <span className="text-sm text-slate-500">total session{scopedSessions !== 1 ? 's' : ''}</span>
        </div>
        <div className="w-px h-4 bg-slate-200" />
        <span className="text-sm text-slate-500">{scopedCompletedCount} completed</span>
      </div>

      {importedSamples.length > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600">
              <ClipboardList className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900">
                {selectedProject ? selectedProject.fileName.replace(/\.csv$/i, '') : `Imported ${currentFoodTypeLabel.toLowerCase()} workspace`}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                <span>{importedSamples.length} sample{importedSamples.length === 1 ? '' : 's'}</span>
                <span>{importedGcmsCount} GC-MS</span>
                <span>{importedCompositionCount} comp</span>
                <span>{importedSamplesWithoutQuestionnaires.length === 0 ? 'surveys created' : `${importedSamplesWithoutQuestionnaires.length} surveys missing`}</span>
                <span>{readyForAssignmentProducts.length} currently open to all</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Button
              onClick={handleCreateQuestionnairesFromImports}
              disabled={insertProductMutation.isPending || importedSamplesWithoutQuestionnaires.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="size-4 mr-1.5" />
              {importedSamplesWithoutQuestionnaires.length === 0
                ? 'Surveys created'
                : `Create ${importedSamplesWithoutQuestionnaires.length} survey${importedSamplesWithoutQuestionnaires.length === 1 ? '' : 's'}`}
            </Button>
            <Button
              variant="outline"
              onClick={handleAssignCurrentScopeToAllPanelists}
              disabled={updateProductAssignmentsMutation.isPending || activePanelists.length === 0 || readyForAssignmentProducts.length === 0}
              className="border-blue-300 text-blue-700 hover:bg-white"
            >
              <Users className="size-4 mr-1.5" />
              Assign project
            </Button>
          </div>
        </div>
      )}

      {/* Products + Attribute Config — full-height split pane */}
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
        style={{
          height: importedSamples.length > 0 ? 'calc(100vh - 335px)' : 'calc(100vh - 265px)',
          minHeight: importedSamples.length > 0 ? '560px' : '600px',
        }}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs bg-white">
              {(['all', 'active', 'completed', 'archived'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 font-semibold capitalize transition-colors border-r border-slate-200 last:border-r-0 ${
                    filterStatus === s ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {s === 'all' ? `All (${scopedProducts.filter(p => p.status !== 'archived').length})`
                    : s === 'active' ? `Active (${scopedActiveCount})`
                    : s === 'completed' ? `Done (${scopedCompletedCount})`
                    : `Archived (${scopedArchivedCount})`}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search products…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm w-48"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleAddBreadStarterSet}
              disabled={insertProductMutation.isPending}
              className="h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              Add Reference Set
            </Button>
            <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700 h-8 text-sm">
              <Plus className="size-3.5 mr-1.5" />New Survey
            </Button>
          </div>
        </div>

        <div className="h-[calc(100%-53px)] overflow-y-auto">
          {/* Survey / sample list */}
          <div className="p-4 space-y-5">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <ClipboardList className="size-10 mb-2 opacity-40" />
                  <p className="text-sm">
                    {foodTypeProducts.length === 0 ? `No ${currentFoodTypeLabel.toLowerCase()} surveys yet` : 'No surveys match filter'}
                  </p>
                </div>
              ) : productProjectGroups.map((group, groupIndex) => {
                const assignedCount = group.products.filter(product => getProductAssignmentMode(product) === 'selected').length;
                const openCount = group.products.filter(product => product.status === 'active' && getProductAssignmentMode(product) === 'open').length;
                const completedProjectCount = group.products.filter(product => product.status === 'completed').length;
                const archivedProjectCount = group.products.filter(product => product.status === 'archived').length;
                return (
                <div key={group.key} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${group.source === 'import' ? 'bg-blue-600' : 'bg-slate-700'}`}>
                        <FolderOpen className="size-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                          {group.source === 'import' ? `Imported project ${groupIndex + 1}` : 'Manual surveys'}
                        </div>
                        <h2 className="truncate text-base font-semibold text-slate-900">{group.label}</h2>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                          <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600 ring-1 ring-slate-200">{group.products.length} sample{group.products.length === 1 ? '' : 's'}</span>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-200">{openCount} open to all</span>
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700 ring-1 ring-blue-200">{assignedCount} assigned</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 ring-1 ring-slate-200">{completedProjectCount} complete</span>
                          {archivedProjectCount > 0 && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 ring-1 ring-amber-200">{archivedProjectCount} archived</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {openCount > 0 ? 'Open access included' : 'Selected assignments'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {group.products.map(product => {
                      const sessions = sessionsByProduct[product.id] ?? 0;
                      const lastActive = lastActivityByProduct[product.id];
                      const attrs = product.customAttributes ?? DEFAULT_CATA_ATTRIBUTES;
                      const previewAttrs = attrs.slice(0, 4);
                      const extraCount = attrs.length - 4;
                      const workflowStatus = getSurveyWorkflowStatus(product);
                      return (
                        <div
                          key={product.id}
                          className={`rounded-lg border-2 transition-all relative overflow-hidden ${
                            selectedProduct === product.id
                              ? 'border-blue-600 bg-blue-50'
                              : 'border-slate-200 hover:border-blue-300 bg-white'
                          }`}
                        >
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${product.status === 'active' ? 'bg-emerald-500' : product.status === 'archived' ? 'bg-amber-400' : 'bg-slate-300'}`} />
                          <div className="p-4 pl-5">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <button onClick={() => setSelectedProduct(product.id)} className="text-left flex-1 min-w-0">
                                <div className="font-bold text-slate-900 truncate flex items-center gap-2 flex-wrap">
                                  {product.name}
                                  {product.sourceSampleId && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{product.sourceSampleId}</Badge>}
                                  {product.blinded && <Badge className="bg-slate-800 text-[10px] px-1.5 py-0">Blinded</Badge>}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">{product.category}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {getAssignmentSummary('product', product, panelists).label}
                                </div>
                              </button>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 flex-shrink-0 ${workflowStatus.className}`}>
                                {workflowStatus.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mb-2 text-xs text-slate-500">
                              <span className="flex items-center gap-1"><Activity className="size-3 text-slate-400" />{sessions} session{sessions !== 1 ? 's' : ''}</span>
                              <span>·</span>
                              {lastActive ? <span>Last: {new Date(lastActive).toLocaleDateString()}</span> : <span className="italic">No activity yet</span>}
                            </div>
                            <div className="flex flex-wrap gap-1 mb-3">
                              {previewAttrs.map(attr => (
                                <span key={attr} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full">{attr}</span>
                              ))}
                              {extraCount > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-full">+{extraCount} more</span>}
                            </div>
                            {product.status === 'archived' ? (
                              <div className="flex items-center gap-1.5">
                                <Button size="sm" variant="outline" onClick={() => handleUnarchiveProduct(product.id)} className="h-7 text-xs flex-1 border-emerald-600 text-emerald-700">
                                  <RotateCcw className="size-3 mr-1" />Restore
                                </Button>
                                {confirmDeleteId === product.id ? (
                                  <div className="flex gap-1">
                                    <Button size="sm" onClick={() => handleDeleteProduct(product.id)} className="h-7 text-xs bg-rose-600 hover:bg-rose-700 px-2">Confirm</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)} className="h-7 text-xs px-2">Cancel</Button>
                                  </div>
                                ) : (
                                  <Button size="sm" variant="outline" onClick={() => setConfirmDeleteId(product.id)} className="h-7 text-xs border-rose-300 text-rose-600 hover:bg-rose-50">
                                    <Trash2 className="size-3 mr-1" />Delete
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <Button size="sm" variant="outline" onClick={() => handleToggleProductStatus(product.id)} className={`h-7 text-xs flex-1 ${product.status !== 'active' ? 'border-emerald-600 text-emerald-700' : ''}`}>
                                  {product.status === 'active' ? 'Mark Complete' : 'Reopen'}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleArchiveProduct(product.id)} className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 px-2" title="Archive product">
                                  <Archive className="size-3" />
                                </Button>
                                <Button size="sm" onClick={() => setSelectedProduct(product.id)} className="h-7 text-xs flex-shrink-0 bg-blue-600 hover:bg-blue-700">
                                  <Settings className="size-3 mr-1" />Configure
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>

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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="flex items-center gap-2">
                {createStep === 'form' && <><Plus className="size-5 text-blue-600" />New Product</>}
                {createStep === 'review' && <><CheckCircle2 className="size-5 text-purple-600" />Step 1: Review Details</>}
                {createStep === 'configure' && <><Settings className="size-5 text-purple-600" />Step 2: Configure Questionnaire</>}
              </DialogTitle>
              {createStep !== 'form' && (
                <Badge className="bg-purple-600">{createStep === 'review' ? '1 of 2' : '2 of 2'}</Badge>
              )}
            </div>
          </DialogHeader>

          <div className="pt-2 space-y-5">

            {/* FORM STEP */}
            {createStep === 'form' && (
              <>
                <div className="space-y-3">
                  <Label className="text-base font-bold text-slate-900">Product Type</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { type: 'single' as const, icon: ClipboardList, label: 'Single Sample', desc: 'Full evaluation: CATA, intensity, hedonic, and emotional response', color: 'blue' },
                      { type: 'multi' as const, icon: Layers, label: 'Multi-Sample', desc: 'Compare samples with discrimination test and preference ranking', color: 'purple' },
                      { type: 'calibration' as const, icon: FlaskConical, label: 'Calibration Session', desc: 'Panel training: set reference scores to measure panelist accuracy', color: 'amber' },
                    ]).map(({ type, icon: Icon, label, desc, color }) => (
                      <button
                        key={type}
                        onClick={() => setProductType(type)}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          productType === type
                            ? color === 'blue' ? 'border-blue-600 bg-blue-50' : color === 'purple' ? 'border-purple-600 bg-gradient-to-br from-purple-50 to-pink-50' : 'border-amber-500 bg-amber-50'
                            : color === 'blue' ? 'border-slate-200 hover:border-blue-300 bg-white' : color === 'purple' ? 'border-slate-200 hover:border-purple-300 bg-white' : 'border-slate-200 hover:border-amber-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${productType === type ? (color === 'blue' ? 'bg-blue-600' : color === 'purple' ? 'bg-purple-600' : 'bg-amber-500') : 'bg-slate-200'}`}>
                            <Icon className={`size-5 ${productType === type ? 'text-white' : 'text-slate-500'}`} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 mb-1 text-sm">{label}</div>
                            <p className="text-xs text-slate-600">{desc}</p>
                          </div>
                        </div>
                        {productType === type && (
                          <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${color === 'blue' ? 'text-blue-700' : color === 'purple' ? 'text-purple-700' : 'text-amber-700'}`}>
                            <CheckCircle2 className="size-3" />Selected
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Reference scores for calibration type */}
                  {productType === 'calibration' && (
                    <div className="space-y-3 p-4 bg-amber-50 rounded-lg border border-amber-200 mt-1">
                      <Label className="text-sm font-bold text-amber-900">Reference Scores (known correct answers)</Label>
                      <p className="text-xs text-slate-600">Set the expected hedonic scores for this calibration product. Panelists are scored by how closely they match these values.</p>
                      <div className="grid grid-cols-5 gap-3">
                        {(['overall', 'appearance', 'aroma', 'flavor', 'texture'] as const).map(key => (
                          <div key={key} className="space-y-1">
                            <Label className="text-xs capitalize text-amber-800">{key}</Label>
                            <Input
                              type="number"
                              min={1} max={9} step={0.5}
                              value={referenceScores[key]}
                              onChange={e => setReferenceScores(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 5 }))}
                              className="h-8 text-sm text-center"
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-amber-700">Scale: 1 (Dislike extremely) → 9 (Like extremely)</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="productName">Product Name</Label>
                    <Input id="productName" placeholder={productType === 'single' ? 'e.g., Coconut Cheddar v3.0' : 'e.g., Coconut Cheddar Comparison'} value={newProductName} onChange={e => setNewProductName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productCategory">Category</Label>
                    <Input id="productCategory" placeholder={productType === 'single' ? 'e.g., Coconut-based' : 'e.g., Multi-sample comparison'} value={newProductCategory} onChange={e => setNewProductCategory(e.target.value)} />
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <Checkbox
                    id="blindedStudy"
                    checked={blindedStudy}
                    onCheckedChange={v => setBlindedStudy(!!v)}
                  />
                  <div>
                    <Label htmlFor="blindedStudy" className="font-semibold text-slate-800 cursor-pointer">Blinded study</Label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Panelists will see sample codes only — product name and category will not be disclosed during evaluation.
                    </p>
                  </div>
                </div>

                {productType === 'multi' && (
                  <div className="space-y-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-bold text-purple-900">Sample Configuration</Label>
                      <Button size="sm" onClick={handleAddSample} variant="outline"><Plus className="size-4 mr-1" />Add Sample</Button>
                    </div>
                    <p className="text-xs text-slate-600">Define each sample with a 3-digit code and label. Minimum 2 required.</p>
                    <div className="space-y-2">
                      {samples.map((sample, index) => (
                        <div key={index} className="flex items-center gap-2 p-3 bg-white rounded border border-purple-200">
                          <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{index + 1}</div>
                          <Input placeholder="3-digit code" value={sample.code} onChange={e => handleUpdateSample(index, 'code', e.target.value)} className="w-28" maxLength={3} />
                          <Input placeholder="Sample label" value={sample.label} onChange={e => handleUpdateSample(index, 'label', e.target.value)} className="flex-1" />
                          {samples.length > 1 && (
                            <Button size="sm" variant="ghost" onClick={() => handleRemoveSample(index)} className="text-rose-600 hover:text-rose-700"><Trash2 className="size-4" /></Button>
                          )}
                        </div>
                      ))}
                    </div>
                    {samples.filter(s => s.code && s.label).length >= 2 && (
                      <div className="p-3 bg-white rounded-lg border-2 border-purple-300 text-xs text-slate-700 space-y-1">
                        <p className="font-bold text-purple-900 mb-1">Evaluation Flow:</p>
                        <p><strong>{samples.filter(s => s.code && s.label).length} samples</strong> evaluated sequentially</p>
                        <p>Full questionnaire per sample (CATA + Intensity + Hedonic + Emotions)</p>
                        <p>Discrimination test + Preference ranking</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={closeCreateModal} className="flex-1">Cancel</Button>
                  <Button
                    onClick={handleCreateProduct}
                    className={`flex-1 py-5 ${productType === 'multi' ? 'bg-purple-600 hover:bg-purple-700' : productType === 'calibration' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                    disabled={!newProductName || !newProductCategory}
                  >
                    {productType === 'multi' ? <Layers className="size-4 mr-2" /> : productType === 'calibration' ? <FlaskConical className="size-4 mr-2" /> : <Plus className="size-4 mr-2" />}
                    Review & Configure
                  </Button>
                </div>
              </>
            )}

            {/* REVIEW STEP */}
            {createStep === 'review' && pendingProduct && (
              <>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-sm text-slate-600 mb-1">Product Name</div>
                      <div className="font-bold text-slate-900 text-lg flex items-center gap-2 flex-wrap">
                        {pendingProduct.name}
                        {pendingProduct.isMultiSample && <Badge className="bg-purple-600"><Layers className="size-3 mr-1" />Multi-Sample</Badge>}
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-sm text-slate-600 mb-1">Category</div>
                      <div className="font-bold text-slate-900 text-lg">{pendingProduct.category}</div>
                    </div>
                  </div>
                  {pendingProduct.isMultiSample && pendingProduct.samples && (
                    <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-300">
                      <div className="text-sm font-bold text-purple-900 mb-3">Samples ({pendingProduct.samples.length})</div>
                      <div className="space-y-2">
                        {pendingProduct.samples.map((sample, idx) => (
                          <div key={sample.id} className="flex items-center gap-3 p-3 bg-white rounded border border-purple-200">
                            <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">{idx + 1}</div>
                            <div><div className="font-bold text-slate-900">Code: {sample.code}</div><div className="text-sm text-slate-600">{sample.label}</div></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-sm font-semibold text-slate-700 mb-3">What happens next</div>
                    <ul className="text-sm text-slate-600 space-y-2">
                      <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-emerald-600 flex-shrink-0 mt-0.5" />Product created and set to "Open for Evaluation"</li>
                      <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-emerald-600 flex-shrink-0 mt-0.5" />Configure which attributes panelists will evaluate</li>
                      <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-emerald-600 flex-shrink-0 mt-0.5" />{pendingProduct.isMultiSample ? 'Panelists evaluate each sample and rank them' : 'Panelists see this product in their questionnaire'}</li>
                    </ul>
                  </div>
                </div>
                <div className="flex gap-3 pt-2 border-t">
                  <Button variant="outline" onClick={() => setCreateStep('form')} className="flex-1">Back</Button>
                  <Button onClick={() => setCreateStep('configure')} className="flex-1 bg-purple-600 hover:bg-purple-700">
                    Next: Configure Questionnaire<Settings className="size-4 ml-2" />
                  </Button>
                </div>
              </>
            )}

            {/* CONFIGURE STEP */}
            {createStep === 'configure' && pendingProduct && (
              <>
                <div className="space-y-5">
                  <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                    <div className="text-sm font-semibold text-purple-900 mb-1">Configuring:</div>
                    <div className="font-bold text-purple-900 text-lg flex items-center gap-2 flex-wrap">
                      {pendingProduct.name}
                      {pendingProduct.isMultiSample && <Badge className="bg-purple-600"><Layers className="size-3 mr-1" />Multi-Sample</Badge>}
                    </div>
                    {pendingProduct.isMultiSample && (
                      <div className="text-xs text-purple-700 mt-1">All {pendingProduct.samples?.length} samples use the same questionnaire attributes</div>
                    )}
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <Label htmlFor="newAttrModal" className="text-sm font-bold text-blue-900 mb-2 block">Add Product-Specific Attribute</Label>
                    <p className="text-xs text-slate-600 mb-3">Custom attributes relevant to this product (e.g., "Smoky" for smoked varieties)</p>
                    <div className="flex gap-2">
                      <Input id="newAttrModal" placeholder="e.g., Smoky, Herbal, Peppery" value={newAttribute} onChange={e => setNewAttribute(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCustomAttribute()} />
                      <Button onClick={handleAddCustomAttribute} className="bg-blue-600 hover:bg-blue-700"><Plus className="size-4 mr-1" />Add</Button>
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
                        <div key={attr} className="flex items-center space-x-2 p-2 bg-purple-50 rounded border-2 border-purple-300">
                          <Checkbox id={`attr-modal-${attr}`} checked disabled />
                          <Label htmlFor={`attr-modal-${attr}`} className="text-sm flex-1 font-medium text-purple-900">{attr}</Label>
                          <button onClick={() => handleRemoveAttribute(attr)} className="text-rose-600 hover:text-rose-700"><Trash2 className="size-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="size-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-emerald-900">
                        <strong>Ready to finalize:</strong> Product will be created with {customAttributes.length} attributes for {pendingProduct.name}.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={closeCreateModal} className="flex-1">Cancel</Button>
                  <Button onClick={finalizeProductCreation} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                    <Save className="size-5 mr-2" />Create Product & Save Configuration
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
