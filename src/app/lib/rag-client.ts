import { supabase } from './supabase';

const LOCAL_RAG_BASE_URL = 'http://127.0.0.1:8000';

/** Resolve the Food RAG service without allowing localhost in production. */
export function ragBaseUrl(): string {
  const configured = (import.meta.env.VITE_NFI_RAG_URL as string | undefined)?.trim().replace(/\/$/, '');
  if (configured) return configured;
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') return LOCAL_RAG_BASE_URL;
  throw new Error('VITE_NFI_RAG_URL is required for production Evidence Assist requests.');
}

function requestId() {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `rag-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Shared authenticated transport for the separate RAG service. Supabase JWTs
 * carry the tenant and role claims supplied by the access-token hook. Cookies
 * stay disabled so browser calls use one auditable authentication mechanism.
 */
export async function ragFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Unable to authenticate the Evidence Assist request: ${error.message}`);

  const accessToken = data.session?.access_token;
  if (!accessToken && import.meta.env.PROD) {
    throw new Error('An authenticated session is required to use Evidence Assist.');
  }

  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (!headers.has('X-Request-ID')) headers.set('X-Request-ID', requestId());
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return fetch(`${ragBaseUrl()}${normalizedPath}`, {
    ...init,
    headers,
    credentials: 'omit',
  });
}

/** Open an authenticated source document without placing credentials in a URL. */
export async function openRagSource(input: {
  sourcePath: string;
  title: string;
  excerpt?: string;
}): Promise<void> {
  const opened = window.open('about:blank', '_blank');
  if (opened) opened.opener = null;
  const params = new URLSearchParams({ source_path: input.sourcePath, title: input.title });
  if (input.excerpt) params.set('excerpt', input.excerpt);
  let response: Response;
  try {
    response = await ragFetch(`/source?${params.toString()}`, { headers: { Accept: 'text/html' } });
    if (!response.ok) throw new Error(`Source viewer unavailable (${response.status}).`);
  } catch (error) {
    opened?.close();
    throw error;
  }

  const objectUrl = URL.createObjectURL(new Blob([await response.text()], { type: 'text/html' }));
  if (opened) opened.location.href = objectUrl;
  else window.open(objectUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
