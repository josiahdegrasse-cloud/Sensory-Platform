import { useMemo, useState } from 'react';
import { AlertTriangle, Check, History, Save, ShieldCheck } from 'lucide-react';
import {
  compareFormulationVersions,
  deriveStructuredIngredients,
  formulationReadiness,
  type FormulationVersion,
  type StructuredIngredient,
} from '../lib/formulation-profile';
import { useReviewFormulationVersion, useUpdateIngredientStatement } from '../lib/hooks';
import { Button } from './ui/button';
import { Input } from './ui/input';

function tagsFromInput(value: string): string[] {
  return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))];
}

export function FormulationProfilePanel({
  importBatchId,
  sampleId,
  versions,
}: {
  importBatchId: string;
  sampleId: string;
  versions: FormulationVersion[];
}) {
  const current = versions.find(version => version.isCurrent) ?? versions[0] ?? null;
  const previous = current
    ? versions.find(version => version.versionNumber === current.versionNumber - 1) ?? null
    : null;
  const initialIngredients = current?.ingredients.length
    ? current.ingredients
    : deriveStructuredIngredients(current?.exactStatement ?? '');
  const [ingredients, setIngredients] = useState<StructuredIngredient[]>(initialIngredients);
  const [changeSummary, setChangeSummary] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const saveProfile = useUpdateIngredientStatement();
  const reviewVersion = useReviewFormulationVersion();
  const readiness = formulationReadiness(current ? { ...current, ingredients } : null);
  const comparison = useMemo(() => current ? compareFormulationVersions(current, previous) : null, [current, previous]);
  const allReviewed = ingredients.length > 0 && ingredients.every(item => item.reviewStatus !== 'suggested');
  const busy = saveProfile.isPending || reviewVersion.isPending;

  if (!current) return null;

  const updateIngredient = (position: number, update: Partial<StructuredIngredient>) => {
    setMessage(null);
    setIngredients(items => items.map(item => item.position === position ? { ...item, ...update } : item));
  };

  const save = async (markReviewed: boolean) => {
    setMessage(null);
    try {
      const versionId = await saveProfile.mutateAsync({
        importBatchId,
        sampleId,
        statement: current.exactStatement,
        ingredients,
        changeSummary,
      });
      if (markReviewed && versionId) {
        await reviewVersion.mutateAsync({ versionId, status: 'reviewed' });
      }
      setMessage(markReviewed ? 'Formulation reviewed and ready for downstream use.' : 'Structured formulation draft saved.');
    } catch {
      setMessage('The formulation profile could not be saved. Your edits are still here.');
    }
  };

  return (
    <section className="mt-4 border-t border-slate-200 pt-4" aria-labelledby="structured-formulation-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="structured-formulation-heading" className="text-sm font-bold text-slate-900">Structured formulation profile</h3>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              Version {current.versionNumber}
            </span>
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
              readiness.status === 'verified'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-800'
            }`}>
              {readiness.label}
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
            Roles, allergens, and dietary flags are review candidates. Only explicit percentages are retained; missing quantities are never estimated.
          </p>
        </div>
        {versions.length > 1 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <History className="size-3.5" /> {versions.length} saved versions
          </span>
        )}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-[940px] w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-3 py-2 font-semibold">#</th>
              <th className="min-w-52 px-3 py-2 font-semibold">Ingredient</th>
              <th className="min-w-36 px-3 py-2 font-semibold">Functional role</th>
              <th className="w-24 px-3 py-2 font-semibold">Explicit %</th>
              <th className="min-w-44 px-3 py-2 font-semibold">Allergen flags</th>
              <th className="min-w-40 px-3 py-2 font-semibold">Supplier / spec</th>
              <th className="w-28 px-3 py-2 font-semibold">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {ingredients.map(ingredient => (
              <tr key={ingredient.position} className="align-top">
                <td className="px-3 py-2.5 font-semibold text-slate-500">{ingredient.position}</td>
                <td className="px-3 py-2.5">
                  <p className="font-semibold leading-5 text-slate-900">{ingredient.suppliedName}</p>
                  <Input
                    value={ingredient.canonicalName}
                    onChange={event => updateIngredient(ingredient.position, { canonicalName: event.target.value, reviewStatus: 'suggested' })}
                    aria-label={`Canonical name for ${ingredient.suppliedName}`}
                    className="mt-1 h-8 text-xs"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Input
                    value={ingredient.functionalRole}
                    onChange={event => updateIngredient(ingredient.position, { functionalRole: event.target.value, reviewStatus: 'suggested' })}
                    aria-label={`Functional role for ${ingredient.suppliedName}`}
                    className="h-8 text-xs"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={ingredient.percentage ?? ''}
                    onChange={event => updateIngredient(ingredient.position, {
                      percentage: event.target.value === '' ? null : Number(event.target.value),
                      reviewStatus: 'suggested',
                    })}
                    placeholder="—"
                    aria-label={`Explicit percentage for ${ingredient.suppliedName}`}
                    className="h-8 text-xs"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Input
                    value={ingredient.allergenTags.join(', ')}
                    onChange={event => updateIngredient(ingredient.position, {
                      allergenTags: tagsFromInput(event.target.value),
                      reviewStatus: 'suggested',
                    })}
                    placeholder="None identified"
                    aria-label={`Allergen flags for ${ingredient.suppliedName}`}
                    className="h-8 text-xs"
                  />
                  {ingredient.dietaryTags.length > 0 && (
                    <p className="mt-1 text-[11px] text-amber-700">{ingredient.dietaryTags.join(', ')}</p>
                  )}
                </td>
                <td className="space-y-1 px-3 py-2.5">
                  <Input
                    value={ingredient.supplier}
                    onChange={event => updateIngredient(ingredient.position, { supplier: event.target.value, reviewStatus: 'suggested' })}
                    placeholder="Supplier"
                    aria-label={`Supplier for ${ingredient.suppliedName}`}
                    className="h-8 text-xs"
                  />
                  <Input
                    value={ingredient.specification}
                    onChange={event => updateIngredient(ingredient.position, { specification: event.target.value, reviewStatus: 'suggested' })}
                    placeholder="Specification"
                    aria-label={`Specification for ${ingredient.suppliedName}`}
                    className="h-8 text-xs"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={ingredient.reviewStatus === 'verified' ? 'default' : 'outline'}
                    onClick={() => updateIngredient(ingredient.position, {
                      reviewStatus: ingredient.reviewStatus === 'verified' ? 'suggested' : 'verified',
                    })}
                    className="h-8 w-full text-xs"
                  >
                    <Check className="size-3.5" />
                    {ingredient.reviewStatus === 'verified' ? 'Verified' : 'Verify'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {comparison && previous && (comparison.added.length > 0 || comparison.removed.length > 0 || comparison.reordered.length > 0) && (
        <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 sm:grid-cols-3">
          <p><span className="font-bold text-slate-900">Added:</span> {comparison.added.join(', ') || 'None'}</p>
          <p><span className="font-bold text-slate-900">Removed:</span> {comparison.removed.join(', ') || 'None'}</p>
          <p><span className="font-bold text-slate-900">Reordered:</span> {comparison.reordered.join(', ') || 'None'}</p>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <label htmlFor="formulation-change-summary" className="text-xs font-semibold text-slate-700">Change note</label>
          <Input
            id="formulation-change-summary"
            value={changeSummary}
            onChange={event => setChangeSummary(event.target.value)}
            placeholder="What changed in this formulation?"
            className="mt-1 h-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void save(false)} disabled={busy}>
            <Save className="size-3.5" /> Save draft
          </Button>
          <Button type="button" size="sm" onClick={() => void save(true)} disabled={busy || !allReviewed}>
            <ShieldCheck className="size-3.5" /> Mark reviewed
          </Button>
        </div>
      </div>

      {!allReviewed && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> Verify or reject every suggested row before this profile can drive shipment safety or external claims.
        </p>
      )}
      {message && <p className="mt-2 text-xs font-semibold text-slate-700" role="status">{message}</p>}
    </section>
  );
}
