import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession, createSignedUrl } = vi.hoisted(() => ({ getSession: vi.fn(), createSignedUrl: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: {
    auth: { getSession },
    storage: { from: () => ({ createSignedUrl }) },
  },
}));

import { openResearchSource, ragFetch } from './rag-client';

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
    vi.restoreAllMocks();
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

  it('opens an indexed article through the authenticated viewer', async () => {
    const popup = { opener: {} as Window | null, location: { href: '' }, close: vi.fn() };
    const open = vi.fn().mockReturnValue(popup);
    vi.stubGlobal('window', { open, setTimeout: vi.fn() });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:article-viewer');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(new Response('<html>Article</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await openResearchSource({ sourcePath: '/approved/texture.pdf', title: 'Texture study' });

    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/source?source_path=%2Fapproved%2Ftexture.pdf');
    expect(popup.location.href).toBe('blob:article-viewer');
  });

  it('opens an uploaded article from a short-lived signed URL', async () => {
    const popup = { opener: {} as Window | null, location: { href: '' }, close: vi.fn() };
    const open = vi.fn().mockReturnValue(popup);
    vi.stubGlobal('window', { open });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://storage.test/signed.pdf' }, error: null });

    await openResearchSource({
      sourcePath: 'supabase://literature-imports/org/article.pdf',
      title: 'Uploaded study',
    });

    expect(createSignedUrl).toHaveBeenCalledWith('org/article.pdf', 300);
    expect(popup.location.href).toBe('https://storage.test/signed.pdf');
  });

  it('repairs older saved citations by resolving the article title in the approved library', async () => {
    const popup = { opener: {} as Window | null, location: { href: '' }, close: vi.fn() };
    vi.stubGlobal('window', { open: vi.fn().mockReturnValue(popup), setTimeout: vi.fn() });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:resolved-article');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        documents: [{
          title: 'Texture confirmation in plant-based cheese',
          corpusPath: '/approved/texture-confirmation.pdf',
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response('<html>Article</html>', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await openResearchSource({
      sourcePath: 'Approved NFI literature library',
      title: 'Texture confirmation in plant-based cheese',
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/library/documents');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('source_path=%2Fapproved%2Ftexture-confirmation.pdf');
    expect(popup.location.href).toBe('blob:resolved-article');
  });

  it('repairs a stale indexed path by finding the current article path and retrying once', async () => {
    const popup = { opener: {} as Window | null, location: { href: '' }, close: vi.fn() };
    vi.stubGlobal('window', { open: vi.fn().mockReturnValue(popup), setTimeout: vi.fn() });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:repaired-article');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('missing', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        documents: [{
          title: 'Texture confirmation in plant-based cheese',
          corpusPath: '/approved/current-texture-confirmation.pdf',
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response('<html>Repaired article</html>', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await openResearchSource({
      sourcePath: '/approved/old-texture-confirmation.pdf',
      title: 'Texture confirmation in plant-based cheese',
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('old-texture-confirmation.pdf');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/api/library/documents');
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('current-texture-confirmation.pdf');
    expect(popup.location.href).toBe('blob:repaired-article');
  });
});
