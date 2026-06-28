import { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
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
  CheckCircle2, ChevronDown, Image as ImageIcon, Loader2,
  Plus, RefreshCw, ShieldCheck, Sparkles, Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { detectFoodType, getFoodTypeProfile } from '../../lib/food-intelligence';
import type { ConceptGenerationSettings } from '../../lib/db/concepts';
import {
  getConceptImageMode,
  getPromptStyle,
  normalizePromptStyle,
} from '../../../../supabase/functions/_shared/concept-image-catalog.ts';
import {
  buildConceptImageBrief,
  buildConceptImagePrompt,
} from '../../../../supabase/functions/_shared/concept-image-prompt.ts';
import type { ConceptDraft } from './types';
import { ImageDirectionPanel, type ImageGenerationOptions } from './ImageDirectionPanel';

interface CandidateImage {
  id?: string;
  url: string;
  selected: boolean;
  mode?: string;
  promptStyle?: string;
  summary?: string;
  revisedPrompt?: string;
}

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

function AIGovernancePanel({
  candidates,
  model,
  quality,
}: {
  candidates: CandidateImage[];
  model?: string;
  quality: ImageGenerationOptions['quality'];
}) {
  const selectedCount = candidates.filter(candidate => candidate.selected && candidate.url).length;
  const promptTraceCount = candidates.filter(candidate => candidate.revisedPrompt || candidate.summary).length;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-slate-500" />
        <p className="text-xs font-semibold text-slate-800">AI governance</p>
      </div>
      <div className="mt-3 grid gap-2 text-[11px] leading-4 text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
        <span><strong className="text-slate-800">Model:</strong> {model ?? 'gpt-image-1.5'}</span>
        <span><strong className="text-slate-800">Quality:</strong> {quality}</span>
        <span><strong className="text-slate-800">Approval:</strong> AI draft, admin review required</span>
        <span><strong className="text-slate-800">Prompt trace:</strong> {promptTraceCount}/{candidates.length} saved</span>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        {selectedCount > 0
          ? `${selectedCount} selected draft${selectedCount === 1 ? '' : 's'} can be added to the concept. They remain directional visuals until approved for panelist or report use.`
          : 'Select only visuals that are physically believable, on-brief, and free of fake claims or warped text.'}
      </p>
    </div>
  );
}

export function ImagesStep({
  draft,
  onChange,
  settings,
}: {
  draft: ConceptDraft;
  onChange: (d: ConceptDraft) => void;
  settings?: ConceptGenerationSettings;
}) {
  const maxImages = Math.max(1, settings?.maxImagesPerConcept ?? 4);
  const estimatedCostPerImage = settings?.estimatedCostPerImage ?? 0.034;
  const [options, setOptions] = useState<ImageGenerationOptions>(() => ({
    mode: 'packaging',
    count: Math.min(settings?.defaultImageCount ?? 4, maxImages),
    quality: settings?.defaultQuality ?? 'high',
    spreadModes: true,
  }));
  const [aiCandidates, setAiCandidates] = useState<CandidateImage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [generationConfirmationOpen, setGenerationConfirmationOpen] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const detection = useMemo(
    () => detectFoodType(draft.category, draft.name, draft.description),
    [draft.category, draft.description, draft.name],
  );
  const profile = getFoodTypeProfile(detection.slug);
  const validImages = draft.marketingImages.filter(u => u.trim() && isValidImageUrl(u));
  const canGenerate = !!(
    draft.name.trim()
    && draft.category.trim()
    && draft.description.trim()
    && draft.productAppearance.trim()
    && draft.packageFormat.trim()
    && draft.targetMarket.trim()
  );
  const generationChecklist = useMemo(() => [
    {
      label: 'Product and category',
      ready: Boolean(draft.name.trim() && draft.category.trim()),
      detail: draft.name.trim() && draft.category.trim()
        ? `${draft.name.trim()} in ${draft.category.trim()}`
        : 'Add the product name and category.',
    },
    {
      label: 'Retail pack reality',
      ready: Boolean(draft.productAppearance.trim() && draft.packageFormat.trim()),
      detail: draft.productAppearance.trim() && draft.packageFormat.trim()
        ? `${draft.productAppearance.trim()} · ${draft.packageFormat.trim()}`
        : 'Describe product appearance and the exact pack format.',
    },
    {
      label: 'Shopper and occasion',
      ready: Boolean(draft.targetMarket.trim() && draft.targetOccasion.trim()),
      detail: draft.targetMarket.trim() && draft.targetOccasion.trim()
        ? `${draft.targetMarket.trim()} · ${draft.targetOccasion.trim()}`
        : 'Add the target shopper and where they use it.',
    },
    {
      label: 'Must-show / must-not-show',
      ready: Boolean(draft.mustShow.trim() || draft.forbiddenClaims.trim() || draft.visualNotes.trim()),
      detail: draft.mustShow.trim() || draft.forbiddenClaims.trim() || draft.visualNotes.trim()
        ? 'Specific visual requirements are captured.'
        : 'Optional, but useful for avoiding generic generated results.',
    },
  ], [draft]);
  const estimatedCost = estimatedCostPerImage * options.count;
  const styleLabel = getPromptStyle(draft.promptStyle).label;
  const leadModeLabel = getConceptImageMode(options.mode).label;

  // Derive variant-dimension overrides for image generation.
  const variantImageMode = draft.variantDimensions?.channel === 'lifestyle' ? 'lifestyle' : options.mode;
  const variantPositioningCues = useMemo(() => {
    const cues: string[] = [];
    if (draft.variantDimensions?.positioning === 'premium') cues.push('premium aesthetic, typographic restraint');
    if (draft.variantDimensions?.positioning === 'accessible') cues.push('friendly, approachable, everyday');
    if (draft.variantDimensions?.appeal === 'health') cues.push('clean ingredients, natural textures, health cues');
    if (draft.variantDimensions?.appeal === 'indulgent') cues.push('rich, indulgent, sensory abundance');
    if (draft.variantDimensions?.visualComplexity === 'minimal') cues.push('minimal composition, whitespace-led');
    if (draft.variantDimensions?.visualComplexity === 'expressive') cues.push('bold, expressive, colourful');
    return cues;
  }, [
    draft.variantDimensions?.appeal,
    draft.variantDimensions?.positioning,
    draft.variantDimensions?.visualComplexity,
  ]);

  // Client-side preview of the brief the server will build. Branding
  // (organization name, report tone) is applied server-side from workspace
  // settings, so the preview uses the neutral fallback phrasing.
  const preview = useMemo(() => {
    if (!canGenerate) return null;
    const positioningParts = [
      draft.description,
      draft.pricePoint ? `priced around ${draft.pricePoint}` : '',
      ...variantPositioningCues,
    ].filter(Boolean);
    const brief = buildConceptImageBrief({
      productName: draft.name,
      conceptName: draft.name,
      foodCategory: draft.category || detection.label,
      conceptPositioning: positioningParts.join(', '),
      targetSegments: draft.targetMarket,
      targetOccasion: draft.targetOccasion,
      productAppearance: draft.packageFormat
        ? `${draft.productAppearance}${draft.variantDimensions?.packagingFormat ? ` (${draft.variantDimensions.packagingFormat})` : ''}`
        : draft.productAppearance,
      packageFormat: draft.packageFormat,
      visualSetting: draft.visualSetting,
      colorDirection: draft.colorDirection
        || (draft.variantDimensions?.brandColorScheme ? `${draft.variantDimensions.brandColorScheme} palette` : ''),
      mustShow: draft.mustShow,
      keyBenefits: draft.keyBenefits,
      sensoryStrengths: profile.successMarkers.slice(0, 6),
      technicalChallenges: [draft.technicalChallenges, ...profile.riskMarkers.slice(0, 5)].filter(Boolean).join('\n'),
      forbiddenClaims: draft.forbiddenClaims,
      visualNotes: draft.visualNotes,
      imageMode: variantImageMode,
      promptStyle: draft.promptStyle,
      model: settings?.defaultModel,
      quality: options.quality,
      count: options.count,
      projectName: draft.projectName,
      foodTypeSlug: detection.slug,
    });
    return buildConceptImagePrompt(brief);
  }, [canGenerate, detection.label, detection.slug, draft, options, profile.riskMarkers, profile.successMarkers, settings?.defaultModel, variantImageMode, variantPositioningCues]);

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
        targetOccasion: draft.targetOccasion,
        productAppearance: draft.productAppearance,
        packageFormat: draft.packageFormat,
        visualSetting: draft.visualSetting,
        colorDirection: draft.colorDirection
          || (draft.variantDimensions?.brandColorScheme ? `${draft.variantDimensions.brandColorScheme} palette` : ''),
        mustShow: draft.mustShow,
        pricePoint: draft.pricePoint,
        keyBenefits: draft.keyBenefits,
        sensoryStrengths: profile.successMarkers.slice(0, 6),
        technicalChallenges: [draft.technicalChallenges, ...profile.riskMarkers.slice(0, 5)].filter(Boolean).join('\n'),
        forbiddenClaims: draft.forbiddenClaims,
        visualNotes: [draft.visualNotes, ...variantPositioningCues].filter(Boolean).join('. '),
        mode: variantImageMode,
        promptStyle: normalizePromptStyle(draft.promptStyle),
        quality: options.quality,
        count: options.count,
        spreadModes: options.spreadModes,
        variantDimensions: draft.variantDimensions ?? {},
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

    const images = (data?.images ?? []) as Array<{
      id?: string; url: string; mode?: string; promptStyle?: string; summary?: string; revisedPrompt?: string;
    }>;
    setAiCandidates(images.map((image) => ({ ...image, selected: true })));
    if (images.length === 0) {
      setGenerationError('OpenAI returned no images. Try a more specific concept description.');
    }
    setGenerating(false);
  };

  const addSelected = () => {
    const remainingSlots = Math.max(0, maxImages - validImages.length);
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
      <div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Choose concept visuals</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Generate a focused set or add approved images. Panelists will see only the selected visuals.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <ImageDirectionPanel
            draft={draft}
            onChange={onChange}
            options={options}
            onOptionsChange={setOptions}
            maxCount={maxImages}
          />

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">AI image generation</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {options.spreadModes
                    ? `Generates ${options.count} distinct retail-ready formats, led by ${leadModeLabel.toLowerCase()}`
                    : `Generates ${options.count} ${leadModeLabel.toLowerCase()} variation${options.count > 1 ? 's' : ''}`}
                  {' '}into the {draft.projectName || 'Project 1'} folder.
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
                    : <><Sparkles className="size-4 mr-2" />Generate {options.count} visual{options.count > 1 ? 's' : ''}</>}
              </Button>
            </div>

            {!canGenerate && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-3">
                Complete the product name, category, description, appearance, package format, and target customer before generating visuals.
              </p>
            )}
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {generationChecklist.map(item => (
                <div
                  key={item.label}
                  className={`rounded-md border px-3 py-2 ${
                    item.ready
                      ? 'border-emerald-100 bg-emerald-50 text-emerald-950'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <CheckCircle2 className={`size-3.5 ${item.ready ? 'text-emerald-600' : 'text-slate-300'}`} />
                    {item.label}
                  </div>
                  <p className={`mt-1 text-[11px] leading-4 ${item.ready ? 'text-emerald-800' : 'text-slate-500'}`}>
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
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
                  ? Array.from({ length: options.count }, (_, i) => (
                      <div key={i} className="aspect-square rounded-xl border border-blue-100 bg-blue-50 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="size-5 text-blue-500 animate-spin" />
                        <span className="text-xs font-medium text-blue-700">Building visual {i + 1}</span>
                      </div>
                    ))
                  : aiCandidates.map((candidate, i) => {
                      const modeLabel = getConceptImageMode(candidate.mode ?? options.mode).label;
                      return (
                        <button
                          key={`${candidate.url}-${i}`}
                          type="button"
                          onClick={() => setAiCandidates(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))}
                          aria-label={`${candidate.selected ? 'Deselect' : 'Select'} generated ${modeLabel} concept option ${i + 1} for ${draft.name}`}
                          aria-pressed={candidate.selected}
                          className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                            candidate.selected ? 'border-blue-500 shadow-md' : 'border-slate-200 opacity-60'
                          }`}
                        >
                          <img
                            src={candidate.url}
                            alt={`Generated ${modeLabel} concept for ${draft.name}, option ${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <span className={`absolute top-2 right-2 flex size-6 items-center justify-center rounded-full border-2 shadow-sm ${
                            candidate.selected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/90 border-slate-300 text-transparent'
                          }`}>
                            <CheckCircle2 className="size-3.5" />
                          </span>
                          <span className="absolute bottom-2 left-2 rounded-md bg-slate-950/75 px-2 py-1 text-xs font-semibold text-white">
                            {modeLabel}
                          </span>
                        </button>
                      );
                    })}
              </div>

              {!generating && aiCandidates.length > 0 && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <DataProvenanceBadge provenance="ai-draft" n={aiCandidates.length} />
                    <p className="text-xs text-slate-500">
                      AI-generated drafts · {styleLabel} · {settings?.defaultModel ?? 'gpt-image-1.5'} ({options.quality}).
                      Select only visuals that look credible enough for consumer or buyer review.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setAiCandidates([])}>
                      Discard
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={addSelected}
                      disabled={!aiCandidates.some(c => c.selected && c.url) || validImages.length >= maxImages}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Add {Math.min(aiCandidates.filter(c => c.selected && c.url).length, Math.max(0, maxImages - validImages.length))} to concept
                    </Button>
                  </div>
                </div>
              )}
              {!generating && aiCandidates.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-800">Marketing review checklist</p>
                  <div className="mt-2 grid gap-2 text-[11px] leading-4 text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                    <span>Product and pack form are physically believable.</span>
                    <span>Food texture looks appetizing, not plastic or over-glossed.</span>
                    <span>No fake claims, badges, dense label copy, or warped text.</span>
                    <span>Image would hold up in a buyer slide or retail concept deck.</span>
                  </div>
                </div>
              )}
              {!generating && aiCandidates.length > 0 && (
                <AIGovernancePanel
                  candidates={aiCandidates}
                  model={settings?.defaultModel}
                  quality={options.quality}
                />
              )}
            </div>
          )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Label className="font-medium flex items-center gap-1.5">
            <ImageIcon className="size-3.5" /> Selected visuals
            {validImages.length > 0 && (
              <span className="text-xs font-normal text-slate-400">({validImages.length} for panelists)</span>
            )}
          </Label>
          {validImages.length > 0 && <DataProvenanceBadge provenance="approved" n={validImages.length} />}
        </div>

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
                  Panelist visual {i + 1} · AI draft
                </div>
              </div>
            ))}
          </div>
        ) : (
          <StageEmptyState
            icon={ImageIcon}
            headline="No concept visuals yet"
            body="Panelists need at least one concept visual to answer the visual-preference question. Generate AI visuals above or paste an approved image URL."
          />
        )}

        <Collapsible open={manualOpen} onOpenChange={setManualOpen} className="rounded-lg border border-slate-200">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
            <span className="text-xs font-semibold text-slate-700">Add an approved image URL</span>
            <ChevronDown className={`size-3.5 text-slate-500 transition-transform ${manualOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 border-t border-slate-200 p-3">
            {draft.marketingImages.map((url, i) => (
              url.startsWith('data:') ? null : (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      value={url}
                      onChange={(e) => {
                        const next = [...draft.marketingImages];
                        next[i] = e.target.value;
                        onChange({ ...draft, marketingImages: next });
                      }}
                      placeholder="https://..."
                      className="flex-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="shrink-0 text-slate-300 hover:text-rose-500"
                      aria-label={`Remove concept image URL ${i + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {url.trim() && !isValidImageUrl(url) && (
                    <p className="pl-1 text-xs text-rose-500">URL must start with https://</p>
                  )}
                </div>
              )
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange({
                ...draft,
                marketingImages: [...draft.marketingImages, ''],
                marketingImageIds: [...draft.marketingImageIds, ''],
              })}
              className="h-8 w-fit text-xs text-slate-600"
            >
              <Plus className="mr-1 size-3" /> Add URL
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <AlertDialog open={generationConfirmationOpen} onOpenChange={(open) => { setGenerationConfirmationOpen(open); if (!open) setPromptExpanded(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate {options.count} concept visual{options.count > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Generation begins only after you confirm. Images are AI-generated drafts until you select them for panelists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {preview && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-900">Art direction summary</p>
              <p className="text-xs text-blue-900/90 leading-snug">{preview.summary}</p>
              <p className="text-[11px] leading-4 text-blue-900/75">
                Built for retail concept review: {leadModeLabel.toLowerCase()} led, {styleLabel.toLowerCase()} creative territory,
                {options.quality} quality, with pack realism, food realism, and claim-safety constraints.
              </p>
              <button
                type="button"
                onClick={() => setPromptExpanded(expanded => !expanded)}
                aria-expanded={promptExpanded}
                className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900"
              >
                <ChevronDown className={`size-3 transition-transform ${promptExpanded ? 'rotate-180' : ''}`} />
                {promptExpanded ? 'Hide full prompt' : 'View full prompt (advanced)'}
              </button>
              {promptExpanded && (
                <p className="text-[11px] text-slate-600 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-2">
                  {preview.prompt}
                </p>
              )}
            </div>
          )}
          <dl className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-600">Images</dt>
              <dd className="font-semibold text-slate-900">{options.count}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-600">Model / quality</dt>
              <dd className="font-semibold text-slate-900">{settings?.defaultModel ?? 'gpt-image-1.5'} · {options.quality}</dd>
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
