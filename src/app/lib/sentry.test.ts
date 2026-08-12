import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captureException = vi.fn();

vi.mock('@sentry/react', () => ({ captureException }));

describe('application error monitoring', () => {
  beforeEach(() => captureException.mockClear());
  afterEach(() => vi.unstubAllEnvs());

  it('does not transmit errors when monitoring is not configured', async () => {
    const { captureAppError } = await import('./sentry');
    captureAppError(new Error('private failure'), 'react-root');
    await Promise.resolve();

    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports only the error and a low-cardinality source tag', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://public@example.invalid/1');
    const error = new Error('render failed');
    const { captureAppError } = await import('./sentry');

    captureAppError(error, 'react-route');

    await vi.waitFor(() => expect(captureException).toHaveBeenCalledWith(error, {
      tags: { app_error_source: 'react-route' },
    }));
  });
});
