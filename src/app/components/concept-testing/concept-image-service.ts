import { supabase } from '../../lib/supabase';

const FUNCTION_NAME = 'generate-concept-images';

type FunctionInvokeError = Error & { context?: Response };

interface ServiceDiagnosticResult {
  data: { ok?: boolean; phase?: string; functionVersion?: number } | null;
  error: unknown;
}

export interface ConceptImageInvokeResult<T = Record<string, unknown>> {
  data: T | null;
  error: unknown;
}

interface ConceptImageInvokeOptions {
  baseUrl?: string;
  anonKey?: string;
  fetcher?: typeof fetch;
  getAccessToken?: () => Promise<string | null>;
}

function functionUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, '')}/functions/v1/${FUNCTION_NAME}`;
}

export function friendlyConceptImageError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('502') || lower.includes('503') || lower.includes('504') || lower.includes('bad gateway')) {
    return 'The Supabase image worker could not start. Wait a few seconds and try again; image credits have not been requested yet.';
  }
  if (lower.includes('failed to send a request') || lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return 'The connection to the image service was interrupted. Check your connection, wait a few seconds, and try again.';
  }
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

export async function conceptImageErrorMessage(error: unknown) {
  let message = error instanceof Error ? error.message : String(error || '');
  const response = (error as FunctionInvokeError | null)?.context;
  if (response instanceof Response) {
    try {
      const body = await response.clone().json();
      if (typeof body?.error === 'string') message = body.error;
    } catch {
      // The gateway can return HTML. Preserve the status rather than exposing it.
      if ([502, 503, 504].includes(response.status)) {
        message = `Supabase image worker returned ${response.status} Bad Gateway.`;
      } else if (!response.ok) {
        message = `Image service returned HTTP ${response.status}.`;
      }
    }
  }
  return friendlyConceptImageError(message);
}

/**
 * Calls the image function with an explicit user JWT. This avoids relying on
 * the FunctionsClient's cached Authorization header, which can remain on the
 * publishable/anon key after a restored browser session.
 */
export async function invokeConceptImageFunction<T = Record<string, unknown>>(
  body: Record<string, unknown>,
  options: ConceptImageInvokeOptions = {},
): Promise<ConceptImageInvokeResult<T>> {
  const baseUrl = options.baseUrl ?? import.meta.env.VITE_SUPABASE_URL;
  const anonKey = options.anonKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  const getAccessToken = options.getAccessToken ?? (async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session?.access_token ?? null;
  });

  try {
    if (!baseUrl || !anonKey) throw new Error('Supabase image service is not configured.');
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error('Your session has expired. Sign in again before generating images.');
    const response = await (options.fetcher ?? fetch)(functionUrl(baseUrl), {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-client-info': 'sensory-platform-concept-images/1.0',
      },
      body: JSON.stringify(body),
    });
    const responseForError = response.clone();
    let payload: T | { error?: string } | null = null;
    try {
      payload = await response.json();
    } catch {
      // Preserve the HTTP response below so the shared error formatter can
      // distinguish a gateway page from a function JSON error.
    }
    if (!response.ok) {
      const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Image service returned HTTP ${response.status}.`;
      return { data: null, error: Object.assign(new Error(message), { context: responseForError }) };
    }
    return { data: payload as T, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Starts and verifies the Edge Function before the paid generation request.
 * OPTIONS is handled before authentication, database writes, or OpenAI calls,
 * so this check cannot consume image credits or create duplicate generations.
 */
export async function warmConceptImageFunction(options: {
  baseUrl?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
} = {}) {
  const baseUrl = options.baseUrl ?? import.meta.env.VITE_SUPABASE_URL;
  if (!baseUrl) throw new Error('Supabase URL is not configured for image generation.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
  try {
    const response = await (options.fetcher ?? fetch)(functionUrl(baseUrl), {
      method: 'OPTIONS',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Supabase image worker returned HTTP ${response.status}.`);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      const timeoutError = new Error('The Supabase image worker did not respond before the connection timed out.');
      (timeoutError as Error & { cause?: unknown }).cause = error;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Exercises the authenticated, tenant-scoped Edge Function path without
 * creating a generation row or calling OpenAI.
 */
export async function checkConceptImageService(
  invoke: (body: Record<string, unknown>) => Promise<ServiceDiagnosticResult>,
) {
  const result = await invoke({ intent: 'diagnostic' });
  if (result.error) throw new Error(await conceptImageErrorMessage(result.error));
  if (!result.data?.ok) {
    throw new Error('The image worker readiness check did not complete. No image credits were used.');
  }
  return result.data;
}
