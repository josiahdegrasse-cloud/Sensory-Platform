import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { EnhancedSensoryProfile } from '../data/enhanced-sensory';
import type { FormulationVersion } from '../lib/formulation-profile';
import {
  tweakDiagnosisQueryOptions,
  useInstrumentalDataset,
  useRagStatus,
  useWorkspaceSettings,
} from '../lib/hooks';
import { buildImportedSensoryProfiles } from '../lib/sensory-evidence-profile';
import {
  buildTweakDiagnosisRequest,
  tweakDiagnosisCacheKey,
  type TweakDiagnosisRequest,
} from '../lib/tweak-intelligence';
import { useSurveyData } from '../lib/use-survey-data';
import { calculateGoStopTweakDecision } from '../utils/go-stop-tweak-engine';

const DECISION_WEIGHTS = { hedonic: 30, texture: 25, cata: 25, emotional: 15 };
const PREFETCH_CONCURRENCY = 2;
const PREFETCH_START_DELAY_MS = 300;

export function scopeDecisionRagProfiles(
  profiles: readonly EnhancedSensoryProfile[],
  sampleIds?: ReadonlySet<string>,
): EnhancedSensoryProfile[] {
  return sampleIds
    ? profiles.filter(profile => sampleIds.has(profile.sampleId))
    : [...profiles];
}

export function buildDecisionRagPrefetchRequests(input: {
  profiles: readonly EnhancedSensoryProfile[];
  foodTypeForProfile: (profile: EnhancedSensoryProfile) => string;
  goThreshold: number;
  stopThreshold: number;
  formulationForProfile?: (profile: EnhancedSensoryProfile) => FormulationVersion | null;
}): TweakDiagnosisRequest[] {
  return input.profiles.flatMap(profile => {
    const foodType = input.foodTypeForProfile(profile);
    const decision = calculateGoStopTweakDecision(profile, DECISION_WEIGHTS, foodType, {
      go: input.goThreshold,
      stop: input.stopThreshold,
    });
    if (decision.decision === 'GO') return [];
    return [buildTweakDiagnosisRequest({
      decision,
      profile,
      foodType,
      formulation: input.formulationForProfile?.(profile) ?? null,
    })];
  });
}

export async function warmDecisionRagRequests(
  requests: readonly TweakDiagnosisRequest[],
  prefetch: (request: TweakDiagnosisRequest) => Promise<unknown>,
  options: {
    concurrency?: number;
    shouldContinue?: () => boolean;
  } = {},
) {
  const uniqueRequests = Array.from(
    new Map(requests.map(request => [tweakDiagnosisCacheKey(request), request])).values(),
  );
  const concurrency = Math.max(1, Math.min(options.concurrency ?? PREFETCH_CONCURRENCY, uniqueRequests.length));
  const shouldContinue = options.shouldContinue ?? (() => true);
  let nextIndex = 0;

  const worker = async () => {
    while (shouldContinue()) {
      const request = uniqueRequests[nextIndex];
      nextIndex += 1;
      if (!request) return;
      try {
        await prefetch(request);
      } catch {
        // Background warming must never interrupt normal app navigation. The
        // visible panel retains its existing retry and offline states.
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

export function DecisionRagPreloader({
  sampleIds,
}: {
  sampleIds?: ReadonlySet<string>;
}) {
  const queryClient = useQueryClient();
  const ragStatus = useRagStatus();
  const { data: instrumentalDataset } = useInstrumentalDataset();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const { liveAggregations } = useSurveyData();
  const minimumResponses = workspaceSettings?.decisionMinResponses ?? 12;
  const goThreshold = workspaceSettings?.decisionGoThreshold ?? 75;
  const stopThreshold = workspaceSettings?.decisionStopThreshold ?? 45;

  const profiles = useMemo(() => {
    const importedProfiles = buildImportedSensoryProfiles(
      instrumentalDataset,
      liveAggregations,
      { minimumResponses },
    );
    return scopeDecisionRagProfiles(importedProfiles, sampleIds);
  }, [instrumentalDataset, liveAggregations, minimumResponses, sampleIds]);

  const requests = useMemo(() => buildDecisionRagPrefetchRequests({
    profiles,
    foodTypeForProfile: profile => instrumentalDataset?.eTongueData.find(
      sample => sample.sampleId === profile.sampleId,
    )?.type ?? 'all',
    goThreshold,
    stopThreshold,
    formulationForProfile: profile => instrumentalDataset?.formulationVersions?.[profile.sampleId]
      ?.find(version => version.isCurrent && version.reviewStatus === 'reviewed') ?? null,
  }), [goThreshold, instrumentalDataset?.eTongueData, instrumentalDataset?.formulationVersions, profiles, stopThreshold]);

  useEffect(() => {
    if (
      !ragStatus.isSuccess
      || requests.length === 0
      || document.visibilityState === 'hidden'
    ) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void warmDecisionRagRequests(
        requests,
        request => queryClient.prefetchQuery(tweakDiagnosisQueryOptions(request)),
        { shouldContinue: () => active },
      );
    }, PREFETCH_START_DELAY_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [queryClient, ragStatus.isSuccess, requests]);

  return null;
}
