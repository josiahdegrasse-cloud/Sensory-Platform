import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { ENHANCED_SENSORY_DATA } from '../data/enhanced-sensory';
import { tweakDiagnosisQueryOptions } from '../lib/hooks';
import {
  buildDecisionRagPrefetchRequests,
  scopeDecisionRagProfiles,
  warmDecisionRagRequests,
} from './decision-rag-preloader';

describe('decision RAG background preloader', () => {
  it('limits background research to the active project samples', () => {
    const profiles = ENHANCED_SENSORY_DATA.filter(profile => ['S2', 'S3', 'S4'].includes(profile.sampleId));

    expect(scopeDecisionRagProfiles(profiles, new Set(['S3'])).map(profile => profile.sampleId))
      .toEqual(['S3']);
  });

  it('builds requests for TWEAK and STOP decisions but skips GO decisions', () => {
    const profiles = ENHANCED_SENSORY_DATA.filter(profile => ['S2', 'S3', 'S4'].includes(profile.sampleId));
    const requests = buildDecisionRagPrefetchRequests({
      profiles,
      foodTypeForProfile: () => 'cheese',
      goThreshold: 75,
      stopThreshold: 45,
    });

    expect(requests.map(request => request.sample.sampleId)).toEqual(['S2', 'S3']);
    expect(requests.map(request => request.decision.outcome)).toEqual(['TWEAK', 'STOP']);
  });

  it('deduplicates requests and limits concurrent background work', async () => {
    const profile = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'S2')!;
    const [request] = buildDecisionRagPrefetchRequests({
      profiles: [profile],
      foodTypeForProfile: () => 'cheese',
      goThreshold: 75,
      stopThreshold: 45,
    });
    const secondRequest = {
      ...request,
      sample: { ...request.sample, sampleId: 'S2-copy' },
    };
    let active = 0;
    let maxActive = 0;
    const prefetch = vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
    });

    await warmDecisionRagRequests(
      [request, request, secondRequest],
      prefetch,
      { concurrency: 2 },
    );

    expect(prefetch).toHaveBeenCalledTimes(2);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('serves a warmed diagnosis without calling the network again', async () => {
    const profile = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'S2')!;
    const [request] = buildDecisionRagPrefetchRequests({
      profiles: [profile],
      foodTypeForProfile: () => 'cheese',
      goThreshold: 75,
      stopThreshold: 45,
    });
    const options = tweakDiagnosisQueryOptions(request);
    const queryClient = new QueryClient();
    const warmed = { summary: 'Already prepared' };
    const networkFetch = vi.fn(async () => ({ summary: 'Fetched again' }));
    queryClient.setQueryData(options.queryKey, warmed);

    const result = await queryClient.fetchQuery({
      ...options,
      queryFn: networkFetch,
    });

    expect(result).toEqual(warmed);
    expect(networkFetch).not.toHaveBeenCalled();
  });
});
