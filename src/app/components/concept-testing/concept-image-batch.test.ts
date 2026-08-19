import { describe, expect, it, vi } from 'vitest';
import { generateConceptImageBatch } from './concept-image-batch';

describe('concept image batch transport', () => {
  it('sends each visual as an independent one-image request', async () => {
    const invoke = vi.fn(async (body: Record<string, unknown>) => ({
      data: { images: [{ url: `https://images.test/${body.mode}.png`, mode: String(body.mode) }] },
      error: null,
    }));

    const result = await generateConceptImageBatch({
      count: 4,
      leadMode: 'packaging',
      spreadModes: true,
      body: { conceptName: 'Test concept', count: 4 },
      invoke,
    });

    expect(invoke).toHaveBeenCalledTimes(4);
    expect(invoke.mock.calls.map(([body]) => body)).toEqual([
      expect.objectContaining({ mode: 'packaging', count: 1, spreadModes: false }),
      expect.objectContaining({ mode: 'lifestyle', count: 1, spreadModes: false }),
      expect.objectContaining({ mode: 'shelf', count: 1, spreadModes: false }),
      expect.objectContaining({ mode: 'social_ad', count: 1, spreadModes: false }),
    ]);
    expect(result.images).toHaveLength(4);
    expect(result.errors).toHaveLength(0);
  });

  it('keeps successful visuals when one independent request fails', async () => {
    const invoke = vi.fn(async (body: Record<string, unknown>) => body.mode === 'lifestyle'
      ? { data: null, error: new Error('Failed to fetch') }
      : { data: { images: [{ url: `https://images.test/${body.mode}.png` }] }, error: null });

    const result = await generateConceptImageBatch({
      count: 3,
      leadMode: 'packaging',
      spreadModes: true,
      body: {},
      invoke,
    });

    expect(result.images).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('connection to the image service');
  });

  it('waits for queued background jobs instead of holding the invoke request open', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { generationId: 'generation-1', status: 'generating' },
      error: null,
    });
    const waitForGeneration = vi.fn().mockResolvedValue({ url: 'https://images.test/ready.png' });

    const result = await generateConceptImageBatch({
      count: 1,
      leadMode: 'packaging',
      spreadModes: false,
      body: { async: true },
      invoke,
      waitForGeneration,
    });

    expect(waitForGeneration).toHaveBeenCalledWith('generation-1');
    expect(result.images).toEqual([{ url: 'https://images.test/ready.png' }]);
  });
});
