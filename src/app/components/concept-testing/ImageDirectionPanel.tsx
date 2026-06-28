import { useState } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';
import {
  ChevronDown,
} from 'lucide-react';
import {
  CONCEPT_IMAGE_MODES,
  PROMPT_STYLES,
  normalizePromptStyle,
  type ConceptImageMode,
} from '../../../../supabase/functions/_shared/concept-image-catalog.ts';
import type { ConceptDraft } from './types';

export interface ImageGenerationOptions {
  mode: ConceptImageMode;
  count: number;
  quality: string;
  spreadModes: boolean;
}

const CREATIVE_TERRITORY_GUIDANCE: Record<string, string> = {
  premium_natural: 'Premium grocery restraint: matte materials, natural light, tactile but sparse props.',
  clean_clinical: 'Precise and transparent: white space, crisp geometry, lab-clean without medical cues.',
  playful_modern: 'Friendly challenger-brand energy with controlled color and simple graphic confidence.',
  rustic_artisanal: 'Small-batch credibility with real material texture and no market-stall clutter.',
  bold_retail: 'Highest shelf impact: simple product name, strong color, clear category recognition.',
  health_forward: 'Fresh and active without claims: clean daylight, ingredient cues, practical vitality.',
  indulgent_premium: 'Rich sensory appetite appeal with restrained premium materials and lighting.',
  family_friendly: 'Warm everyday mealtime credibility, approachable but not cartoonish.',
  sustainable_earthy: 'Responsible material cues without greenwashing symbols or leaf overload.',
  minimalist_ecommerce: 'Commerce-first clarity: centered product, white field, no props.',
};

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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const style = normalizePromptStyle(draft.promptStyle);

  return (
    <div className="space-y-4">
      <div>
        <Label className="font-medium">Lead marketing format</Label>
        <p className="text-xs text-slate-500 mt-1">
          Start with the format most useful for this decision. For retail concept work, packaging, shelf,
          ecommerce, and buyer presentation usually give the cleanest signal.
        </p>
        <Select value={options.mode} onValueChange={(value: ConceptImageMode) => onOptionsChange({ ...options, mode: value })}>
          <SelectTrigger className="mt-3 w-full sm:max-w-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CONCEPT_IMAGE_MODES.map(option => (
              <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-2 text-xs text-slate-500">
          {CONCEPT_IMAGE_MODES.find(option => option.id === options.mode)?.purpose}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setAdvancedOpen(open => !open)}
        aria-expanded={advancedOpen}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
      >
        <ChevronDown className={`size-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
        Advanced image settings {advancedOpen ? '' : '- creative territory, count, quality, and claim limits'}
      </button>

      {advancedOpen && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Creative territory</Label>
              <Select value={style} onValueChange={(value) => onChange({ ...draft, promptStyle: value })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROMPT_STYLES.map(option => (
                    <SelectItem key={option.id} value={option.id} className="text-xs">{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] leading-4 text-slate-500">
                {CREATIVE_TERRITORY_GUIDANCE[style]}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Images per batch</Label>
              <Select
                value={String(options.count)}
                onValueChange={(value) => onOptionsChange({ ...options, count: Number(value) })}
              >
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxCount }, (_, i) => i + 1).map(n => (
                    <SelectItem key={n} value={String(n)} className="text-xs">{n} image{n > 1 ? 's' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Quality</Label>
              <Select value={options.quality} onValueChange={(value) => onOptionsChange({ ...options, quality: value })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['low', 'medium', 'high', 'auto'].map(quality => (
                    <SelectItem key={quality} value={quality} className="text-xs capitalize">
                      {quality}{quality === 'high' ? ' - recommended' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] leading-4 text-slate-500">
                High quality is recommended for buyer-ready retail concept visuals.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <div>
              <p className="text-xs font-semibold text-slate-700">Span marketing formats</p>
              <p className="text-[11px] text-slate-500">
                On: each image uses a different retail/marketing format, led by your pick. Off: every image is a {`${CONCEPT_IMAGE_MODES.find(m => m.id === options.mode)?.label.toLowerCase()}`} variation.
              </p>
            </div>
            <Switch
              checked={options.spreadModes}
              onCheckedChange={(checked) => onOptionsChange({ ...options, spreadModes: checked })}
              aria-label="Span marketing formats across the batch"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Additional visual notes (optional)</Label>
            <Input
              value={draft.visualNotes}
              onChange={(e) => onChange({ ...draft, visualNotes: e.target.value })}
              placeholder="e.g. matte pouch, no hands, realistic cheese slice scale, room for buyer-slide copy"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Forbidden claims (optional, one per line)</Label>
            <Textarea
              value={draft.forbiddenClaims}
              onChange={(e) => onChange({ ...draft, forbiddenClaims: e.target.value })}
              placeholder={'e.g. lowers cholesterol\nclinically proven'}
              rows={2}
              className="resize-none text-xs"
            />
            <p className="text-[11px] text-slate-400">
              Fake certifications, nutrition panels, retailer logos, and unsupported health claims are always blocked.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
