import { useMemo, useState } from 'react';
import { ChevronDown, SlidersHorizontal, WandSparkles } from 'lucide-react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import type { ConceptDraft, VariantDimensions } from './types';
import { detectFoodType } from '../../lib/food-intelligence';
import { getFoodProductForms } from '../../lib/food-product-forms';
import { buildConsumerBriefSuggestions } from './consumer-brief-defaults';

// ─── Shared section heading ───────────────────────────────────────────────────

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function ProductFormSelector({ draft, onChange }: { draft: ConceptDraft; onChange: (draft: ConceptDraft) => void }) {
  const [customOpen, setCustomOpen] = useState(false);
  const detection = detectFoodType(draft.category, draft.name);
  const options = getFoodProductForms(detection.slug);
  const selected = draft.variantDimensions.productForm;
  const customSelected = Boolean(selected && !options.some(option => option.value === selected));
  const showCustom = customOpen || customSelected;
  const setProductForm = (productForm: string | null) => onChange({
    ...draft,
    variantDimensions: { ...draft.variantDimensions, productForm },
  });

  return (
    <div className="space-y-2">
      <div>
        <Label className="font-medium">Product form</Label>
        <p className="mt-1 text-xs text-slate-500">Suggested for {detection.label}. This controls how the food itself appears, separately from its packaging.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={`${detection.label} product form`}>
        {options.map(option => {
          const active = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setProductForm(active ? null : option.value);
                setCustomOpen(false);
              }}
              className={`min-h-10 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-800'
              }`}
            >
              {option.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={showCustom}
          onClick={() => setCustomOpen(true)}
          className={`min-h-10 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            showCustom
              ? 'border-blue-500 bg-blue-50 text-blue-800'
              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-800'
          }`}
        >
          Other
        </button>
      </div>
      {showCustom && (
        <div className="flex max-w-md items-center gap-2">
          <Input
            value={customSelected ? selected ?? '' : ''}
            onChange={event => setProductForm(event.target.value.trim() ? event.target.value : null)}
            placeholder="Describe the product form"
            className="h-9 bg-white text-sm"
          />
          <button
            type="button"
            onClick={() => {
              setProductForm(null);
              setCustomOpen(false);
            }}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      )}
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
];

const variantDimensionGroups: VariantDimensionGroup[] = [
  {
    key: 'positioning',
    label: 'Positioning',
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
    label: 'Visual style',
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
    label: 'Pack format',
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
    label: 'Brand palette',
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
    label: 'Price tier',
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
            className="min-h-9 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-blue-400 hover:text-blue-800"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PositioningFields({
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

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {variantDimensionGroups.map(group => {
          const selected = draft.variantDimensions[group.key] as string | null;
          const customSelected = Boolean(selected && !group.options.some(option => option.value === selected));
          const showCustom = Boolean(customOpen[group.key] || customSelected);
          const inputId = `concept-positioning-${group.key}`;
          return (
            <div key={group.key} className="space-y-1.5">
              <Label htmlFor={inputId} className="text-xs font-medium text-slate-700">{group.label}</Label>
              <select
                id={inputId}
                value={showCustom ? '__custom__' : selected ?? ''}
                onChange={event => {
                  if (event.target.value === '__custom__') {
                    setCustomOpen(prev => ({ ...prev, [group.key]: true }));
                    return;
                  }
                  setCustomOpen(prev => ({ ...prev, [group.key]: false }));
                  setDimension(group.key, event.target.value || null);
                }}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition-colors hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Not set</option>
                {group.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                <option value="__custom__">Custom…</option>
              </select>
              {showCustom && (
                <Input
                  value={customSelected ? selected ?? '' : ''}
                  onChange={event => setDimension(group.key, event.target.value.trim() ? event.target.value : null)}
                  placeholder={`Custom ${group.label.toLowerCase()}`}
                  aria-label={`Custom ${group.label.toLowerCase()}`}
                  className="h-10 bg-white text-sm"
                />
              )}
            </div>
          );
        })}
    </div>
  );
}

export function ConceptStep({ draft, onChange }: { draft: ConceptDraft; onChange: (d: ConceptDraft) => void }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const set = (field: keyof ConceptDraft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...draft, [field]: event.target.value });
  const setVariantDimensions = (variantDimensions: VariantDimensions) => onChange({ ...draft, variantDimensions });
  const consumerBriefSuggestions = useMemo(() => buildConsumerBriefSuggestions({
    name: draft.name,
    category: draft.category,
    productForm: draft.variantDimensions.productForm,
    sensorySignals: draft.keyBenefits.split(/[,\n]+/).map(value => value.trim()).filter(Boolean),
  }), [draft.category, draft.keyBenefits, draft.name, draft.variantDimensions.productForm]);
  const suggestedBriefIsApplied = draft.targetMarket === consumerBriefSuggestions.audience
    && draft.targetOccasion === consumerBriefSuggestions.occasions[0]
    && draft.description === consumerBriefSuggestions.promise
    && draft.keyBenefits === consumerBriefSuggestions.proofCues.join(', ');
  const positioningFieldCount = variantDimensionGroups.filter(group => Boolean(draft.variantDimensions[group.key])).length;
  const hasDecisionDetails = Boolean(draft.technicalChallenges.trim() || draft.forbiddenClaims.trim());
  const applyConsumerBriefSuggestions = () => onChange({
    ...draft,
    targetMarket: consumerBriefSuggestions.audience,
    targetOccasion: consumerBriefSuggestions.occasions[0] ?? draft.targetOccasion,
    description: consumerBriefSuggestions.promise,
    keyBenefits: consumerBriefSuggestions.proofCues.join(', '),
  });
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
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">Build the concept brief</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Define the product, its intended consumer, and the single idea the concept should communicate.</p>
      </div>

      <section className="space-y-5" aria-labelledby="brief-product-heading">
        <div id="brief-product-heading">
          <SectionHeading title="Product basics" description="Start with the product identity. These details carry into the visuals, survey, and final report." />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="concept-product-name" className="font-medium">Product name <span className="text-rose-500">*</span></Label>
            <Input id="concept-product-name" value={draft.name} onChange={set('name')} placeholder="e.g. Vitacheeze Original Cheddar" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="concept-category" className="font-medium">Category <span className="text-rose-500">*</span></Label>
            <Input id="concept-category" value={draft.category} onChange={set('category')} placeholder="e.g. Plant-based cheese" />
          </div>
        </div>

        <ProductFormSelector draft={draft} onChange={onChange} />
      </section>

      <section className="space-y-5 border-t border-slate-200 pt-7" aria-labelledby="brief-consumer-heading">
        <div id="brief-consumer-heading">
          <SectionHeading title="Consumer and occasion" description="Describe who should want this product and when it should fit into their life." />
        </div>
        <div className="flex flex-col gap-3 rounded-lg bg-blue-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-950">
              <WandSparkles className="size-4" aria-hidden />
              Suggested brief direction
            </p>
            <p className="mt-1 text-xs leading-5 text-blue-900">
              {consumerBriefSuggestions.audience} · Best fit: {consumerBriefSuggestions.occasions.slice(0, 2).join(' or ')}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-blue-800">Fills the audience, occasion, consumer promise, and sensory proof cues for you to review.</p>
          </div>
          <button
            type="button"
            onClick={applyConsumerBriefSuggestions}
            disabled={suggestedBriefIsApplied}
            className="min-h-10 shrink-0 rounded-md border border-blue-300 bg-white px-3 text-xs font-semibold text-blue-800 transition-colors hover:bg-blue-100 disabled:cursor-default disabled:border-blue-200 disabled:bg-blue-50 disabled:text-blue-600"
          >
            {suggestedBriefIsApplied ? 'Suggestion applied' : 'Apply suggestion'}
          </button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="concept-target-market" className="font-medium">Audience</Label>
            <Input
              id="concept-target-market"
              value={draft.targetMarket}
              onChange={set('targetMarket')}
              placeholder="e.g. Flexitarian families"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="concept-target-occasion" className="font-medium">Occasion</Label>
            <Input
              id="concept-target-occasion"
              value={draft.targetOccasion}
              onChange={set('targetOccasion')}
              placeholder="e.g. Everyday sandwiches and burgers"
            />
          </div>
        </div>
      </section>

      <section className="space-y-5 border-t border-slate-200 pt-7" aria-labelledby="brief-message-heading">
        <div id="brief-message-heading">
          <SectionHeading title="Positioning message" description="Choose a starting direction, then refine the promise and sensory proof in your own words." />
        </div>

        <PresetButtons label="Optional starting direction" presets={promisePresets} onApply={applyPreset} />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)]">
          <div className="space-y-1.5">
            <Label htmlFor="concept-description" className="font-medium">Consumer promise <span className="text-rose-500">*</span></Label>
            <Textarea
              id="concept-description"
              value={draft.description}
              onChange={set('description')}
              placeholder="e.g. Familiar cheddar flavour and reliable melt for easy everyday meals."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs leading-5 text-slate-500">Write one clear, consumer-facing sentence.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="concept-proof-cues" className="font-medium">Sensory proof cues</Label>
            <Textarea
              id="concept-proof-cues"
              value={draft.keyBenefits}
              onChange={set('keyBenefits')}
              placeholder="e.g. Smooth texture, clean breakdown, familiar cheddar flavour"
              rows={4}
              className="resize-none"
            />
            <p className="text-xs leading-5 text-slate-500">Use observed sensory cues, not unsupported claims.</p>
          </div>
        </div>
      </section>

      <div className="space-y-2 border-t border-slate-200 pt-6">
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="rounded-lg border border-slate-200">
          <CollapsibleTrigger className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-2.5 text-left" aria-label="Toggle positioning metadata">
            <span className="flex min-w-0 items-center gap-3">
              <SlidersHorizontal className="size-4 shrink-0 text-slate-500" aria-hidden />
              <span>
                <span className="block text-sm font-semibold text-slate-900">Positioning metadata</span>
                <span className="mt-0.5 block text-xs text-slate-500">Optional fields for comparison and visual direction</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-slate-500">{positioningFieldCount > 0 ? `${positioningFieldCount} set` : 'Optional'}</span>
              <ChevronDown className={`size-4 text-slate-500 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} aria-hidden />
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-slate-200 px-4 py-4">
            <PositioningFields draft={draft} onChange={setVariantDimensions} />
          </CollapsibleContent>
        </Collapsible>

        {hasDecisionDetails && (
          <Collapsible open={evidenceOpen} onOpenChange={setEvidenceOpen} className="rounded-lg border border-slate-200">
            <CollapsibleTrigger className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-2.5 text-left" aria-label="Toggle decision notes and claim boundaries">
              <span>
                <span className="block text-sm font-semibold text-slate-900">Decision notes and claim boundaries</span>
                <span className="mt-0.5 block text-xs text-slate-500">Read-only context carried forward from the product decision</span>
              </span>
              <ChevronDown className={`size-4 shrink-0 text-slate-500 transition-transform ${evidenceOpen ? 'rotate-180' : ''}`} aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 border-t border-slate-200 px-4 py-4 text-xs leading-5 text-slate-700">
              {draft.technicalChallenges.trim() && <p>{draft.technicalChallenges}</p>}
              {draft.forbiddenClaims.trim() && <p><strong className="text-slate-900">Do not claim:</strong> {draft.forbiddenClaims}</p>}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
