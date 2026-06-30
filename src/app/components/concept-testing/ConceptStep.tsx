import { useState } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { ChevronDown, DollarSign, Eye, FolderKanban, Layers, Package, Palette, Star, Target } from 'lucide-react';
import type { ConceptDraft, VariantDimensions } from './types';
import { detectFoodType, getFoodTypeProfile } from '../../lib/food-intelligence';

// ─── Dimension picker ─────────────────────────────────────────────────────────

function DimPicker<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-slate-700">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(active ? null : opt.value)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
                active
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-700'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ConceptStep({ draft, onChange }: { draft: ConceptDraft; onChange: (d: ConceptDraft) => void }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [positioningOpen, setPositioningOpen] = useState(false);
  const set = (field: keyof ConceptDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...draft, [field]: e.target.value });
  const setDim = <K extends keyof VariantDimensions>(dim: K) => (value: VariantDimensions[K] | null) =>
    onChange({ ...draft, variantDimensions: { ...draft.variantDimensions, [dim]: value } });
  const detection = detectFoodType(draft.category, draft.name, draft.description);
  const profile = getFoodTypeProfile(detection.slug);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Concept brief</h2>
        <p className="text-slate-500 text-sm mt-1">Define what panelists will evaluate.</p>
      </div>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Product basics</h3>
          <p className="mt-1 text-xs text-slate-500">These fields become the plain-language concept that consumers evaluate.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="concept-product-name" className="font-medium">Product name <span className="text-rose-500">*</span></Label>
            <Input id="concept-product-name" value={draft.name} onChange={set('name')} placeholder="e.g. Vitacheeze Original Cheddar" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="concept-category" className="font-medium">Category <span className="text-rose-500">*</span></Label>
            <Input id="concept-category" value={draft.category} onChange={set('category')} placeholder="e.g. Plant-based cheese" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="concept-description" className="font-medium">Concept description <span className="text-rose-500">*</span></Label>
          <Textarea
            id="concept-description"
            value={draft.description}
            onChange={set('description')}
            placeholder="Describe the product concept as consumers would read it: ingredients, format, occasion, and key claims."
            rows={4}
            className="resize-none"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Visual brief</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Give AI enough concrete product and package detail to create usable options.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="concept-product-appearance" className="flex items-center gap-1.5 font-medium">
              <Eye className="size-3.5" /> Product appearance <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="concept-product-appearance"
              value={draft.productAppearance}
              onChange={set('productAppearance')}
              placeholder="e.g. Pale cheddar-orange slices, rounded corners, smooth surface, realistic melt and stretch on toast"
              rows={3}
              className="resize-none bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="concept-package-format" className="flex items-center gap-1.5 font-medium">
              <Package className="size-3.5" /> Package format <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="concept-package-format"
              value={draft.packageFormat}
              onChange={set('packageFormat')}
              placeholder="e.g. 7 oz resealable pouch, clear product window, matte label, front-facing product name and plant-based cue"
              rows={3}
              className="resize-none bg-white"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="concept-target-customer" className="flex items-center gap-1.5 font-medium">
              <Target className="size-3.5" /> Target customer <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="concept-target-customer"
              value={draft.targetMarket}
              onChange={set('targetMarket')}
              placeholder="e.g. Flexitarian parents seeking an easy dairy swap"
              className="bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="concept-usage-occasion" className="font-medium">Usage occasion</Label>
            <Input
              id="concept-usage-occasion"
              value={draft.targetOccasion}
              onChange={set('targetOccasion')}
              placeholder="e.g. Weeknight burgers, sandwiches, and family cooking"
              className="bg-white"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="concept-visual-setting" className="font-medium">Scene or setting</Label>
            <Input
              id="concept-visual-setting"
              value={draft.visualSetting}
              onChange={set('visualSetting')}
              placeholder="e.g. Bright modern kitchen, warm natural daylight"
              className="bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="concept-color-direction" className="flex items-center gap-1.5 font-medium"><Palette className="size-3.5" /> Color and materials</Label>
            <Input
              id="concept-color-direction"
              value={draft.colorDirection}
              onChange={set('colorDirection')}
              placeholder="e.g. Sage green, charcoal type, matte paper texture"
              className="bg-white"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="concept-must-show" className="font-medium">Must-show elements</Label>
          <Textarea
            id="concept-must-show"
            value={draft.mustShow}
            onChange={set('mustShow')}
            placeholder="e.g. Product name, melted serving suggestion, plant-based cue, resealable closure"
            rows={2}
            className="resize-none bg-white"
          />
          <p className="text-xs text-slate-500">Only include claims or badges that are approved for concept testing.</p>
        </div>
      </section>

      <Collapsible open={positioningOpen} onOpenChange={setPositioningOpen} className="rounded-lg border border-slate-200 bg-slate-50/60">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Layers className="size-3.5" /> Optional positioning metadata
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Use when you want to compare consumer response against positioning choices later.
            </p>
          </div>
          <ChevronDown className={`size-4 shrink-0 text-slate-500 transition-transform ${positioningOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="grid gap-4 border-t border-slate-200 px-4 py-4 sm:grid-cols-2">
          <DimPicker
            label="Brand positioning"
            value={draft.variantDimensions?.positioning ?? null}
            options={[{ value: 'premium', label: 'Premium' }, { value: 'accessible', label: 'Accessible' }]}
            onChange={setDim('positioning')}
          />
          <DimPicker
            label="Visual complexity"
            value={draft.variantDimensions?.visualComplexity ?? null}
            options={[{ value: 'minimal', label: 'Minimal' }, { value: 'expressive', label: 'Expressive' }]}
            onChange={setDim('visualComplexity')}
          />
          <DimPicker
            label="Consumer appeal"
            value={draft.variantDimensions?.appeal ?? null}
            options={[{ value: 'health', label: 'Health-focused' }, { value: 'indulgent', label: 'Indulgent' }]}
            onChange={setDim('appeal')}
          />
          <DimPicker
            label="Primary channel"
            value={draft.variantDimensions?.channel ?? null}
            options={[{ value: 'retail', label: 'Retail shelf' }, { value: 'lifestyle', label: 'Lifestyle / DTC' }]}
            onChange={setDim('channel')}
          />
          <DimPicker
            label="Packaging format"
            value={draft.variantDimensions?.packagingFormat ?? null}
            options={[
              { value: 'pouch', label: 'Pouch' }, { value: 'block', label: 'Block' },
              { value: 'jar', label: 'Jar' }, { value: 'can', label: 'Can' },
              { value: 'bottle', label: 'Bottle' }, { value: 'sleeve', label: 'Sleeve' },
              { value: 'tray', label: 'Tray' }, { value: 'tube', label: 'Tube' },
            ]}
            onChange={setDim('packagingFormat')}
          />
          <DimPicker
            label="Brand colour scheme"
            value={draft.variantDimensions?.brandColorScheme ?? null}
            options={[
              { value: 'earthy', label: 'Earthy' }, { value: 'vibrant', label: 'Vibrant' },
              { value: 'minimalist', label: 'Minimalist' }, { value: 'luxury', label: 'Luxury' },
              { value: 'bold', label: 'Bold' }, { value: 'pastel', label: 'Pastel' },
            ]}
            onChange={setDim('brandColorScheme')}
          />
          <DimPicker
            label="Target demographic"
            value={draft.variantDimensions?.targetDemographic ?? null}
            options={[
              { value: 'young_active', label: 'Young & Active' }, { value: 'family', label: 'Family' },
              { value: 'professional', label: 'Professional' }, { value: 'senior', label: 'Senior' },
              { value: 'health_seeker', label: 'Health-seeker' },
            ]}
            onChange={setDim('targetDemographic')}
          />
          <DimPicker
            label="Price positioning"
            value={draft.variantDimensions?.pricePositioning ?? null}
            options={[
              { value: 'budget', label: 'Budget' }, { value: 'mainstream', label: 'Mainstream' },
              { value: 'premium', label: 'Premium' }, { value: 'ultra_premium', label: 'Ultra-premium' },
            ]}
            onChange={setDim('pricePositioning')}
          />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="rounded-lg border border-slate-200">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left">
          <div>
            <p className="text-sm font-semibold text-slate-900">Consumer promise and internal context</p>
            <p className="mt-0.5 text-xs text-slate-500">Project, price, benefits, and R&D notes that support the brief.</p>
          </div>
          <ChevronDown className={`size-4 shrink-0 text-slate-500 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 border-t border-slate-200 px-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="concept-project-folder" className="flex items-center gap-1.5 font-medium"><FolderKanban className="size-3.5" /> Project folder</Label>
            <Input id="concept-project-folder" value={draft.projectName} onChange={set('projectName')} placeholder="e.g. Project 1" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="concept-price-point" className="flex items-center gap-1.5 font-medium"><DollarSign className="size-3.5" /> Expected price point</Label>
            <Input id="concept-price-point" value={draft.pricePoint} onChange={set('pricePoint')} placeholder="e.g. $6.99 / 200g block" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="concept-key-benefits" className="flex items-center gap-1.5 font-medium"><Star className="size-3.5" /> Key consumer benefits</Label>
            <Textarea
              id="concept-key-benefits"
              value={draft.keyBenefits}
              onChange={set('keyBenefits')}
              placeholder="e.g. Melts like dairy, high-protein, allergen-free."
              rows={2}
              className="resize-none"
            />
            <div className="flex items-start justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-600">
                Suggested {detection.label.toLowerCase()} cues: {profile.successMarkers.slice(0, 4).join(', ')}
              </p>
              <button
                type="button"
                onClick={() => {
                  const additions = profile.successMarkers.slice(0, 4).join(', ');
                  onChange({ ...draft, keyBenefits: [draft.keyBenefits, additions].filter(Boolean).join(draft.keyBenefits ? ', ' : '') });
                }}
                className="shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                Add cues
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="concept-technical-challenges" className="flex items-center gap-1.5 font-medium"><Package className="size-3.5" /> Technical challenges / R&D notes</Label>
            <Textarea
              id="concept-technical-challenges"
              value={draft.technicalChallenges}
              onChange={set('technicalChallenges')}
              placeholder="e.g. Melt properties, protein binding, shelf stability."
              rows={2}
              className="resize-none"
            />
            <p className="text-xs text-slate-400">Internal only.</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
