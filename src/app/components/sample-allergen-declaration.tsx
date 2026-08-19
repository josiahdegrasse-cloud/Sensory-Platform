import { useMemo, useState } from 'react';
import { CheckCircle2, FlaskConical, ShieldCheck } from 'lucide-react';
import { ALLERGEN_OPTIONS, ALLERGEN_LABELS, splitOtherAvoidances, type AllergenCode } from '../lib/allergen-eligibility';
import {
  useSampleAllergenDeclaration,
  useSampleAllergenDeclarationsForProducts,
  useSaveSampleAllergenDeclaration,
  useSaveSampleAllergenDeclarationsForProducts,
} from '../lib/hooks';
import type { SampleAllergenDeclaration, SampleEligibilityTarget } from '../lib/database';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

export function SampleAllergenDeclarationEditor({
  target,
  sampleName,
  sourceIngredientStatement = '',
  suggestedAllergens = [],
  compact = false,
}: {
  target: SampleEligibilityTarget;
  sampleName: string;
  sourceIngredientStatement?: string;
  suggestedAllergens?: AllergenCode[];
  compact?: boolean;
}) {
  const { data: declaration, isLoading } = useSampleAllergenDeclaration(target);
  const saveDeclaration = useSaveSampleAllergenDeclaration(target);
  if (isLoading) {
    return <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4"><p className="text-sm font-semibold text-slate-900">Exact-sample allergen declaration</p><Badge variant="outline">Checking…</Badge></div>;
  }
  return (
    <SampleAllergenDeclarationForm
      key={declaration?.id ?? `new-${target.productId ?? target.formulationVersionId}`}
      sampleName={sampleName}
      sourceIngredientStatement={sourceIngredientStatement}
      suggestedAllergens={suggestedAllergens}
      compact={compact}
      declaration={declaration}
      formId={target.productId ?? target.formulationVersionId ?? 'sample'}
      saveDeclaration={input => saveDeclaration.mutateAsync({ ...target, ...input })}
      isSaving={saveDeclaration.isPending}
    />
  );
}

export function BatchSampleAllergenDeclarationEditor({
  productIds,
  sampleName,
}: {
  productIds: string[];
  sampleName: string;
}) {
  const { data: declarations = [], isLoading } = useSampleAllergenDeclarationsForProducts(productIds);
  const saveDeclarations = useSaveSampleAllergenDeclarationsForProducts(productIds);
  if (isLoading) {
    return <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4"><p className="text-sm font-semibold text-slate-900">Sample allergen declaration</p><Badge variant="outline">Checking…</Badge></div>;
  }

  const seed = declarations[0];
  const allVerified = productIds.length > 0 && productIds.every(productId => (
    declarations.some(declaration => declaration.productId === productId && declaration.status === 'verified')
  ));
  const declaration = seed ? { ...seed, status: allVerified ? 'verified' as const : 'draft' as const } : null;

  return (
    <SampleAllergenDeclarationForm
      key={`${declaration?.id ?? 'new-batch'}-${productIds.join('-')}`}
      sampleName={sampleName}
      sourceIngredientStatement=""
      suggestedAllergens={[]}
      compact
      declaration={declaration}
      formId={`batch-${productIds[0] ?? 'sample'}`}
      title="Allergen check for this sample"
      description={`Check the imported sample once. This declaration will be applied to all ${productIds.length} survey${productIds.length === 1 ? '' : 's'} created from it.`}
      draftLabel="Save for all surveys"
      verifyLabel="Verify for all surveys"
      successMessage={`Declaration applied to all ${productIds.length} survey${productIds.length === 1 ? '' : 's'}. The eligible panel has been recalculated.`}
      saveDeclaration={input => saveDeclarations.mutateAsync(input)}
      isSaving={saveDeclarations.isPending}
    />
  );
}

type AllergenDeclarationInput = {
  containsAllergens: AllergenCode[];
  mayContainAllergens: AllergenCode[];
  otherAllergens: string[];
  ingredientStatement?: string | null;
  verify: boolean;
};

function SampleAllergenDeclarationForm({
  sampleName,
  sourceIngredientStatement,
  suggestedAllergens,
  compact,
  declaration,
  formId,
  title = 'Exact-sample allergen declaration',
  description,
  draftLabel = 'Save draft',
  verifyLabel = 'Verify declaration',
  successMessage,
  saveDeclaration,
  isSaving,
}: {
  sampleName: string;
  sourceIngredientStatement: string;
  suggestedAllergens: AllergenCode[];
  compact: boolean;
  declaration: SampleAllergenDeclaration | null | undefined;
  formId: string;
  title?: string;
  description?: string;
  draftLabel?: string;
  verifyLabel?: string;
  successMessage?: string;
  saveDeclaration: (input: AllergenDeclarationInput) => Promise<unknown>;
  isSaving: boolean;
}) {
  const [contains, setContains] = useState<AllergenCode[]>(declaration?.containsAllergens ?? suggestedAllergens);
  const [mayContain, setMayContain] = useState<AllergenCode[]>(declaration?.mayContainAllergens ?? []);
  const [other, setOther] = useState(declaration?.otherAllergens.join(', ') ?? '');
  const [ingredientStatement, setIngredientStatement] = useState(declaration?.ingredientStatement ?? sourceIngredientStatement);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedCount = contains.length + mayContain.length + splitOtherAvoidances(other).length;
  const declarationSummary = useMemo(() => [
    ...contains.map(code => ALLERGEN_LABELS[code]),
    ...mayContain.map(code => `${ALLERGEN_LABELS[code]} (may contain)`),
    ...splitOtherAvoidances(other),
  ], [contains, mayContain, other]);

  const toggle = (code: AllergenCode, field: 'contains' | 'mayContain') => {
    setReviewed(false);
    setMessage('');
    if (field === 'contains') {
      setContains(current => current.includes(code) ? current.filter(item => item !== code) : [...current, code]);
      setMayContain(current => current.filter(item => item !== code));
    } else {
      setMayContain(current => current.includes(code) ? current.filter(item => item !== code) : [...current, code]);
      setContains(current => current.filter(item => item !== code));
    }
  };

  const save = async (verify: boolean) => {
    setError('');
    setMessage('');
    if (verify && !reviewed) {
      setError('Confirm that you checked the declaration against the exact sample before verifying it.');
      return;
    }
    try {
      await saveDeclaration({
        containsAllergens: contains,
        mayContainAllergens: mayContain,
        otherAllergens: splitOtherAvoidances(other),
        ingredientStatement,
        verify,
      });
      setReviewed(false);
      setMessage(verify ? (successMessage ?? 'Declaration verified. The eligible panel has been recalculated.') : 'Draft declaration saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save the declaration.');
    }
  };

  return (
    <section className="space-y-4" aria-labelledby={`allergen-declaration-${formId}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-4 text-slate-600" aria-hidden />
            <h3 id={`allergen-declaration-${formId}`} className="text-sm font-semibold text-slate-950">{title}</h3>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description ?? <>Record the label or recipe used for <strong className="font-semibold text-slate-800">{sampleName}</strong>. Eligibility is calculated only from a verified declaration.</>}</p>
        </div>
        {declaration?.status === 'verified' ? (
          <Badge className="w-fit border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50"><ShieldCheck className="mr-1 size-3.5" aria-hidden />Verified v{declaration.version}</Badge>
        ) : (
          <Badge className="w-fit border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-50">Review required</Badge>
        )}
      </div>

      {!compact && (
        <div className="space-y-1.5">
          <Label htmlFor={`ingredient-statement-${formId}`}>Ingredient or label statement</Label>
          <Textarea
            id={`ingredient-statement-${formId}`}
            value={ingredientStatement}
            onChange={event => { setIngredientStatement(event.target.value); setReviewed(false); }}
            placeholder="Paste the statement from the exact product label, recipe or approved specification."
            className="min-h-24 bg-white text-sm leading-6"
          />
        </div>
      )}

      <div>
        <div className="grid grid-cols-[minmax(0,1fr)_84px_100px] gap-2 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Regulated allergen</span><span className="text-center">Contains</span><span className="text-center">May contain</span>
        </div>
        <div className="divide-y divide-slate-100">
          {ALLERGEN_OPTIONS.map(option => (
            <div key={option.code} className="grid grid-cols-[minmax(0,1fr)_84px_100px] items-center gap-2 py-2.5">
              <span className="min-w-0 text-sm text-slate-800"><strong className="font-medium">{option.label}</strong>{'detail' in option && option.detail && <span className="mt-0.5 block text-xs leading-4 text-slate-500">{option.detail}</span>}</span>
              <span className="flex justify-center"><Checkbox checked={contains.includes(option.code)} onCheckedChange={() => toggle(option.code, 'contains')} aria-label={`${option.label}: contains`} /></span>
              <span className="flex justify-center"><Checkbox checked={mayContain.includes(option.code)} onCheckedChange={() => toggle(option.code, 'mayContain')} aria-label={`${option.label}: may contain`} /></span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`other-allergens-${formId}`}>Other declared allergens or avoidance ingredients <span className="font-normal text-slate-500">(optional)</span></Label>
        <Textarea id={`other-allergens-${formId}`} value={other} onChange={event => { setOther(event.target.value); setReviewed(false); }} placeholder="For example: kiwi, buckwheat" className="min-h-16 bg-white" />
        <p className="text-xs leading-5 text-slate-500">Separate entries with commas. These are matched conservatively against panelists’ own declarations.</p>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <label htmlFor={`allergen-reviewed-${formId}`} className="flex cursor-pointer items-start gap-3 text-sm leading-5 text-slate-700">
          <Checkbox id={`allergen-reviewed-${formId}`} checked={reviewed} onCheckedChange={value => setReviewed(value === true)} className="mt-0.5" />
          <span>I checked this against the exact sample being sent, including precautionary “may contain” wording. {selectedCount === 0 && 'This sample has no declared allergens.'}</span>
        </label>
        {declarationSummary.length > 0 && <p className="mt-3 text-xs leading-5 text-slate-600"><strong className="text-slate-800">Recorded:</strong> {declarationSummary.join(' · ')}</p>}
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><CheckCircle2 className="size-4 shrink-0" aria-hidden />{message}</div>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => save(false)} disabled={isSaving}>{draftLabel}</Button>
        <Button type="button" onClick={() => save(true)} disabled={isSaving} className="bg-slate-900 hover:bg-slate-800"><ShieldCheck className="size-4" aria-hidden />{isSaving ? 'Saving…' : verifyLabel}</Button>
      </div>
    </section>
  );
}
