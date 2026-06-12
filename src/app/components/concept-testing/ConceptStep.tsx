import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { DollarSign, Target, Star, Package, FolderKanban } from 'lucide-react';
import type { ConceptDraft } from './types';
import { detectFoodType, getFoodTypeProfile } from '../../lib/food-intelligence';
import { PROMPT_STYLES, normalizePromptStyle } from '../../../../supabase/functions/_shared/concept-image-catalog.ts';

export function ConceptStep({ draft, onChange }: { draft: ConceptDraft; onChange: (d: ConceptDraft) => void }) {
  const set = (field: keyof ConceptDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...draft, [field]: e.target.value });
  const detection = detectFoodType(draft.category, draft.name, draft.description);
  const profile = getFoodTypeProfile(detection.slug);

  const completeness = [
    draft.name ? 20 : 0,
    draft.category ? 20 : 0,
    draft.description ? 20 : 0,
    draft.targetMarket ? 10 : 0,
    draft.pricePoint ? 10 : 0,
    draft.keyBenefits ? 10 : 0,
    draft.technicalChallenges ? 10 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Define your concept</h2>
        <p className="text-slate-500 text-sm mt-1">Describe the product you want consumers to evaluate.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="font-medium">Product name <span className="text-rose-500">*</span></Label>
          <Input value={draft.name} onChange={set('name')} placeholder="e.g. Vitacheeze Original Cheddar" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-medium">Category <span className="text-rose-500">*</span></Label>
          <Input value={draft.category} onChange={set('category')} placeholder="e.g. Plant-based cheese" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-medium flex items-center gap-1.5"><FolderKanban className="size-3.5" /> Project folder</Label>
          <Input value={draft.projectName} onChange={set('projectName')} placeholder="e.g. Project 1" />
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="font-medium flex items-center gap-1.5"><Target className="size-3.5" /> Target market</Label>
          <Input value={draft.targetMarket} onChange={set('targetMarket')} placeholder="e.g. Health-conscious adults 25-45" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-medium flex items-center gap-1.5"><DollarSign className="size-3.5" /> Expected price point</Label>
          <Input value={draft.pricePoint} onChange={set('pricePoint')} placeholder="e.g. $6.99 / 200g block" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="font-medium flex items-center gap-1.5"><Star className="size-3.5" /> Key consumer benefits</Label>
        <Textarea
          value={draft.keyBenefits}
          onChange={set('keyBenefits')}
          placeholder="e.g. Melts like dairy, high-protein (10g/serving), allergen-free, sustainable sourcing."
          rows={2}
          className="resize-none"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-700">Suggested {detection.label.toLowerCase()} cues</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {profile.successMarkers.slice(0, 4).join(', ')}
            </p>
          </div>
          <button
            type="button"
            aria-label={`Add suggested ${detection.label.toLowerCase()} cues to key consumer benefits`}
            onClick={() => {
              const additions = profile.successMarkers.slice(0, 4).join(', ');
              onChange({
                ...draft,
                keyBenefits: [draft.keyBenefits, additions].filter(Boolean).join(draft.keyBenefits ? ', ' : ''),
              });
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Add
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="font-medium flex items-center gap-1.5"><Package className="size-3.5" /> Technical challenges / R&D notes</Label>
        <Textarea
          value={draft.technicalChallenges}
          onChange={set('technicalChallenges')}
          placeholder="e.g. Achieving melt properties from cashew base, protein source binding, shelf stability."
          rows={2}
          className="resize-none"
        />
        <p className="text-xs text-slate-400">Internal only.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Visual positioning</p>
            <p className="text-xs text-slate-500 mt-0.5">Choose the tone for generated concept images.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PROMPT_STYLES.map(style => (
              <button
                key={style.id}
                type="button"
                onClick={() => onChange({ ...draft, promptStyle: style.id })}
                aria-pressed={normalizePromptStyle(draft.promptStyle) === style.id}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  normalizePromptStyle(draft.promptStyle) === style.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-600 font-medium">Concept completeness</span>
          <span className={`font-bold ${completeness >= 80 ? 'text-emerald-600' : completeness >= 50 ? 'text-amber-600' : 'text-rose-500'}`}>
            {completeness}%
          </span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${completeness >= 80 ? 'bg-emerald-500' : completeness >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
            style={{ width: `${completeness}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {completeness < 60
            ? 'Add target market, benefits, and R&D notes to strengthen this concept.'
            : completeness < 80
              ? 'Good brief. Pricing or benefits will make the survey more specific.'
              : 'Well-defined concept ready for images and survey generation.'}
        </p>
      </div>
    </div>
  );
}
