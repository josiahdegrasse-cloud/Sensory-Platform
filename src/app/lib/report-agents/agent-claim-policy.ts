import type { AgentClaim, EvidenceStrength, EvidenceProvenancePacket } from './agent-types';
import type { ClaimRecord, ReportContext } from '../report-qc';

const RISKY_PHRASES = [
  'consumers prefer',
  'market validated',
  'proven',
  'guaranteed',
  'ready for launch',
  'commercially approved',
  'best in market',
  'statistically significant',
  'clinically proven',
  'superior',
  'validated consumer demand',
];

export function evidenceProvenanceFromContext(ctx: ReportContext): EvidenceProvenancePacket {
  const source = ctx.evidenceProvenance.toLowerCase();
  const conceptLive = ctx.concept.responseCount > 0;
  return {
    sensory: /reference|demo/.test(source) ? 'reference' : ctx.dimensions.some(d => d.sampleSize && d.sampleSize > 0) ? 'live' : 'none',
    instrumental: ctx.instrumental.available ? 'live' : 'none',
    concept: conceptLive ? 'live' : 'none',
    purchaseIntent: conceptLive && ctx.concept.purchaseIntent !== null ? 'live' : 'none',
  };
}

export function missingEvidenceFromContext(ctx: ReportContext): string[] {
  return [
    ctx.concept.responseCount === 0 ? 'Concept and purchase-intent validation remain pending.' : null,
    /reference|demo/i.test(ctx.evidenceProvenance)
      ? 'This draft uses reference sensory evidence and is not approval-ready until live panel data is collected.'
      : null,
    !ctx.instrumental.available ? ctx.instrumental.absenceNote ?? 'Instrumental evidence is not available.' : null,
    ...ctx.limitations.map(item => item.limitation),
  ].filter((item): item is string => Boolean(item));
}

export function prohibitedClaimsFromContext(ctx: ReportContext): string[] {
  return [...new Set([
    ...RISKY_PHRASES,
    ...ctx.conceptStrategy.prohibitedClaims,
    ...ctx.claims.flatMap(claim => claim.prohibitedWording),
  ])];
}

function strengthForClaim(claim: ClaimRecord, ctx: ReportContext): EvidenceStrength {
  if (claim.evidenceIds.length === 0) return 'unsupported';
  if (claim.claimType === 'consumer_preference' || claim.claimType === 'purchase_demand' || claim.claimType === 'market_readiness') {
    return ctx.concept.responseCount >= 30 ? 'strong' : ctx.concept.responseCount > 0 ? 'directional' : 'unsupported';
  }
  if (/reference|demo/i.test(ctx.evidenceProvenance) && claim.claimType !== 'descriptive') return 'directional';
  return claim.confidence >= 0.8 ? 'strong' : 'directional';
}

export function normalizeClaimRecord(claim: ClaimRecord, ctx: ReportContext): AgentClaim {
  const strength = strengthForClaim(claim, ctx);
  const allowedLanguage = claim.permittedWording[0]
    ?? (strength === 'strong'
      ? claim.claim
      : strength === 'directional'
        ? `Directional evidence indicates ${claim.claim.toLowerCase()}`
        : `Unsupported claim removed: ${claim.claim}`);
  return {
    id: claim.id,
    text: claim.claim,
    strength,
    evidenceKeys: claim.evidenceIds,
    allowedLanguage,
    disallowedLanguage: claim.prohibitedWording,
    reason: claim.limitations[0] ?? `${claim.claimType} claim classified as ${strength}.`,
  };
}

export function splitClaims(claims: AgentClaim[]) {
  return {
    supportedClaims: claims.filter(claim => claim.strength === 'strong'),
    directionalClaims: claims.filter(claim => claim.strength === 'directional'),
    unsupportedClaims: claims.filter(claim => claim.strength === 'unsupported' || claim.strength === 'missing'),
  };
}
