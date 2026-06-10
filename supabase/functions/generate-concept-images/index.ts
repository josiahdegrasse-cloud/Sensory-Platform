import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type ConceptImageMode = 'packaging' | 'shelf' | 'usage' | 'ingredient' | 'ad';

interface GenerateConceptImagesBody {
  conceptTestId?: string;
  conceptName?: string;
  category?: string;
  foodTypeSlug?: string;
  projectName?: string;
  description?: string;
  targetMarket?: string;
  pricePoint?: string;
  keyBenefits?: string;
  mode?: ConceptImageMode;
  count?: number;
  promptStyle?: string;
}

const DEFAULT_IMAGE_COUNT = 4;
const MAX_IMAGE_COUNT = 4;

const modeDirections: Record<ConceptImageMode, string> = {
  packaging: 'Flagship hero packshot art-directed like a modern indie-premium snack launch (think bold, minimalist challenger brands): three-quarter front angle on a punchy solid-color studio backdrop, crisp directional key light with a subtle rim light separating the pack from the background, shallow depth of field, saturated true-to-brand color grading, confident oversized logotype and claims with generous breathing room, premium material rendering (matte coatings, foil or embossed accents, glossy film highlights where appropriate) — the kind of single-product hero shot that anchors a billboard or app icon',
  shelf: 'In-context shelf placement shot styled like a category audit photo from a retail insights deck: product faces forward at eye level among softly blurred adjacent category competitors, realistic store lighting, strong shelf-talker readability, a composition that proves stand-out without looking staged',
  usage: 'Lifestyle usage photography styled like a finished campaign social post: appetite-appeal food styling under natural window or golden-hour light, candid framing with intentional negative space reserved for copy overlay, authentic textures (steam, condensation, crumb, crunch) where relevant, hands only if they add narrative warmth — energetic and aspirational, never sterile',
  ingredient: 'Ingredient storytelling flat-lay styled like a benefits page from a brand deck: clean overhead or three-quarter composition with key ingredients arranged in a deliberate visual hierarchy around the product, soft diffused lighting, generous negative space for callout copy, a credible food-science aesthetic rather than clinical or sterile',
  ad: 'Campaign-ready ad concept styled like a finished social or out-of-home creative for a buzzy modern challenger brand: bold graphic hero composition with the product as the clear focal point against a saturated solid or duotone color block, dramatic but on-brand lighting and color grading, a clean negative-space block reserved for a punchy headline and call-to-action, consistent with high-production-value, design-forward food and beverage advertising',
};

// Each generation batch spans these distinct angles (in priority order) so the
// four results read as genuinely different concepts rather than near-duplicate
// renders of the same shot — matching how a design team would pitch a range of
// directions, not four takes on one idea.
const ANGLE_SEQUENCE: ConceptImageMode[] = ['packaging', 'usage', 'shelf', 'ad', 'ingredient'];

function buildAngleSequence(preferredMode: ConceptImageMode, count: number): ConceptImageMode[] {
  const ordered = [preferredMode, ...ANGLE_SEQUENCE.filter(angle => angle !== preferredMode)];
  return ordered.slice(0, Math.max(1, count));
}

const styleDirections: Record<string, string> = {
  balanced: 'Mainstream food-and-beverage brand system: confident but approachable typography, credible claim placement, a restrained color palette that reads as trustworthy on a crowded shelf',
  premium: 'Premium brand system: refined serif or modern sans typography, metallic or deep jewel-tone accents, elevated editorial-style photography, generous white space that signals exclusivity and craftsmanship',
  natural: 'Natural and clean-living brand system: organic textures (kraft paper, linen, raw wood), earthy muted palette, botanical or hand-drawn accents, soft natural light that reinforces a wellness narrative',
  family: 'Family and everyday brand system: warm saturated palette, rounded friendly typography, energetic composition that signals an easy mealtime win',
  foodservice: 'Foodservice and B2B brand system: clean professional-kitchen aesthetic, practical portion and format cues, confident utilitarian typography that signals reliability at scale',
  'clean-label': 'Clean-label and transparency brand system: minimal palette, generous negative space, ingredient-forward visual hierarchy, typography that reads as honest and unembellished',
};

function clean(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function buildPrompt(body: GenerateConceptImagesBody, modeOverride?: ConceptImageMode) {
  const mode = modeOverride ?? body.mode ?? 'packaging';
  const style = body.promptStyle ?? 'balanced';
  const benefits = clean(body.keyBenefits);
  const target = clean(body.targetMarket);
  const price = clean(body.pricePoint);
  const details = [
    `Act as the creative director at a top food-and-beverage marketing agency producing a campaign-grade concept visual for "${clean(body.conceptName, 'a new food product')}".`,
    clean(body.category) ? `Category: ${clean(body.category)}.` : '',
    clean(body.description) ? `Concept brief: ${clean(body.description)}.` : '',
    benefits ? `The image must communicate these consumer benefits visually, without relying on label text: ${benefits}.` : '',
    target ? `Target audience: ${target} — let color, styling, and composition feel deliberately chosen for them, not generic.` : '',
    price ? `Price positioning: ${price} — the production value and material rendering should match this price point.` : '',
    `Art direction: ${modeDirections[mode]}.`,
    `Brand system: ${styleDirections[style] ?? styleDirections.balanced}.`,
    'Production bar: this should look like a real launch asset from a buzzy, design-led modern food or snack brand — bold and confident, never generic or "AI stock photo." Favor punchy, deliberate color choices, tactile premium materials, and a composition that would hold up printed large on a billboard or shelf.',
    'Render at a quality indistinguishable from a finished agency campaign asset: photorealistic, tack-sharp focus on the hero subject, intentional color grading, believable physical material and lighting interactions, and a composition polished enough to run as-is in a consumer concept test.',
    'Avoid fake nutrition labels, celebrity likenesses, real brand logos, medical claims, watermarks, stock-photo artifacts, generic AI sheen, and unreadable or distorted text.',
  ].filter(Boolean);

  return details.join(' ').slice(0, 32000);
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
      .select('concept_max_generations_per_concept, concept_monthly_budget_cents, concept_require_approval')
      .eq('org_id', orgId)
      .maybeSingle();

    const configuredCount = Number(settings?.default_image_count) || DEFAULT_IMAGE_COUNT;
    const configuredMax = Number(settings?.max_images_per_concept) || MAX_IMAGE_COUNT;
    const configuredModel = clean(settings?.default_model, imageModel);
    const configuredQuality = clean(settings?.default_quality, imageQuality);
    const configuredStyle = clean(body.promptStyle, clean(settings?.prompt_style, 'balanced'));
    const costPerImage = Number(settings?.estimated_cost_per_image) || 0.034;

    const count = Math.max(1, Math.min(configuredMax, Number(body.count) || configuredCount));
    const model = configuredModel;
    const quality = configuredQuality;
    const projectName = clean(body.projectName, 'Project 1');
    const foodTypeSlug = clean(body.foodTypeSlug);
    const primaryMode = body.mode ?? 'packaging';
    const angles = buildAngleSequence(primaryMode, count);
    const angledPrompts = angles.map(angle => ({ angle, prompt: buildPrompt({ ...body, promptStyle: configuredStyle }, angle) }));
    const prompt = angledPrompts[0]?.prompt ?? buildPrompt({ ...body, promptStyle: configuredStyle });
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
        },
      })
      .select()
      .single();

    if (generationError) throw generationError;

    // One request per angle (n: 1 each) so every image is art-directed from a
    // genuinely distinct prompt — a single shared prompt with n > 1 just
    // produces near-duplicate renders of the same shot.
    const angleResponses = await Promise.all(angledPrompts.map(async ({ angle, prompt: anglePrompt }) => {
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
      return { angle, prompt: anglePrompt, ok: res.ok, status: res.status, json };
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

    const imageResults = [] as Array<{ id: string; url: string; storagePath: string; revisedPrompt?: string }>;
    for (let index = 0; index < angleResponses.length; index++) {
      const { angle, prompt: anglePrompt, json } = angleResponses[index];
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
