import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, ClipboardList, Send, ShieldCheck, Users } from 'lucide-react';
import { getDefaultCataAttributes, type Product } from '../data/survey-domain';
import { notifyPanelistsOfSurveys } from '../lib/database';
import { launchSurveyBatch } from '../lib/launch-survey-batch';
import { DEFAULT_SURVEY_SECTIONS, SURVEY_SECTION_IDS, SURVEY_SECTION_LABELS, toggleSurveySection, type SurveySection } from '../lib/survey-sections';
import {
  useEligiblePanelistsForProducts,
  useSampleAllergenDeclarationsForProducts,
  useUpdateProductAssignments,
  useUpdateProduct,
} from '../lib/hooks';
import { EligiblePanelSummary } from './eligible-panel-summary';
import { BatchSampleAllergenDeclarationEditor } from './sample-allergen-declaration';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';

export function ImportedSurveyBatchConfiguration({
  batchName,
  products,
  onClose,
  onAssigned,
}: {
  batchName: string;
  products: Product[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const productIds = products.map(product => product.id);
  const [step, setStep] = useState(0);
  const [sections, setSections] = useState<SurveySection[]>(products[0]?.surveySections ?? DEFAULT_SURVEY_SECTIONS);
  const [isSending, setIsSending] = useState(false);
  const sending = useRef(false);
  const sentIds = useRef(new Set<string>());
  const [sentCount, setSentCount] = useState(0);
  const updateProduct = useUpdateProduct();
  const steps = ['Sections', 'Allergens', 'Panelists', 'Review', 'Send'];
  const [isEditingAllergens, setIsEditingAllergens] = useState(false);
  const declarationsQuery = useSampleAllergenDeclarationsForProducts(productIds);
  const verifiedIds = new Set((declarationsQuery.data ?? [])
    .filter(declaration => declaration.status === 'verified' && declaration.productId)
    .map(declaration => declaration.productId as string));
  const allVerified = !isEditingAllergens && products.length > 0 && products.every(product => verifiedIds.has(product.id));
  const eligibleQuery = useEligiblePanelistsForProducts(productIds, allVerified);
  const assignPanelists = useUpdateProductAssignments();
  const [selectedPanelistIds, setSelectedPanelistIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const eligiblePanelists = eligibleQuery.data ?? [];
  const eligibleIds = new Set(eligiblePanelists.map(panelist => panelist.id));
  const safeSelectedIds = selectedPanelistIds.filter(id => eligibleIds.has(id));
  const missingAttributes = sections.includes('cata') && products.some(product => (product.customAttributes ?? getDefaultCataAttributes(product.category)).length === 0);
  const sectionsReady = sections.length > 0 && !missingAttributes;
  const panelReady = allVerified && !eligibleQuery.isFetching && !eligibleQuery.isError && safeSelectedIds.length > 0;
  const canContinue = step === 0 ? sectionsReady : step === 1 ? allVerified : sectionsReady && panelReady;

  const assignAll = async () => {
    if (sending.current) return;
    if (!sectionsReady) {
      setError('Choose at least one section and ensure each CATA survey has attributes.');
      return;
    }
    if (!allVerified) {
      setError('Verify the shared allergen declaration before assigning panelists.');
      return;
    }
    if (!panelReady) {
      setError('Choose at least one panelist who is eligible for this sample.');
      return;
    }
    setError('');
    sending.current = true;
    setIsSending(true);
    try {
      const freshDeclarations = await declarationsQuery.refetch();
      const freshPanel = await eligibleQuery.refetch();
      if (freshDeclarations.error || freshPanel.error
        || !productIds.every(id => freshDeclarations.data?.some(item => item.productId === id && item.status === 'verified'))
        || !safeSelectedIds.every(id => freshPanel.data?.some(panelist => panelist.id === id))) {
        throw new Error('Allergen verification or panelist eligibility changed. Go back and review the selection.');
      }
      await launchSurveyBatch({
        products, sections, panelistIds: safeSelectedIds, sentIds: sentIds.current,
        update: (id, updates) => updateProduct.mutateAsync({ id, updates }),
        assign: (ids, panelistIds) => assignPanelists.mutateAsync({ productIds: ids, assignedPanelistIds: panelistIds }),
        onActivated: setSentCount,
      });
      void notifyPanelistsOfSurveys(safeSelectedIds, products.map(product => product.name));
      onAssigned();
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : 'Unable to send the surveys.';
      setError(sentIds.current.size > 0 ? `${sentIds.current.size} of ${products.length} surveys are already active. ${detail} Retry to finish the remaining surveys.` : detail);
    } finally {
      sending.current = false;
      setIsSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && !isSending && onClose()}>
      <DialogContent className="h-[min(94vh,960px)] w-[calc(100vw-2rem)] max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle>Configure all imported surveys</DialogTitle>
          <DialogDescription className="text-slate-600">
            {batchName} · {products.length} survey{products.length === 1 ? '' : 's'}. Step {step + 1} of {steps.length}: {steps[step]}.
          </DialogDescription>
          <ol className="mt-4 grid grid-cols-5 gap-2" aria-label="Survey setup progress">
            {steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} className={`border-t-2 pt-2 text-xs font-semibold ${index === step ? 'border-blue-600 text-blue-800' : index < step ? 'border-emerald-500 text-emerald-800' : 'border-slate-200 text-slate-500'}`}>{index + 1}. {label}</li>)}
          </ol>
        </DialogHeader>

        <div className="min-h-0 space-y-7 overflow-y-auto px-6 py-5">
          {step === 0 && <section aria-labelledby="batch-sections-heading" className="space-y-4">
            <h2 id="batch-sections-heading" className="font-semibold text-slate-950">Choose survey sections</h2>
            <p className="text-sm text-slate-600">These sections apply to all {products.length} surveys. Intensity ratings require flavor and aroma selections (CATA).</p>
            <div className="grid gap-3 sm:grid-cols-2">{SURVEY_SECTION_IDS.map(section => <label key={section} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 ${sections.includes(section) ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
              <Checkbox checked={sections.includes(section)} onCheckedChange={() => setSections(current => toggleSurveySection(current, section))} />
              <span>{SURVEY_SECTION_LABELS[section]}</span>
            </label>)}</div>
            {sections.length === 0 && <p role="alert" className="text-sm text-amber-800">Choose at least one section to continue.</p>}
            {missingAttributes && <p role="alert" className="text-sm text-amber-800">A survey has no CATA attributes. Configure its attributes individually or deselect CATA.</p>}
          </section>}

          <section hidden={step !== 1} aria-labelledby="batch-allergens-heading">
            <h2 id="batch-allergens-heading" className="sr-only">Shared allergen declaration</h2>
            <BatchSampleAllergenDeclarationEditor productIds={productIds} sampleName={batchName} onEditingChange={setIsEditingAllergens} />
          </section>

          <section hidden={step !== 2} aria-labelledby="batch-panel-heading">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 id="batch-panel-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Users className="size-4 text-blue-700" />Assign every survey</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Only panelists eligible for the verified sample can be selected.</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setSelectedPanelistIds(eligiblePanelists.map(panelist => panelist.id))} disabled={!allVerified || eligiblePanelists.length === 0}>Select all eligible</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setSelectedPanelistIds([])} disabled={safeSelectedIds.length === 0}>Clear</Button>
              </div>
            </div>

            {!allVerified ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                Verify the sample allergen declaration to calculate the eligible panel.
              </div>
            ) : eligibleQuery.isError ? (
              <Alert variant="destructive"><AlertDescription>Unable to load eligible panelists. <Button variant="outline" onClick={() => void eligibleQuery.refetch()}>Try again</Button></AlertDescription></Alert>
            ) : eligibleQuery.isFetching ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">Calculating eligibility across all surveys…</div>
            ) : eligiblePanelists.length === 0 ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">No shared eligible panelists</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">No completed panelist profile is currently safe for every food in this import.</p>
              </div>
            ) : (
              <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2 lg:grid-cols-3">
                {eligiblePanelists.map(panelist => {
                  const selected = safeSelectedIds.includes(panelist.id);
                  return (
                    <div key={panelist.id} className={`flex items-start gap-2 rounded-md border px-3 py-2.5 ${selected ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                      <Checkbox
                        id={`batch-panelist-${panelist.id}`}
                        checked={selected}
                        onCheckedChange={() => setSelectedPanelistIds(current => selected ? current.filter(id => id !== panelist.id) : [...current, panelist.id])}
                      />
                      <Label htmlFor={`batch-panelist-${panelist.id}`} className="min-w-0 flex-1 cursor-pointer font-normal">
                        <span className="block truncate text-sm font-medium text-slate-950">{panelist.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{[panelist.panelistId, panelist.ageBand, panelist.region].filter(Boolean).join(' · ')}</span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{panelist.dietaryPattern?.replace(/_/g, ' ') || 'Dietary profile recorded'}</span>
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}
            {allVerified && <div className="mt-4"><EligiblePanelSummary panelists={eligiblePanelists} selectedIds={safeSelectedIds} /></div>}
          </section>

          {step === 3 && <section className="space-y-6" aria-labelledby="batch-review-heading">
            <div>
              <h2 id="batch-review-heading" className="text-xl font-semibold text-slate-950">Review your studies</h2>
              <p className="mt-1 text-sm text-slate-600">Check the content and recipients before sending. Nothing is sent until the final step.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><ClipboardList className="mb-2 size-5 text-blue-700" aria-hidden /><p className="text-2xl font-semibold text-slate-950">{products.length}</p><p className="text-sm text-slate-600">Surveys to send</p></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><Users className="mb-2 size-5 text-blue-700" aria-hidden /><p className="text-2xl font-semibold text-slate-950">{safeSelectedIds.length}</p><p className="text-sm text-slate-600">Panelists per survey</p></div>
              <div className={`rounded-xl border p-4 ${allVerified ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><ShieldCheck className="mb-2 size-5" aria-hidden /><p className="font-semibold">{allVerified ? 'Allergens verified' : 'Review required'}</p><p className="mt-1 text-sm">{allVerified ? 'Declarations saved for every survey' : 'Return to the allergen step'}</p></div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Included in every survey</h3>
              <div className="mt-3 flex flex-wrap gap-2">{sections.map(section => <span key={section} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">{SURVEY_SECTION_LABELS[section]}</span>)}</div>
              <details className="group mt-4 border-t border-slate-100 pt-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-700">View selected panelists ({safeSelectedIds.length})<ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden /></summary>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{eligiblePanelists.filter(panelist => safeSelectedIds.includes(panelist.id)).map(panelist => <li key={panelist.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{panelist.name}</li>)}</ul>
              </details>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Survey previews</h3>
              {products.map((product, index) => <details key={product.id} className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4 hover:bg-slate-50">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600">{index + 1}</span>
                  <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold text-slate-900">{product.name}</span><span className="mt-1 block text-xs text-slate-500">{sections.length} sections · {safeSelectedIds.length} panelists</span></span>
                  <ChevronDown className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <ol className="grid gap-3 border-t border-slate-100 bg-slate-50 p-4 sm:grid-cols-2">{sections.map((section, sectionIndex) => <li key={section} className="rounded-lg border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-semibold text-slate-900"><span className="mr-2 text-slate-400">{sectionIndex + 1}.</span>{SURVEY_SECTION_LABELS[section]}</h4>
                  {section === 'cata' ? <><p className="mt-2 text-xs text-slate-500">Panelists select all attributes that apply.</p><div className="mt-3 flex flex-wrap gap-1.5">{(product.customAttributes ?? getDefaultCataAttributes(product.category)).map(attribute => <span key={attribute} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{attribute}</span>)}</div></> : <p className="mt-2 text-sm leading-6 text-slate-600">{section === 'intensity' ? 'Rate the intensity of the attributes selected in CATA.' : section === 'hedonic' ? 'Rate overall liking, appearance, aroma, flavor, and texture.' : section === 'emotions' ? 'Rate the emotions experienced while tasting the sample.' : 'Add any other comments about the sample.'}</p>}
                </li>)}</ol>
              </details>)}
            </div>
            <p className="text-xs text-slate-500">Use Back to change panelists, allergens or survey sections.</p>
            {!panelReady && <p role="alert" className="text-sm text-amber-800">Return to allergen verification or panelist selection before continuing.</p>}
          </section>}

          {step === 4 && <section className="space-y-4" aria-labelledby="batch-send-heading">
            <h2 id="batch-send-heading" className="font-semibold text-slate-950">Ready to send</h2>
            <p className="text-sm text-slate-700">Make {products.length} surveys available to {safeSelectedIds.length} selected panelists. Each survey includes {sections.map(section => SURVEY_SECTION_LABELS[section]).join(', ')}.</p>
            <p className="text-sm text-slate-600">Surveys appear in their accounts after sending. Email notifications are attempted if configured.</p>
            {sentCount > 0 && <p role="status" className="text-sm text-slate-700">{sentCount} of {products.length} surveys are active.</p>}
          </section>}

          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </div>

        <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSending}>Close</Button>
          {step > 0 && <Button type="button" variant="outline" disabled={isSending || sentCount > 0} onClick={() => { setStep(current => current - 1); setError(''); }}><ArrowLeft className="size-4" />Back</Button>}
          {step < 4 ? <Button type="button" disabled={!canContinue} onClick={() => { setStep(current => current + 1); setError(''); }}>Continue to {steps[step + 1].toLowerCase()}<ArrowRight className="size-4" /></Button> :
            <Button type="button" onClick={assignAll} disabled={!canContinue || isSending} className="bg-slate-900 hover:bg-slate-800"><Send className="size-4" />{isSending ? 'Sending…' : sentCount > 0 ? 'Retry remaining surveys' : `Send ${products.length} surveys`}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
