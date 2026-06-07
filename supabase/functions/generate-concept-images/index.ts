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
  packaging: 'front-facing premium retail packaging mockup, clear product name, realistic materials, white studio background',
  shelf: 'realistic grocery shelf context, adjacent category products softly visible, strong package readability',
  usage: 'natural consumer usage occasion, appetizing food styling, realistic lighting, no people in frame unless hands are necessary',
  ingredient: 'ingredient and benefit visual system, clean composition, ingredients arranged around the product, credible food science tone',
  ad: 'polished social ad concept, product hero image, campaign-ready composition, space for headline and claims',
};

const styleDirections: Record<string, string> = {
  balanced: 'balanced mainstream food branding with credible claims and restrained styling',
  premium: 'premium cues, refined materials, elevated photography, sophisticated retail presence',
  natural: 'natural ingredient cues, fresh food styling, approachable wellness positioning',
  family: 'family-friendly clarity, warm approachable packaging, easy everyday usage cues',
  foodservice: 'foodservice-ready presentation, professional kitchen credibility, practical format cues',
  'clean-label': 'clean-label positioning, simple ingredient emphasis, minimal trustworthy visual language',
};

function clean(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function buildPrompt(body: GenerateConceptImagesBody) {
  const mode = body.mode ?? 'packaging';
  const style = body.promptStyle ?? 'balanced';
  const benefits = clean(body.keyBenefits);
  const target = clean(body.targetMarket);
  const price = clean(body.pricePoint);
  const details = [
    `Create a market-ready food concept visual for ${clean(body.conceptName, 'a new food product')}.`,
    clean(body.category) ? `Food category: ${clean(body.category)}.` : '',
    clean(body.description) ? `Concept: ${clean(body.description)}.` : '',
    benefits ? `Consumer benefits to communicate visually: ${benefits}.` : '',
    target ? `Target consumer: ${target}.` : '',
    price ? `Expected retail price: ${price}.` : '',
    `Visual direction: ${modeDirections[mode]}.`,
    `Positioning style: ${styleDirections[style] ?? styleDirections.balanced}.`,
    'Make it realistic, appetizing, commercially credible, and suitable for consumer concept testing.',
    'Avoid fake nutrition labels, celebrity likenesses, real brand logos, medical claims, and unreadable distorted text.',
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

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: authHeader } },
  });

  const { data: { user: callerUser }, error: callerUserError } = await callerClient.auth.getUser();
  if (callerUserError || !callerUser) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const { data: profile, error: profileError } = await callerClient
    .from('profiles')
    .select('id, role, status')
    .eq('id', callerUser.id)
    .single();

  if (profileError || profile?.role !== 'admin' || profile?.status !== 'active') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
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
      .eq('active', true)
      .maybeSingle();
    const { data: workspaceSettings } = await serviceClient
      .from('workspace_settings')
      .select('concept_max_generations_per_concept, concept_monthly_budget_cents, concept_require_approval')
      .eq('id', true)
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
    const prompt = buildPrompt({ ...body, promptStyle: configuredStyle });
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
        concept_test_id: body.conceptTestId || null,
        created_by: profile.id,
        project_name: projectName,
        food_type_slug: foodTypeSlug,
        concept_name: clean(body.conceptName),
        mode: body.mode ?? 'packaging',
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

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        n: count,
        size: '1024x1024',
        quality,
        background: 'opaque',
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      const message = result?.error?.message ?? `OpenAI image generation failed with status ${response.status}`;
      await serviceClient
        .from('concept_image_generations')
        .update({ status: 'failed', error_message: message, completed_at: new Date().toISOString() })
        .eq('id', generation.id);
      throw new Error(message);
    }

    const imageResults = [] as Array<{ id: string; url: string; storagePath: string; revisedPrompt?: string }>;
    const rawImages = ((result.data ?? []) as Array<{ b64_json?: string; url?: string; revised_prompt?: string }>);
    for (let index = 0; index < rawImages.length; index++) {
      const item = rawImages[index];
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
          generation_id: generation.id,
          concept_test_id: body.conceptTestId || null,
          image_url: storagePath,
          storage_path: storagePath,
          selected_for_panelists: !Boolean(workspaceSettings?.concept_require_approval),
          sort_order: index,
          mode: body.mode ?? 'packaging',
          prompt,
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
