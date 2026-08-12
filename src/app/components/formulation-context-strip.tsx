import { AlertTriangle, Beaker, CheckCircle2, PackageCheck, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { compareFormulationVersions, formulationReadiness, verifiedAllergenTags } from '../lib/formulation-profile';
import { useFormulationVersions } from '../lib/hooks';
import { projectPath } from '../lib/project-journey-routes';

type FormulationContext = 'overview' | 'ship-outs' | 'insights' | 'decision' | 'concept' | 'report';

const CONTEXT_COPY: Record<FormulationContext, { title: string; description: string }> = {
  overview: {
    title: 'Formulation readiness',
    description: 'Link and review the exact formulation once here so downstream interpretation, safety, concept, and report work share the same version.',
  },
  'ship-outs': {
    title: 'Formulation safety check',
    description: 'Packing and participant instructions may use verified allergen flags only.',
  },
  insights: {
    title: 'Formulation context',
    description: 'Use ingredient changes to explain patterns worth testing—not to imply causation from correlation.',
  },
  decision: {
    title: 'Formulation snapshot',
    description: 'This context can guide TWEAK work; it does not alter the deterministic GO / TWEAK / STOP result.',
  },
  concept: {
    title: 'Ingredient-led positioning',
    description: 'Reviewed ingredients can inspire positioning. Product claims still need direct supporting evidence.',
  },
  report: {
    title: 'Formulation traceability',
    description: 'Reports should name the reviewed formulation version and surface unresolved supplier or safety gaps.',
  },
};

export function FormulationContextStrip({
  projectId,
  sampleId,
  formulationVersionId,
  context,
  prominent = false,
}: {
  projectId?: string | null;
  sampleId?: string | null;
  formulationVersionId?: string | null;
  context: FormulationContext;
  prominent?: boolean;
}) {
  const { data: allVersions = [], isLoading } = useFormulationVersions(undefined, Boolean(projectId || sampleId));
  const versions = allVersions.filter(version => (
    (!formulationVersionId || version.id === formulationVersionId)
    &&
    (!projectId || version.projectId === projectId || version.importBatchId === projectId)
    && (!sampleId || version.sampleId === sampleId)
  ));
  const current = formulationVersionId ? versions : versions.filter(version => version.isCurrent);
  const reviewed = current.filter(version => version.reviewStatus === 'reviewed');
  const allergenTags = [...new Set(reviewed.flatMap(version => verifiedAllergenTags(version)))].sort();
  const ingredientNames = [...new Set(reviewed.flatMap(version => version.ingredients
    .filter(ingredient => ingredient.reviewStatus === 'verified')
    .map(ingredient => ingredient.canonicalName)))].slice(0, 6);
  const incomplete = current.filter(version => formulationReadiness(version).status !== 'verified').length;
  const focusedCurrent = current[0] ?? null;
  const focusedPrevious = focusedCurrent
    ? versions.find(version => (
      version.sampleId === focusedCurrent.sampleId
      && version.versionNumber === focusedCurrent.versionNumber - 1
    )) ?? null
    : null;
  const formulationChanges = focusedCurrent && focusedPrevious
    ? compareFormulationVersions(focusedCurrent, focusedPrevious)
    : null;
  const copy = CONTEXT_COPY[context];

  if (!projectId && !sampleId) return null;

  if (!isLoading && current.length === 0 && !prominent) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-200 py-2" aria-label="Formulation status">
        <p className="flex items-center gap-2 text-xs text-slate-600">
          <AlertTriangle className="size-3.5 shrink-0 text-amber-700" aria-hidden />
          <span><strong>Formulation not linked.</strong> Conclusions remain product-level until the exact version is recorded.</span>
        </p>
        <Link
          to={projectPath(projectId ?? sampleId!, 'data')}
          className="text-xs font-semibold text-slate-800 underline decoration-slate-300 underline-offset-4 hover:text-slate-950"
        >
          Add in Data
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white px-4 py-3" aria-label={copy.title}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`mt-0.5 rounded-md p-1.5 ${reviewed.length > 0 && incomplete === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {context === 'ship-outs' ? <PackageCheck className="size-4" /> : <Beaker className="size-4" />}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">{copy.title}</h2>
              {!isLoading && current.length > 0 && (
                <span className="text-[11px] font-semibold text-slate-500">
                  {reviewed.length}/{current.length} current formulation{current.length === 1 ? '' : 's'} reviewed
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs leading-5 text-slate-600">{copy.description}</p>
            {reviewed.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
                <span><strong className="text-slate-900">Versions:</strong> {reviewed.map(version => `${version.sampleName ?? version.sampleId} v${version.versionNumber}`).join(', ')}</span>
                {ingredientNames.length > 0 && <span><strong className="text-slate-900">Reviewed ingredients:</strong> {ingredientNames.join(', ')}</span>}
                {context === 'ship-outs' && (
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="size-3.5 text-emerald-700" />
                    <strong className="text-slate-900">Verified allergens:</strong> {allergenTags.join(', ') || 'None recorded'}
                  </span>
                )}
              </div>
            )}
            {(context === 'insights' || context === 'decision') && formulationChanges && (
              <p className="mt-2 text-xs leading-5 text-slate-700">
                <strong className="text-slate-900">Change from v{focusedPrevious?.versionNumber}:</strong>{' '}
                {[
                  formulationChanges.added.length ? `added ${formulationChanges.added.join(', ')}` : null,
                  formulationChanges.removed.length ? `removed ${formulationChanges.removed.join(', ')}` : null,
                  formulationChanges.reordered.length ? `reordered ${formulationChanges.reordered.join(', ')}` : null,
                ].filter(Boolean).join('; ') || 'no ingredient-list difference detected'}.
              </p>
            )}
          </div>
        </div>
        {(projectId || current[0]?.projectId || current[0]?.importBatchId) && (
          <Link
            to={projectPath(projectId ?? current[0]?.projectId ?? current[0]!.importBatchId, 'data')}
            className="shrink-0 text-xs font-bold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950"
          >
            Review in Data
          </Link>
        )}
      </div>

      {!isLoading && current.length === 0 && prominent && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> No versioned formulation is linked yet. Add the exact ingredient statement in Data.
        </p>
      )}
      {!isLoading && incomplete > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {incomplete} formulation{incomplete === 1 ? '' : 's'} still need human review; suggested flags cannot drive safety or claims.
        </p>
      )}
      {!isLoading && current.length > 0 && incomplete === 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="size-3.5" /> Reviewed formulation evidence is available for this workflow step.
        </p>
      )}
    </section>
  );
}
