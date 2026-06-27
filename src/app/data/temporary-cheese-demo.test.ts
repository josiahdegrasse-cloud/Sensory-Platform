import { describe, expect, it } from 'vitest';
import {
  TEMPORARY_CHEESE_CONCEPT_RESPONSES,
  TEMPORARY_CHEESE_CONCEPTS,
  TEMPORARY_CHEESE_DECISION,
  TEMPORARY_CHEESE_RESPONSES,
  mergeTemporaryFixtures,
} from './demo/temporary-cheese-demo';
import { COCONUT_CHEDDAR_PROFILE, getCommercializationProjectProfile } from './coconut-cheddar-profile';

describe('temporary cheese demo fixtures', () => {
  it('provides report-ready cheese evidence across the workflow', () => {
    expect(TEMPORARY_CHEESE_RESPONSES).toHaveLength(14);
    expect(TEMPORARY_CHEESE_CONCEPTS).toHaveLength(2);
    expect(TEMPORARY_CHEESE_CONCEPT_RESPONSES[TEMPORARY_CHEESE_CONCEPTS[0].id]).toHaveLength(40);
    expect(TEMPORARY_CHEESE_DECISION).toMatchObject({
      sampleId: 'S4',
      sampleName: 'Coconut Cheddar v3.0',
      decision: 'GO',
      methodVersion: 'NFI-GST-1.1',
    });
    expect(TEMPORARY_CHEESE_CONCEPTS[0].questions).toHaveLength(9);
    expect(TEMPORARY_CHEESE_CONCEPTS[0].targetMarket).toMatch(/Hypothesis/);
  });

  it('does not duplicate fixtures already returned by the database', () => {
    const fixture = TEMPORARY_CHEESE_CONCEPTS[0];
    expect(mergeTemporaryFixtures([fixture], TEMPORARY_CHEESE_CONCEPTS)).toHaveLength(2);
  });

  it('provides a report-complete S4 product dossier with explicit evidence boundaries', () => {
    expect(getCommercializationProjectProfile('S4')).toBe(COCONUT_CHEDDAR_PROFILE);
    expect(COCONUT_CHEDDAR_PROFILE.evidenceStatus).toBe('reference_demo');
    expect(COCONUT_CHEDDAR_PROFILE.development.formulationUnknown.length).toBeGreaterThanOrEqual(5);
    expect(COCONUT_CHEDDAR_PROFILE.conceptHypothesis.validationQuestions.length).toBeGreaterThanOrEqual(5);
    expect(COCONUT_CHEDDAR_PROFILE.actionPlan).toHaveLength(5);
    expect(COCONUT_CHEDDAR_PROFILE.actionPlan.every(action =>
      action.owner && action.completionEvidence && action.passingCriteria && action.nextGate
    )).toBe(true);
  });
});
