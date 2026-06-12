import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageMocks = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  from: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: {
    storage: {
      from: storageMocks.from,
    },
  },
}));

import { createConceptImageSignedUrl } from './concepts';

describe('createConceptImageSignedUrl', () => {
  beforeEach(() => {
    storageMocks.createSignedUrl.mockReset();
    storageMocks.from.mockReset();
    storageMocks.from.mockReturnValue({
      createSignedUrl: storageMocks.createSignedUrl,
    });
  });

  it('uses a signed URL when storage_path is available', async () => {
    storageMocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/concept.png' },
      error: null,
    });

    await expect(createConceptImageSignedUrl(
      'generation/concept.png',
      'https://legacy.example/concept.png',
    )).resolves.toBe('https://signed.example/concept.png');

    expect(storageMocks.from).toHaveBeenCalledWith('concept-images');
    expect(storageMocks.createSignedUrl).toHaveBeenCalledWith('generation/concept.png', 60 * 60);
  });

  it('preserves the legacy URL when storage_path is missing', async () => {
    await expect(createConceptImageSignedUrl(
      null,
      'https://legacy.example/concept.png',
    )).resolves.toBe('https://legacy.example/concept.png');

    expect(storageMocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it('falls back safely when signing fails', async () => {
    storageMocks.createSignedUrl.mockResolvedValue({
      data: null,
      error: new Error('signing failed'),
    });

    await expect(createConceptImageSignedUrl(
      'generation/concept.png',
      'https://legacy.example/concept.png',
    )).resolves.toBe('https://legacy.example/concept.png');

    await expect(createConceptImageSignedUrl(
      'generation/concept.png',
      'generation/concept.png',
    )).resolves.toBe('');
  });
});
