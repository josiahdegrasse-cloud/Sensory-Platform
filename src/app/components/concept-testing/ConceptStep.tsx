import { useState } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import type { ConceptDraft, VariantDimensions } from './types';

// ─── Shared section heading ───────────────────────────────────────────────────

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

interface QuickPreset {
  label: string;
  fields: Partial<Pick<ConceptDraft,
    | 'description'
  >> & { variantDimensions?: Partial<VariantDimensions> };
}

interface VariantDimensionGroup {
  key: keyof VariantDimensions;
  label: string;
  options: { value: string; label: string }[];
}

const promisePresets: QuickPreset[] = [
  {
    label: 'Everyday swap',
    fields: {
      description: 'An easy everyday alternative with familiar flavor, reliable performance, and broad family appeal.',
      variantDimensions: {
        positioning: 'accessible',
        appeal: 'health',
        targetDemographic: 'family',
        pricePositioning: 'mainstream',
      },
    },
  },
  {
    label: 'Premium natural',
    fields: {
      description: 'A premium, ingredient-conscious product built around strong sensory quality and a more elevated eating occasion.',
      variantDimensions: {
        positioning: 'premium',
        visualComplexity: 'minimal',
        appeal: 'health',
        brandColorScheme: 'earthy',
        pricePositioning: 'premium',
      },
    },
  },
  {
    label: 'Indulgent treat',
    fields: {
      description: 'A rich, satisfying concept that leads with appetite appeal, texture, and a treat-worthy sensory experience.',
      variantDimensions: {
        positioning: 'premium',
        visualComplexity: 'expressive',
        appeal: 'indulgent',
        pricePositioning: 'premium',
      },
    },
  },
  {
    label: 'Health-forward',
    fields: {
      description: 'A practical better-for-you concept that should feel fresh, credible, and easy to choose without making unsupported claims.',
      variantDimensions: {
        positioning: 'accessible',
        visualComplexity: 'minimal',
        appeal: 'health',
        targetDemographic: 'health_seeker',
        brandColorScheme: 'minimalist',
      },
    },
  },
  { label: 'Other', fields: { description: '' } },
];

const variantDimensionGroups: VariantDimensionGroup[] = [
  {
    key: 'positioning',
    label: 'Position',
    options: [
      { value: 'premium', label: 'Premium' },
      { value: 'accessible', label: 'Accessible' },
      { value: 'value', label: 'Value' },
      { value: 'craft', label: 'Craft' },
      { value: 'functional', label: 'Functional' },
      { value: 'playful', label: 'Playful' },
      { value: 'heritage', label: 'Heritage' },
      { value: 'disruptive', label: 'Disruptive' },
    ],
  },
  {
    key: 'visualComplexity',
    label: 'Visual',
    options: [
      { value: 'minimal', label: 'Minimal' },
      { value: 'expressive', label: 'Expressive' },
      { value: 'ingredient_led', label: 'Ingredient-led' },
      { value: 'clinical', label: 'Clinical' },
      { value: 'editorial', label: 'Editorial' },
      { value: 'abundant', label: 'Abundant' },
    ],
  },
  {
    key: 'appeal',
    label: 'Appeal',
    options: [
      { value: 'health', label: 'Health' },
      { value: 'indulgent', label: 'Indulgent' },
      { value: 'taste_first', label: 'Taste-first' },
      { value: 'convenience', label: 'Convenience' },
      { value: 'sustainable', label: 'Sustainable' },
      { value: 'family_friendly', label: 'Family-friendly' },
      { value: 'adventurous', label: 'Adventurous' },
    ],
  },
  {
    key: 'channel',
    label: 'Channel',
    options: [
      { value: 'retail', label: 'Retail' },
      { value: 'lifestyle', label: 'Lifestyle' },
      { value: 'ecommerce', label: 'Ecommerce' },
      { value: 'foodservice', label: 'Foodservice' },
      { value: 'buyer_deck', label: 'Buyer deck' },
      { value: 'club_store', label: 'Club store' },
    ],
  },
  {
    key: 'packagingFormat',
    label: 'Format',
    options: [
      { value: 'pouch', label: 'Pouch' },
      { value: 'block', label: 'Block' },
      { value: 'jar', label: 'Jar' },
      { value: 'can', label: 'Can' },
      { value: 'bottle', label: 'Bottle' },
      { value: 'sleeve', label: 'Sleeve' },
      { value: 'tray', label: 'Tray' },
      { value: 'tube', label: 'Tube' },
      { value: 'carton', label: 'Carton' },
      { value: 'box', label: 'Box' },
      { value: 'cup', label: 'Cup' },
      { value: 'wrapper', label: 'Wrapper' },
      { value: 'multipack', label: 'Multipack' },
      { value: 'sachet', label: 'Sachet' },
    ],
  },
  {
    key: 'brandColorScheme',
    label: 'Palette',
    options: [
      { value: 'earthy', label: 'Earthy' },
      { value: 'vibrant', label: 'Vibrant' },
      { value: 'minimalist', label: 'Minimalist' },
      { value: 'luxury', label: 'Luxury' },
      { value: 'bold', label: 'Bold' },
      { value: 'pastel', label: 'Pastel' },
      { value: 'fresh', label: 'Fresh' },
      { value: 'warm', label: 'Warm' },
      { value: 'cool', label: 'Cool' },
      { value: 'monochrome', label: 'Mono' },
      { value: 'natural', label: 'Natural' },
    ],
  },
  {
    key: 'targetDemographic',
    label: 'Audience',
    options: [
      { value: 'young_active', label: 'Young active' },
      { value: 'family', label: 'Family' },
      { value: 'professional', label: 'Professional' },
      { value: 'senior', label: 'Senior' },
      { value: 'health_seeker', label: 'Health seeker' },
      { value: 'parent', label: 'Parent' },
      { value: 'kid', label: 'Kid' },
      { value: 'flexitarian', label: 'Flexitarian' },
      { value: 'foodie', label: 'Foodie' },
      { value: 'budget_shopper', label: 'Budget shopper' },
      { value: 'retail_buyer', label: 'Retail buyer' },
    ],
  },
  {
    key: 'pricePositioning',
    label: 'Price',
    options: [
      { value: 'budget', label: 'Budget' },
      { value: 'value', label: 'Value' },
      { value: 'mainstream', label: 'Mainstream' },
      { value: 'premium', label: 'Premium' },
      { value: 'ultra_premium', label: 'Ultra-premium' },
      { value: 'trial_size', label: 'Trial size' },
      { value: 'bulk_value', label: 'Bulk value' },
    ],
  },
];

function PresetButtons({
  label,
  presets,
  onApply,
}: {
  label: string;
  presets: QuickPreset[];
  onApply: (preset: QuickPreset) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-slate-600">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {presets.map(preset => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onApply(preset)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PositioningTags({
  draft,
  onChange,
}: {
  draft: ConceptDraft;
  onChange: (dimensions: VariantDimensions) => void;
}) {
  const [customOpen, setCustomOpen] = useState<Partial<Record<keyof VariantDimensions, boolean>>>({});

  const setDimension = (key: keyof VariantDimensions, value: string | null) => {
    onChange({ ...draft.variantDimensions, [key]: value } as VariantDimensions);
  };

  const openCustom = (key: keyof VariantDimensions) => {
    setCustomOpen(prev => ({ ...prev, [key]: true }));
  };

  const closeCustom = (key: keyof VariantDimensions) => {
    setCustomOpen(prev => ({ ...prev, [key]: false }));
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold text-slate-600">Positioning tags</p>
        <p className="mt-0.5 text-xs text-slate-500">Compact analytics metadata that also nudges the image prompt.</p>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {variantDimensionGroups.map(group => {
          const selected = draft.variantDimensions[group.key] as string | null;
          const customSelected = Boolean(selected && !group.options.some(option => option.value === selected));
          const showCustom = Boolean(customOpen[group.key] || customSelected);
          return (
            <div key={group.key} className="rounded-md border border-slate-200 bg-slate-50 p-2">
              <p className="mb-1.5 text-[11px] font-semibold text-slate-600">{group.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.options.map(option => {
                  const active = selected === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setDimension(group.key, active ? null : option.value);
                        closeCustom(group.key);
                      }}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                        active
                          ? 'border-blue-500 bg-blue-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => openCustom(group.key)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                    showCustom
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800'
                  }`}
                >
                  Other
                </button>
              </div>
              {showCustom && (
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    value={customSelected ? selected ?? '' : ''}
                    onChange={event => setDimension(group.key, event.target.value.trim() ? event.target.value : null)}
                    placeholder={`Custom ${group.label.toLowerCase()}`}
                    className="h-8 bg-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setDimension(group.key, null);
                      closeCustom(group.key);
                    }}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ConceptStep({ draft, onChange }: { draft: ConceptDraft; onChange: (d: ConceptDraft) => void }) {
  const set = (field: keyof ConceptDraft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...draft, [field]: event.target.value });
  const setVariantDimensions = (variantDimensions: VariantDimensions) => onChange({ ...draft, variantDimensions });
  const applyPreset = (preset: QuickPreset) => {
    const { variantDimensions, ...fields } = preset.fields;
    onChange({
      ...draft,
      ...fields,
      variantDimensions: variantDimensions
        ? { ...draft.variantDimensions, ...variantDimensions }
        : draft.variantDimensions,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Concept image brief</h2>
        <p className="mt-1 text-sm text-slate-500">Only the inputs needed to generate credible concept visuals.</p>
      </div>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <SectionHeading title="Image subject" description="The minimum identity and positioning the image generator needs." />
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
          <Label htmlFor="concept-description" className="font-medium">Positioning promise <span className="text-rose-500">*</span></Label>
          <Textarea
            id="concept-description"
            value={draft.description}
            onChange={set('description')}
            placeholder="e.g. A dairy-free cheddar slice for everyday sandwiches and burgers, with familiar cheddar flavor and reliable melt."
            rows={3}
            className="resize-none"
          />
        </div>
        <PresetButtons label="Quick promise" presets={promisePresets} onApply={applyPreset} />
        <PositioningTags draft={draft} onChange={setVariantDimensions} />
      </section>
    </div>
  );
}
