import { useMemo, useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  CheckCircle2, Image as ImageIcon, Layers3, Loader2, Package,
  Plus, RefreshCw, Sparkles, Trash2, Utensils,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { detectFoodType, getFoodTypeProfile } from '../../lib/food-intelligence';
import type { ConceptDraft } from './types';

type ImageMode = 'packaging' | 'shelf' | 'usage' | 'ingredient' | 'ad';

interface CandidateImage {
  url: string;
  selected: boolean;
  revisedPrompt?: string;
}

const IMAGE_MODES: Array<{
  id: ImageMode;
  label: string;
  description: string;
  icon: typeof Package;
}> = [
  { id: 'packaging', label: 'Packaging', description: 'Hero pack shot for concept surveys', icon: Package },
  { id: 'shelf', label: 'Shelf', description: 'Retail context and category fit', icon: Layers3 },
  { id: 'usage', label: 'Usage', description: 'Consumer occasion and appetite appeal', icon: Utensils },
  { id: 'ingredient', label: 'Benefits', description: 'Ingredients, claims, and sensory promise', icon: Sparkles },
  { id: 'ad', label: 'Ad concept', description: 'Campaign-ready launch visual', icon: ImageIcon },
];

const isValidImageUrl = (u: string) =>
  u.startsWith('data:image/') || ((): boolean => { try { return new URL(u).protocol === 'https:'; } catch { return false; } })();

export function ImagesStep({ draft, onChange }: { draft: ConceptDraft; onChange: (d: ConceptDraft) => void }) {
  const [mode, setMode] = useState<ImageMode>('packaging');
  const [aiCandidates, setAiCandidates] = useState<CandidateImage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');

  const detection = useMemo(
    () => detectFoodType(draft.category, draft.name, draft.description),
    [draft.category, draft.description, draft.name],
  );
  const profile = getFoodTypeProfile(detection.slug);
  const validImages = draft.marketingImages.filter(u => u.trim() && isValidImageUrl(u));
  const canGenerate = !!(draft.name.trim() && draft.category.trim() && draft.description.trim());

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setGenerationError('');
    setAiCandidates([]);

    const { data, error } = await supabase.functions.invoke('generate-concept-images', {
      body: {
        conceptName: draft.name,
        category: draft.category || detection.label,
        description: draft.description,
        targetMarket: draft.targetMarket,
        pricePoint: draft.pricePoint,
        keyBenefits: [
          draft.keyBenefits,
          profile.successMarkers.length ? `Desired sensory cues: ${profile.successMarkers.slice(0, 6).join(', ')}` : '',
          profile.riskMarkers.length ? `Avoid sensory negatives: ${profile.riskMarkers.slice(0, 5).join(', ')}` : '',
        ].filter(Boolean).join('\n'),
        mode,
        count: 3,
      },
    });

    if (error) {
      setGenerationError(error.message);
      setGenerating(false);
      return;
    }

    const images = (data?.images ?? []) as Array<{ url: string; revisedPrompt?: string }>;
    setAiCandidates(images.map((image) => ({ ...image, selected: true })));
    if (images.length === 0) {
      setGenerationError('OpenAI returned no images. Try a more specific concept description.');
    }
    setGenerating(false);
  };

  const addSelected = () => {
    const toAdd = aiCandidates.filter(c => c.selected && c.url).map(c => c.url);
    onChange({ ...draft, marketingImages: [...draft.marketingImages.filter(u => u.trim()), ...toAdd] });
    setAiCandidates([]);
  };

  const removeImage = (i: number) =>
    onChange({ ...draft, marketingImages: draft.marketingImages.filter((_, j) => j !== i) });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Create concept visuals</h2>
          <p className="text-slate-500 text-sm mt-1 max-w-2xl">
            Generate OpenAI concept images that match the food type, sensory promise, target consumer, and launch context.
          </p>
        </div>
        <Badge className="w-fit bg-slate-900 text-white">
          {detection.label} intelligence
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div>
            <Label className="font-medium">Visual direction</Label>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {IMAGE_MODES.map((option) => {
                const Icon = option.icon;
                const active = mode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setMode(option.id)}
                    className={`text-left rounded-lg border p-3 transition-all ${
                      active
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`size-4 ${active ? 'text-blue-600' : 'text-slate-500'}`} />
                      <span className="text-sm font-semibold text-slate-900">{option.label}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-snug">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">OpenAI image generation</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Uses your Supabase Edge Function with `OPENAI_API_KEY`, so admins never paste provider tokens into the browser.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate || generating}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {generating
                  ? <><Loader2 className="size-4 mr-2 animate-spin" />Generating</>
                  : aiCandidates.length > 0
                    ? <><RefreshCw className="size-4 mr-2" />Regenerate</>
                    : <><Sparkles className="size-4 mr-2" />Generate visuals</>}
              </Button>
            </div>

            {!canGenerate && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-3">
                Add product name, category, and description on the concept step before generating visuals.
              </p>
            )}
            {generationError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 mt-3">
                {generationError}
              </p>
            )}
          </div>

          {(generating || aiCandidates.length > 0) && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {generating && aiCandidates.length === 0
                  ? [0, 1, 2].map((i) => (
                      <div key={i} className="aspect-square rounded-xl border border-blue-100 bg-blue-50 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="size-5 text-blue-500 animate-spin" />
                        <span className="text-xs font-medium text-blue-700">Building visual {i + 1}</span>
                      </div>
                    ))
                  : aiCandidates.map((candidate, i) => (
                      <button
                        key={`${candidate.url}-${i}`}
                        type="button"
                        onClick={() => setAiCandidates(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                          candidate.selected ? 'border-blue-500 shadow-md' : 'border-slate-200 opacity-60'
                        }`}
                      >
                        <img src={candidate.url} alt={`Generated concept ${i + 1}`} className="h-full w-full object-cover" />
                        <span className={`absolute top-2 right-2 flex size-6 items-center justify-center rounded-full border-2 shadow-sm ${
                          candidate.selected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/90 border-slate-300 text-transparent'
                        }`}>
                          <CheckCircle2 className="size-3.5" />
                        </span>
                        <span className="absolute bottom-2 left-2 rounded-md bg-slate-950/75 px-2 py-1 text-xs font-semibold text-white">
                          Option {i + 1}
                        </span>
                      </button>
                    ))}
              </div>

              {!generating && aiCandidates.length > 0 && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500">Select the visuals that should be shown to panelists.</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setAiCandidates([])}>
                      Discard
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={addSelected}
                      disabled={!aiCandidates.some(c => c.selected && c.url)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Add {aiCandidates.filter(c => c.selected && c.url).length} to concept
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Food-aware prompt inputs</p>
            <p className="text-xs text-slate-500 mt-1">These signals are automatically passed into the generator.</p>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <p className="font-semibold text-slate-600">Success cues</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {profile.successMarkers.slice(0, 6).map(marker => (
                  <Badge key={marker} variant="outline" className="bg-white text-[11px] capitalize">{marker}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="font-semibold text-slate-600">Avoid cues</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {profile.riskMarkers.slice(0, 5).map(marker => (
                  <Badge key={marker} variant="outline" className="bg-white text-[11px] capitalize">{marker}</Badge>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Label className="font-medium flex items-center gap-1.5">
            <ImageIcon className="size-3.5" /> Concept image library
            {validImages.length > 0 && (
              <span className="text-xs font-normal text-slate-400">({validImages.length} selected for panelists)</span>
            )}
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...draft, marketingImages: [...draft.marketingImages, ''] })}
            className="w-fit text-slate-600 text-xs h-8"
          >
            <Plus className="size-3 mr-1" /> Add URL manually
          </Button>
        </div>

        {draft.marketingImages.map((url, i) => (
          url.startsWith('data:') ? null : (
            <div key={i} className="space-y-1">
              <div className="flex gap-2 items-center">
                <Input
                  value={url}
                  onChange={(e) => {
                    const next = [...draft.marketingImages];
                    next[i] = e.target.value;
                    onChange({ ...draft, marketingImages: next });
                  }}
                  placeholder="https://... (paste a URL)"
                  className="flex-1 text-xs"
                />
                <button type="button" onClick={() => removeImage(i)} className="text-slate-300 hover:text-rose-500 flex-shrink-0">
                  <Trash2 className="size-4" />
                </button>
              </div>
              {url.trim() && !isValidImageUrl(url) && (
                <p className="text-xs text-rose-500 pl-1">URL must start with https://</p>
              )}
            </div>
          )
        ))}

        {validImages.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {validImages.map((url, i) => (
              <div key={`${url}-${i}`} className="rounded-xl overflow-hidden border border-slate-200 shadow-sm group relative bg-white">
                <img src={url} alt={`Marketing concept ${i + 1}`} className="w-full aspect-square object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(draft.marketingImages.indexOf(url))}
                  className="absolute top-2 right-2 bg-white/90 hover:bg-rose-500 hover:text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                  aria-label={`Remove image ${i + 1}`}
                >
                  <Trash2 className="size-3" />
                </button>
                <div className="px-2 py-2 bg-white text-[11px] text-slate-500 text-center font-medium border-t border-slate-100">
                  Panelist visual {i + 1}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="border-2 border-dashed border-slate-200">
            <CardContent className="py-10 text-center">
              <ImageIcon className="size-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm font-medium">No concept visuals yet</p>
              <p className="text-slate-400 text-xs mt-1">Generate OpenAI visuals or paste an approved image URL.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
