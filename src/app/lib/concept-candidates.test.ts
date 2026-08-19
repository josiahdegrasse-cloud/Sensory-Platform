import { describe, expect, it } from 'vitest';
import type { DecisionRecord } from './database';
import type { GoStopTweakDecision } from '../utils/go-stop-tweak-engine';
import { findPendingConceptGoDecisions } from './concept-candidates';

function calculated(input: Partial<GoStopTweakDecision> & Pick<GoStopTweakDecision, 'sampleId' | 'decisionFingerprint'>) {
  return {
    sampleName: input.sampleId,
    decision: 'GO',
    decisionStatus: 'ready',
    issfScore: 80,
    ...input,
  } as GoStopTweakDecision;
}

function confirmed(input: Partial<DecisionRecord> & Pick<DecisionRecord, 'sampleId' | 'decisionFingerprint'>) {
  return {
    id: 'decision-1',
    projectId: 'project-1',
    ...input,
  } as DecisionRecord;
}

describe('findPendingConceptGoDecisions', () => {
  it('shows ready calculated GOs strongest-first', () => {
    const result = findPendingConceptGoDecisions([
      calculated({ sampleId: 'A', decisionFingerprint: 'a', issfScore: 79 }),
      calculated({ sampleId: 'B', decisionFingerprint: 'b', issfScore: 86 }),
    ], [], 'project-1');

    expect(result.map(item => item.sampleId)).toEqual(['B', 'A']);
  });

  it('excludes held results and evidence versions already confirmed in this project', () => {
    const result = findPendingConceptGoDecisions([
      calculated({ sampleId: 'A', decisionFingerprint: 'confirmed' }),
      calculated({ sampleId: 'B', decisionFingerprint: 'held', decisionStatus: 'hold' }),
      calculated({ sampleId: 'C', decisionFingerprint: 'new' }),
    ], [confirmed({ sampleId: 'A', decisionFingerprint: 'confirmed' })], 'project-1');

    expect(result.map(item => item.sampleId)).toEqual(['C']);
  });
});
