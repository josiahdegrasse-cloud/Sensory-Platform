import type { ClaimRecord, ClaimType, ConceptEvidence } from './types';
import { RESTRICTED_CLAIM_TYPES } from './types';

// ════════════════════════════════════════════════════════════════════════════
// Claim records (section 4). Every substantive commercial claim is represented
// as a typed record with evidence ids. Restricted claim types are blocked
// unless explicitly supported by evidence in the bundle.
// ════════════════════════════════════════════════════════════════════════════

export interface ClaimGuardInput {
  claims: ClaimRecord[];
  /** Evidence ids known to exist in the bundle. */
  knownEvidenceIds: Set<string>;
  concept: ConceptEvidence;
}

export interface ClaimViolation {
  claimId: string;
  claimType: ClaimType;
  reason: string;
}

// Detects restricted claims made without supporting evidence, plus consumer/market
// claims asserted before the minimum interpretable concept threshold (n=30).
export function findUnsupportedClaims(input: ClaimGuardInput): ClaimViolation[] {
  const violations: ClaimViolation[] = [];
  const conceptDependent: ClaimType[] = [
    'consumer_preference',
    'purchase_demand',
    'representative_acceptance',
    'market_readiness',
  ];

  for (const claim of input.claims) {
    const hasRealEvidence = claim.evidenceIds.some(id => input.knownEvidenceIds.has(id));

    if (RESTRICTED_CLAIM_TYPES.includes(claim.claimType) && !hasRealEvidence) {
      violations.push({
        claimId: claim.id,
        claimType: claim.claimType,
        reason: `Restricted claim type "${claim.claimType}" has no supporting evidence record.`,
      });
      continue;
    }

    if (input.concept.responseCount < 30 && conceptDependent.includes(claim.claimType)) {
      violations.push({
        claimId: claim.id,
        claimType: claim.claimType,
        reason: `Claim type "${claim.claimType}" requires at least 30 concept responses, but n=${input.concept.responseCount}.`,
      });
    }
  }

  return violations;
}

// Heuristic claim-type classifier for free-text statements, used to catch
// unsupported claims that slip into generated prose.
const CLAIM_PATTERNS: Array<{ type: ClaimType; re: RegExp }> = [
  { type: 'consumer_preference', re: /\b(consumers?\s+prefer|preferred by|most[- ]liked|consumer[- ]approved)\b/i },
  { type: 'purchase_demand', re: /\b(will buy|purchase intent|demand for|sales potential|guaranteed sales)\b/i },
  { type: 'market_readiness', re: /\b(market[- ]ready|ready for (?:market|launch|retail)|launch[- ]ready)\b/i },
  { type: 'health_benefit', re: /\b(healthy|health benefit|good for you|wellness benefit|boosts? immunity)\b/i },
  { type: 'nutrition_benefit', re: /\b(low[- ]fat|high[- ]protein|nutritious|source of \w+|reduces? cholesterol)\b/i },
  { type: 'superiority', re: /\b(best[- ]in[- ]class|superior to|outperforms|better than (?:any|all|competitors))\b/i },
  { type: 'representative_acceptance', re: /\b(representative (?:of )?consumers?|broadly accepted|widely accepted)\b/i },
  { type: 'production_readiness', re: /\b(production[- ]ready|ready (?:for|to) (?:scale|manufacture)|manufacturing[- ]ready)\b/i },
  { type: 'legal_approval', re: /\b(claims? (?:are )?approved|legally cleared|legally approved)\b/i },
];

export function classifyStatement(statement: string): ClaimType {
  for (const { type, re } of CLAIM_PATTERNS) {
    if (re.test(statement)) return type;
  }
  return 'descriptive';
}
