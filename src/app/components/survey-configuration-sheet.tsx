import { AlertTriangle, Layers, Lock, Plus, Save, Trash2, Users } from 'lucide-react';
import type { Product } from '../data/survey-domain';
import type { PanelistInfo } from '../lib/database';
import { getAssignmentSummary } from '../lib/assignments';
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

export function SurveyConfigurationSheet({
  product,
  panelists,
  standardAttributes,
  customAttributes,
  newAttribute,
  onOpenChange,
  onNewAttributeChange,
  onAddAttribute,
  onRemoveAttribute,
  onToggleAttribute,
  onResetAttributes,
  onClearAttributes,
  onSaveAttributes,
  onTogglePanelist,
  onAssignAll,
  onOpenToAll,
  saving,
}: {
  product: Product | null;
  panelists: PanelistInfo[];
  standardAttributes: string[];
  customAttributes: string[];
  newAttribute: string;
  onOpenChange: (open: boolean) => void;
  onNewAttributeChange: (value: string) => void;
  onAddAttribute: () => void;
  onRemoveAttribute: (attribute: string) => void;
  onToggleAttribute: (attribute: string) => void;
  onResetAttributes: () => void;
  onClearAttributes: () => void;
  onSaveAttributes: () => void;
  onTogglePanelist: (panelistId: string) => void;
  onAssignAll: () => void;
  onOpenToAll: () => void;
  saving: boolean;
}) {
  const assignment = product
    ? getAssignmentSummary('product', product, panelists)
    : null;

  return (
    <Sheet open={Boolean(product)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-2xl">
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
          </div>
          <SheetDescription>
            Choose who receives this survey and which attributes they evaluate.
          </SheetDescription>
        </SheetHeader>

        {product && assignment && (
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {product.blinded && (
              <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4" aria-labelledby="blind-study-heading">
                <h3 id="blind-study-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Lock className="size-4 text-slate-700" aria-hidden />
                  Blind study codes
                </h3>
                <p className="text-sm text-slate-600">
                  Panelists see coded sample identities only. The internal product name, category, and labels remain visible to administrators.
                </p>
                {product.isMultiSample && product.samples?.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {product.samples.map(sample => (
                      <div key={sample.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                        <span className="font-bold tracking-wider text-slate-900">{sample.code}</span>
                        <span className="ml-2 text-slate-600">{sample.label}</span>
                      </div>
                    ))}
                  </div>
                ) : product.blindCode ? (
                  <div className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                    <span className="text-slate-600">Panelist sample code:</span>
                    <span className="ml-2 font-bold tracking-wider text-slate-900">{product.blindCode}</span>
                  </div>
                ) : null}
              </section>
            )}

            <section className="space-y-3" aria-labelledby="panel-assignment-heading">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 id="panel-assignment-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Users className="size-4 text-blue-600" aria-hidden />
                    Panel assignment
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">{assignment.label}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={onAssignAll} disabled={panelists.length === 0 || saving}>
                    Assign all active
                  </Button>
                  <Button size="sm" variant="outline" onClick={onOpenToAll} disabled={saving}>
                    Open to all
                  </Button>
                </div>
              </div>

              {assignment.inactiveAssignedIds.length > 0 && (
                <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {assignment.inactiveAssignedIds.length} saved assignment{assignment.inactiveAssignedIds.length === 1 ? '' : 's'} belong to inactive or archived panelists. They remain saved but cannot be selected again here.
                  </span>
                </div>
              )}

              {panelists.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                  No active panelists are available.
                </p>
              ) : (
                <div className="grid max-h-64 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
                  {panelists.map(panelist => (
                    <div key={panelist.id} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:border-blue-300">
                      <Checkbox
                        id={`survey-panelist-${panelist.id}`}
                        checked={(product.assignedPanelistIds ?? []).includes(panelist.id)}
                        onCheckedChange={() => onTogglePanelist(panelist.id)}
                        disabled={saving}
                      />
                      <Label htmlFor={`survey-panelist-${panelist.id}`} className="min-w-0 flex-1 cursor-pointer font-normal">
                        <span className="block truncate font-medium text-slate-900">{panelist.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {panelist.panelistId ?? 'No panelist ID'} · {panelist.completedCount} completed
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4 border-t border-slate-200 pt-5" aria-labelledby="survey-attributes-heading">
              <div>
                <h3 id="survey-attributes-heading" className="text-sm font-semibold text-slate-900">Survey attributes</h3>
                <p className="mt-1 text-sm text-slate-600">Select the sensory cues included in this questionnaire.</p>
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
            </section>
          </div>
        )}

        <div className="border-t border-slate-200 bg-white px-6 py-4">
          <Button onClick={onSaveAttributes} disabled={!product || saving} className="w-full bg-blue-600 hover:bg-blue-700">
            <Save className="mr-2 size-4" aria-hidden />
            {saving ? 'Saving...' : 'Save survey attributes'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
