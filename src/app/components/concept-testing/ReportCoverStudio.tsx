import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Camera,
  Check,
  FileImage,
  ImagePlus,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useAuth } from '../../contexts/auth-context';
import {
  approveConceptReportCover,
  uploadConceptProductReference,
  type ConceptGenerationSettings,
} from '../../lib/database';
import { queryKeys } from '../../lib/hooks';
import { detectFoodType, getFoodTypeProfile } from '../../lib/food-intelligence';
import { formatProductForm } from '../../lib/food-product-forms';
import { waitForConceptImageGeneration } from '../../lib/db/concept-image-jobs';
import { normalizePromptStyle } from '../../../../supabase/functions/_shared/concept-image-catalog.ts';
import type { ConceptDraft, ConceptReportAsset } from './types';
import {
  COVER_QA_FIELDS,
  coverQaFailures,
  coverQaReady,
  normalizeCoverQaScore,
  type CoverQaScores,
} from './concept-cover-governance';
import {
  checkConceptImageService,
  conceptImageErrorMessage,
  invokeConceptImageFunction,
  warmConceptImageFunction,
} from './concept-image-service';
import {
  generateConceptImageBatch,
  type GeneratedConceptImage,
} from './concept-image-batch';

const MAX_PRODUCT_REFERENCES = 3;
const COVER_VARIANT_COUNT = 3;

function toAsset(
  image: GeneratedConceptImage,
  assetRole: ConceptReportAsset['assetRole'],
  approvedForExternalUse = false,
  qualityScores: Record<string, number> = {},
): ConceptReportAsset | null {
  if (!image.id || !image.url) return null;
  return {
    imageId: image.id,
    url: image.url,
    mode: image.mode ?? assetRole,
    assetRole,
    sourceKind: image.sourceKind === 'uploaded_reference' || image.sourceKind === 'text_generated'
      ? image.sourceKind
      : 'reference_generated',
    parentImageId: image.parentImageId ?? null,
    approvedForExternalUse,
    qualityScores,
  };
}

function generationBody(draft: ConceptDraft, settings?: ConceptGenerationSettings) {
  const detection = detectFoodType(draft.category, draft.name, draft.description);
  const profile = getFoodTypeProfile(detection.slug);
  const productForm = draft.variantDimensions?.productForm;
  return {
    conceptName: draft.name,
    category: draft.category || detection.label,
    foodTypeSlug: detection.slug,
    projectName: draft.projectName,
    description: draft.description,
    targetMarket: draft.targetMarket || draft.variantDimensions?.targetDemographic || '',
    targetOccasion: draft.targetOccasion,
    productAppearance: [
      draft.productAppearance,
      productForm ? `Physical form: ${formatProductForm(productForm).toLowerCase()}` : '',
      draft.mustShow ? `Required visible product details: ${draft.mustShow}` : '',
    ].filter(Boolean).join('. '),
    packageFormat: '',
    visualSetting: draft.visualSetting,
    colorDirection: draft.colorDirection,
    mustShow: draft.mustShow,
    keyBenefits: '',
    sensoryStrengths: profile.successMarkers.slice(0, 6),
    technicalChallenges: [draft.technicalChallenges, ...profile.riskMarkers.slice(0, 5)].filter(Boolean).join('\n'),
    forbiddenClaims: draft.forbiddenClaims,
    promptStyle: normalizePromptStyle(draft.promptStyle),
    quality: settings?.defaultQuality === 'low' ? 'medium' : 'high',
    size: 'auto',
    async: true,
    variantDimensions: draft.variantDimensions ?? {},
  };
}

export function ReportCoverStudio({
  draft,
  onChange,
  settings,
}: {
  draft: ConceptDraft;
  onChange: (draft: ConceptDraft) => void;
  settings?: ConceptGenerationSettings;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [masterCandidates, setMasterCandidates] = useState<GeneratedConceptImage[]>([]);
  const [coverCandidates, setCoverCandidates] = useState<GeneratedConceptImage[]>([]);
  const [selectedCoverIndex, setSelectedCoverIndex] = useState(0);
  const [qaScores, setQaScores] = useState<CoverQaScores>(draft.reportCover?.qualityScores ?? {});
  const [reviewNotes, setReviewNotes] = useState('');
  const [busyStage, setBusyStage] = useState<'master' | 'cover' | 'approval' | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState('');

  const productBriefReady = Boolean(draft.name.trim() && draft.category.trim() && draft.productAppearance.trim());
  const canGenerateMaster = productBriefReady && draft.productReferences.length > 0 && !busyStage;
  const canGenerateCover = Boolean(draft.productTruth?.imageId && !busyStage);
  const selectedCover = coverCandidates[selectedCoverIndex] ?? null;
  const failedQa = coverQaFailures(qaScores);

  const runGeneration = async (
    stage: 'master' | 'cover',
    count: number,
    referenceImageIds: string[],
  ) => {
    setBusyStage(stage);
    setProgress({ completed: 0, total: count });
    setError('');
    try {
      await warmConceptImageFunction();
      await checkConceptImageService(invokeConceptImageFunction);
      const batch = await generateConceptImageBatch({
        count,
        leadMode: stage === 'master' ? 'product_truth' : 'report_cover',
        spreadModes: false,
        body: {
          ...generationBody(draft, settings),
          referenceImageIds,
          useBrandKit: stage === 'cover',
          assetRole: stage === 'master' ? 'product_truth' : 'report_cover',
          visualNotes: stage === 'master'
            ? 'Create a neutral product-truth master for fidelity review. No packaging, branding, claims, or campaign styling.'
            : 'Portrait client-report cover. Preserve a clean title-safe area across the top and left. Do not render any words, logo, claim, badge, or package copy.',
        },
        invoke: invokeConceptImageFunction,
        waitForGeneration: waitForConceptImageGeneration,
        onProgress: (completed, total) => setProgress({ completed, total }),
      });
      if (stage === 'master') setMasterCandidates(batch.images);
      else {
        setCoverCandidates(batch.images);
        setSelectedCoverIndex(0);
        setQaScores({});
      }
      if (batch.errors.length > 0) {
        setError(batch.images.length
          ? `${batch.images.length} of ${batch.requested} images completed. ${batch.errors[0]}`
          : batch.errors[0]);
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.conceptImageUsage });
    } catch (reason) {
      setError(await conceptImageErrorMessage(reason));
    } finally {
      setBusyStage(null);
    }
  };

  const uploadReferences = async (files: FileList | null) => {
    if (!files?.length || uploading) return;
    const slots = Math.max(0, MAX_PRODUCT_REFERENCES - draft.productReferences.length);
    const selectedFiles = Array.from(files).slice(0, slots);
    if (!selectedFiles.length) return;
    setUploading(true);
    setError('');
    try {
      const assets = [] as ConceptReportAsset[];
      for (const file of selectedFiles) {
        assets.push(await uploadConceptProductReference(file));
      }
      onChange({ ...draft, productReferences: [...draft.productReferences, ...assets] });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The product reference could not be uploaded.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const lockProductTruth = (asset: ConceptReportAsset) => {
    onChange({ ...draft, productTruth: asset, reportCover: null });
    setCoverCandidates([]);
    setQaScores({});
  };

  const approveCover = async () => {
    if (!selectedCover?.id || !user?.id || !coverQaReady(qaScores) || busyStage) return;
    const scores = Object.fromEntries(COVER_QA_FIELDS.map(field => [
      field.key,
      normalizeCoverQaScore(qaScores[field.key]),
    ]));
    setBusyStage('approval');
    setError('');
    try {
      await approveConceptReportCover({
        imageId: selectedCover.id,
        actorId: user.id,
        qualityScores: scores,
        notes: reviewNotes,
      });
      const asset = toAsset(selectedCover, 'report_cover', true, scores);
      if (!asset) throw new Error('The approved cover is missing its stored image identity.');
      onChange({ ...draft, reportCover: asset });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The report cover approval could not be saved.');
    } finally {
      setBusyStage(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <FileImage className="size-4 text-slate-500" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-950">Client report image</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Anchor the food to real references, then create a portrait cover. Logos and report text are added later from the client brand settings.
          </p>
        </div>
        <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
          draft.reportCover?.approvedForExternalUse
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-slate-100 text-slate-700'
        }`}>
          {draft.reportCover?.approvedForExternalUse ? <Check className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
          {draft.reportCover?.approvedForExternalUse ? 'Client cover approved' : 'Internal draft'}
        </span>
      </header>

      <div className="divide-y divide-slate-200">
        <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">1</span>
              <div>
                <h4 className="font-semibold text-slate-950">Lock product truth</h4>
                <p className="mt-0.5 text-xs leading-5 text-slate-600">
                  Upload up to three views of the tested food: hero, top and cut face. A written brief alone cannot produce a client-truthful cover.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {draft.productReferences.map((asset, index) => (
                <div key={asset.imageId} className="group relative w-24">
                  <img
                    src={asset.url}
                    alt={`Product reference ${index + 1} for ${draft.name}`}
                    className="aspect-square w-24 rounded-md border border-slate-200 bg-slate-50 object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <button
                    type="button"
                    onClick={() => onChange({
                      ...draft,
                      productReferences: draft.productReferences.filter(item => item.imageId !== asset.imageId),
                      productTruth: draft.productTruth?.imageId === asset.imageId ? null : draft.productTruth,
                      reportCover: draft.productTruth?.imageId === asset.imageId ? null : draft.reportCover,
                    })}
                    className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-slate-950/80 text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                    aria-label={`Remove product reference ${index + 1}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 h-8 w-full px-2 text-[11px]"
                    onClick={() => lockProductTruth(asset)}
                  >
                    {draft.productTruth?.imageId === asset.imageId ? 'Truth locked' : 'Use as truth'}
                  </Button>
                </div>
              ))}
              {draft.productReferences.length < MAX_PRODUCT_REFERENCES && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                  className="flex aspect-square w-24 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
                  {uploading ? 'Uploading' : 'Add photo'}
                </button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={event => void uploadReferences(event.target.files)}
              />
            </div>

            {!productBriefReady && (
              <p className="mt-4 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Describe the product appearance in the concept brief before creating a master.
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!canGenerateMaster}
                onClick={() => void runGeneration('master', 3, draft.productReferences.map(asset => asset.imageId))}
              >
                {busyStage === 'master' ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                {busyStage === 'master' ? `Creating master ${progress.completed}/${progress.total}` : 'Create product master'}
              </Button>
              <p className="self-center text-xs text-slate-500">A real uploaded photo can also be locked directly.</p>
            </div>

            {masterCandidates.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {masterCandidates.map((candidate, index) => (
                  <button
                    key={candidate.id ?? candidate.url}
                    type="button"
                    onClick={() => {
                      const asset = toAsset(candidate, 'product_truth');
                      if (asset) lockProductTruth(asset);
                    }}
                    className={`overflow-hidden rounded-md border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                      draft.productTruth?.imageId === candidate.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <img src={candidate.url} alt={`Product truth master option ${index + 1}`} className="aspect-square w-full object-cover" />
                    <span className="flex min-h-10 items-center gap-1.5 px-2 text-xs font-semibold text-slate-800">
                      <LockKeyhole className="size-3.5" />
                      {draft.productTruth?.imageId === candidate.id ? 'Product truth locked' : `Lock master ${index + 1}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="border-t border-slate-200 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <p className="text-xs font-semibold text-slate-500">CURRENT PRODUCT TRUTH</p>
            {draft.productTruth ? (
              <>
                <img
                  src={draft.productTruth.url}
                  alt={`Locked product truth for ${draft.name}`}
                  className="mt-3 aspect-square w-full rounded-md border border-slate-200 bg-slate-50 object-cover"
                />
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                  <Check className="size-3.5" />
                  {draft.productTruth.sourceKind === 'uploaded_reference' ? 'Real photo locked' : 'Reference-anchored master locked'}
                </p>
              </>
            ) : (
              <div className="mt-3 flex min-h-40 flex-col items-center justify-center rounded-md bg-slate-50 p-4 text-center text-xs leading-5 text-slate-500">
                <Camera className="mb-2 size-5" />
                No product truth is locked yet.
              </div>
            )}
          </aside>
        </div>

        <div className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex max-w-2xl items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">2</span>
              <div>
                <h4 className="font-semibold text-slate-950">Create and approve the cover</h4>
                <p className="mt-0.5 text-xs leading-5 text-slate-600">
                  Three portrait candidates keep the locked food intact and leave space for the real client logo, report title and decision status.
                </p>
              </div>
            </div>
            <Button
              type="button"
              disabled={!canGenerateCover}
              onClick={() => void runGeneration('cover', COVER_VARIANT_COUNT, [draft.productTruth!.imageId])}
              className="shrink-0"
            >
              {busyStage === 'cover' ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {busyStage === 'cover' ? `Creating covers ${progress.completed}/${progress.total}` : 'Generate cover candidates'}
            </Button>
          </div>

          {coverCandidates.length > 0 && (
            <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid grid-cols-3 gap-3">
                {coverCandidates.map((candidate, index) => (
                  <button
                    key={candidate.id ?? candidate.url}
                    type="button"
                    onClick={() => { setSelectedCoverIndex(index); setQaScores({}); }}
                    aria-pressed={selectedCoverIndex === index}
                    className={`overflow-hidden rounded-md border-2 bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                      selectedCoverIndex === index ? 'border-blue-600' : 'border-transparent hover:border-blue-200'
                    }`}
                  >
                    <img src={candidate.url} alt={`Portrait report cover option ${index + 1}`} className="aspect-[2/3] w-full object-cover" />
                    <span className="block px-2 py-2 text-xs font-semibold text-slate-800">Cover {index + 1}</span>
                  </button>
                ))}
              </div>

              <div className="border-t border-slate-200 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <h5 className="text-sm font-semibold text-slate-950">External-use review</h5>
                <p className="mt-1 text-xs leading-5 text-slate-600">Score every check 4 or 5. Approval records your identity and keeps this image out of the panelist stimulus set.</p>
                <div className="mt-4 space-y-3">
                  {COVER_QA_FIELDS.map(field => (
                    <label key={field.key} className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-3">
                      <span>
                        <span className="block text-xs font-semibold text-slate-800">{field.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{field.detail}</span>
                      </span>
                      <select
                        value={qaScores[field.key] ?? ''}
                        onChange={event => setQaScores(current => ({
                          ...current,
                          [field.key]: normalizeCoverQaScore(event.target.value),
                        }))}
                        className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                        aria-label={`${field.label} score`}
                      >
                        <option value="">—</option>
                        {[1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                <Textarea
                  value={reviewNotes}
                  onChange={event => setReviewNotes(event.target.value)}
                  className="mt-4 min-h-20 text-sm"
                  placeholder="Optional fidelity or crop note"
                  aria-label="Cover approval note"
                />
                <Button
                  type="button"
                  className="mt-4 w-full"
                  disabled={!selectedCover?.id || !coverQaReady(qaScores) || busyStage === 'approval'}
                  onClick={() => void approveCover()}
                >
                  {busyStage === 'approval' ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  {busyStage === 'approval' ? 'Recording approval' : 'Approve for client report'}
                </Button>
                {failedQa.length > 0 && (
                  <p className="mt-2 text-center text-[11px] text-slate-500">
                    {failedQa.length} fidelity check{failedQa.length === 1 ? '' : 's'} still need a score of 4 or 5.
                  </p>
                )}
              </div>
            </div>
          )}

          {draft.reportCover?.approvedForExternalUse && (
            <div className="mt-5 flex flex-col gap-4 rounded-md bg-emerald-50 p-4 sm:flex-row sm:items-center">
              <img src={draft.reportCover.url} alt={`Approved report cover for ${draft.name}`} className="aspect-[2/3] w-20 rounded border border-emerald-200 object-cover" />
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-950"><ShieldCheck className="size-4" />Approved client cover</p>
                <p className="mt-1 text-xs leading-5 text-emerald-800">This exact image will be available to the report builder. Client logo, title and evidence status remain live report elements.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="m-4 flex items-start gap-2 rounded-md bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{error}
        </p>
      )}
    </section>
  );
}
