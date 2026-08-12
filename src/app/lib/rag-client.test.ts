import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: { auth: { getSession } },
}));

import { ragFetch } from './rag-client';

describe('authenticated RAG transport', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_NFI_RAG_URL', 'https://research.nfi.test/');
    getSession.mockResolvedValue({
      data: { session: { access_token: 'signed-supabase-token' } },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sends the Supabase bearer token and an auditable request id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await ragFetch('/api/evidence-assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(url).toBe('https://research.nfi.test/api/evidence-assist');
    expect(headers.get('Authorization')).toBe('Bearer signed-supabase-token');
    expect(headers.get('X-Request-ID')).toBeTruthy();
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(init.credentials).toBe('omit');
  });

  it('fails before the network when Supabase cannot establish the caller identity', async () => {
    getSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'session storage unavailable' },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(ragFetch('/api/status')).rejects.toThrow(/authenticate.*session storage unavailable/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborts a stalled research request at the caller-provided deadline', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    vi.stubGlobal('fetch', fetchMock);

    const request = ragFetch('/api/status', { timeoutMs: 50 });
    const rejection = expect(request).rejects.toThrow(/timed out after 50 ms/i);
    await vi.runAllTimersAsync();

    await rejection;
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).signal?.aborted).toBe(true);
    vi.useRealTimers();
  });
});
