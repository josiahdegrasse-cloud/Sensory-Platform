import { useState } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { CheckCircle2, DollarSign, Target, Star, Package, EyeOff, Eye, FolderKanban } from 'lucide-react';
import type { ConceptDraft } from './types';
import { detectFoodType, getFoodTypeProfile } from '../../lib/food-intelligence';

export function ConceptStep({ draft, onChange }: { draft: ConceptDraft; onChange: (d: ConceptDraft) => void }) {
  const [showPreview, setShowPreview] = useState(true);
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
    <div className={showPreview ? "grid gap-6 lg:grid-cols-2" : "space-y-5"}>
      {/* Left: form inputs */}
      <div className="space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Define your concept</h2>
            <p className="text-slate-500 text-sm mt-1">Describe the product you want consumers to evaluate.</p>
          </div>
          <button
            onClick={() => setShowPreview(p => !p)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors mt-1 shrink-0"
          >
            {showPreview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {showPreview ? 'Hide preview' : 'Show preview'}
          </button>
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
            placeholder="Describe the product concept as you'd present it to a consumer — ingredients, format, occasion, key claims…"
            rows={4}
            className="resize-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="font-medium flex items-center gap-1.5"><Target className="size-3.5" /> Target market</Label>
            <Input value={draft.targetMarket} onChange={set('targetMarket')} placeholder="e.g. Health-conscious adults 25–45" />
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
            placeholder="e.g. Melts like dairy, high-protein (10g/serving), allergen-free, sustainable sourcing…"
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
            placeholder="e.g. Achieving melt properties from cashew base, protein source binding, shelf stability…"
            rows={2}
            className="resize-none"
          />
          <p className="text-xs text-slate-400">Internal only — not shown to panelists.</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Visual positioning</p>
              <p className="text-xs text-slate-500 mt-0.5">Choose the tone for generated concept images.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['balanced', 'premium', 'natural', 'family', 'foodservice', 'clean-label'] as const).map(style => (
                <button
                  key={style}
                  type="button"
                  onClick={() => onChange({ ...draft, promptStyle: style })}
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                    draft.promptStyle === style
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {style.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: live panelist preview */}
      {showPreview && <div className="sticky top-0 self-start space-y-3">
        <div className="rounded-xl border-2 border-blue-200 overflow-hidden shadow-sm">
          <div className="px-4 py-2 bg-blue-600 flex items-center justify-between">
            <span className="text-xs font-bold text-white tracking-wider uppercase">Panelist View</span>
            <div className="flex items-center gap-1.5 text-xs text-blue-200">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse" />
              Live preview
            </div>
          </div>

          <div className="p-5 space-y-4 bg-gradient-to-br from-blue-50 to-slate-50 min-h-[200px]">
            {draft.name ? (
              <div>
                <h3 className="text-xl font-black text-slate-900 leading-tight">{draft.name}</h3>
                {draft.category && (
                  <span className="inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{draft.category}</span>
                )}
                {draft.projectName && (
                  <span className="inline-block mt-1.5 ml-1.5 text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{draft.projectName}</span>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="h-6 bg-slate-200 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-slate-200 rounded animate-pulse w-1/3" />
              </div>
            )}

            {draft.description ? (
              <p className="text-sm text-slate-700 leading-relaxed">{draft.description}</p>
            ) : (
              <div className="space-y-1.5">
                <div className="h-3 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 bg-slate-200 rounded animate-pulse w-4/5" />
                <div className="h-3 bg-slate-200 rounded animate-pulse w-3/5" />
              </div>
            )}

            {(draft.pricePoint || draft.targetMarket) && (
              <div className="flex flex-wrap gap-3 text-xs text-slate-600 border-t border-slate-200 pt-3">
                {draft.pricePoint && (
                  <span className="flex items-center gap-1"><DollarSign className="size-3 text-slate-400" />{draft.pricePoint}</span>
                )}
                {draft.targetMarket && (
                  <span className="flex items-center gap-1"><Target className="size-3 text-slate-400" />{draft.targetMarket}</span>
                )}
              </div>
            )}

            {draft.keyBenefits && (
              <div className="border-t border-slate-200 pt-3">
                <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Key Benefits</p>
                <div className="space-y-1">
                  {draft.keyBenefits.split(/[,\n]+/).filter(Boolean).map((b, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                      <CheckCircle2 className="size-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                      {b.trim()}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Completeness bar */}
          <div className="px-5 py-3 bg-white border-t border-slate-200">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-500 font-medium">Concept completeness</span>
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
            <p className="text-[10px] text-slate-400 mt-1.5">
              {completeness < 60
                ? 'Add more details to strengthen this concept'
                : completeness < 80
                  ? 'Good concept — add pricing or benefits to complete it'
                  : 'Well-defined concept ready for testing'}
            </p>
          </div>
        </div>
      </div>}
    </div>
  );
}
