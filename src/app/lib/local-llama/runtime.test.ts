import { describe, expect, it } from 'vitest';
import { inspectLocalLlamaCapability } from './runtime';

describe('local Llama runtime capability', () => {
  it('fails clearly outside a supported browser instead of calling a remote model', async () => {
    const result = await inspectLocalLlamaCapability();
    expect(result.supported).toBe(false);
    expect(result.reason).toMatch(/browser|WebGPU/i);
  });
});
