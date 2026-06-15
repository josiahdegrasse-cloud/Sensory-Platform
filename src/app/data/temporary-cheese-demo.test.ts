import { describe, expect, it } from 'vitest';
import {
  TEMPORARY_CHEESE_CONCEPT_RESPONSES,
  TEMPORARY_CHEESE_CONCEPTS,
  TEMPORARY_CHEESE_DECISION,
  TEMPORARY_CHEESE_RESPONSES,
  mergeTemporaryFixtures,
} from './temporary-cheese-demo';

describe('temporary cheese demo fixtures', () => {
  it('provides report-ready cheese evidence across the workflow', () => {
    expect(TEMPORARY_CHEESE_RESPONSES).toHaveLength(14);
    expect(TEMPORARY_CHEESE_CONCEPTS).toHaveLength(2);
    expect(TEMPORARY_CHEESE_CONCEPT_RESPONSES[TEMPORARY_CHEESE_CONCEPTS[0].id]).toHaveLength(14);
    expect(TEMPORARY_CHEESE_DECISION).toMatchObject({ sampleId: 'S1', decision: 'GO' });
  });

  it('does not duplicate fixtures already returned by the database', () => {
    const fixture = TEMPORARY_CHEESE_CONCEPTS[0];
    expect(mergeTemporaryFixtures([fixture], TEMPORARY_CHEESE_CONCEPTS)).toHaveLength(2);
  });
});
