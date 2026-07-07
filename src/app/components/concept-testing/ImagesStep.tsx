import { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
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
  CheckCircle2, ChevronDown, Image as ImageIcon, Loader2, Lock,
  Plus, RefreshCw, ShieldCheck, Sparkles, Star, Trash2, Unlock, Wand2,
} from 'lucide-react';
import { Switch } from '../ui/switch';
import { supabase } from '../../lib/supabase';
import { updateConceptImageReviewStatus } from '../../lib/database';
import { useAdoptBrandKit, useWorkspaceSettings } from '../../lib/hooks';
import { detectFoodType, getFoodTypeProfile } from '../../lib/food-intelligence';
import type { ConceptGenerationSettings } from '../../lib/db/concepts';
import { useAuth } from '../../contexts/auth-context';
import {
  getConceptImageMode,
  getPromptStyle,
  normalizePromptStyle,
} from '../../../../supabase/functions/_shared/concept-image-catalog.ts';
import {
  buildConceptImageBrief,
  buildConceptImagePrompt,
  type ConceptReferenceContext,
} from '../../../../supabase/functions/_shared/concept-image-prompt.ts';
import type {
  ConceptDraft,
  ConceptVisualQaKey,
  ConceptVisualReview,
  ConceptVisualReviewStatus,
} from './types';
import { ImageDirectionPanel, type ImageGenerationOptions } from './ImageDirectionPanel';

interface CandidateImage {
  id?: string;
  url: string;
  selected: boolean;
  mode?: string;
  size?: string;
  storagePath?: string;
  promptStyle?: string;
  summary?: string;
  revisedPrompt?: string;
  reviewStatus: ConceptVisualReviewStatus;
  qa: Partial<Record<ConceptVisualQaKey, boolean>>;
  reviewNotes: string;
  reviewError?: string;
  reviewing?: boolean;
}

const QA_ITEMS: Array<{ key: ConceptVisualQaKey; label: string }> = [
  { key: 'packBelievability', label: 'Product and pack form are physically believable.' },
  { key: 'foodRealism', label: 'Food texture looks appetizing and realistic.' },
  { key: 'claimSafety', label: 'No fake claims, badges, QR codes, certifications, or dense AI text.' },
  { key: 'audienceFit', label: 'Visual fits the target customer and occasion.' },
  { key: 'panelistReady', label: 'Safe and clear enough for panelist stimulus use.' },
  { key: 'buyerDeckReady', label: 'Strong enough for a buyer or internal review deck.' },
];

function emptyReview(imageId = '', source: ConceptVisualReview['source'] = 'external'): ConceptVisualReview {
  return {
    imageId,
    source,
    status: 'selected',
    qa: {},
    notes: '',
  };
}

function statusLabel(status: ConceptVisualReviewStatus) {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  if (status === 'selected') return 'Selected';
  return 'Draft';
}

function statusClasses(status: ConceptVisualReviewStatus) {
  if (status === 'approved') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'rejected') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (status === 'selected') return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function qaComplete(qa: Partial<Record<ConceptVisualQaKey, boolean>>) {
  return QA_ITEMS.every(item => qa[item.key]);
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
  sourceLabel,
}: {
  candidates: CandidateImage[];
  model?: string;
  quality: ImageGenerationOptions['quality'];
  /** Provenance of this batch: fresh, locked-design re-stage, or brand-kit anchored. */
  sourceLabel: string;
}) {
  const selectedCount = candidates.filter(candidate => candidate.selected && candidate.url).length;
  const promptTraceCount = candidates.filter(candidate => candidate.revisedPrompt || candidate.summary).length;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-slate-500" />
        <p className="text-xs font-semibold text-slate-700">AI governance</p>
      </div>
      <div className="mt-3 grid gap-2 text-[11px] leading-4 text-slate-700 sm:grid-cols-2 lg:grid-cols-5">
        <span><strong className="text-slate-700">Model:</strong> {model ?? 'gpt-image-1.5'}</span>
        <span><strong className="text-slate-700">Quality:</strong> {quality}</span>
        <span><strong className="text-slate-700">Source:</strong> {sourceLabel}</span>
        <span><strong className="text-slate-700">Approval:</strong> AI draft, admin review required</span>
        <span><strong className="text-slate-700">Prompt trace:</strong> {promptTraceCount}/{candidates.length} saved</span>
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
  requireApproval,
}: {
  draft: ConceptDraft;
  onChange: (d: ConceptDraft) => void;
  settings?: ConceptGenerationSettings;
  requireApproval: boolean;
}) {
  const { user } = useAuth();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const adoptBrandKit = useAdoptBrandKit();
  const maxImages = Math.max(1, settings?.maxImagesPerConcept ?? 4);
  const estimatedCostPerImage = settings?.estimatedCostPerImage ?? 0.034;
  const [options, setOptions] = useState<ImageGenerationOptions>(() => ({
    mode: 'packaging',
    count: Math.min(settings?.defaultImageCount ?? 4, maxImages),
    quality: settings?.defaultQuality ?? 'high',
    spreadModes: true,
    sizeOverride: 'auto',
    useLockedDesign: true,
  }));
  const [aiCandidates, setAiCandidates] = useState<CandidateImage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [generationConfirmationOpen, setGenerationConfirmationOpen] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  // Single-image refinement: one open refine box at a time.
  const [refine, setRefine] = useState<{ index: number | null; text: string; busy: boolean; error: string }>({
    index: null, text: '', busy: false, error: '',
  });

  const brandKit = workspaceSettings?.brandKit ?? null;
  const lockedDesignActive = Boolean(draft.brandReference && options.useLockedDesign);

  const detection = useMemo(
    () => detectFoodType(draft.category, draft.name, draft.description),
    [draft.category, draft.description, draft.name],
  );
  const profile = getFoodTypeProfile(detection.slug);
  const validImageEntries = draft.marketingImages
    .map((url, index) => ({
      url,
      index,
      id: draft.marketingImageIds[index] ?? '',
      review: draft.marketingImageReviews[index] ?? emptyReview(draft.marketingImageIds[index] ?? ''),
    }))
    .filter(entry => entry.url.trim() && isValidImageUrl(entry.url));
  const validImages = validImageEntries.map(entry => entry.url);
  const approvedImageCount = validImageEntries.filter(entry => entry.review.status === 'approved').length;
  const canGenerate = !!(
    draft.name.trim()
    && draft.category.trim()
    && draft.description.trim()
    && draft.productAppearance.trim()
    && draft.packageFormat.trim()
    && draft.targetMarket.trim()
  );
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

  // Mirrors the server's reference context so the previewed prompt matches
  // what will actually be sent (locked design + org brand kit).
  const previewReferenceContext = useMemo<ConceptReferenceContext | null>(() => {
    if (!lockedDesignActive && !brandKit) return null;
    return {
      productLocked: lockedDesignActive,
      brandKit: brandKit
        ? {
            brandDescriptor: brandKit.brandDescriptor,
            brandColors: [workspaceSettings?.primaryColor, workspaceSettings?.accentColor].filter((c): c is string => Boolean(c)),
            hasReferenceImage: Boolean(brandKit.referenceImagePath),
          }
        : null,
    };
  }, [brandKit, lockedDesignActive, workspaceSettings?.accentColor, workspaceSettings?.primaryColor]);

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
    return buildConceptImagePrompt(brief, previewReferenceContext);
  }, [canGenerate, detection.label, detection.slug, draft, options, previewReferenceContext, profile.riskMarkers, profile.successMarkers, settings?.defaultModel, variantImageMode, variantPositioningCues]);

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
        size: options.sizeOverride,
        // Locked design: every image in the batch re-stages this exact pack.
        referenceImageIds: lockedDesignActive && draft.brandReference ? [draft.brandReference.imageId] : [],
        useBrandKit: true,
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
      id?: string; url: string; mode?: string; size?: string; storagePath?: string;
      promptStyle?: string; summary?: string; revisedPrompt?: string;
    }>;
    setAiCandidates(images.map((image) => ({
      ...image,
      selected: true,
      reviewStatus: 'draft',
      qa: {},
      reviewNotes: '',
    })));
    if (images.length === 0) {
      setGenerationError('OpenAI returned no images. Try a more specific concept description.');
    }
    setGenerating(false);
  };

  // Targeted single-image revision via the image-edit endpoint: keeps the rest
  // of the batch, replaces only the refined candidate (as a fresh AI draft).
  const handleRefine = async (candidateIndex: number) => {
    const candidate = aiCandidates[candidateIndex];
    if (!candidate?.id || refine.busy) return;
    setRefine(prev => ({ ...prev, busy: true, error: '' }));
    const { data, error } = await supabase.functions.invoke('generate-concept-images', {
      body: {
        intent: 'refine',
        baseImageId: candidate.id,
        refineInstruction: refine.text,
        conceptName: draft.name,
        category: draft.category || detection.label,
        foodTypeSlug: detection.slug,
        projectName: draft.projectName,
        promptStyle: normalizePromptStyle(draft.promptStyle),
        quality: options.quality,
      },
    });
    if (error) {
      let message = error.message;
      const response = (error as { context?: Response }).context;
      if (response instanceof Response) {
        try {
          const body = await response.clone().json();
          message = body?.error ?? message;
        } catch { /* not JSON */ }
      }
      setRefine(prev => ({ ...prev, busy: false, error: friendlyGenerationError(message) }));
      return;
    }
    const image = ((data?.images ?? []) as Array<{
      id?: string; url: string; mode?: string; size?: string; storagePath?: string;
      promptStyle?: string; summary?: string; revisedPrompt?: string;
    }>)[0];
    if (!image?.url) {
      setRefine(prev => ({ ...prev, busy: false, error: 'The refinement returned no image. Try a more specific instruction.' }));
      return;
    }
    setAiCandidates(prev => prev.map((item, index) => index === candidateIndex
      ? { ...image, selected: true, reviewStatus: 'draft' as const, qa: {}, reviewNotes: '' }
      : item));
    setRefine({ index: null, text: '', busy: false, error: '' });
  };

  const lockDesign = (candidate: CandidateImage) => {
    if (!candidate.id) return;
    onChange({
      ...draft,
      brandReference: { imageId: candidate.id, url: candidate.url, mode: candidate.mode ?? 'packaging' },
    });
    setOptions(prev => ({ ...prev, useLockedDesign: true }));
  };

  const adoptAsCompanyBrand = (imageId: string) => {
    if (!imageId || adoptBrandKit.isPending) return;
    adoptBrandKit.mutate({
      imageId,
      sourceConceptName: draft.name,
      actorId: user?.id ?? null,
    });
  };

  const addSelected = () => {
    const remainingSlots = Math.max(0, maxImages - validImages.length);
    const selectedCandidates = aiCandidates
      .filter(c => c.selected && c.url && c.reviewStatus !== 'rejected')
      .filter(c => !requireApproval || c.reviewStatus === 'approved')
      .slice(0, remainingSlots);
    const toAdd = selectedCandidates.map(c => c.url);
    const imageIds = selectedCandidates.map(c => c.id ?? '');
    const existingPairs = draft.marketingImages
      .map((url, index) => ({
        url,
        id: draft.marketingImageIds[index] ?? '',
        review: draft.marketingImageReviews[index] ?? emptyReview(draft.marketingImageIds[index] ?? ''),
      }))
      .filter(pair => pair.url.trim());
    const newReviews: ConceptVisualReview[] = selectedCandidates.map(candidate => ({
      imageId: candidate.id ?? '',
      source: candidate.id ? 'ai' : 'external',
      status: candidate.reviewStatus === 'approved' ? 'approved' : 'selected',
      qa: candidate.qa,
      notes: candidate.reviewNotes,
      reviewedAt: candidate.reviewStatus === 'approved' ? new Date().toISOString() : undefined,
      reviewedBy: candidate.reviewStatus === 'approved' ? user?.id : undefined,
    }));
    onChange({
      ...draft,
      marketingImages: [...existingPairs.map(pair => pair.url), ...toAdd],
      marketingImageIds: [...existingPairs.map(pair => pair.id), ...imageIds],
      marketingImageReviews: [...existingPairs.map(pair => pair.review), ...newReviews],
    });
    setAiCandidates([]);
  };

  const removeImage = (i: number) =>
    onChange({
      ...draft,
      marketingImages: draft.marketingImages.filter((_, j) => j !== i),
      marketingImageIds: draft.marketingImageIds.filter((_, j) => j !== i),
      marketingImageReviews: draft.marketingImageReviews.filter((_, j) => j !== i),
    });

  const updateDraftImageReview = (imageIndex: number, patch: Partial<ConceptVisualReview>) => {
    const nextReviews = draft.marketingImages.map((_, index) => ({
      ...(draft.marketingImageReviews[index] ?? emptyReview(draft.marketingImageIds[index] ?? '')),
      imageId: draft.marketingImageIds[index] ?? '',
      source: draft.marketingImageIds[index] ? 'ai' as const : 'external' as const,
    }));
    nextReviews[imageIndex] = { ...nextReviews[imageIndex], ...patch };
    onChange({ ...draft, marketingImageReviews: nextReviews });
  };

  const persistReview = async (
    imageId: string,
    status: ConceptVisualReviewStatus,
    qa: Partial<Record<ConceptVisualQaKey, boolean>>,
    notes: string,
  ) => {
    if (!imageId) return;
    await updateConceptImageReviewStatus([imageId], status, {
      qaSummary: qa,
      notes,
      reviewedBy: user?.id ?? null,
      reviewedAt: new Date().toISOString(),
    });
  };

  const reviewCandidate = async (candidateIndex: number, status: ConceptVisualReviewStatus) => {
    const candidate = aiCandidates[candidateIndex];
    if (!candidate) return;
    setAiCandidates(prev => prev.map((item, index) => index === candidateIndex
      ? { ...item, reviewing: true, reviewError: '' }
      : item));
    try {
      await persistReview(candidate.id ?? '', status, candidate.qa, candidate.reviewNotes);
      setAiCandidates(prev => prev.map((item, index) => index === candidateIndex
        ? {
          ...item,
          reviewStatus: status,
          selected: status === 'rejected' ? false : item.selected,
          reviewing: false,
        }
        : item));
    } catch (err) {
      setAiCandidates(prev => prev.map((item, index) => index === candidateIndex
        ? {
          ...item,
          reviewing: false,
          reviewError: err instanceof Error ? err.message : 'Could not save image review.',
        }
        : item));
    }
  };

  const reviewSelectedImage = async (imageIndex: number, status: ConceptVisualReviewStatus) => {
    const review = draft.marketingImageReviews[imageIndex] ?? emptyReview(draft.marketingImageIds[imageIndex] ?? '');
    updateDraftImageReview(imageIndex, {
      status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: user?.id,
    });
    try {
      await persistReview(draft.marketingImageIds[imageIndex] ?? '', status, review.qa, review.notes);
    } catch (err) {
      updateDraftImageReview(imageIndex, {
        status: review.status,
        notes: `${review.notes}${review.notes ? '\n' : ''}Review save failed: ${err instanceof Error ? err.message : 'Could not save image review.'}`,
      });
    }
  };

  const selectedVisualsSection = (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <ImageIcon className="size-4 text-slate-500" /> Panelist visuals
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            These are the concept stimulus images panelists will actually see.
          </p>
        </div>
        {validImages.length > 0 ? (
          <DataProvenanceBadge provenance={requireApproval && approvedImageCount < validImages.length ? 'ai-draft' : 'approved'} n={validImages.length} />
        ) : (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
            Required
          </span>
        )}
      </div>

      <div className="p-4">
        {validImages.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {validImageEntries.map(({ url, index, id, review }, i) => {
              const complete = qaComplete(review.qa);
              return (
              <div key={`${url}-${index}`} className="group overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="relative">
                <img
                  src={url}
                  alt={`Approved concept visual for ${draft.name || 'this concept'}, option ${i + 1}`}
                  className="aspect-square w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute right-2 top-2 rounded-full bg-white/95 p-1 text-slate-500 opacity-0 shadow-sm transition-all hover:bg-rose-500 hover:text-white group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Remove image ${i + 1}`}
                >
                  <Trash2 className="size-3" />
                </button>
                </div>
                <div className="space-y-3 border-t border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-slate-500">Visual {i + 1}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClasses(review.status)}`}>
                      {statusLabel(review.status)}
                    </span>
                  </div>
                  {requireApproval && review.status !== 'approved' && (
                    <p className="text-[11px] leading-4 text-amber-700">
                      Approval required before this can launch.
                    </p>
                  )}
                  <div className="space-y-1.5">
                    {QA_ITEMS.map(item => (
                      <label key={item.key} className="flex items-start gap-2 text-[11px] leading-4 text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(review.qa[item.key])}
                          onChange={(event) => updateDraftImageReview(index, {
                            qa: { ...review.qa, [item.key]: event.target.checked },
                          })}
                          className="mt-0.5"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                  <Textarea
                    value={review.notes}
                    onChange={(event) => updateDraftImageReview(index, { notes: event.target.value })}
                    placeholder="Reviewer note"
                    className="min-h-16 text-xs"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!complete}
                      onClick={() => reviewSelectedImage(index, 'approved')}
                      className="h-8 text-xs"
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => reviewSelectedImage(index, 'rejected')}
                      className="h-8 border-rose-200 text-rose-700 hover:bg-rose-50"
                    >
                      Reject
                    </Button>
                    {id ? (
                      <span className="self-center text-[11px] text-slate-500">AI provenance saved</span>
                    ) : (
                      <span className="self-center text-[11px] text-slate-500">External image</span>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <StageEmptyState
            icon={ImageIcon}
            headline="No panelist visuals selected"
            body="Generate draft options below or add an approved image URL. At least one visual is required before launch."
          />
        )}

        <Collapsible open={manualOpen} onOpenChange={setManualOpen} className="mt-4 rounded-lg border border-slate-200">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
            <span className="text-xs font-semibold text-slate-700">Add external image URL</span>
            <ChevronDown className={`size-3.5 text-slate-500 transition-transform ${manualOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 border-t border-slate-200 p-3">
            {draft.marketingImages.map((url, i) => (
              url.startsWith('data:') ? null : (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`Concept image URL ${i + 1}`}
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
                marketingImageReviews: [...draft.marketingImageReviews, emptyReview('', 'external')],
              })}
              className="h-8 w-fit text-xs text-slate-700"
            >
              <Plus className="mr-1 size-3" /> Add URL
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Choose concept visuals</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Review the visuals panelists will see, then generate or add options when the set needs work.
          </p>
        </div>
      </div>

      {selectedVisualsSection}

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Create visual options</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Generate AI drafts from the approved brief, then add only credible options to the panelist set above.
          </p>
        </div>
        <div className="space-y-4 p-4">
          {draft.brandReference && (
            <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={draft.brandReference.url}
                  alt="Locked product design"
                  className="size-12 shrink-0 rounded-md border border-blue-200 bg-white object-contain"
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-950">
                    <Lock className="size-3.5" aria-hidden /> Product design locked
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-blue-900">
                    {options.useLockedDesign
                      ? 'New batches re-stage this exact pack across formats instead of inventing a new design each time.'
                      : 'Lock is paused — this batch explores fresh design directions.'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <label htmlFor="use-locked-design" className="flex items-center gap-2 text-[11px] font-semibold text-blue-950">
                  Re-stage locked design
                  <Switch
                    id="use-locked-design"
                    checked={options.useLockedDesign}
                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, useLockedDesign: checked }))}
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onChange({ ...draft, brandReference: null })}
                  className="h-8 border-blue-200 text-xs text-blue-900 hover:bg-blue-100"
                >
                  <Unlock className="mr-1 size-3" /> Unlock
                </Button>
              </div>
            </div>
          )}

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
                    ? `Generates ${options.count} distinct concept-visual formats, led by ${leadModeLabel.toLowerCase()}`
                    : `Generates ${options.count} ${leadModeLabel.toLowerCase()} variation${options.count > 1 ? 's' : ''}`}
                  {' '}into the {draft.projectName || 'Project 1'} folder.
                  {lockedDesignActive && ' Re-stages the locked design.'}
                  {!lockedDesignActive && brandKit && ' Applies the company brand kit.'}
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
            {canGenerate && (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="size-3.5" />
                Brief is ready for visual generation.
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
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Generated drafts</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Review AI drafts before moving credible, approved options into the panelist stimulus set.
                  </p>
                </div>
                {!generating && aiCandidates.length > 0 && (
                  <DataProvenanceBadge provenance="ai-draft" n={aiCandidates.length} />
                )}
              </div>
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {generating && aiCandidates.length === 0
                  ? Array.from({ length: options.count }, (_, i) => (
                      <div key={i} className="aspect-square rounded-lg border border-blue-100 bg-blue-50 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="size-5 text-blue-500 animate-spin" />
                        <span className="text-xs font-medium text-blue-700">Building visual {i + 1}</span>
                      </div>
                    ))
                  : aiCandidates.map((candidate, i) => {
                      const modeLabel = getConceptImageMode(candidate.mode ?? options.mode).label;
                      const complete = qaComplete(candidate.qa);
                      return (
                        <div
                          key={`${candidate.url}-${i}`}
                          className={`overflow-hidden rounded-lg border-2 bg-white transition-all ${
                            candidate.selected ? 'border-blue-500' : 'border-slate-200 opacity-65 hover:opacity-100'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (candidate.reviewStatus === 'rejected') return;
                              setAiCandidates(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x));
                            }}
                            aria-label={`${candidate.selected ? 'Deselect' : 'Select'} generated ${modeLabel} concept option ${i + 1} for ${draft.name}`}
                            aria-pressed={candidate.selected}
                            className="relative block aspect-square w-full overflow-hidden"
                          >
                          <img
                            src={candidate.url}
                            alt={`Generated ${modeLabel} concept for ${draft.name}, option ${i + 1}`}
                            className="h-full w-full bg-slate-100 object-contain"
                          />
                          <span className={`absolute top-2 right-2 flex size-6 items-center justify-center rounded-full border-2 shadow-sm ${
                            candidate.selected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/90 border-slate-200 text-transparent'
                          }`}>
                            <CheckCircle2 className="size-3.5" />
                          </span>
                          <span className="absolute bottom-2 left-2 rounded-md bg-slate-950/75 px-2 py-1 text-xs font-semibold text-white">
                            {modeLabel}
                          </span>
                          </button>
                          <div className="space-y-3 border-t border-slate-200 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClasses(candidate.reviewStatus)}`}>
                                {statusLabel(candidate.reviewStatus)}
                              </span>
                              {candidate.revisedPrompt || candidate.summary ? (
                                <span className="text-[11px] text-slate-500">Prompt trace saved</span>
                              ) : null}
                            </div>
                            <div className="space-y-1.5">
                              {QA_ITEMS.map(item => (
                                <label key={item.key} className="flex items-start gap-2 text-[11px] leading-4 text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(candidate.qa[item.key])}
                                    onChange={(event) => setAiCandidates(prev => prev.map((itemCandidate, index) => index === i
                                      ? { ...itemCandidate, qa: { ...itemCandidate.qa, [item.key]: event.target.checked } }
                                      : itemCandidate))}
                                    className="mt-0.5"
                                  />
                                  <span>{item.label}</span>
                                </label>
                              ))}
                            </div>
                            <Textarea
                              value={candidate.reviewNotes}
                              onChange={(event) => setAiCandidates(prev => prev.map((itemCandidate, index) => index === i
                                ? { ...itemCandidate, reviewNotes: event.target.value }
                                : itemCandidate))}
                              placeholder="Reviewer note"
                              className="min-h-16 text-xs"
                            />
                            {candidate.reviewError && (
                              <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">
                                {candidate.reviewError}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!complete || candidate.reviewing}
                                onClick={() => reviewCandidate(i, 'approved')}
                                className="h-8 text-xs"
                              >
                                {candidate.reviewing ? 'Saving...' : 'Approve'}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={candidate.reviewing}
                                onClick={() => reviewCandidate(i, 'rejected')}
                                className="h-8 border-rose-200 text-rose-700 hover:bg-rose-50"
                              >
                                Reject
                              </Button>
                            </div>
                            {candidate.id && (
                              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={draft.brandReference?.imageId === candidate.id}
                                  onClick={() => lockDesign(candidate)}
                                  className="h-8 text-xs"
                                  title="Use this exact design for every further image of this concept"
                                >
                                  <Lock className="mr-1 size-3" />
                                  {draft.brandReference?.imageId === candidate.id ? 'Design locked' : 'Lock design'}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={refine.busy}
                                  onClick={() => setRefine(prev => prev.index === i
                                    ? { index: null, text: '', busy: false, error: '' }
                                    : { index: i, text: '', busy: false, error: '' })}
                                  className="h-8 text-xs"
                                  title="Keep this image and request one focused change"
                                >
                                  <Wand2 className="mr-1 size-3" /> Refine
                                </Button>
                                {candidate.reviewStatus === 'approved' && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={adoptBrandKit.isPending || brandKit?.sourceImageId === candidate.id}
                                    onClick={() => adoptAsCompanyBrand(candidate.id!)}
                                    className="h-8 text-xs"
                                    title="Make this the company-wide brand reference for future concepts"
                                  >
                                    <Star className="mr-1 size-3" />
                                    {brandKit?.sourceImageId === candidate.id
                                      ? 'Company brand'
                                      : adoptBrandKit.isPending ? 'Saving...' : 'Set as company brand'}
                                  </Button>
                                )}
                              </div>
                            )}
                            {refine.index === i && (
                              <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                                <Input
                                  value={refine.text}
                                  onChange={(event) => setRefine(prev => ({ ...prev, text: event.target.value }))}
                                  placeholder="One focused change, e.g. warmer background, matte pouch"
                                  aria-label="Refinement instruction"
                                  disabled={refine.busy}
                                  className="h-8 bg-white text-xs"
                                />
                                {refine.error && (
                                  <p className="text-[11px] text-rose-700">{refine.error}</p>
                                )}
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={refine.busy || !refine.text.trim()}
                                    onClick={() => handleRefine(i)}
                                    className="h-8 text-xs"
                                  >
                                    {refine.busy ? <><Loader2 className="mr-1 size-3 animate-spin" />Refining</> : 'Apply change'}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={refine.busy}
                                    onClick={() => setRefine({ index: null, text: '', busy: false, error: '' })}
                                    className="h-8 text-xs"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                                <p className="text-[11px] leading-4 text-slate-500">
                                  Replaces this draft only; the refined image returns as a new AI draft for review.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>

              {!generating && aiCandidates.length > 0 && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
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
                      disabled={
                        !aiCandidates.some(c => c.selected && c.url && c.reviewStatus !== 'rejected' && (!requireApproval || c.reviewStatus === 'approved'))
                        || validImages.length >= maxImages
                      }
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Add {Math.min(
                        aiCandidates.filter(c => c.selected && c.url && c.reviewStatus !== 'rejected' && (!requireApproval || c.reviewStatus === 'approved')).length,
                        Math.max(0, maxImages - validImages.length)
                      )} to concept
                    </Button>
                  </div>
                </div>
              )}
              {!generating && aiCandidates.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-700">Stimulus review checklist</p>
                  <div className="mt-2 grid gap-2 text-[11px] leading-4 text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
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
                  sourceLabel={lockedDesignActive
                    ? 'Locked design re-stage'
                    : brandKit ? 'Brand-kit anchored' : 'Fresh generation'}
                />
              )}
              </div>
            </section>
          )}
        </div>
      </section>

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
                <p className="text-[11px] text-slate-700 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-2">
                  {preview.prompt}
                </p>
              )}
            </div>
          )}
          <dl className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-700">Images</dt>
              <dd className="font-semibold text-slate-900">{options.count}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-700">Model / quality</dt>
              <dd className="font-semibold text-slate-900">{settings?.defaultModel ?? 'gpt-image-1.5'} · {options.quality}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-700">Estimated cost per image</dt>
              <dd className="font-semibold text-slate-900">${estimatedCostPerImage.toFixed(3)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-2">
              <dt className="font-semibold text-slate-700">Estimated total</dt>
              <dd className="font-bold text-slate-900">${estimatedCost.toFixed(2)}</dd>
            </div>
          </dl>
          <p className="text-xs text-slate-500">This is an estimate based on the workspace setting. Actual OpenAI billing may vary.</p>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={handleGenerate} className="bg-slate-900 hover:bg-slate-800">
              Generate visuals
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
