import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { isPublicDemoWorkspace, PUBLIC_DEMO_EXTERNAL_ACTION_ERROR } from '../_shared/demo-guard.ts'
import {
  buildModeSequence,
  estimateConceptImageCost,
  getConceptImageSize,
  normalizeConceptImageMode,
  normalizePromptStyle,
} from '../_shared/concept-image-catalog.ts'
import {
  buildConceptImageBrief,
  buildConceptImagePrompt,
  buildConceptImageRefinePrompt,
  type ConceptImageBrief,
  type ConceptReferenceContext,
} from '../_shared/concept-image-prompt.ts'

interface GenerateConceptImagesBody {
  conceptTestId?: string;
  conceptName?: string;
  category?: string;
  foodTypeSlug?: string;
  projectName?: string;
  description?: string;
  targetMarket?: string;
  targetOccasion?: string;
  productAppearance?: string;
  packageFormat?: string;
  visualSetting?: string;
  colorDirection?: string;
  mustShow?: string;
  pricePoint?: string;
  keyBenefits?: string;
  sensoryStrengths?: string | string[];
  technicalChallenges?: string;
  forbiddenClaims?: string | string[];
  visualNotes?: string;
  evidenceStrength?: string;
  decisionContext?: string;
  mode?: string;
  count?: number;
  promptStyle?: string;
  quality?: string;
  /** When false, all images use the lead mode instead of spanning distinct modes. */
  spreadModes?: boolean;
  /** Explicit render size override; anything else uses each mode's catalog size. */
  size?: string;
  /**
   * The concept's locked product-design image (a concept_images id owned by
   * this org). When present, generation switches to the image-edit endpoint so
   * every new format re-stages that exact design.
   */
  referenceImageIds?: string[];
  /** Set false to skip applying the org brand kit for this batch. */
  useBrandKit?: boolean;
  /** 'refine' = single-image targeted revision; 'diagnostic' = charge-free dependency check. */
  intent?: string;
  baseImageId?: string;
  refineInstruction?: string;
  /** Return after the generation row is queued; render and storage continue in the background. */
  async?: boolean;
  /** Server-normalized downstream role for this generated asset. */
  assetRole?: string;
}

const DEFAULT_IMAGE_COUNT = 4;
const MAX_IMAGE_COUNT = 4;
const ALLOWED_QUALITIES = new Set(['low', 'medium', 'high', 'auto']);
function clean(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function decodeBase64Image(dataUrlOrBase64: string) {
  const base64 = dataUrlOrBase64.includes(',') ? dataUrlOrBase64.split(',').pop() ?? '' : dataUrlOrBase64;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

interface StoredBrandKit {
  referenceImagePath: string;
  sourceImageId: string;
  sourceConceptName: string;
  brandDescriptor: string;
}

/** Tolerant parse of workspace_settings.brand_kit (jsonb; column may not exist yet). */
function parseBrandKit(value: unknown): StoredBrandKit | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const kit: StoredBrandKit = {
    referenceImagePath: clean(record.referenceImagePath),
    sourceImageId: clean(record.sourceImageId),
    sourceConceptName: clean(record.sourceConceptName),
    brandDescriptor: clean(record.brandDescriptor),
  };
  return kit.referenceImagePath || kit.brandDescriptor ? kit : null;
}

interface ReferenceFile {
  bytes: Uint8Array;
  name: string;
}

/**
 * Sends one image request. With reference files it uses the image-edit
 * endpoint (multipart, image[] per reference — locked design first, brand kit
 * second, matching the prompt's attachment-order contract); without, the plain
 * generations endpoint. Both return b64 image data in the same response shape.
 */
async function requestOpenAiImage(input: {
  openAiKey: string;
  model: string;
  prompt: string;
  size: string;
  quality: string;
  references: ReferenceFile[];
}) {
  if (input.references.length === 0) {
    return fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        n: 1,
        size: input.size,
        quality: input.quality,
        background: 'opaque',
      }),
    });
  }
  const form = new FormData();
  form.append('model', input.model);
  form.append('prompt', input.prompt);
  form.append('n', '1');
  form.append('size', input.size);
  form.append('quality', input.quality);
  for (const reference of input.references) {
    form.append('image[]', new Blob([reference.bytes as BlobPart], { type: 'image/png' }), reference.name);
  }
  return fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.openAiKey}` },
    body: form,
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  const imageModel = Deno.env.get('OPENAI_IMAGE_MODEL') ?? 'gpt-image-1.5';
  const imageQuality = Deno.env.get('OPENAI_IMAGE_QUALITY') ?? 'medium';

  const callerToken = authHeader.replace(/^Bearer\s+/i, '');

  // A plain client (no global authorization header) avoids sending both a
  // lowercase "authorization" header and the capitalized "Authorization"
  // header that getUser(jwt) sets internally — the gateway rejects requests
  // with both present, returning an HTML error page instead of JSON.
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: { user: callerUser }, error: callerUserError } = await authClient.auth.getUser(callerToken);
  if (callerUserError || !callerUser) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: authHeader } },
  });

  const { data: profile, error: profileError } = await callerClient
    .from('profiles')
    .select('id, role, status, org_id')
    .eq('id', callerUser.id)
    .single();

  if (profileError || profile?.role !== 'admin' || profile?.status !== 'active') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  // Multi-tenant: every read/write below is scoped to the caller's organization.
  // The service-role client bypasses RLS, so org_id must be applied explicitly.
  const orgId = (profile as { org_id?: string | null }).org_id ?? null;
  if (!orgId) {
    return new Response(JSON.stringify({ error: 'No organization context for this account.' }), {
      status: 403,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  if (await isPublicDemoWorkspace(serviceClient, orgId)) {
    return new Response(JSON.stringify({ error: PUBLIC_DEMO_EXTERNAL_ACTION_ERROR }), {
      status: 403,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json() as GenerateConceptImagesBody;
    if (clean(body.intent) === 'diagnostic') {
      const edgeRuntimeAvailable = Boolean((globalThis as unknown as {
        EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void };
      }).EdgeRuntime);
      const [settingsCheck, workspaceCheck, generationsCheck, storageCheck] = await Promise.all([
        serviceClient
          .from('concept_generation_settings')
          .select('id')
          .eq('org_id', orgId)
          .limit(1),
        serviceClient
          .from('workspace_settings')
          .select('org_id')
          .eq('org_id', orgId)
          .limit(1),
        serviceClient
          .from('concept_image_generations')
          .select('id')
          .eq('org_id', orgId)
          .limit(1),
        serviceClient.storage.from('concept-images').list('', { limit: 1 }),
      ]);
      const dependencyErrors = [
        ['concept settings', settingsCheck.error],
        ['workspace settings', workspaceCheck.error],
        ['generation records', generationsCheck.error],
        ['image storage', storageCheck.error],
      ].flatMap(([label, error]) => error
        ? [`${label}: ${(error as { message?: string }).message ?? String(error)}`]
        : []);
      const missing = [
        !openAiKey ? 'OpenAI API key' : '',
        !edgeRuntimeAvailable ? 'background task runtime' : '',
      ].filter(Boolean);

      if (dependencyErrors.length > 0 || missing.length > 0) {
        return new Response(JSON.stringify({
          error: [...dependencyErrors, ...missing.map(item => `${item} is unavailable`)].join('; '),
          phase: 'readiness',
          functionVersion: 29,
        }), {
          status: 503,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        ok: true,
        phase: 'ready',
        functionVersion: 29,
      }), {
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    if (!openAiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured for this Supabase project.' }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const { data: settings } = await serviceClient
      .from('concept_generation_settings')
      .select('*')
      .eq('org_id', orgId)
      .eq('active', true)
      .maybeSingle();
    // select('*') so the optional brand_kit / branding columns are tolerated on
    // databases that have not run the newest migrations yet.
    const { data: workspaceSettings, error: workspaceSettingsError } = await serviceClient
      .from('workspace_settings')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle();
    if (workspaceSettingsError) throw workspaceSettingsError;
    if (
      (workspaceSettings as Record<string, unknown> | null)?.demo_mode_enabled === true
      || (workspaceSettings as Record<string, unknown> | null)?.concept_image_generation_enabled === false
    ) {
      return new Response(JSON.stringify({
        error: 'Concept image generation is disabled for this workspace. Existing concept visuals and reports remain available.',
      }), {
        status: 403,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const configuredCount = Number(settings?.default_image_count) || DEFAULT_IMAGE_COUNT;
    const configuredMax = Number(settings?.max_images_per_concept) || MAX_IMAGE_COUNT;
    const configuredModel = clean(settings?.default_model, imageModel);
    const requestedQuality = clean(body.quality).toLowerCase();
    const configuredQuality = ALLOWED_QUALITIES.has(requestedQuality)
      ? requestedQuality
      : clean(settings?.default_quality, imageQuality);
    const configuredStyle = normalizePromptStyle(clean(body.promptStyle, clean(settings?.prompt_style, 'balanced')));
    const costPerImage = Number(settings?.estimated_cost_per_image) || 0.034;

    const model = configuredModel;
    const quality = configuredQuality;
    const projectName = clean(body.projectName, 'Project 1');
    const foodTypeSlug = clean(body.foodTypeSlug);
    const intent: 'explore' | 'refine' = clean(body.intent) === 'refine' ? 'refine' : 'explore';
    const refineInstruction = clean(body.refineInstruction);
    const sizeOverride = clean(body.size);
    const useBrandKit = body.useBrandKit !== false;
    const settingsRecord = (workspaceSettings ?? {}) as Record<string, unknown>;
    const brandKit = parseBrandKit(settingsRecord.brand_kit);
    const brandColors = [clean(settingsRecord.primary_color), clean(settingsRecord.accent_color)].filter(Boolean);

    // ── Reference images (org-validated, storage-backed) ────────────────────
    // Every reference must be a concept_images row owned by this org; a tenant
    // can never pull another org's image into a prompt.
    const loadOrgImageRows = async (ids: string[]) => {
      if (ids.length === 0) return [];
      const { data, error } = await serviceClient
        .from('concept_images')
        .select('id, storage_path, mode, asset_role, source_kind, parent_image_id')
        .eq('org_id', orgId)
        .in('id', ids);
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        id: string;
        storage_path: string | null;
        mode: string | null;
        asset_role: string | null;
        source_kind: string | null;
        parent_image_id: string | null;
      }>;
      const byId = new Map(rows.map(row => [row.id, row]));
      return ids.flatMap(id => byId.get(id) ? [byId.get(id)!] : []);
    };
    const downloadReference = async (path: string, name: string): Promise<ReferenceFile> => {
      const { data, error } = await serviceClient.storage.from('concept-images').download(path);
      if (error || !data) throw new Error(`Reference image is no longer available in storage (${name}).`);
      return { bytes: new Uint8Array(await data.arrayBuffer()), name };
    };

    let baseImageMode = '';
    let baseImageAssetRole = 'concept_visual';
    const referenceFiles: ReferenceFile[] = [];
    let productLocked = false;
    let brandKitImageAttached = false;
    let productReferenceIds: string[] = [];
    let referenceKind: ConceptReferenceContext['referenceKind'] = 'product_design';

    if (intent === 'refine') {
      const baseId = clean(body.baseImageId);
      if (!baseId) {
        return new Response(JSON.stringify({ error: 'Refinement requires the image to refine (baseImageId).' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }
      const [baseRow] = await loadOrgImageRows([baseId]);
      if (!baseRow?.storage_path) {
        return new Response(JSON.stringify({ error: 'The image to refine was not found in this workspace.' }), {
          status: 404,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }
      baseImageMode = clean(baseRow.mode, 'packaging');
      baseImageAssetRole = clean(baseRow.asset_role, 'concept_visual');
      productReferenceIds = [baseId];
      referenceFiles.push(await downloadReference(baseRow.storage_path, 'base-image.png'));
    } else {
      // Up to three views of the same product are attached first. A single
      // packaging/design lock remains supported; product-truth generation can
      // instead use hero, top, and cut-face reference photographs.
      productReferenceIds = (Array.isArray(body.referenceImageIds) ? body.referenceImageIds : [])
        .map(id => clean(id)).filter(Boolean).slice(0, 3);
      if (productReferenceIds.length > 0) {
        const lockedRows = await loadOrgImageRows(productReferenceIds);
        if (lockedRows.length !== productReferenceIds.length || lockedRows.some(row => !row.storage_path)) {
          return new Response(JSON.stringify({ error: 'The locked design image was not found in this workspace.' }), {
            status: 404,
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        }
        referenceKind = lockedRows.every(row => row.asset_role === 'product_reference' || row.asset_role === 'product_truth')
          ? 'food'
          : 'product_design';
        for (let index = 0; index < lockedRows.length; index += 1) {
          referenceFiles.push(await downloadReference(lockedRows[index].storage_path!, `product-reference-${index + 1}.png`));
        }
        productLocked = true;
      }
      // Org brand kit reference follows every product view. A missing file degrades to
      // descriptor-only brand guidance rather than failing the batch.
      if (useBrandKit && brandKit?.referenceImagePath && !productReferenceIds.includes(brandKit.sourceImageId)) {
        try {
          referenceFiles.push(await downloadReference(brandKit.referenceImagePath, 'brand-kit.png'));
          brandKitImageAttached = true;
        } catch (_err) {
          brandKitImageAttached = false;
        }
      }
    }

    const referenceContext: ConceptReferenceContext | null = intent === 'refine'
      ? null
      : productLocked || (useBrandKit && brandKit)
        ? {
            productLocked,
            referenceKind,
            productReferenceCount: productReferenceIds.length,
            brandKit: useBrandKit && brandKit
              ? {
                  brandDescriptor: brandKit.brandDescriptor,
                  brandColors,
                  hasReferenceImage: brandKitImageAttached,
                }
              : null,
          }
        : null;

    const count = intent === 'refine'
      ? 1
      : Math.max(1, Math.min(configuredMax, Number(body.count) || configuredCount));
    const primaryMode = intent === 'refine'
      ? normalizeConceptImageMode(baseImageMode)
      : normalizeConceptImageMode(body.mode);
    const requestedAssetRole = clean(body.assetRole);
    const assetRole = intent === 'refine'
      ? baseImageAssetRole
      : primaryMode === 'product_truth' || primaryMode === 'report_cover'
        ? primaryMode
        : requestedAssetRole === 'concept_visual'
          ? 'concept_visual'
          : 'panelist_stimulus';
    const sourceKind = productLocked || intent === 'refine' ? 'reference_generated' : 'text_generated';
    const parentImageId = productReferenceIds[0] ?? null;

    if (intent !== 'refine' && primaryMode === 'report_cover' && (!productLocked || referenceKind !== 'food')) {
      return new Response(JSON.stringify({
        error: 'A client report cover requires a locked product-truth or uploaded product reference image.',
      }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    // Branding comes from the caller's workspace settings, never from the
    // request body — a tenant cannot generate under another client's name.
    const brief: ConceptImageBrief = buildConceptImageBrief({
      clientName: workspaceSettings?.organization_name,
      brandTone: workspaceSettings?.report_tone,
      productName: body.conceptName,
      conceptName: body.conceptName,
      foodCategory: body.category,
      conceptPositioning: [clean(body.description), clean(body.pricePoint) ? `priced around ${clean(body.pricePoint)}` : '']
        .filter(Boolean).join(', '),
      targetSegments: body.targetMarket,
      targetOccasion: body.targetOccasion,
      productAppearance: body.productAppearance,
      packageFormat: body.packageFormat,
      visualSetting: body.visualSetting,
      colorDirection: body.colorDirection,
      mustShow: body.mustShow,
      keyBenefits: body.keyBenefits,
      sensoryStrengths: body.sensoryStrengths,
      technicalChallenges: body.technicalChallenges,
      forbiddenClaims: body.forbiddenClaims,
      visualNotes: body.visualNotes,
      evidenceStrength: body.evidenceStrength,
      decisionContext: body.decisionContext,
      imageMode: primaryMode,
      promptStyle: configuredStyle,
      model,
      quality,
      count,
      conceptTestId: body.conceptTestId,
      projectName,
      foodTypeSlug,
    });

    const angles = intent === 'refine'
      ? [primaryMode]
      : buildModeSequence(primaryMode, count, body.spreadModes !== false);
    const angledPrompts = angles.map(angle => {
      const built = intent === 'refine'
        ? buildConceptImageRefinePrompt({ brief: { ...brief, imageMode: angle }, instruction: refineInstruction })
        : buildConceptImagePrompt({ ...brief, imageMode: angle }, referenceContext);
      return { angle, size: getConceptImageSize(angle, sizeOverride), prompt: built.prompt, summary: built.summary };
    });
    const prompt = angledPrompts[0].prompt;
    // Quality-aware estimate (configured rate = medium baseline) so the budget
    // gate reflects that a high-quality render costs a multiple of medium.
    const estimatedCost = estimateConceptImageCost(costPerImage, quality, count);
    const maxGenerations = Math.max(1, Number(workspaceSettings?.concept_max_generations_per_concept) || 12);
    const settingsBudget = Math.max(0, Number(settings?.monthly_budget) || 0);
    const workspaceBudget = Math.max(0, Number(workspaceSettings?.concept_monthly_budget_cents) || 0) / 100;
    const monthlyBudget = settingsBudget > 0 && workspaceBudget > 0
      ? Math.min(settingsBudget, workspaceBudget)
      : Math.max(settingsBudget, workspaceBudget);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { data: monthlyRows, error: monthlyError } = await serviceClient
      .from('concept_image_generations')
      .select('estimated_cost')
      .eq('org_id', orgId)
      .gte('created_at', monthStart.toISOString())
      .in('status', ['generating', 'completed']);
    if (monthlyError) throw monthlyError;
    const monthSpend = (monthlyRows ?? []).reduce(
      (total, row) => total + Number(row.estimated_cost ?? 0),
      0,
    );
    if (monthlyBudget > 0 && monthSpend + estimatedCost > monthlyBudget) {
      return new Response(JSON.stringify({
        error: `Monthly image budget reached. This request would bring estimated spend to $${(monthSpend + estimatedCost).toFixed(2)} of the $${monthlyBudget.toFixed(2)} limit.`,
      }), {
        status: 429,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    let generationCountQuery = serviceClient
      .from('concept_image_generations')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('created_by', profile.id)
      .eq('concept_name', clean(body.conceptName))
      .eq('concept_folder_name', projectName)
      .in('status', ['generating', 'completed']);
    if (body.conceptTestId) {
      generationCountQuery = generationCountQuery.eq('concept_test_id', body.conceptTestId);
    }
    const { count: generationCount, error: generationCountError } = await generationCountQuery;
    if (generationCountError) throw generationCountError;
    if ((generationCount ?? 0) >= maxGenerations) {
      return new Response(JSON.stringify({
        error: `This concept has reached its limit of ${maxGenerations} image generations.`,
      }), {
        status: 429,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const { data: generation, error: generationError } = await serviceClient
      .from('concept_image_generations')
      .insert({
        org_id: orgId,
        concept_test_id: body.conceptTestId || null,
        created_by: profile.id,
        concept_folder_name: projectName,
        food_type_slug: foodTypeSlug,
        concept_name: clean(body.conceptName),
        mode: primaryMode,
        prompt,
        prompt_style: configuredStyle,
        model,
        quality,
        requested_count: count,
        status: 'generating',
        estimated_cost: estimatedCost,
        concept_snapshot: {
          conceptName: body.conceptName,
          category: body.category,
          foodTypeSlug,
          description: body.description,
          targetMarket: body.targetMarket,
          pricePoint: body.pricePoint,
          keyBenefits: body.keyBenefits,
          // Full normalized brief for provenance — what the prompts were built from.
          imageBrief: brief,
          // Reference provenance: how this batch was anchored (or not).
          generationIntent: intent,
          baseImageId: intent === 'refine' ? clean(body.baseImageId) : null,
          refineInstruction: intent === 'refine' ? refineInstruction : null,
          lockedDesignImageId: productLocked ? productReferenceIds[0] : null,
          productReferenceImageIds: productReferenceIds,
          referenceKind,
          assetRole,
          sourceKind,
          brandKitApplied: Boolean(intent !== 'refine' && useBrandKit && brandKit),
          brandKitImageAttached,
          sizes: angledPrompts.map(item => item.size),
        },
      })
      .select()
      .single();

    if (generationError) throw generationError;

    const processGeneration = async () => {
      try {
        // One request per angle (n: 1 each) so every image is art-directed from
        // a distinct prompt. The async path returns before this provider call.
        const angleResponses = await Promise.all(angledPrompts.map(async ({ angle, size, prompt: anglePrompt, summary }) => {
          const res = await requestOpenAiImage({
            openAiKey,
            model,
            prompt: anglePrompt,
            size,
            quality,
            references: referenceFiles,
          });
          const json = await res.json();
          return { angle, size, prompt: anglePrompt, summary, ok: res.ok, status: res.status, json };
        }));

        const failed = angleResponses.find(r => !r.ok);
        if (failed) {
          throw new Error(failed.json?.error?.message ?? `OpenAI image generation failed with status ${failed.status}`);
        }

        const imageResults = [] as Array<{
          id: string; url: string; storagePath: string;
          mode: string; size: string; promptStyle: string; summary: string; revisedPrompt?: string;
          assetRole: string; sourceKind: string; parentImageId: string | null;
        }>;
        for (let index = 0; index < angleResponses.length; index++) {
          const { angle, size, prompt: anglePrompt, summary, json } = angleResponses[index];
          const item = ((json.data ?? [])[0] ?? {}) as { b64_json?: string; url?: string; revised_prompt?: string };
          let storagePath = '';
          let bytes: Uint8Array | null = null;
          if (item.b64_json) bytes = decodeBase64Image(item.b64_json);
          if (!bytes && item.url) {
            const remoteImage = await fetch(item.url);
            if (!remoteImage.ok) throw new Error(`Unable to secure generated image ${index + 1}`);
            bytes = new Uint8Array(await remoteImage.arrayBuffer());
          }
          if (!bytes) throw new Error(`OpenAI returned no image data for visual ${index + 1}.`);

          storagePath = `${generation.id}/concept-${index + 1}.png`;
          const { error: uploadError } = await serviceClient.storage
            .from('concept-images')
            .upload(storagePath, bytes, {
              contentType: 'image/png',
              upsert: true,
            });
          if (uploadError) throw uploadError;

          const { data: imageRow, error: imageError } = await serviceClient
            .from('concept_images')
            .insert({
              org_id: orgId,
              generation_id: generation.id,
              concept_test_id: body.conceptTestId || null,
              image_url: storagePath,
              storage_path: storagePath,
              selected_for_panelists: assetRole === 'panelist_stimulus'
                && !Boolean(workspaceSettings?.concept_require_approval),
              sort_order: index,
              mode: angle,
              prompt: anglePrompt,
              prompt_style: configuredStyle,
              review_status: assetRole === 'panelist_stimulus'
                && !Boolean(workspaceSettings?.concept_require_approval)
                ? 'selected'
                : 'draft',
              model,
              quality,
              asset_role: assetRole,
              parent_image_id: parentImageId,
              source_kind: sourceKind,
            })
            .select()
            .single();

          if (imageError) throw imageError;
          const { data: signedData, error: signedError } = await serviceClient.storage
            .from('concept-images')
            .createSignedUrl(storagePath, 60 * 60);
          if (signedError) throw signedError;
          imageResults.push({
            id: imageRow.id,
            url: signedData.signedUrl,
            storagePath,
            mode: angle,
            size,
            promptStyle: configuredStyle,
            summary,
            revisedPrompt: item.revised_prompt,
            assetRole,
            sourceKind,
            parentImageId,
          });
        }

        await serviceClient
          .from('concept_image_generations')
          .update({ status: 'completed', error_message: null, completed_at: new Date().toISOString() })
          .eq('id', generation.id);

        return imageResults;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Concept image generation ${generation.id} failed: ${message}`);
        await serviceClient
          .from('concept_image_generations')
          .update({ status: 'failed', error_message: message, completed_at: new Date().toISOString() })
          .eq('id', generation.id);
        throw error;
      }
    };

    if (body.async === true) {
      const edgeRuntime = (globalThis as unknown as {
        EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void };
      }).EdgeRuntime;
      if (!edgeRuntime) {
        throw new Error('Background image generation is unavailable in this runtime.');
      }
      edgeRuntime.waitUntil(processGeneration().catch(() => undefined));
      return new Response(JSON.stringify({
        generationId: generation.id,
        status: 'generating',
        model,
        quality,
        mode: primaryMode,
      }), {
        status: 202,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const imageResults = await processGeneration();
    return new Response(JSON.stringify({
      generationId: generation.id,
      images: imageResults,
      model,
      quality,
      promptStyle: configuredStyle,
      modes: angles,
      sizes: angledPrompts.map(item => item.size),
      intent,
      usedLockedDesign: productLocked,
      usedBrandKit: Boolean(intent !== 'refine' && useBrandKit && brandKit),
      summary: angledPrompts[0].summary,
      estimatedCost,
      prompt,
    }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
});
