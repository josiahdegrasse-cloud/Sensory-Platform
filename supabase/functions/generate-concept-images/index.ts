import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type ConceptImageMode = 'packaging' | 'shelf' | 'usage' | 'ingredient' | 'ad';

interface GenerateConceptImagesBody {
  conceptName?: string;
  category?: string;
  description?: string;
  targetMarket?: string;
  pricePoint?: string;
  keyBenefits?: string;
  mode?: ConceptImageMode;
  count?: number;
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

function clean(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function buildPrompt(body: GenerateConceptImagesBody) {
  const mode = body.mode ?? 'packaging';
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
    'Make it realistic, appetizing, commercially credible, and suitable for consumer concept testing.',
    'Avoid fake nutrition labels, celebrity likenesses, real brand logos, medical claims, and unreadable distorted text.',
  ].filter(Boolean);

  return details.join(' ').slice(0, 32000);
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

  const { data: profile, error: profileError } = await callerClient
    .from('profiles')
    .select('role')
    .single();

  if (profileError || profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json() as GenerateConceptImagesBody;
    const count = Math.max(1, Math.min(MAX_IMAGE_COUNT, Number(body.count) || DEFAULT_IMAGE_COUNT));
    const prompt = buildPrompt(body);

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: imageModel,
        prompt,
        n: count,
        size: '1024x1024',
        quality: imageQuality,
        background: 'opaque',
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      const message = result?.error?.message ?? `OpenAI image generation failed with status ${response.status}`;
      throw new Error(message);
    }

    const images = ((result.data ?? []) as Array<{ b64_json?: string; url?: string; revised_prompt?: string }>)
      .map((item) => ({
        url: item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url,
        revisedPrompt: item.revised_prompt,
      }))
      .filter((item) => item.url);

    return new Response(JSON.stringify({ images, model: imageModel, quality: imageQuality, prompt }), {
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
