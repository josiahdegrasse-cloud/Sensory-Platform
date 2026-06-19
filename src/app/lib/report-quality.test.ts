import { describe, expect, it } from 'vitest';
import { canApproveReport, isReportStale } from './report-quality';
import type { NarrativeEvaluation } from './report-evaluator';

const passingEval: NarrativeEvaluation = { score: 100, passed: true, issues: [], sections: [] };
const failingEval: NarrativeEvaluation = { score: 40, passed: false, issues: ['x'], sections: [] };

describe('isReportStale', () => {
  it('is stale when source-data versions differ', () => {
    expect(isReportStale('AAA', 'BBB')).toBe(true);
  });
  it('is not stale when versions match', () => {
    expect(isReportStale('AAA', 'AAA')).toBe(false);
  });
  it('is not stale when either version is missing (cannot tell)', () => {
    expect(isReportStale(null, 'BBB')).toBe(false);
    expect(isReportStale('AAA', undefined)).toBe(false);
  });
});

describe('canApproveReport', () => {
  it('blocks without an evidence bundle', () => {
    expect(canApproveReport({ hasEvidenceBundle: false }).allowed).toBe(false);
  });
  it('blocks when the deterministic decision contradicts GO (STOP/TWEAK)', () => {
    const gate = canApproveReport({ hasEvidenceBundle: true, candidateDecision: 'STOP' });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/STOP/);
    expect(canApproveReport({ hasEvidenceBundle: true, candidateDecision: 'TWEAK' }).allowed).toBe(false);
  });

  it('allows INSUFFICIENT_DATA (no deterministic opinion) for a confirmed GO', () => {
    expect(canApproveReport({ hasEvidenceBundle: true, candidateDecision: 'INSUFFICIENT_DATA' }).allowed).toBe(true);
  });
  it('blocks when AI narrative failed the evaluator', () => {
    expect(canApproveReport({ hasEvidenceBundle: true, candidateDecision: 'GO', evaluation: failingEval }).allowed).toBe(false);
  });
  it('allows a GO report with a bundle and passing (or no) evaluation', () => {
    expect(canApproveReport({ hasEvidenceBundle: true, candidateDecision: 'GO' }).allowed).toBe(true);
    expect(canApproveReport({ hasEvidenceBundle: true, candidateDecision: 'GO', evaluation: passingEval }).allowed).toBe(true);
  });
});
