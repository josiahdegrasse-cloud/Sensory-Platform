import { describe, expect, it, vi } from 'vitest';
import {
  checkConceptImageService,
  conceptImageErrorMessage,
  friendlyConceptImageError,
  invokeConceptImageFunction,
  warmConceptImageFunction,
} from './concept-image-service';

describe('concept image service', () => {
  it('invokes the worker with the current user token instead of a cached function header', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(invokeConceptImageFunction({ intent: 'diagnostic' }, {
      baseUrl: 'https://example.supabase.co/',
      anonKey: 'public-key',
      getAccessToken: async () => 'current-user-jwt',
      fetcher,
    })).resolves.toEqual({ data: { ok: true }, error: null });
    expect(fetcher).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/generate-concept-images',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'public-key',
          Authorization: 'Bearer current-user-jwt',
        }),
      }),
    );
  });

  it('does not call the worker when the browser session has expired', async () => {
    const fetcher = vi.fn();

    const result = await invokeConceptImageFunction({ intent: 'diagnostic' }, {
      baseUrl: 'https://example.supabase.co',
      anonKey: 'public-key',
      getAccessToken: async () => null,
      fetcher,
    });

    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toContain('session has expired');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('checks the authenticated service path without requesting a generation', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true, phase: 'ready', functionVersion: 26 }, error: null });

    await expect(checkConceptImageService(invoke)).resolves.toMatchObject({ ok: true });
    expect(invoke).toHaveBeenCalledWith({ intent: 'diagnostic' });
  });

  it('returns the diagnostic function error without hiding it', async () => {
    const diagnosticError = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: new Response(JSON.stringify({ error: 'image storage: bucket not found' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    });

    await expect(checkConceptImageService(vi.fn().mockResolvedValue({ data: null, error: diagnosticError })))
      .rejects.toThrow('Concept image storage bucket is not ready');
  });

  it('warms the Edge Function with a credit-safe OPTIONS request', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

    await warmConceptImageFunction({ baseUrl: 'https://example.supabase.co/', fetcher });

    expect(fetcher).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/generate-concept-images',
      expect.objectContaining({ method: 'OPTIONS' }),
    );
  });

  it('does not allow a failed worker preflight to reach generation', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 }));

    await expect(warmConceptImageFunction({ baseUrl: 'https://example.supabase.co', fetcher }))
      .rejects.toThrow('HTTP 502');
  });

  it('distinguishes a Supabase boot failure from OpenAI billing', async () => {
    const gatewayError = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: new Response('<html>Bad Gateway</html>', { status: 502 }),
    });

    await expect(conceptImageErrorMessage(gatewayError)).resolves.toContain('could not start');
    expect(friendlyConceptImageError('insufficient_quota')).toContain('billing or credits');
  });
});
