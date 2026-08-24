import { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
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
import { useQueryClient } from '@tanstack/react-query';
import {
  BatteryCharging, CheckCircle2, Loader2, Lock,
  RefreshCw, Sparkles, Star, Unlock, Wand2,
} from 'lucide-react';
import { Switch } from '../ui/switch';
import { updateConceptImageReviewStatus } from '../../lib/database';
import { waitForConceptImageGeneration } from '../../lib/db/concept-image-jobs';
import { useAdoptBrandKit, useWorkspaceSettings, useConceptImageUsage, queryKeys } from '../../lib/hooks';
import { creditsTone, daysUntilReset } from '../../lib/concept-credits';
import { detectFoodType, getFoodTypeProfile } from '../../lib/food-intelligence';
import { formatProductForm } from '../../lib/food-product-forms';
import type { ConceptGenerationSettings } from '../../lib/db/concepts';
import { useAuth } from '../../contexts/auth-context';
import {
  estimateConceptImageCost,
  getConceptImageMode,
  normalizeConceptImageMode,
  normalizePromptStyle,
} from '../../../../supabase/functions/_shared/concept-image-catalog.ts';
import {
  buildConceptImageBrief,
  buildConceptImagePrompt,
  type ConceptReferenceContext,
} from '../../../../supabase/functions/_shared/concept-image-prompt.ts';
import type {
  ConceptDraft,
  ConceptVisualReview,
  ConceptVisualReviewStatus,
} from './types';
import { ImageDirectionPanel, type ImageGenerationOptions } from './ImageDirectionPanel';
import {
  checkConceptImageService,
  conceptImageErrorMessage,
  invokeConceptImageFunction,
  warmConceptImageFunction,
} from './concept-image-service';
import { generateConceptImageBatch } from './concept-image-batch';
import { ReportCoverStudio } from './ReportCoverStudio';

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
  qa: ConceptVisualReview['qa'];
  reviewNotes: string;
  reviewError?: string;
  reviewing?: boolean;
}

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

const isValidImageUrl = (u: string) =>
  u.startsWith('data:image/') || ((): boolean => { try { return new URL(u).protocol === 'https:'; } catch { return false; } })();

const CREDITS_BAR_TONE: Record<'ok' | 'warn' | 'critical', { bar: string; preview: string; text: string }> = {
  ok: { bar: 'bg-emerald-500', preview: 'bg-emerald-200', text: 'text-emerald-700' },
  warn: { bar: 'bg-amber-500', preview: 'bg-amber-200', text: 'text-amber-700' },
  critical: { bar: 'bg-rose-500', preview: 'bg-rose-200', text: 'text-rose-700' },
};

/**
 * A Claude-Code-style usage meter for concept image generation: shows credits
 * used this month as a bar rather than a running dollar total. `previewFraction`
 * (0..1) renders the pending generation's expected draw as a lighter segment
 * appended to the current usage, so an admin sees the "before / after" at a
 * glance before confirming.
 */
function ConceptCreditsBar({ usage, previewFraction, compact }: {
  usage: { fraction: number; periodResetsAt: string } | undefined;
  previewFraction?: number;
  compact?: boolean;
}) {
  if (!usage) return null;
  const used = Math.max(0, Math.min(1, usage.fraction));
  const preview = Math.max(0, Math.min(1 - used, previewFraction ?? 0));
  const tone = CREDITS_BAR_TONE[creditsTone(used + preview)];
  const days = daysUntilReset(usage.periodResetsAt);

  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <BatteryCharging className="size-3.5 text-slate-400" aria-hidden />
          Concept image credits
        </span>
        <span className={`text-xs font-semibold ${tone.text}`}>
          {Math.round(used * 100)}%{preview > 0 ? ` → ${Math.round((used + preview) * 100)}%` : ''} used
        </span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${tone.bar}`} style={{ width: `${used * 100}%` }} />
        {preview > 0 && <div className={`h-full ${tone.preview}`} style={{ width: `${preview * 100}%` }} />}
      </div>
      {!compact && (
        <p className="text-[11px] text-slate-500">
          Resets in {days} day{days === 1 ? '' : 's'}.
          {preview > 0 ? ' Highlighted segment is what this batch will use.' : ''}
        </p>
      )}
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
  const queryClient = useQueryClient();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const { data: creditsUsage } = useConceptImageUsage();
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
  const [generationProgress, setGenerationProgress] = useState({ completed: 0, total: 0 });
  const [generationError, setGenerationError] = useState('');
  const [checkingService, setCheckingService] = useState(false);
  const [serviceReady, setServiceReady] = useState(false);
  const [generationConfirmationOpen, setGenerationConfirmationOpen] = useState(false);
  // Single-image refinement: one open refine box at a time.
  const [refine, setRefine] = useState<{ index: number | null; text: string; busy: boolean; error: string }>({
    index: null, text: '', busy: false, error: '',
  });

  const brandKit = workspaceSettings?.brandKit ?? null;
  const imageGenerationEnabled = workspaceSettings?.conceptImageGenerationEnabled ?? true;
  const lockedDesignActive = Boolean(draft.brandReference && options.useLockedDesign);

  const detection = useMemo(
    () => detectFoodType(draft.category, draft.name, draft.description),
    [draft.category, draft.description, draft.name],
  );
  const profile = getFoodTypeProfile(detection.slug);
  const validImages = draft.marketingImages.filter(url => url.trim() && isValidImageUrl(url));
  const generationBriefReady = !!(
    draft.name.trim()
    && draft.category.trim()
    && draft.description.trim()
  );
  const canGenerate = imageGenerationEnabled && generationBriefReady;
  // Quality-aware: the configured per-image rate is the medium baseline.
  // Not shown to the admin as a dollar figure — expressed as a credits-bar
  // fraction of the monthly budget instead (see ConceptCreditsBar).
  const estimatedCost = estimateConceptImageCost(estimatedCostPerImage, options.quality, options.count);
  const previewFraction = creditsUsage && creditsUsage.budget > 0 ? estimatedCost / creditsUsage.budget : 0;
  const refinePreviewFraction = creditsUsage && creditsUsage.budget > 0
    ? estimateConceptImageCost(estimatedCostPerImage, options.quality, 1) / creditsUsage.budget
    : 0;
  const leadModeLabel = getConceptImageMode(options.mode).label;

  // Derive variant-dimension overrides for image generation.
  const variantImageMode = draft.variantDimensions?.channel === 'lifestyle' ? 'lifestyle' : options.mode;
  const variantPositioningCues = useMemo(() => {
    const cues: string[] = [];
    const positioningCues: Record<string, string> = {
      premium: 'premium aesthetic, typographic restraint',
      accessible: 'friendly, approachable, everyday',
      value: 'clear value cues, straightforward shelf communication',
      craft: 'small-batch craft cues, tactile materials',
      functional: 'benefit-led functional food cues, credible restraint',
      playful: 'playful energy, bright approachable details',
      heritage: 'heritage-inspired trust cues, familiar category language',
      disruptive: 'modern challenger-brand attitude, distinctive shelf impact',
    };
    const appealCues: Record<string, string> = {
      health: 'clean ingredients, natural textures, health cues',
      indulgent: 'rich, indulgent, sensory abundance',
      taste_first: 'appetite-first flavor cues and sensory payoff',
      convenience: 'easy-use, everyday convenience cues',
      sustainable: 'responsible materials and sustainability cues without overclaiming',
      family_friendly: 'broad family appeal, familiar usage cues',
      adventurous: 'discovery-led flavor and exploratory energy',
    };
    const complexityCues: Record<string, string> = {
      minimal: 'minimal composition, whitespace-led',
      expressive: 'bold, expressive, colourful',
      ingredient_led: 'ingredient-forward styling with visible natural cues',
      clinical: 'precise, clean, evidence-led visual language',
      editorial: 'polished editorial composition, premium magazine-like staging',
      abundant: 'generous sensory abundance and full appetizing composition',
    };
    const positioning = draft.variantDimensions?.positioning;
    const appeal = draft.variantDimensions?.appeal;
    const complexity = draft.variantDimensions?.visualComplexity;
    if (positioning && positioningCues[positioning]) cues.push(positioningCues[positioning]);
    if (appeal && appealCues[appeal]) cues.push(appealCues[appeal]);
    if (complexity && complexityCues[complexity]) cues.push(complexityCues[complexity]);
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
    const targetSegments = draft.targetMarket
      || draft.variantDimensions?.targetDemographic
      || '';
    const productForm = draft.variantDimensions?.productForm;
    const productAppearance = [
      draft.productAppearance
        || `${draft.category || detection.label} product, styled to make the core eating quality and sensory promise visible`,
      productForm ? `The food must be shown in ${formatProductForm(productForm).toLowerCase()} form` : '',
    ].filter(Boolean).join('. ');
    const packageFormat = draft.packageFormat
      || draft.variantDimensions?.packagingFormat
      || 'commercially believable concept packaging';
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
      targetSegments,
      targetOccasion: draft.targetOccasion,
      productAppearance: draft.variantDimensions?.packagingFormat
        ? `${productAppearance} (${draft.variantDimensions.packagingFormat})`
        : productAppearance,
      packageFormat,
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
    setGenerationProgress({ completed: 0, total: options.count });
    setGenerationError('');
    setAiCandidates([]);

    try {
      await warmConceptImageFunction();
      await checkConceptImageService(invokeConceptImageFunction);
      setServiceReady(true);
    } catch (error) {
      setGenerationError(await conceptImageErrorMessage(error));
      setGenerating(false);
      return;
    }

    const requestBody = {
        conceptName: draft.name,
        category: draft.category || detection.label,
        foodTypeSlug: detection.slug,
        projectName: draft.projectName,
        description: draft.description,
        targetMarket: draft.targetMarket || draft.variantDimensions?.targetDemographic || '',
        targetOccasion: draft.targetOccasion,
        productAppearance: [
          draft.productAppearance || `${draft.category || detection.label} product, styled to make the core eating quality and sensory promise visible`,
          draft.variantDimensions?.productForm
            ? `The food must be shown in ${formatProductForm(draft.variantDimensions.productForm).toLowerCase()} form`
            : '',
        ].filter(Boolean).join('. '),
        packageFormat: draft.packageFormat || draft.variantDimensions?.packagingFormat || 'commercially believable concept packaging',
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
        promptStyle: normalizePromptStyle(draft.promptStyle),
        quality: options.quality,
        size: options.sizeOverride,
        // Locked design: every image in the batch re-stages this exact pack.
        referenceImageIds: lockedDesignActive && draft.brandReference ? [draft.brandReference.imageId] : [],
        useBrandKit: true,
        async: true,
        variantDimensions: draft.variantDimensions ?? {},
      };
    const batch = await generateConceptImageBatch({
      count: options.count,
      leadMode: normalizeConceptImageMode(variantImageMode),
      spreadModes: options.spreadModes,
      body: requestBody,
      invoke: invokeConceptImageFunction,
      waitForGeneration: waitForConceptImageGeneration,
      onProgress: (completed, total) => setGenerationProgress({ completed, total }),
    });
    const images = batch.images;
    setAiCandidates(images.map((image) => ({
      ...image,
      selected: true,
      reviewStatus: 'draft',
      qa: {},
      reviewNotes: '',
    })));
    if (batch.errors.length > 0) {
      const leadError = batch.errors[0];
      setGenerationError(images.length > 0
        ? `${images.length} of ${batch.requested} visuals completed. ${batch.errors.length} failed: ${leadError}`
        : leadError);
    }
    setGenerating(false);
    queryClient.invalidateQueries({ queryKey: queryKeys.conceptImageUsage });
  };

  const handleCheckService = async () => {
    setCheckingService(true);
    setGenerationError('');
    setServiceReady(false);
    try {
      await warmConceptImageFunction();
      await checkConceptImageService(invokeConceptImageFunction);
      setServiceReady(true);
    } catch (error) {
      setGenerationError(await conceptImageErrorMessage(error));
    } finally {
      setCheckingService(false);
    }
  };

  // Targeted single-image revision via the image-edit endpoint: keeps the rest
  // of the batch, replaces only the refined candidate (as a fresh AI draft).
  const handleRefine = async (candidateIndex: number) => {
    const candidate = aiCandidates[candidateIndex];
    if (!candidate?.id || refine.busy) return;
    setRefine(prev => ({ ...prev, busy: true, error: '' }));
    try {
      await warmConceptImageFunction();
      await checkConceptImageService(invokeConceptImageFunction);
      setServiceReady(true);
    } catch (error) {
      const message = await conceptImageErrorMessage(error);
      setRefine(prev => ({ ...prev, busy: false, error: message }));
      return;
    }
    const { data, error } = await invokeConceptImageFunction<{
      images?: Array<{
        id?: string; url: string; mode?: string; size?: string; storagePath?: string;
        promptStyle?: string; summary?: string; revisedPrompt?: string;
      }>;
      generationId?: string;
    }>({
        intent: 'refine',
        baseImageId: candidate.id,
        refineInstruction: refine.text,
        conceptName: draft.name,
        category: draft.category || detection.label,
        foodTypeSlug: detection.slug,
        projectName: draft.projectName,
        promptStyle: normalizePromptStyle(draft.promptStyle),
        quality: options.quality,
        async: true,
    });
    if (error) {
      const message = await conceptImageErrorMessage(error);
      setRefine(prev => ({ ...prev, busy: false, error: message }));
      return;
    }
    const immediateImage = ((data?.images ?? []) as Array<{
      id?: string; url: string; mode?: string; size?: string; storagePath?: string;
      promptStyle?: string; summary?: string; revisedPrompt?: string;
    }>)[0];
    let image = immediateImage;
    if (!image && data?.generationId) {
      try {
        image = await waitForConceptImageGeneration(data.generationId);
      } catch (reason) {
        const message = await conceptImageErrorMessage(reason);
        setRefine(prev => ({ ...prev, busy: false, error: message }));
        return;
      }
    }
    if (!image?.url) {
      setRefine(prev => ({ ...prev, busy: false, error: 'The refinement returned no image. Try a more specific instruction.' }));
      return;
    }
    setAiCandidates(prev => prev.map((item, index) => index === candidateIndex
      ? { ...image, selected: true, reviewStatus: 'draft' as const, qa: {}, reviewNotes: '' }
      : item));
    setRefine({ index: null, text: '', busy: false, error: '' });
    queryClient.invalidateQueries({ queryKey: queryKeys.conceptImageUsage });
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

  const persistReview = async (
    imageId: string,
    status: ConceptVisualReviewStatus,
    qa: ConceptVisualReview['qa'],
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

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Create visual options</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Generate draft visuals from the image brief, then review the credible options.
          </p>
        </div>
      </div>

      {!imageGenerationEnabled && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <p className="font-semibold">Demo visuals are view-only</p>
          <p className="mt-1 text-xs leading-5 text-blue-800">New AI images are disabled for this workspace. You can still review the approved concept images and concept report.</p>
        </div>
      )}

      <ReportCoverStudio draft={draft} onChange={onChange} settings={settings} imageGenerationEnabled={imageGenerationEnabled} />

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Image generation</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Pick the output type and generate AI drafts for review.
          </p>
        </div>
        <div className="space-y-4 p-4">
          {draft.brandReference && (
            <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={draft.brandReference.url}
                  alt="Locked product design"
                  loading="lazy"
                  decoding="async"
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
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCheckService}
                  disabled={!imageGenerationEnabled || checkingService || generating}
                >
                  {checkingService
                    ? <><Loader2 className="mr-2 size-4 animate-spin" />Checking</>
                    : 'Check service'}
                </Button>
                <Button
                  type="button"
                  onClick={() => setGenerationConfirmationOpen(true)}
                  disabled={!canGenerate || generating}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {generating
                    ? <><Loader2 className="size-4 mr-2 animate-spin" />Generating {generationProgress.completed}/{generationProgress.total}</>
                    : aiCandidates.length > 0
                      ? <><RefreshCw className="size-4 mr-2" />Regenerate</>
                      : <><Sparkles className="size-4 mr-2" />Generate {options.count} visual{options.count > 1 ? 's' : ''}</>}
                </Button>
              </div>
            </div>

            {!imageGenerationEnabled ? (
              <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                Image generation is disabled for this workspace. Previously approved visuals remain available below.
              </p>
            ) : !generationBriefReady && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-3">
                Complete the product name, category, and positioning promise before generating visuals.
              </p>
            )}
            {imageGenerationEnabled && generationBriefReady && (
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
            {serviceReady && !generationError && (
              <p className="mt-3 flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="size-3.5" />
                Image service is ready. No image credits were used by this check.
              </p>
            )}
            {imageGenerationEnabled && generationBriefReady && !generating && (
              <div className="mt-3">
                <ConceptCreditsBar usage={creditsUsage} previewFraction={previewFraction} compact />
              </div>
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
                            loading="lazy"
                            decoding="async"
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
                                disabled={candidate.reviewing}
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
                                  {refinePreviewFraction > 0 && ` Uses about ${Math.max(1, Math.round(refinePreviewFraction * 100))}% of this month's concept image credits.`}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>

              {!generating && aiCandidates.length > 0 && (
                <div className="flex justify-end gap-2">
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
              </div>
            </section>
          )}
        </div>
      </section>

      <AlertDialog open={generationConfirmationOpen} onOpenChange={setGenerationConfirmationOpen}>
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
                Built from the {leadModeLabel.toLowerCase()} preset with pack realism, food realism, and claim-safety constraints.
              </p>
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
            <div className="border-t border-slate-200 pt-3">
              <ConceptCreditsBar usage={creditsUsage} previewFraction={previewFraction} />
            </div>
          </dl>
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
