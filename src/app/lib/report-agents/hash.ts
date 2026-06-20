import type { ReportContext } from '../report-qc';

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stable(nested)]),
  );
}

export async function hashReportContext(ctx: ReportContext): Promise<string> {
  const protectedContext = {
    projectId: ctx.projectId,
    sampleId: ctx.sampleId,
    stage: ctx.stage,
    decision: ctx.decision,
    issfScore: ctx.issfScore,
    dimensions: ctx.dimensions,
    thresholds: ctx.thresholds,
    gates: ctx.gates,
    methodology: ctx.methodology,
    instrumental: ctx.instrumental,
    concept: ctx.concept,
    sourceEvidenceIds: ctx.sourceEvidenceIds.slice().sort(),
    evidenceProvenance: ctx.evidenceProvenance,
    methodVersion: ctx.methodVersion,
    decisionFingerprint: ctx.decisionFingerprint,
    approvalStatus: ctx.approvalStatus,
    claims: ctx.claims,
    limitations: ctx.limitations,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(stable(protectedContext)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}
