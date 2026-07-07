import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import {
  buildModeSequence,
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
  /** 'refine' = single-image targeted revision of baseImageId. */
  intent?: string;
  baseImageId?: string;
  refineInstruction?: string;
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

  if (!openAiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured for this Supabase project.' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

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

  try {
    const body = await req.json() as GenerateConceptImagesBody;
    const { data: settings } = await serviceClient
      .from('concept_generation_settings')
      .select('*')
      .eq('org_id', orgId)
      .eq('active', true)
      .maybeSingle();
    // select('*') so the optional brand_kit / branding columns are tolerated on
    // databases that have not run the newest migrations yet.
    const { data: workspaceSettings } = await serviceClient
      .from('workspace_settings')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle();

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
        .select('id, storage_path, mode')
        .eq('org_id', orgId)
        .in('id', ids);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; storage_path: string | null; mode: string | null }>;
    };
    const downloadReference = async (path: string, name: string): Promise<ReferenceFile> => {
      const { data, error } = await serviceClient.storage.from('concept-images').download(path);
      if (error || !data) throw new Error(`Reference image is no longer available in storage (${name}).`);
      return { bytes: new Uint8Array(await data.arrayBuffer()), name };
    };

    let baseImageMode = '';
    const referenceFiles: ReferenceFile[] = [];
    let productLocked = false;
    let brandKitImageAttached = false;

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
      referenceFiles.push(await downloadReference(baseRow.storage_path, 'base-image.png'));
    } else {
      // Locked product design (at most one), attached first per the prompt's
      // attachment-order contract.
      const lockedIds = (Array.isArray(body.referenceImageIds) ? body.referenceImageIds : [])
        .map(id => clean(id)).filter(Boolean).slice(0, 1);
      if (lockedIds.length > 0) {
        const [lockedRow] = await loadOrgImageRows(lockedIds);
        if (!lockedRow?.storage_path) {
          return new Response(JSON.stringify({ error: 'The locked design image was not found in this workspace.' }), {
            status: 404,
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        }
        referenceFiles.push(await downloadReference(lockedRow.storage_path, 'locked-design.png'));
        productLocked = true;
      }
      // Org brand kit reference, attached second. A missing file degrades to
      // descriptor-only brand guidance rather than failing the batch.
      if (useBrandKit && brandKit?.referenceImagePath && brandKit.sourceImageId !== lockedIds[0]) {
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
    const estimatedCost = Number((count * costPerImage).toFixed(4));
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
          lockedDesignImageId: productLocked ? clean((body.referenceImageIds ?? [])[0]) : null,
          brandKitApplied: Boolean(intent !== 'refine' && useBrandKit && brandKit),
          brandKitImageAttached,
          sizes: angledPrompts.map(item => item.size),
        },
      })
      .select()
      .single();

    if (generationError) throw generationError;

    // One request per angle (n: 1 each) so every image is art-directed from a
    // genuinely distinct prompt — a single shared prompt with n > 1 just
    // produces near-duplicate renders of the same shot. When reference images
    // are present (locked design / brand kit / refine base), the shared helper
    // switches to the image-edit endpoint so the design carries across angles.
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
      const message = failed.json?.error?.message ?? `OpenAI image generation failed with status ${failed.status}`;
      await serviceClient
        .from('concept_image_generations')
        .update({ status: 'failed', error_message: message, completed_at: new Date().toISOString() })
        .eq('id', generation.id);
      throw new Error(message);
    }

    const imageResults = [] as Array<{
      id: string; url: string; storagePath: string;
      mode: string; size: string; promptStyle: string; summary: string; revisedPrompt?: string;
    }>;
    for (let index = 0; index < angleResponses.length; index++) {
      const { angle, size, prompt: anglePrompt, summary, json } = angleResponses[index];
      const item = ((json.data ?? [])[0] ?? {}) as { b64_json?: string; url?: string; revised_prompt?: string };
      let signedUrl = '';
      let storagePath = '';
      let bytes: Uint8Array | null = null;
      if (item.b64_json) bytes = decodeBase64Image(item.b64_json);
      if (!bytes && item.url) {
        const remoteImage = await fetch(item.url);
        if (!remoteImage.ok) throw new Error(`Unable to secure generated image ${index + 1}`);
        bytes = new Uint8Array(await remoteImage.arrayBuffer());
      }
      if (!bytes) continue;

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
          selected_for_panelists: !Boolean(workspaceSettings?.concept_require_approval),
          sort_order: index,
          mode: angle,
          prompt: anglePrompt,
          prompt_style: configuredStyle,
          review_status: workspaceSettings?.concept_require_approval ? 'draft' : 'selected',
          model,
          quality,
        })
        .select()
        .single();

      if (imageError) throw imageError;
      const { data: signedData, error: signedError } = await serviceClient.storage
        .from('concept-images')
        .createSignedUrl(storagePath, 60 * 60);
      if (signedError) throw signedError;
      signedUrl = signedData.signedUrl;
      imageResults.push({
        id: imageRow.id,
        url: signedUrl,
        storagePath,
        mode: angle,
        size,
        promptStyle: configuredStyle,
        summary,
        revisedPrompt: item.revised_prompt,
      });
    }

    await serviceClient
      .from('concept_image_generations')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', generation.id);

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
