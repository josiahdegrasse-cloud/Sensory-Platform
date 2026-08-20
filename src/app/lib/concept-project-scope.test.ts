import { describe, expect, it } from 'vitest';
import type { ConceptTest } from './database';
import { conceptBelongsToProject, conceptsForProject } from './concept-project-scope';

function concept(id: string, projectId: string | null): ConceptTest {
  return { id, projectId } as ConceptTest;
}

describe('concept project scope', () => {
  const cashewCheddar = concept('cashew-cheddar', 'cashew-project');
  const cashewCreamCheese = concept('cashew-cream-cheese', 'cashew-project');
  const mozzaReference = concept('mozza-reference', 'mozza-project');
  const legacy = concept('legacy-projectless', null);

  it('shows only concepts with the exact canonical project id on project routes', () => {
    expect(conceptsForProject(
      [cashewCheddar, cashewCreamCheese, mozzaReference, legacy],
      'mozza-project',
    ).map(item => item.id)).toEqual(['mozza-reference']);
  });

  it('does not treat a missing project id as a match for a canonical project', () => {
    expect(conceptBelongsToProject(legacy, 'mozza-project')).toBe(false);
  });

  it('preserves tenant-wide legacy views when no project is active', () => {
    expect(conceptsForProject([cashewCheddar, mozzaReference, legacy], undefined)).toHaveLength(3);
  });
});
