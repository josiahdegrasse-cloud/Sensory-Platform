import { useState } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { ChevronDown, DollarSign, Eye, FolderKanban, Package, Palette, Star, Target } from 'lucide-react';
import type { ConceptDraft } from './types';
import { detectFoodType, getFoodTypeProfile } from '../../lib/food-intelligence';

export function ConceptStep({ draft, onChange }: { draft: ConceptDraft; onChange: (d: ConceptDraft) => void }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const set = (field: keyof ConceptDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...draft, [field]: e.target.value });
  const detection = detectFoodType(draft.category, draft.name, draft.description);
  const profile = getFoodTypeProfile(detection.slug);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Define your concept</h2>
        <p className="text-slate-500 text-sm mt-1">Describe the product you want consumers to evaluate.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="font-medium">Product name <span className="text-rose-500">*</span></Label>
          <Input value={draft.name} onChange={set('name')} placeholder="e.g. Vitacheeze Original Cheddar" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-medium">Category <span className="text-rose-500">*</span></Label>
          <Input value={draft.category} onChange={set('category')} placeholder="e.g. Plant-based cheese" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="font-medium">Concept description <span className="text-rose-500">*</span></Label>
        <Textarea
          value={draft.description}
          onChange={set('description')}
          placeholder="Describe the product concept as consumers would read it: ingredients, format, occasion, and key claims."
          rows={4}
          className="resize-none"
        />
      </div>

      <section className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Marketing image brief</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Give the image generator concrete packaging, product, audience, and scene details. The more physical the brief is, the less generic the image options become.
            </p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-slate-700">
            <p className="font-semibold text-slate-900">Best image briefs include:</p>
            <ul className="mt-1.5 space-y-1">
              <li>Product form and texture</li>
              <li>Package shape, size, label, and window</li>
              <li>Who buys it and where they use it</li>
              <li>Approved claims, badges, and must-show cues</li>
            </ul>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 font-medium">
              <Eye className="size-3.5" /> Product appearance <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              value={draft.productAppearance}
              onChange={set('productAppearance')}
              placeholder="e.g. Pale cheddar-orange slices, rounded corners, smooth surface, realistic melt and stretch on toast"
              rows={3}
              className="resize-none bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 font-medium">
              <Package className="size-3.5" /> Package format <span className="text-rose-500">*</span>
            </Label>
            <Textarea
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
            <Label className="flex items-center gap-1.5 font-medium">
              <Target className="size-3.5" /> Target customer <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={draft.targetMarket}
              onChange={set('targetMarket')}
              placeholder="e.g. Flexitarian parents seeking an easy dairy swap"
              className="bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="font-medium">Usage occasion</Label>
            <Input
              value={draft.targetOccasion}
              onChange={set('targetOccasion')}
              placeholder="e.g. Weeknight burgers, sandwiches, and family cooking"
              className="bg-white"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="font-medium">Scene or setting</Label>
            <Input
              value={draft.visualSetting}
              onChange={set('visualSetting')}
              placeholder="e.g. Bright modern kitchen, warm natural daylight"
              className="bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 font-medium"><Palette className="size-3.5" /> Color and materials</Label>
            <Input
              value={draft.colorDirection}
              onChange={set('colorDirection')}
              placeholder="e.g. Sage green, charcoal type, matte paper texture"
              className="bg-white"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="font-medium">Must-show elements</Label>
          <Textarea
            value={draft.mustShow}
            onChange={set('mustShow')}
            placeholder="e.g. Product name, melted serving suggestion, plant-based cue, resealable closure"
            rows={2}
            className="resize-none bg-white"
          />
          <p className="text-xs text-slate-500">Only include claims or badges that are approved for concept testing.</p>
        </div>
      </section>

      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="rounded-lg border border-slate-200">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left">
          <div>
            <p className="text-sm font-semibold text-slate-900">Additional concept details</p>
            <p className="mt-0.5 text-xs text-slate-500">Project, price, benefits, and internal R&D notes.</p>
          </div>
          <ChevronDown className={`size-4 shrink-0 text-slate-500 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 border-t border-slate-200 px-4 py-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 font-medium"><FolderKanban className="size-3.5" /> Project folder</Label>
            <Input value={draft.projectName} onChange={set('projectName')} placeholder="e.g. Project 1" />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 font-medium"><DollarSign className="size-3.5" /> Expected price point</Label>
            <Input value={draft.pricePoint} onChange={set('pricePoint')} placeholder="e.g. $6.99 / 200g block" />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 font-medium"><Star className="size-3.5" /> Key consumer benefits</Label>
            <Textarea
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
            <Label className="flex items-center gap-1.5 font-medium"><Package className="size-3.5" /> Technical challenges / R&D notes</Label>
            <Textarea
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
