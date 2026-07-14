import { Label } from '../ui/label';
import {
  Apple,
  Images,
  Instagram,
  LayoutPanelTop,
  Package,
  ShoppingBasket,
  Store,
} from 'lucide-react';
import {
  normalizePromptStyle,
  type ConceptImageMode,
  type ConceptImageSize,
  type PromptStyleId,
} from '../../../../supabase/functions/_shared/concept-image-catalog.ts';
import type { ConceptDraft } from './types';

export interface ImageGenerationOptions {
  mode: ConceptImageMode;
  count: number;
  quality: string;
  spreadModes: boolean;
  /** 'auto' renders each format at its catalog size; a size forces one shape. */
  sizeOverride: 'auto' | ConceptImageSize;
  /** When a design is locked, whether this batch re-stages it (vs. explores fresh). */
  useLockedDesign: boolean;
}

const IMAGE_PRESETS: Array<{
  id: string;
  label: string;
  detail: string;
  icon: typeof Package;
  mode: ConceptImageMode;
  promptStyle: PromptStyleId;
  count: number;
  spreadModes: boolean;
  quality: string;
}> = [
  {
    id: 'retail-pack',
    label: 'Retail pack',
    detail: '4 pack-led drafts',
    icon: Package,
    mode: 'packaging',
    promptStyle: 'bold_retail',
    count: 4,
    spreadModes: true,
    quality: 'high',
  },
  {
    id: 'shelf-check',
    label: 'Shelf check',
    detail: '3 retail shelf views',
    icon: Store,
    mode: 'shelf',
    promptStyle: 'bold_retail',
    count: 3,
    spreadModes: false,
    quality: 'high',
  },
  {
    id: 'buyer-deck',
    label: 'Buyer deck',
    detail: '3 polished review shots',
    icon: LayoutPanelTop,
    mode: 'buyer_presentation',
    promptStyle: 'premium_natural',
    count: 3,
    spreadModes: true,
    quality: 'high',
  },
  {
    id: 'ingredient-cue',
    label: 'Ingredient cue',
    detail: '3 benefit-safe cues',
    icon: Apple,
    mode: 'ingredient_benefit',
    promptStyle: 'health_forward',
    count: 3,
    spreadModes: true,
    quality: 'high',
  },
  {
    id: 'ecommerce',
    label: 'Ecommerce',
    detail: '3 clean product shots',
    icon: ShoppingBasket,
    mode: 'ecommerce',
    promptStyle: 'minimalist_ecommerce',
    count: 3,
    spreadModes: false,
    quality: 'high',
  },
  {
    id: 'social-test',
    label: 'Social test',
    detail: '3 expressive crops',
    icon: Instagram,
    mode: 'social_ad',
    promptStyle: 'playful_modern',
    count: 3,
    spreadModes: true,
    quality: 'high',
  },
  {
    id: 'occasion',
    label: 'Usage moment',
    detail: '3 lifestyle contexts',
    icon: Images,
    mode: 'lifestyle',
    promptStyle: 'family_friendly',
    count: 3,
    spreadModes: true,
    quality: 'high',
  },
];

export function ImageDirectionPanel({
  draft,
  onChange,
  options,
  onOptionsChange,
  maxCount,
}: {
  draft: ConceptDraft;
  onChange: (d: ConceptDraft) => void;
  options: ImageGenerationOptions;
  onOptionsChange: (o: ImageGenerationOptions) => void;
  maxCount: number;
}) {
  const style = normalizePromptStyle(draft.promptStyle);
  const applyPreset = (preset: (typeof IMAGE_PRESETS)[number]) => {
    onOptionsChange({
      ...options,
      mode: preset.mode,
      count: Math.min(maxCount, preset.count),
      quality: preset.quality,
      spreadModes: preset.spreadModes,
      sizeOverride: 'auto',
    });
    onChange({ ...draft, promptStyle: preset.promptStyle });
  };

  return (
    <div className="space-y-3">
      <Label className="font-medium">Image preset</Label>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {IMAGE_PRESETS.map(preset => {
          const Icon = preset.icon;
          const presetCount = Math.min(maxCount, preset.count);
          const active = options.mode === preset.mode
            && style === preset.promptStyle
            && options.spreadModes === preset.spreadModes
            && options.count === presetCount
            && options.quality === preset.quality;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              aria-pressed={active}
              className={`flex min-h-16 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                active
                  ? 'border-blue-500 bg-blue-50 text-blue-950'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-slate-50'
              }`}
            >
              <Icon className={`size-4 shrink-0 ${active ? 'text-blue-700' : 'text-slate-500'}`} aria-hidden />
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{preset.label}</span>
                <span className={`mt-0.5 block text-[11px] ${active ? 'text-blue-800' : 'text-slate-500'}`}>
                  {presetCount === preset.count ? preset.detail : `${presetCount} draft${presetCount === 1 ? '' : 's'}`}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
