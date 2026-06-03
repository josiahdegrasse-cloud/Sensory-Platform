import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { type Product, DEFAULT_CATA_ATTRIBUTES } from '../data/mock-users';
import { type Template, type PanelistInfo, type PanelistReliability } from '../lib/database';
import {
  useProducts, useTemplates, usePanelists, usePanelistReliability,
  useInsertProduct, useUpdateProduct, useInsertTemplate, useDeleteTemplate, useUpdatePanelistId,
} from '../lib/hooks';
import { Plus, Settings, Trash2, Save, CheckCircle2, Bookmark, FolderOpen, Layers, ClipboardList, Users, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { useAuth } from '../contexts/auth-context';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

type QuestionnaireTemplate = Template;

export function AdminConfig() {
  const { user } = useAuth();
  const { data: products = [] } = useProducts()
  const { data: panelists = [] } = usePanelists()
  const { data: reliability = [] } = usePanelistReliability()
  const { data: templates = [] } = useTemplates()
  const insertProductMutation = useInsertProduct()
  const updateProductMutation = useUpdateProduct()
  const insertTemplateMutation = useInsertTemplate()
  const deleteTemplateMutation = useDeleteTemplate()
  const updatePanelistIdMutation = useUpdatePanelistId()
  const [editingPanelistId, setEditingPanelistId] = useState<string | null>(null);
  const [panelistIdInput, setPanelistIdInput] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [customAttributes, setCustomAttributes] = useState<string[]>([]);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [mutationError, setMutationError] = useState('');
  const [newAttribute, setNewAttribute] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [confirmationStep, setConfirmationStep] = useState<'review' | 'configure'>('review');

  // Multi-sample state
  const [productType, setProductType] = useState<'single' | 'multi'>('single');
  const [samples, setSamples] = useState<{ id: string; code: string; label: string }[]>([
    { id: '1', code: '', label: '' }
  ]);

  useEffect(() => {
    // Load custom attributes when product is selected
    if (selectedProduct) {
      const product = products.find(p => p.id === selectedProduct);
      setCustomAttributes(product?.customAttributes || [...DEFAULT_CATA_ATTRIBUTES]);
    }
  }, [selectedProduct, products]);

  const handleAddSample = () => {
    setSamples([...samples, { id: String(samples.length + 1), code: '', label: '' }]);
  };

  const handleRemoveSample = (index: number) => {
    if (samples.length <= 1) return; // Keep at least one sample
    setSamples(samples.filter((_, i) => i !== index));
  };

  const handleUpdateSample = (index: number, field: 'code' | 'label', value: string) => {
    const updated = [...samples];
    updated[index][field] = value;
    setSamples(updated);
  };

  const handleCreateProduct = () => {
    if (!newProductName || !newProductCategory) return;

    // Validate multi-sample fields
    if (productType === 'multi') {
      const validSamples = samples.filter(s => s.code && s.label);
      if (validSamples.length < 2) {
        alert('Multi-sample products require at least 2 samples with code and label');
        return;
      }
      const codes = validSamples.map(s => s.code);
      if (new Set(codes).size !== codes.length) {
        alert('Each sample must have a unique code. Please remove duplicate codes.');
        return;
      }
    }

    const newProduct: Product = {
      id: `prod${Date.now()}`,
      name: newProductName,
      category: newProductCategory,
      createdDate: new Date().toISOString(),
      status: 'active',
      customAttributes: [...DEFAULT_CATA_ATTRIBUTES],
      isMultiSample: productType === 'multi',
      samples: productType === 'multi' ? samples.filter(s => s.code && s.label) : undefined
    };

    setPendingProduct(newProduct);
    setShowConfirmation(true);
  };

  const confirmCreateProduct = () => {
    if (!pendingProduct) return;
    
    // Move to configuration step
    setConfirmationStep('configure');
  };

  const finalizeProductCreation = async () => {
    if (!pendingProduct) return;
    setMutationError('');
    try {
      await insertProductMutation.mutateAsync({
        name: pendingProduct.name,
        category: pendingProduct.category,
        status: 'active',
        customAttributes: customAttributes,
        isMultiSample: pendingProduct.isMultiSample,
        samples: pendingProduct.samples,
      });
      setNewProductName('');
      setNewProductCategory('');
      setShowConfirmation(false);
      setPendingProduct(null);
      setConfirmationStep('review');
      setCustomAttributes([...DEFAULT_CATA_ATTRIBUTES]);
      setProductType('single');
      setSamples([{ id: '1', code: '', label: '' }]);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to create product. Please try again.');
    }
  };

  const cancelCreateProduct = () => {
    setShowConfirmation(false);
    setPendingProduct(null);
    setConfirmationStep('review');
    setCustomAttributes([...DEFAULT_CATA_ATTRIBUTES]);
    setProductType('single');
    setSamples([{ id: '1', code: '', label: '' }]);
  };

  const handleSaveAttributes = async () => {
    if (!selectedProduct) return;
    setMutationError('');
    try {
      await updateProductMutation.mutateAsync({ id: selectedProduct, updates: { customAttributes } });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to save attributes. Please try again.');
    }
  };

  const handleToggleAttribute = (attr: string) => {
    setCustomAttributes(prev =>
      prev.includes(attr) 
        ? prev.filter(a => a !== attr)
        : [...prev, attr]
    );
  };

  const handleAddCustomAttribute = () => {
    if (!newAttribute || customAttributes.includes(newAttribute)) return;
    setCustomAttributes(prev => [...prev, newAttribute]);
    setNewAttribute('');
  };

  const handleRemoveAttribute = (attr: string) => {
    setCustomAttributes(prev => prev.filter(a => a !== attr));
  };

  const handleToggleProductStatus = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const newStatus: 'active' | 'completed' = product.status === 'active' ? 'completed' : 'active';
    setMutationError('');
    try {
      await updateProductMutation.mutateAsync({ id: productId, updates: { status: newStatus } });
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to update product status. Please try again.');
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName || customAttributes.length === 0) return;
    setMutationError('');
    try {
      await insertTemplateMutation.mutateAsync({ name: templateName, attributes: customAttributes });
      setTemplateName('');
      setShowTemplateSave(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to save template. Please try again.');
    }
  };

  const handleLoadTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template || !selectedProduct) return;
    setMutationError('');
    try {
      await updateProductMutation.mutateAsync({ id: selectedProduct, updates: { customAttributes: template.attributes } });
      setCustomAttributes(template.attributes);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to apply template. Please try again.');
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Product Configuration</h1>
        <p className="text-sm text-slate-500 mt-1">Manage products, questionnaire attributes, and panelists</p>
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

      {/* Create New Product */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-5 text-slate-600" />
            Create New Product for Evaluation
          </CardTitle>
          <p className="text-sm text-slate-600">Add a new plant-based cheese sample to evaluate with panelists</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product Type Toggle */}
          <div className="space-y-3">
            <Label className="text-base font-bold text-slate-900">Product Type</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setProductType('single')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  productType === 'single'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-200 hover:border-blue-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    productType === 'single' ? 'bg-blue-600' : 'bg-slate-200'
                  }`}>
                    <ClipboardList className={`size-5 ${productType === 'single' ? 'text-white' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 mb-1">Single Sample</div>
                    <p className="text-xs text-slate-600">
                      One product evaluation with CATA, intensity, hedonic, and emotional response
                    </p>
                  </div>
                </div>
                {productType === 'single' && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-blue-700 font-medium">
                    <CheckCircle2 className="size-3" />
                    Selected
                  </div>
                )}
              </button>

              <button
                onClick={() => setProductType('multi')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  productType === 'multi'
                    ? 'border-purple-600 bg-gradient-to-br from-purple-50 to-pink-50'
                    : 'border-slate-200 hover:border-purple-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    productType === 'multi' ? 'bg-purple-600' : 'bg-slate-200'
                  }`}>
                    <Layers className={`size-5 ${productType === 'multi' ? 'text-white' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 mb-1">Multi-Sample Comparison</div>
                    <p className="text-xs text-slate-600">
                      Compare samples with discrimination test and preference ranking
                    </p>
                  </div>
                </div>
                {productType === 'multi' && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-purple-700 font-medium">
                    <CheckCircle2 className="size-3" />
                    Selected
                  </div>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="productName">Product Name</Label>
              <Input
                id="productName"
                placeholder={productType === 'single' ? 'e.g., Coconut Cheddar v3.0' : 'e.g., Coconut Cheddar Comparison'}
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="productCategory">Category</Label>
              <Input
                id="productCategory"
                placeholder={productType === 'single' ? 'e.g., Coconut-based' : 'e.g., Multi-sample comparison'}
                value={newProductCategory}
                onChange={(e) => setNewProductCategory(e.target.value)}
              />
            </div>
          </div>

          {/* Multi-Sample Configuration */}
          {productType === 'multi' && (
            <div className="space-y-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold text-purple-900">Sample Configuration</Label>
                <Button size="sm" onClick={handleAddSample} variant="outline">
                  <Plus className="size-4 mr-1" />
                  Add Sample
                </Button>
              </div>
              <p className="text-xs text-slate-600">
                Define each sample with a 3-digit code and descriptive label. Minimum 2 samples required.
              </p>
              <div className="space-y-2">
                {samples.map((sample, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-white rounded border border-purple-200">
                    <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {index + 1}
                    </div>
                    <Input
                      placeholder="3-digit code (e.g., 341)"
                      value={sample.code}
                      onChange={(e) => handleUpdateSample(index, 'code', e.target.value)}
                      className="w-32"
                      maxLength={3}
                    />
                    <Input
                      placeholder="Sample label (e.g., Coconut Cheddar v2.0)"
                      value={sample.label}
                      onChange={(e) => handleUpdateSample(index, 'label', e.target.value)}
                      className="flex-1"
                    />
                    {samples.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveSample(index)}
                        className="text-rose-600 hover:text-rose-700"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Summary */}
              {samples.filter(s => s.code && s.label).length >= 2 && (
                <div className="mt-3 p-3 bg-white rounded-lg border-2 border-purple-300">
                  <div className="text-xs font-bold text-purple-900 mb-2">Multi-Sample Evaluation Flow:</div>
                  <div className="space-y-1 text-xs text-slate-700">
                    <p>✓ Panelists will evaluate <strong>{samples.filter(s => s.code && s.label).length} samples</strong> sequentially</p>
                    <p>✓ Each sample gets full questionnaire (CATA + Intensity + Hedonic + Emotions)</p>
                    <p>✓ Discrimination test: Identify which sample is different</p>
                    <p>✓ Preference ranking: Rank from best to worst</p>
                    <p className="text-slate-500 mt-2">Est. time: {15 + (samples.filter(s => s.code && s.label).length - 3) * 5}-{20 + (samples.filter(s => s.code && s.label).length - 3) * 5} minutes</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <Button
            onClick={handleCreateProduct}
            className={`w-full text-base py-6 ${productType === 'multi' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            disabled={!newProductName || !newProductCategory}
          >
            {productType === 'multi' ? <Layers className="size-5 mr-2" /> : <Plus className="size-5 mr-2" />}
            Create {productType === 'multi' ? 'Multi-Sample ' : ''}Product & Open for Evaluation
          </Button>
        </CardContent>
      </Card>

      {/* Products + Attribute Config (2-column master-detail) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="size-5 text-blue-600" />
            Products & Questionnaire Setup
          </CardTitle>
          <p className="text-sm text-slate-600">Select a product to configure its questionnaire attributes</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-5">
            {/* Left: product list */}
            <div className="col-span-2 space-y-2">
              {products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <ClipboardList className="size-10 mb-2 opacity-40" />
                  <p className="text-sm">No products yet — create one above</p>
                </div>
              ) : products.map(product => (
              <div
                key={product.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  product.isMultiSample
                    ? selectedProduct === product.id
                      ? 'border-purple-600 bg-gradient-to-br from-purple-50 to-pink-50'
                      : 'border-purple-200 bg-purple-50/30 hover:border-purple-400'
                    : selectedProduct === product.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 hover:border-blue-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          product.isMultiSample ? 'bg-purple-600' : 'bg-blue-600'
                        }`}
                      >
                        {product.isMultiSample ? (
                          <Layers className="size-6 text-white" />
                        ) : (
                          <ClipboardList className="size-6 text-white" />
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedProduct(product.id)}
                        className="text-left flex-1"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-bold text-slate-900 text-lg">{product.name}</div>
                          {product.isMultiSample && (
                            <Badge className="bg-purple-600 text-xs">
                              <Layers className="size-3 mr-1" />
                              Multi-Sample
                            </Badge>
                          )}
                          <Badge className={product.status === 'active' ? 'bg-emerald-600' : 'bg-slate-400'}>
                            {product.status === 'active' ? 'Active' : 'Completed'}
                          </Badge>
                        </div>
                        <div className="text-sm text-slate-600">{product.category}</div>
                        {product.isMultiSample && product.samples && (
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                            <span>{product.samples.length} samples</span>
                            <span>·</span>
                            <span>Discrimination + Ranking</span>
                          </div>
                        )}
                        <div className="text-xs text-slate-500 mt-1">Created {new Date(product.createdDate).toLocaleDateString()}</div>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleProductStatus(product.id)}
                      className={product.status === 'active' ? '' : 'border-emerald-600 text-emerald-700'}
                    >
                      {product.status === 'active' ? 'Mark Complete' : 'Reopen'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setSelectedProduct(product.id)}
                      className={product.isMultiSample ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}
                    >
                      <Settings className="size-4 mr-1" />
                      Configure
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            </div>

            {/* Right: attribute config + templates */}
            <div className="col-span-3 border-l border-slate-100 pl-5 space-y-4 overflow-y-auto max-h-[640px]">
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
                        <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => setCustomAttributes([...DEFAULT_CATA_ATTRIBUTES])}>Reset</Button>
                        <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => setCustomAttributes([])}>Clear</Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                      {DEFAULT_CATA_ATTRIBUTES.map(attr => (
                        <div key={attr} className="flex items-center gap-1.5 p-1.5 bg-white rounded border border-slate-200">
                          <Checkbox id={`rp-${attr}`} checked={customAttributes.includes(attr)} onCheckedChange={() => handleToggleAttribute(attr)} />
                          <Label htmlFor={`rp-${attr}`} className="text-xs cursor-pointer">{attr}</Label>
                        </div>
                      ))}
                      {customAttributes.filter(attr => !DEFAULT_CATA_ATTRIBUTES.includes(attr)).map(attr => (
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
                    <Save className="size-4 mr-2" />
                    Save Attributes
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
                            <button
                              onClick={() => handleLoadTemplate(t.id)}
                              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 flex-shrink-0"
                            >
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
        </CardContent>
      </Card>

      {/* Panelists */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-slate-600" />
            Panelists ({panelists.length})
          </CardTitle>
          <p className="text-sm text-slate-600">Manage panelist IDs and view session counts</p>
        </CardHeader>
        <CardContent>
          {panelists.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Users className="size-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No panelists yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Panelist ID</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sessions</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reliability</th>
                    <th className="py-2 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {panelists.map(p => {
                    const rel = reliability.find(r => r.userId === p.id);
                    return (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 px-3 font-medium text-slate-900">{p.name}</td>
                        <td className="py-2 px-3">
                          {editingPanelistId === p.id ? (
                            <div className="flex gap-2">
                              <Input
                                value={panelistIdInput}
                                onChange={e => setPanelistIdInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSavePanelistId(p.id)}
                                className="h-7 text-xs w-28"
                                autoFocus
                              />
                              <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => handleSavePanelistId(p.id)}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingPanelistId(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <span className={`font-mono text-xs ${p.panelistId ? 'text-slate-700' : 'text-slate-400 italic'}`}>
                              {p.panelistId ?? 'not set'}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{p.completedCount}</td>
                        <td className="py-2 px-3">
                          {rel?.meanDeviation != null ? (
                            <Badge className={`text-xs ${rel.meanDeviation < 1.5 ? 'bg-emerald-100 text-emerald-800' : rel.meanDeviation < 2.5 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                              {rel.meanDeviation.toFixed(2)}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400">–</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {editingPanelistId !== p.id && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleEditPanelistId(p.id, p.panelistId)}>Edit ID</Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      {showConfirmation && pendingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl shadow-xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="bg-white border-b sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {confirmationStep === 'review' && (
                    <>
                      <CheckCircle2 className="size-6 text-purple-600" />
                      Step 1: Review Product Details
                    </>
                  )}
                  {confirmationStep === 'configure' && (
                    <>
                      <Settings className="size-6 text-purple-600" />
                      Step 2: Configure Questionnaire
                    </>
                  )}
                </CardTitle>
                <Badge className="bg-purple-600">
                  {confirmationStep === 'review' ? '1 of 2' : '2 of 2'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {confirmationStep === 'review' && (
                <>
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-sm text-slate-600 mb-1">Product Name</div>
                      <div className="font-bold text-slate-900 text-xl flex items-center gap-2">
                        {pendingProduct.name}
                        {pendingProduct.isMultiSample && (
                          <Badge className="bg-purple-600">
                            <Layers className="size-3 mr-1" />
                            Multi-Sample
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-sm text-slate-600 mb-1">Category</div>
                      <div className="font-bold text-slate-900 text-xl">{pendingProduct.category}</div>
                    </div>

                    {/* Show samples for multi-sample products */}
                    {pendingProduct.isMultiSample && pendingProduct.samples && (
                      <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-300">
                        <div className="text-sm font-bold text-purple-900 mb-3">Samples ({pendingProduct.samples.length})</div>
                        <div className="space-y-2">
                          {pendingProduct.samples.map((sample, idx) => (
                            <div key={sample.id} className="flex items-center gap-3 p-3 bg-white rounded border border-purple-200">
                              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                                {idx + 1}
                              </div>
                              <div className="flex-1">
                                <div className="font-bold text-slate-900">Code: {sample.code}</div>
                                <div className="text-sm text-slate-600">{sample.label}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-sm font-semibold text-slate-700 mb-3">What happens next</div>
                      <ul className="text-sm text-slate-600 space-y-2">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="size-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span>Product will be created and set to "Open for Evaluation"</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="size-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span>You'll configure which attributes panelists will evaluate</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="size-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span>
                            Panelists will {pendingProduct.isMultiSample ? 'evaluate each sample and rank them' : 'see this product in their questionnaire'}
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={cancelCreateProduct}
                      className="flex-1"
                      size="lg"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={confirmCreateProduct}
                      className="flex-1 bg-purple-600 hover:bg-purple-700"
                      size="lg"
                    >
                      Next: Configure Questionnaire
                      <Settings className="size-4 ml-2" />
                    </Button>
                  </div>
                </>
              )}

              {confirmationStep === 'configure' && (
                <>
                  <div className="space-y-6">
                    <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                      <div className="text-sm font-semibold text-purple-900 mb-1">Configuring:</div>
                      <div className="font-bold text-purple-900 text-lg flex items-center gap-2">
                        {pendingProduct.name}
                        {pendingProduct.isMultiSample && (
                          <Badge className="bg-purple-600">
                            <Layers className="size-3 mr-1" />
                            Multi-Sample
                          </Badge>
                        )}
                      </div>
                      {pendingProduct.isMultiSample && (
                        <div className="text-xs text-purple-700 mt-2">
                          All {pendingProduct.samples?.length} samples will use the same questionnaire attributes
                        </div>
                      )}
                    </div>

                    {/* Add Custom Attribute */}
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <Label htmlFor="newAttrModal" className="text-sm font-bold text-blue-900 mb-2 block">
                        Add Product-Specific Attribute
                      </Label>
                      <p className="text-xs text-slate-600 mb-3">Add custom attributes relevant to this specific product (e.g., "Smoky" for smoked varieties)</p>
                      <div className="flex gap-2">
                        <Input
                          id="newAttrModal"
                          placeholder="e.g., Smoky, Herbal, Peppery, Aged"
                          value={newAttribute}
                          onChange={(e) => setNewAttribute(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddCustomAttribute()}
                        />
                        <Button onClick={handleAddCustomAttribute} className="bg-blue-600 hover:bg-blue-700">
                          <Plus className="size-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>

                    {/* Attribute Selection */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-base font-bold text-slate-900">
                          Select Questionnaire Attributes ({customAttributes.length} selected)
                        </Label>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setCustomAttributes([...DEFAULT_CATA_ATTRIBUTES])}
                          >
                            Reset to Default
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setCustomAttributes([])}
                          >
                            Clear All
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3 max-h-80 overflow-y-auto p-4 bg-slate-50 rounded-lg border border-slate-200">
                        {/* Default attributes */}
                        {DEFAULT_CATA_ATTRIBUTES.map(attr => (
                          <div key={attr} className="flex items-center space-x-2 p-2 bg-white rounded border border-slate-200">
                            <Checkbox
                              id={`attr-modal-${attr}`}
                              checked={customAttributes.includes(attr)}
                              onCheckedChange={() => handleToggleAttribute(attr)}
                            />
                            <Label htmlFor={`attr-modal-${attr}`} className="text-sm cursor-pointer flex-1">
                              {attr}
                            </Label>
                          </div>
                        ))}
                        
                        {/* Custom attributes */}
                        {customAttributes
                          .filter(attr => !DEFAULT_CATA_ATTRIBUTES.includes(attr))
                          .map(attr => (
                            <div key={attr} className="flex items-center space-x-2 p-2 bg-purple-50 rounded border-2 border-purple-300">
                              <Checkbox
                                id={`attr-modal-${attr}`}
                                checked={true}
                                disabled
                              />
                              <Label htmlFor={`attr-modal-${attr}`} className="text-sm flex-1 font-medium text-purple-900">
                                {attr}
                              </Label>
                              <button
                                onClick={() => handleRemoveAttribute(attr)}
                                className="text-rose-600 hover:text-rose-700"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="size-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-emerald-900">
                          <strong>Ready to finalize:</strong> Your product will be created with {customAttributes.length} attributes. Panelists will see these attributes when evaluating {pendingProduct.name}.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={cancelCreateProduct}
                      className="flex-1"
                      size="lg"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={finalizeProductCreation}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      size="lg"
                    >
                      <Save className="size-5 mr-2" />
                      Create Product & Save Configuration
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}