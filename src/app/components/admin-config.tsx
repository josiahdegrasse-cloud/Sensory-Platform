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
import { type Template } from '../lib/database';
import {
  useProducts, useTemplates, usePanelists,
  useInsertProduct, useUpdateProduct, useDeleteProduct, useInsertTemplate, useDeleteTemplate,
  useUpdatePanelistId, useAllResponses, useImportBatches,
} from '../lib/hooks';
import {
  Plus, Settings, Trash2, Save, CheckCircle2, FolderOpen, Layers,
  ClipboardList, Users, AlertCircle, Search, Activity, FlaskConical, Archive, RotateCcw,
  Upload, FileText,
} from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { useAuth } from '../contexts/auth-context';
import { PanelistPerformancePanel } from './panelist-performance';

type AdminTab = 'products' | 'panelists' | 'templates' | 'imports';

type QuestionnaireTemplate = Template;

export function AdminConfig() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('products');
  const { data: products = [] } = useProducts();
  const { data: panelists = [] } = usePanelists();
  const { data: templates = [] } = useTemplates();
  const { data: allResponses = [] } = useAllResponses();
  const { data: importBatches = [] } = useImportBatches(activeTab === 'imports');

  const insertProductMutation = useInsertProduct();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();
  const insertTemplateMutation = useInsertTemplate();
  const deleteTemplateMutation = useDeleteTemplate();
  const updatePanelistIdMutation = useUpdatePanelistId();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [editingPanelistId, setEditingPanelistId] = useState<string | null>(null);
  const [panelistIdInput, setPanelistIdInput] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [customAttributes, setCustomAttributes] = useState<string[]>([]);
  const [newAttribute, setNewAttribute] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [mutationError, setMutationError] = useState('');

  const { foodType, subCategory } = useFoodType();

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
  const selectedProductStdAttrs = getDefaultCataAttributes(selectedProductCategory);
  const modalStdAttrs = getDefaultCataAttributes(newProductCategory);

  const activeCount = products.filter(p => p.status === 'active').length;
  const completedCount = products.filter(p => p.status === 'completed').length;
  const totalSessions = allResponses.length;

  const archivedCount = products.filter(p => p.status === 'archived').length;
  const filteredProducts = products
    .filter(p => filterStatus === 'archived' ? p.status === 'archived' : (filterStatus === 'all' ? p.status !== 'archived' : p.status === filterStatus))
    .filter(p =>
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(p => {
      if (foodType === 'all') return true;
      if (matchFoodType(p.category) !== foodType) return false;
      if (subCategory && p.category !== subCategory) return false;
      return true;
    });

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
    setNewProductCategory('');
    setProductType('single');
    setSamples([{ id: '1', code: '', label: '' }]);
    setCustomAttributes(getDefaultCataAttributes('generic'));
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

  const handleSaveTemplate = async () => {
    if (!templateName || customAttributes.length === 0) return;
    setMutationError('');
    try {
      await insertTemplateMutation.mutateAsync({ name: templateName, attributes: customAttributes });
      setTemplateName('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to save template.');
    }
  };

  const handleLoadTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!selectedProduct) { setMutationError('Select a product first, then load the template.'); return; }
    if (!template) return;
    setMutationError('');
    try {
      await updateProductMutation.mutateAsync({ id: selectedProduct, updates: { customAttributes: template.attributes } });
      setCustomAttributes(template.attributes);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to apply template.');
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

  // ── Render ────────────────────────────────────────────────────────────────────

  const tabs: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: 'products',  label: 'Products',  icon: ClipboardList },
    { id: 'panelists', label: 'Panelists', icon: Users },
    { id: 'templates', label: 'Templates', icon: FileText },
    { id: 'imports',   label: 'Imports',   icon: Upload },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Configure</h1>
        <p className="text-sm text-slate-500 mt-1">Manage products, panelists, templates, and import history</p>
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
          <div className={`w-2 h-2 rounded-full ${activeCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
          <span className="text-sm font-bold text-slate-900">{activeCount}</span>
          <span className="text-sm text-slate-500">active product{activeCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="w-px h-4 bg-slate-200" />
        <div className="flex items-center gap-2">
          <Users className="size-3.5 text-slate-400" />
          <span className="text-sm font-bold text-slate-900">{panelists.length}</span>
          <span className="text-sm text-slate-500">panelist{panelists.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="w-px h-4 bg-slate-200" />
        <div className="flex items-center gap-2">
          <Activity className="size-3.5 text-slate-400" />
          <span className="text-sm font-bold text-slate-900">{totalSessions}</span>
          <span className="text-sm text-slate-500">total session{totalSessions !== 1 ? 's' : ''}</span>
        </div>
        <div className="w-px h-4 bg-slate-200" />
        <span className="text-sm text-slate-500">{completedCount} completed</span>
      </div>

      {/* Products + Attribute Config — full-height split pane */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 280px)', minHeight: '560px' }}>
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
                  {s === 'all' ? `All (${products.filter(p => p.status !== 'archived').length})`
                    : s === 'active' ? `Active (${activeCount})`
                    : s === 'completed' ? `Done (${completedCount})`
                    : `Archived (${archivedCount})`}
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
              <Plus className="size-3.5 mr-1.5" />New Product
            </Button>
          </div>
        </div>

        <div className="flex h-[calc(100%-53px)]">
          {/* Product list */}
          <div className="w-[360px] flex-shrink-0 border-r border-slate-100 overflow-y-auto p-3 space-y-2">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <ClipboardList className="size-10 mb-2 opacity-40" />
                  <p className="text-sm">
                    {products.length === 0 ? 'No products yet — create one' : 'No products match filter'}
                  </p>
                </div>
              ) : filteredProducts.map(product => {
                const sessions = sessionsByProduct[product.id] ?? 0;
                const lastActive = lastActivityByProduct[product.id];
                const attrs = product.customAttributes ?? DEFAULT_CATA_ATTRIBUTES;
                const previewAttrs = attrs.slice(0, 4);
                const extraCount = attrs.length - 4;
                return (
                  <div
                    key={product.id}
                    className={`rounded-lg border-2 transition-all relative overflow-hidden ${
                      product.isMultiSample
                        ? selectedProduct === product.id
                          ? 'border-purple-600 bg-gradient-to-br from-purple-50 to-pink-50'
                          : 'border-purple-200 bg-purple-50/30 hover:border-purple-400'
                        : selectedProduct === product.id
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
                            {product.isMultiSample && (
                              <Badge className="bg-purple-600 text-[10px] px-1.5 py-0">
                                <Layers className="size-2.5 mr-0.5" />Multi
                              </Badge>
                            )}
                            {product.blinded && (
                              <Badge className="bg-slate-800 text-[10px] px-1.5 py-0">Blinded</Badge>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{product.category}</div>
                        </button>
                        <Badge className={`text-[10px] px-1.5 py-0.5 flex-shrink-0 ${product.status === 'active' ? 'bg-emerald-600' : product.status === 'archived' ? 'bg-amber-500' : 'bg-slate-400'}`}>
                          {product.status === 'active' ? 'Active' : product.status === 'archived' ? 'Archived' : 'Done'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 mb-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Activity className="size-3 text-slate-400" />
                          {sessions} session{sessions !== 1 ? 's' : ''}
                        </span>
                        <span>·</span>
                        {lastActive
                          ? <span>Last: {new Date(lastActive).toLocaleDateString()}</span>
                          : <span className="italic">No activity yet</span>
                        }
                      </div>

                      <div className="flex flex-wrap gap-1 mb-3">
                        {previewAttrs.map(attr => (
                          <span key={attr} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full">{attr}</span>
                        ))}
                        {extraCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-full">+{extraCount} more</span>
                        )}
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleProductStatus(product.id)}
                            className={`h-7 text-xs flex-1 ${product.status !== 'active' ? 'border-emerald-600 text-emerald-700' : ''}`}
                          >
                            {product.status === 'active' ? 'Mark Complete' : 'Reopen'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleArchiveProduct(product.id)}
                            className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 px-2"
                            title="Archive product"
                          >
                            <Archive className="size-3" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setSelectedProduct(product.id)}
                            className={`h-7 text-xs flex-shrink-0 ${product.isMultiSample ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                          >
                            <Settings className="size-3 mr-1" />Configure
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          {/* Attribute config panel */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!selectedProduct ? (
                <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400 text-center">
                  <Settings className="size-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">Select a product to configure</p>
                  <p className="text-xs mt-1 max-w-[200px]">Choose a product from the list to customise its questionnaire attributes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Configuring</p>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      {products.find(p => p.id === selectedProduct)?.name}
                      {products.find(p => p.id === selectedProduct)?.isMultiSample && (
                        <Badge className="bg-purple-600 text-xs"><Layers className="size-3 mr-1" />Multi</Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Add Attribute</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g., Smoky, Herbal"
                        value={newAttribute}
                        onChange={e => setNewAttribute(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddCustomAttribute()}
                        className="text-sm"
                      />
                      <Button size="sm" onClick={handleAddCustomAttribute} className="bg-blue-600 hover:bg-blue-700 flex-shrink-0">
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-bold text-slate-700">Attributes ({customAttributes.length})</Label>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => setCustomAttributes(selectedProductStdAttrs)}>Reset</Button>
                        <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => setCustomAttributes([])}>Clear</Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                      {selectedProductStdAttrs.map(attr => (
                        <div key={attr} className="flex items-center gap-1.5 p-1.5 bg-white rounded border border-slate-200">
                          <Checkbox id={`rp-${attr}`} checked={customAttributes.includes(attr)} onCheckedChange={() => handleToggleAttribute(attr)} />
                          <Label htmlFor={`rp-${attr}`} className="text-xs cursor-pointer">{attr}</Label>
                        </div>
                      ))}
                      {customAttributes.filter(attr => !selectedProductStdAttrs.includes(attr)).map(attr => (
                        <div key={attr} className="flex items-center gap-1.5 p-1.5 bg-purple-50 rounded border border-purple-300">
                          <Checkbox id={`rp-${attr}`} checked disabled />
                          <Label htmlFor={`rp-${attr}`} className="text-xs font-medium text-purple-900 flex-1">{attr}</Label>
                          <button onClick={() => handleRemoveAttribute(attr)} className="text-rose-500 hover:text-rose-700"><Trash2 className="size-3" /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveAttributes}
                    className="w-full"
                    style={{ background: '#6B7890' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#5a6878')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#6B7890')}
                  >
                    <Save className="size-4 mr-2" />Save Attributes
                  </Button>

                  <div className="border-t border-slate-200 pt-3 space-y-2">
                    <Label className="text-xs font-bold text-slate-700">Templates ({templates.length})</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Template name…"
                        value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
                        className="text-sm"
                      />
                      <Button size="sm" onClick={handleSaveTemplate} variant="outline" className="flex-shrink-0 text-xs">Save</Button>
                    </div>
                    {templates.length > 0 && (
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {templates.map(t => (
                          <div key={t.id} className="flex items-center gap-2 p-1.5 bg-slate-50 rounded border border-slate-200">
                            <button onClick={() => handleLoadTemplate(t.id)} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 flex-shrink-0">
                              <FolderOpen className="size-3" />Load
                            </button>
                            <span className="text-xs flex-1 truncate">{t.name}</span>
                            <button
                              onClick={async () => {
                                setMutationError('');
                                try { await deleteTemplateMutation.mutateAsync(t.id); }
                                catch (err) { setMutationError(err instanceof Error ? err.message : 'Failed to delete template.'); }
                              }}
                              className="text-rose-500 hover:text-rose-700"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>

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

      {/* ── Templates tab ── */}
      {activeTab === 'templates' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 text-slate-500" />
              Attribute Templates
            </CardTitle>
            <p className="text-sm text-slate-500">Save and reuse questionnaire attribute sets across products.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Template name…"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
                className="flex-1"
              />
              <Button onClick={handleSaveTemplate} disabled={!templateName} className="bg-slate-900 hover:bg-slate-700">
                <Save className="size-4 mr-1.5" />Save
              </Button>
            </div>
            {templates.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <FileText className="size-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No templates saved yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <FileText className="size-4 text-slate-400 shrink-0" />
                    <span className="flex-1 text-sm font-medium text-slate-800">{t.name}</span>
                    <span className="text-xs text-slate-500">{t.attributes.length} attributes</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          if (selectedProduct) {
                            handleLoadTemplate(t.id);
                          } else {
                            setMutationError('Select a product in the Products tab first.');
                          }
                        }}
                      >
                        <FolderOpen className="size-3 mr-1" />Apply
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-rose-300 text-rose-600 hover:bg-rose-50"
                        onClick={async () => {
                          setMutationError('');
                          try { await deleteTemplateMutation.mutateAsync(t.id); }
                          catch (err) { setMutationError(err instanceof Error ? err.message : 'Failed to delete template.'); }
                        }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
          <CardContent>
            {importBatches.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Upload className="size-10 mx-auto mb-2 opacity-30" />
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
