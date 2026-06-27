import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CATA_ATTRIBUTES,
  INTENSITY_ATTRIBUTES,
  getDefaultCataAttributes,
  getDefaultIntensityAttributes,
} from './survey-domain';

describe('survey-domain defaults', () => {
  it('uses generic defaults for empty or unknown production categories', () => {
    expect(getDefaultCataAttributes('')).toContain('Off-note');
    expect(getDefaultCataAttributes('')).not.toContain('Cheese');
    expect(getDefaultCataAttributes('Prototype Alpha')).toContain('Off-note');
    expect(getDefaultCataAttributes('Prototype Alpha')).not.toContain('Cheese');

    expect(getDefaultIntensityAttributes('')).toContain('Aromatic');
    expect(getDefaultIntensityAttributes('')).not.toContain('Cheese');
    expect(getDefaultIntensityAttributes('Prototype Alpha')).toContain('Aromatic');
    expect(getDefaultIntensityAttributes('Prototype Alpha')).not.toContain('Cheese');
  });

  it('keeps explicit cheese and dairy categories mapped to the cheese profile', () => {
    expect(getDefaultCataAttributes('Cheese')).toContain('Cheese');
    expect(getDefaultCataAttributes('Plant-based cheddar')).toContain('Cheese');
    expect(getDefaultCataAttributes('Dairy alternative')).toContain('Cheese');

    expect(getDefaultIntensityAttributes('Cheese')).toContain('Cheese');
    expect(getDefaultIntensityAttributes('Plant-based cheddar')).toContain('Cheese');
    expect(getDefaultIntensityAttributes('Dairy alternative')).toContain('Cheese');
  });

  it('keeps non-cheese categories category-specific', () => {
    expect(getDefaultCataAttributes('Bread')).toContain('Fresh-baked');
    expect(getDefaultCataAttributes('Meat')).toContain('Beefy');
    expect(getDefaultCataAttributes('Yogurt')).toContain('Thick');
    expect(getDefaultCataAttributes('Beverage')).toContain('Carbonated');
    expect(getDefaultCataAttributes('Snack')).toContain('Crunchy');
    expect(getDefaultCataAttributes('Sauce')).toContain('Garlic');
  });

  it('keeps compatibility constants generic instead of dairy-backed', () => {
    expect(DEFAULT_CATA_ATTRIBUTES).toContain('Off-note');
    expect(DEFAULT_CATA_ATTRIBUTES).not.toContain('Cheese');
    expect(INTENSITY_ATTRIBUTES).toContain('Aromatic');
    expect(INTENSITY_ATTRIBUTES).not.toContain('Cheese');
  });
});
