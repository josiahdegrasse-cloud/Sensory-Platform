import { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { StageEmptyState } from '../stage-empty-state';
import { DataProvenanceBadge } from '../data-provenance-badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  CheckCircle2, Image as ImageIcon, Layers3, Loader2, Package,
  Plus, RefreshCw, Sparkles, Trash2, Utensils,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { detectFoodType, getFoodTypeProfile } from '../../lib/food-intelligence';
import type { ConceptDraft } from './types';

type ImageMode = 'packaging' | 'shelf' | 'usage' | 'ingredient' | 'ad';
const CONCEPT_IMAGE_COUNT = 4;

interface CandidateImage {
  id?: string;
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

function friendlyGenerationError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('function') && lower.includes('not found')) {
    return 'Image generator is not deployed yet. Deploy the generate-concept-images Supabase function.';
  }
  if (lower.includes('openai_api_key') || lower.includes('api key') || lower.includes('unauthorized') || lower.includes('401')) {
    return 'OpenAI key is missing or invalid in Supabase secrets.';
  }
  if (lower.includes('billing') || lower.includes('quota') || lower.includes('insufficient') || lower.includes('credits')) {
    return 'OpenAI billing or credits are not available for image generation.';
  }
  if (lower.includes('monthly image budget') || lower.includes('generation limit') || lower.includes('reached its limit')) {
    return message;
  }
  if (lower.includes('rate') || lower.includes('429')) {
    return 'OpenAI rate limit hit. Wait a minute and try again.';
  }
  if (lower.includes('concept_images') || lower.includes('concept_image_generations') || lower.includes('concept_generation_settings')) {
    return 'Concept Lab SQL migration has not been applied yet.';
  }
  if (lower.includes('concept-images') || lower.includes('bucket') || lower.includes('storage')) {
    return 'Concept image storage bucket is not ready in Supabase.';
  }
  return message || 'Image generation failed. Try again with a clearer concept brief.';
}

export function ImagesStep({
  draft,
  onChange,
  estimatedCostPerImage,
}: {
  draft: ConceptDraft;
  onChange: (d: ConceptDraft) => void;
  estimatedCostPerImage: number;
}) {
  const [mode, setMode] = useState<ImageMode>('packaging');
  const [aiCandidates, setAiCandidates] = useState<CandidateImage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [generationConfirmationOpen, setGenerationConfirmationOpen] = useState(false);

  const detection = useMemo(
    () => detectFoodType(draft.category, draft.name, draft.description),
    [draft.category, draft.description, draft.name],
  );
  const profile = getFoodTypeProfile(detection.slug);
  const validImages = draft.marketingImages.filter(u => u.trim() && isValidImageUrl(u));
  const canGenerate = !!(draft.name.trim() && draft.category.trim() && draft.description.trim());
  const estimatedCost = estimatedCostPerImage * CONCEPT_IMAGE_COUNT;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerationConfirmationOpen(false);
    setGenerating(true);
    setGenerationError('');
    setAiCandidates([]);

    const { data, error } = await supabase.functions.invoke('generate-concept-images', {
      body: {
        conceptName: draft.name,
        category: draft.category || detection.label,
        foodTypeSlug: detection.slug,
        projectName: draft.projectName,
        description: draft.description,
        targetMarket: draft.targetMarket,
        pricePoint: draft.pricePoint,
        keyBenefits: [
          draft.keyBenefits,
          profile.successMarkers.length ? `Desired sensory cues: ${profile.successMarkers.slice(0, 6).join(', ')}` : '',
          profile.riskMarkers.length ? `Avoid sensory negatives: ${profile.riskMarkers.slice(0, 5).join(', ')}` : '',
        ].filter(Boolean).join('\n'),
        mode,
        promptStyle: draft.promptStyle,
        count: CONCEPT_IMAGE_COUNT,
      },
    });

    if (error) {
      let message = error.message;
      const response = (error as { context?: Response }).context;
      if (response instanceof Response) {
        try {
          const body = await response.clone().json();
          message = body?.error ?? message;
        } catch {
          // response body wasn't JSON; fall back to error.message
        }
      }
      setGenerationError(friendlyGenerationError(message));
      setGenerating(false);
      return;
    }

    const images = (data?.images ?? []) as Array<{ id?: string; url: string; revisedPrompt?: string }>;
    setAiCandidates(images.map((image) => ({ ...image, selected: true })));
    if (images.length === 0) {
      setGenerationError('OpenAI returned no images. Try a more specific concept description.');
    }
    setGenerating(false);
  };

  const addSelected = () => {
    const remainingSlots = Math.max(0, CONCEPT_IMAGE_COUNT - validImages.length);
    const selectedCandidates = aiCandidates.filter(c => c.selected && c.url).slice(0, remainingSlots);
    const toAdd = selectedCandidates.map(c => c.url);
    const imageIds = selectedCandidates.map(c => c.id ?? '');
    const existingPairs = draft.marketingImages
      .map((url, index) => ({ url, id: draft.marketingImageIds[index] ?? '' }))
      .filter(pair => pair.url.trim());
    onChange({
      ...draft,
      marketingImages: [...existingPairs.map(pair => pair.url), ...toAdd],
      marketingImageIds: [...existingPairs.map(pair => pair.id), ...imageIds],
    });
    setAiCandidates([]);
  };

  const removeImage = (i: number) =>
    onChange({
      ...draft,
      marketingImages: draft.marketingImages.filter((_, j) => j !== i),
      marketingImageIds: draft.marketingImageIds.filter((_, j) => j !== i),
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Create concept visuals</h2>
          <p className="text-slate-500 text-sm mt-1 max-w-2xl">
            Generate OpenAI concept images that match the food type, sensory promise, target consumer, and launch context.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">{CONCEPT_IMAGE_COUNT} visuals</span>
          <span className="mx-1.5 text-slate-300">/</span>
          {draft.promptStyle.replace('-', ' ')}
          <span className="mx-1.5 text-slate-300">/</span>
          {detection.label}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div>
            <Label className="font-medium">Lead visual direction</Label>
            <p className="text-xs text-slate-500 mt-1">
              We generate {CONCEPT_IMAGE_COUNT} genuinely different concepts per batch — packaging hero, lifestyle usage, shelf context, and ad concept — so panelists can compare distinct directions. Pick which one leads the set.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {IMAGE_MODES.map((option) => {
                const Icon = option.icon;
                const active = mode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setMode(option.id)}
                    aria-label={`${option.label}: ${option.description}`}
                    aria-pressed={active}
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
                  Generates {CONCEPT_IMAGE_COUNT} distinct, campaign-quality concepts — each its own angle and prompt — into the {draft.projectName || 'Project 1'} folder.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setGenerationConfirmationOpen(true)}
                disabled={!canGenerate || generating}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {generating
                  ? <><Loader2 className="size-4 mr-2 animate-spin" />Generating</>
                  : aiCandidates.length > 0
                    ? <><RefreshCw className="size-4 mr-2" />Regenerate</>
                    : <><Sparkles className="size-4 mr-2" />Generate {CONCEPT_IMAGE_COUNT} visuals</>}
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
            {canGenerate && !generating && (
              <p className="text-[11px] text-slate-500 mt-3">
                Estimated cost per generation: about ${estimatedCost.toFixed(2)}.
              </p>
            )}
          </div>

          {(generating || aiCandidates.length > 0) && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {generating && aiCandidates.length === 0
                  ? Array.from({ length: CONCEPT_IMAGE_COUNT }, (_, i) => (
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
                        aria-label={`${candidate.selected ? 'Deselect' : 'Select'} generated ${mode} concept option ${i + 1} for ${draft.name}`}
                        aria-pressed={candidate.selected}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                          candidate.selected ? 'border-blue-500 shadow-md' : 'border-slate-200 opacity-60'
                        }`}
                      >
                        <img
                          src={candidate.url}
                          alt={`Generated ${mode} concept for ${draft.name}, option ${i + 1}`}
                          className="h-full w-full object-cover"
                        />
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <DataProvenanceBadge provenance="ai-draft" n={aiCandidates.length} />
                    <p className="text-xs text-slate-500">Select the visuals panelists should compare — keep them genuinely distinct so the "best image" question has a real choice to make.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setAiCandidates([])}>
                      Discard
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={addSelected}
                      disabled={!aiCandidates.some(c => c.selected && c.url) || validImages.length >= CONCEPT_IMAGE_COUNT}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Add {Math.min(aiCandidates.filter(c => c.selected && c.url).length, Math.max(0, CONCEPT_IMAGE_COUNT - validImages.length))} to concept
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Prompt context: {profile.successMarkers.slice(0, 4).join(', ')}
        {profile.riskMarkers.length > 0 && ` · avoids ${profile.riskMarkers.slice(0, 3).join(', ')}`}
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Label className="font-medium flex items-center gap-1.5">
            <ImageIcon className="size-3.5" /> Concept image library
            {validImages.length > 0 && (
              <span className="text-xs font-normal text-slate-400">({validImages.length} selected for panelists)</span>
            )}
          </Label>
          <div className="flex items-center gap-2">
            {validImages.length > 0 && <DataProvenanceBadge provenance="approved" n={validImages.length} />}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange({
                ...draft,
                marketingImages: [...draft.marketingImages, ''],
                marketingImageIds: [...draft.marketingImageIds, ''],
              })}
              className="w-fit text-slate-600 text-xs h-8"
            >
              <Plus className="size-3 mr-1" /> Add URL manually
            </Button>
          </div>
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
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="text-slate-300 hover:text-rose-500 flex-shrink-0"
                  aria-label={`Remove concept image URL ${i + 1}`}
                >
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
                <img
                  src={url}
                  alt={`Approved concept visual for ${draft.name || 'this concept'}, option ${i + 1}`}
                  className="w-full aspect-square object-cover"
                />
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
          <StageEmptyState
            icon={ImageIcon}
            headline="No concept visuals yet"
            body="Panelists need at least one concept visual to answer the visual-preference question. Generate OpenAI visuals above or paste an approved image URL."
          />
        )}
      </div>

      <AlertDialog open={generationConfirmationOpen} onOpenChange={setGenerationConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate {CONCEPT_IMAGE_COUNT} concept visuals?</AlertDialogTitle>
            <AlertDialogDescription>
              OpenAI will generate {CONCEPT_IMAGE_COUNT} medium-quality images for this concept. Generation begins only after you confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <dl className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-600">Images</dt>
              <dd className="font-semibold text-slate-900">{CONCEPT_IMAGE_COUNT}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-600">Estimated cost per image</dt>
              <dd className="font-semibold text-slate-900">${estimatedCostPerImage.toFixed(3)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-2">
              <dt className="font-semibold text-slate-800">Estimated total</dt>
              <dd className="font-bold text-slate-950">${estimatedCost.toFixed(2)}</dd>
            </div>
          </dl>
          <p className="text-xs text-slate-500">This is an estimate based on the workspace setting. Actual OpenAI billing may vary.</p>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={handleGenerate} className="bg-blue-600 hover:bg-blue-700">
              Generate visuals
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
