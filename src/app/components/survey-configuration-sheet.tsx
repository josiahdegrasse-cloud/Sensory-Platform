import { ArrowRight, Eye, Layers, Lock, PackageCheck, Plus, Rocket, Save, ShieldCheck, Trash2, Users } from 'lucide-react';
import { Link } from 'react-router';
import type { Product } from '../data/survey-domain';
import type { PanelistInfo } from '../lib/database';
import { useEligiblePanelists, useSampleAllergenDeclaration } from '../lib/hooks';
import { SampleAllergenDeclarationEditor } from './sample-allergen-declaration';
import { EligiblePanelSummary } from './eligible-panel-summary';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import { projectStudiesPath } from '../lib/project-journey-routes';
import { SURVEY_SECTION_IDS, SURVEY_SECTION_LABELS, type SurveySection } from '../lib/survey-sections';
import { validateMultiSampleStudy } from '../lib/studies';

export function SurveyConfigurationSheet({
  product,
  shipOutProjectId,
  panelists,
  standardAttributes,
  customAttributes,
  surveySections,
  assignedPanelistIds,
  newAttribute,
  onOpenChange,
  onNewAttributeChange,
  onAddAttribute,
  onRemoveAttribute,
  onToggleAttribute,
  onResetAttributes,
  onClearAttributes,
  onToggleSection,
  onSaveAttributes,
  onPreview,
  onLaunch,
  onSetPanelists,
  saving,
}: {
  product: Product | null;
  shipOutProjectId?: string | null;
  panelists: PanelistInfo[];
  standardAttributes: string[];
  customAttributes: string[];
  surveySections: SurveySection[];
  assignedPanelistIds: string[];
  newAttribute: string;
  onOpenChange: (open: boolean) => void;
  onNewAttributeChange: (value: string) => void;
  onAddAttribute: () => void;
  onRemoveAttribute: (attribute: string) => void;
  onToggleAttribute: (attribute: string) => void;
  onResetAttributes: () => void;
  onClearAttributes: () => void;
  onToggleSection: (section: SurveySection) => void;
  onSaveAttributes: (panelistIds: string[]) => void;
  onPreview: (panelistIds: string[]) => void;
  onLaunch: (panelistIds: string[]) => void;
  onSetPanelists: (panelistIds: string[]) => void;
  saving: boolean;
}) {
  const target = { productId: product?.id ?? null };
  const { data: declaration } = useSampleAllergenDeclaration(target, Boolean(product));
  const { data: eligiblePanelists = [], isLoading: eligibilityLoading } = useEligiblePanelists(target, Boolean(product));
  const eligibleIds = new Set(eligiblePanelists.map(panelist => panelist.id));
  const safeAssignedIds = assignedPanelistIds.filter(id => eligibleIds.has(id));
  const excludedCount = Math.max(0, panelists.length - eligiblePanelists.length);
  const multiSampleBlockers = product?.isMultiSample
    ? validateMultiSampleStudy(product).filter(blocker => blocker.severity === 'blocker').map(blocker => blocker.label)
    : [];
  const launchBlockers = [
    declaration?.status !== 'verified' ? 'Verify the exact-sample allergen declaration.' : null,
    safeAssignedIds.length === 0 ? 'Assign at least one eligible panelist.' : null,
    surveySections.length === 0 ? 'Select at least one questionnaire section.' : null,
    surveySections.includes('cata') && customAttributes.length === 0 ? 'Select at least one CATA attribute.' : null,
    ...multiSampleBlockers,
  ].filter((blocker): blocker is string => Boolean(blocker));

  return (
    <Sheet open={Boolean(product)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <SheetHeader className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <SheetTitle className="text-lg text-slate-900">
              Configure {product?.name ?? 'survey'}
            </SheetTitle>
            {product?.isMultiSample && (
              <Badge className="bg-purple-600">
                <Layers className="mr-1 size-3" aria-hidden />
                Multi-sample
              </Badge>
            )}
            {product?.blinded && (
              <Badge className="bg-slate-900">
                <Lock className="mr-1 size-3" aria-hidden />
                Blinded
              </Badge>
            )}
            {product && (
              <Badge variant="outline" className={product.status === 'active' ? 'border-emerald-300 text-emerald-700' : 'border-slate-300 text-slate-700'}>
                {product.status === 'active' ? 'Active' : product.status === 'completed' ? 'Closed' : 'Draft'}
              </Badge>
            )}
          </div>
          <SheetDescription>
            Configure, preview, and launch in a deliberate sequence. Draft changes are not visible to panelists.
          </SheetDescription>
          <ol className="mt-3 grid grid-cols-4 gap-1" aria-label="Study launch workflow">
            {['Configure', 'Assign', 'Preview', 'Launch'].map((label, index) => (
              <li key={label} className="border-t-2 border-slate-300 pt-1 text-[11px] font-semibold text-slate-600">
                {index + 1}. {label}
              </li>
            ))}
          </ol>
        </SheetHeader>

        {product && (
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {product.blinded && (
              <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4" aria-labelledby="blind-study-heading">
                <h3 id="blind-study-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Lock className="size-4 text-slate-700" aria-hidden />
                  Blind study codes
                </h3>
                <p className="text-sm text-slate-700">
                  Panelists see coded sample identities only. The internal product name, category, and labels remain visible to administrators.
                </p>
                {product.isMultiSample && product.samples?.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {product.samples.map(sample => (
                      <div key={sample.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                        <span className="font-bold tracking-wider text-slate-900">{sample.code}</span>
                        <span className="ml-2 text-slate-700">{sample.label}</span>
                      </div>
                    ))}
                  </div>
                ) : product.blindCode ? (
                  <div className="inline-flex rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                    <span className="text-slate-700">Panelist sample code:</span>
                    <span className="ml-2 font-bold tracking-wider text-slate-900">{product.blindCode}</span>
                  </div>
                ) : null}
              </section>
            )}

            <div className="border-b border-slate-200 pb-6">
              <SampleAllergenDeclarationEditor target={target} sampleName={product.name} />
            </div>

            <section className="space-y-3 border-t border-slate-200 pt-5" aria-labelledby="survey-sections-heading">
              <div>
                <h3 id="survey-sections-heading" className="text-sm font-semibold text-slate-900">Questionnaire sections</h3>
                <p className="mt-1 text-sm text-slate-700">Only selected sections appear to panelists. Intensity requires CATA.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {SURVEY_SECTION_IDS.map(section => (
                  <label key={section} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${surveySections.includes(section) ? 'border-blue-300 bg-blue-50 text-blue-950' : 'border-slate-200 bg-white text-slate-700'}`}>
                    <Checkbox checked={surveySections.includes(section)} onCheckedChange={() => onToggleSection(section)} />
                    <span className="font-medium">{SURVEY_SECTION_LABELS[section]}</span>
                  </label>
                ))}
              </div>
            </section>

            {surveySections.includes('cata') && <section className="space-y-4 border-t border-slate-200 pt-5" aria-labelledby="survey-attributes-heading">
              <div>
                <h3 id="survey-attributes-heading" className="text-sm font-semibold text-slate-900">Survey attributes</h3>
                <p className="mt-1 text-sm text-slate-700">Select the sensory cues included in this questionnaire.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-survey-attribute" className="text-sm font-medium">Add attribute</Label>
                <div className="flex gap-2">
                  <Input
                    id="new-survey-attribute"
                    placeholder="For example: Smoky or Herbal"
                    value={newAttribute}
                    onChange={event => onNewAttributeChange(event.target.value)}
                    onKeyDown={event => event.key === 'Enter' && onAddAttribute()}
                  />
                  <Button type="button" variant="outline" onClick={onAddAttribute} aria-label="Add survey attribute">
                    <Plus className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Label className="text-sm font-medium">Attributes ({customAttributes.length})</Label>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={onResetAttributes}>Reset</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={onClearAttributes}>Clear</Button>
                  </div>
                </div>
                <div className="grid max-h-80 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
                  {standardAttributes.map(attribute => (
                    <div key={attribute} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                      <Checkbox
                        id={`survey-attribute-${attribute}`}
                        checked={customAttributes.includes(attribute)}
                        onCheckedChange={() => onToggleAttribute(attribute)}
                      />
                      <Label htmlFor={`survey-attribute-${attribute}`} className="flex-1 cursor-pointer font-normal">
                        {attribute}
                      </Label>
                    </div>
                  ))}
                  {customAttributes.filter(attribute => !standardAttributes.includes(attribute)).map(attribute => (
                    <div key={attribute} className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
                      <Checkbox checked disabled />
                      <span className="min-w-0 flex-1 truncate font-medium text-blue-950">{attribute}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveAttribute(attribute)}
                        className="rounded p-1 text-rose-600 hover:bg-rose-50 hover:text-rose-800"
                        aria-label={`Remove ${attribute}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>}

            <section className="space-y-3 border-t border-slate-200 pt-5" aria-labelledby="panel-assignment-heading">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 id="panel-assignment-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Users className="size-4 text-blue-600" aria-hidden />
                    Choose panelists
                  </h3>
                  <p className="mt-1 text-sm text-slate-700">Select who should receive this survey. Panelists with a profile or allergy conflict are removed automatically.</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onSetPanelists(eligiblePanelists.map(panelist => panelist.id))} disabled={eligiblePanelists.length === 0 || saving}>
                    Select all eligible
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onSetPanelists([])} disabled={safeAssignedIds.length === 0 || saving}>
                    Clear
                  </Button>
                </div>
              </div>

              {eligibilityLoading ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">Calculating sample eligibility…</p>
              ) : declaration?.status !== 'verified' ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-4 text-sm text-amber-950">Verify the exact-sample declaration above before choosing panelists.</p>
              ) : eligiblePanelists.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
                  No panelists are currently eligible for this sample.
                </p>
              ) : (
                <div className="grid max-h-64 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
                  {eligiblePanelists.map(panelist => (
                    <div key={panelist.id} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:border-emerald-300">
                      <Checkbox
                        id={`survey-panelist-${panelist.id}`}
                        checked={safeAssignedIds.includes(panelist.id)}
                        onCheckedChange={() => onSetPanelists(safeAssignedIds.includes(panelist.id) ? safeAssignedIds.filter(id => id !== panelist.id) : [...safeAssignedIds, panelist.id])}
                        disabled={saving}
                      />
                      <Label htmlFor={`survey-panelist-${panelist.id}`} className="min-w-0 flex-1 cursor-pointer font-normal">
                        <span className="block truncate font-medium text-slate-900">{panelist.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {[panelist.panelistId ?? 'No panelist ID', panelist.ageBand, panelist.region].filter(Boolean).join(' · ')}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {[panelist.dietaryPattern?.replace(/_/g, ' '), `${panelist.completedCount} completed`].filter(Boolean).join(' · ')}
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
              )}
              {declaration?.status === 'verified' && <p className="flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck className="size-3.5 text-emerald-700" aria-hidden />{eligiblePanelists.length} eligible · {excludedCount} excluded by account readiness or sample-safety rules. Excluded panelists are not shown.</p>}
              <EligiblePanelSummary panelists={eligiblePanelists} selectedIds={safeAssignedIds} />
            </section>

            <section className="border-t border-slate-200 pt-5" aria-labelledby="ship-outs-heading">
              <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 id="ship-outs-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <PackageCheck className="size-4 text-slate-700" aria-hidden />
                    Ship-outs
                  </h3>
                  <p className="mt-1 max-w-lg text-sm leading-6 text-slate-700">
                    Build recipient boxes, generate unique QR inserts, and track packing, dispatch, claims, and completion in the project shipment workspace.
                  </p>
                </div>
                {shipOutProjectId ? (
                  <Button asChild variant="outline" className="shrink-0 bg-white">
                    <Link to={projectStudiesPath(shipOutProjectId, 'ship-outs', `?study=${encodeURIComponent(product.id)}`)}>
                      Open Ship-outs
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </Button>
                ) : (
                  <p className="max-w-52 text-xs leading-5 text-amber-800">Assign this study to a project before creating physical shipments.</p>
                )}
              </div>
            </section>
          </div>
        )}

        <div className="border-t border-slate-200 bg-white px-6 py-4">
          {product?.status !== 'active' && (
            <div className={`mb-3 rounded-lg border px-3 py-2.5 ${launchBlockers.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <p className={`text-sm font-semibold ${launchBlockers.length > 0 ? 'text-amber-950' : 'text-emerald-950'}`}>
                {launchBlockers.length > 0 ? `${launchBlockers.length} launch requirement${launchBlockers.length === 1 ? '' : 's'} remaining` : 'Ready to launch'}
              </p>
              {launchBlockers.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs leading-5 text-amber-900">
                  {launchBlockers.map(blocker => <li key={blocker}>{blocker}</li>)}
                </ul>
              )}
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => onSaveAttributes(safeAssignedIds)}
              disabled={!product || saving || surveySections.length === 0 || (surveySections.includes('cata') && customAttributes.length === 0)}
              className="flex-1"
            >
              <Save className="mr-2 size-4" aria-hidden />
              {saving ? 'Saving…' : product?.status === 'active' ? 'Save setup changes' : 'Save draft'}
            </Button>
            <Button
              variant="outline"
              onClick={() => onPreview(safeAssignedIds)}
              disabled={!product || saving || surveySections.length === 0 || (surveySections.includes('cata') && customAttributes.length === 0)}
              className="flex-1"
            >
              <Eye className="mr-2 size-4" aria-hidden />
              Save &amp; preview
            </Button>
            {product?.status !== 'active' && (
              <Button
                onClick={() => onLaunch(safeAssignedIds)}
                disabled={!product || saving || eligibilityLoading || launchBlockers.length > 0}
                className="flex-1 bg-slate-900 hover:bg-slate-800"
              >
                <Rocket className="mr-2 size-4" aria-hidden />
                {saving ? 'Launching…' : product?.status === 'completed' ? 'Review & reopen' : 'Launch study'}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
