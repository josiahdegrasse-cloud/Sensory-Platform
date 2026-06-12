import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import {
  buildModeSequence,
  normalizeConceptImageMode,
  normalizePromptStyle,
} from '../_shared/concept-image-catalog.ts'
import {
  buildConceptImageBrief,
  buildConceptImagePrompt,
  type ConceptImageBrief,
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
    const { data: workspaceSettings } = await serviceClient
      .from('workspace_settings')
      .select('concept_max_generations_per_concept, concept_monthly_budget_cents, concept_require_approval, organization_name, report_tone')
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

    const count = Math.max(1, Math.min(configuredMax, Number(body.count) || configuredCount));
    const model = configuredModel;
    const quality = configuredQuality;
    const projectName = clean(body.projectName, 'Project 1');
    const foodTypeSlug = clean(body.foodTypeSlug);
    const primaryMode = normalizeConceptImageMode(body.mode);

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

    const angles = buildModeSequence(primaryMode, count, body.spreadModes !== false);
    const angledPrompts = angles.map(angle => {
      const built = buildConceptImagePrompt({ ...brief, imageMode: angle });
      return { angle, prompt: built.prompt, summary: built.summary };
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
      .eq('project_name', projectName)
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
        project_name: projectName,
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
        },
      })
      .select()
      .single();

    if (generationError) throw generationError;

    // One request per angle (n: 1 each) so every image is art-directed from a
    // genuinely distinct prompt — a single shared prompt with n > 1 just
    // produces near-duplicate renders of the same shot.
    const angleResponses = await Promise.all(angledPrompts.map(async ({ angle, prompt: anglePrompt, summary }) => {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: anglePrompt,
          n: 1,
          size: '1024x1024',
          quality,
          background: 'opaque',
        }),
      });
      const json = await res.json();
      return { angle, prompt: anglePrompt, summary, ok: res.ok, status: res.status, json };
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
      mode: string; promptStyle: string; summary: string; revisedPrompt?: string;
    }>;
    for (let index = 0; index < angleResponses.length; index++) {
      const { angle, prompt: anglePrompt, summary, json } = angleResponses[index];
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
