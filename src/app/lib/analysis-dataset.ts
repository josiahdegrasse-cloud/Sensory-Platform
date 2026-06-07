import type { EnhancedSensoryProfile } from '../data/enhanced-sensory';

export function mergeAnalysisProfiles(
  referenceProfiles: EnhancedSensoryProfile[],
  importedProfiles: EnhancedSensoryProfile[],
): EnhancedSensoryProfile[] {
  const profiles = new Map(
    referenceProfiles.map(profile => [profile.sampleId, profile] as const),
  );

  importedProfiles.forEach(imported => {
    const reference = profiles.get(imported.sampleId);

    if (!reference) {
      profiles.set(imported.sampleId, imported);
      return;
    }

    profiles.set(imported.sampleId, {
      ...reference,
      sampleName: imported.sampleName || reference.sampleName,
      taste: imported.taste,
      composition: imported.composition,
      gcmsOlfactometry: imported.gcmsOlfactometry.length > 0
        ? imported.gcmsOlfactometry
        : reference.gcmsOlfactometry,
      istdRecovery: imported.istdRecovery || reference.istdRecovery,
      olfactometryFlowSplit: imported.olfactometryFlowSplit || reference.olfactometryFlowSplit,
    });
  });

  return Array.from(profiles.values());
}
