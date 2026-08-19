import { describe, expect, it } from 'vitest';
import { formatProductForm, getFoodProductForms } from './food-product-forms';

describe('food product forms', () => {
  it('offers cheese-specific physical formats', () => {
    expect(getFoodProductForms('cheese').map(option => option.value)).toEqual(
      expect.arrayContaining(['shredded', 'block', 'cubes', 'slices']),
    );
  });

  it('inherits formats for a specific subtype', () => {
    expect(getFoodProductForms('cheddar').map(option => option.value)).toContain('shredded');
  });

  it('falls back to useful generic formats for newly added food types', () => {
    expect(getFoodProductForms('new-category')).toHaveLength(5);
    expect(formatProductForm('bite_sized')).toBe('Bite Sized');
  });
});
