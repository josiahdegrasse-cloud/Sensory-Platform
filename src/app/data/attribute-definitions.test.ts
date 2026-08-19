import { describe, expect, it } from 'vitest';
import { FOOD_TYPE_PROFILES } from '../lib/food-intelligence';
import { getCataDefinition } from './attribute-definitions';

describe('CATA definitions', () => {
  it('provides a meaningful description for every built-in food-profile attribute', () => {
    const attributes = new Set(FOOD_TYPE_PROFILES.flatMap(profile => profile.cataAttributes));
    for (const attribute of attributes) {
      const definition = getCataDefinition(attribute);
      expect(definition, attribute).not.toMatch(/^sensory attribute$/i);
      expect(definition.length, attribute).toBeGreaterThan(20);
    }
  });

  it('matches definitions regardless of case or surrounding whitespace', () => {
    expect(getCataDefinition('  cocoa  ', 'chocolate')).toBe(getCataDefinition('Cocoa', 'chocolate'));
  });

  it('gives custom attributes useful panelist guidance instead of a generic label', () => {
    const definition = getCataDefinition('Cherry smoke', 'confectionery');

    expect(definition).toContain('cherry smoke');
    expect(definition).toContain('Select it only when it is clearly noticeable');
    expect(definition).not.toMatch(/sensory attribute/i);
  });
});
