import { describe, expect, it } from 'vitest';
import { buildConsumerBriefSuggestions } from './consumer-brief-defaults';

describe('consumer brief defaults', () => {
  it('turns cheese evidence into consumer language without scores', () => {
    const result = buildConsumerBriefSuggestions({
      name: 'Cashew Cheddar v2.0',
      category: 'Cheese',
      productForm: 'slices',
      sensorySignals: ['Cheese CATA 9/14', 'Butter CATA 9/14', 'appearance 8.1/9'],
    });

    expect(result.audience).toContain('Flexitarian');
    expect(result.occasions[0]).toBe('Sandwiches and burgers');
    expect(result.proofCues).toEqual(['Cheesy', 'Buttery', 'Appetising appearance']);
    expect(result.promise).toBe('Cheesy and buttery cheese made for sandwiches and burgers.');
    expect(JSON.stringify(result)).not.toMatch(/\d+\s*\/\s*\d+/);
  });

  it('changes occasions with the selected product form', () => {
    const shredded = buildConsumerBriefSuggestions({ name: 'Cheddar', category: 'Cheese', productForm: 'shredded' });
    const cubes = buildConsumerBriefSuggestions({ name: 'Cheddar', category: 'Cheese', productForm: 'cubes' });

    expect(shredded.occasions[0]).toBe('Cooking and melting');
    expect(cubes.occasions[0]).toBe('Snacking and lunchboxes');
  });

  it('filters technical measurements out of proof cues', () => {
    const result = buildConsumerBriefSuggestions({
      name: 'New cheese',
      category: 'Cheese',
      sensorySignals: ['GC-MS Benzaldehyde 2.3 ppm', 'protein 8.9%', 'Creamy intensity 7.8/10'],
    });

    expect(result.proofCues).toEqual(['Creamy']);
  });
});
