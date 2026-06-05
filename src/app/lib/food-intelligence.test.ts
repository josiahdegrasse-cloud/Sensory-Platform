import { describe, expect, it } from 'vitest';
import {
  detectFoodType,
  getDefaultCataAttributesForFoodType,
  getDefaultIntensityAttributesForFoodType,
  slugifyFoodType,
} from './food-intelligence';

describe('food intelligence', () => {
  it('detects meat from product and ingredient language', () => {
    const detection = detectFoodType('plant based chicken patty', 'pea protein burger');
    expect(detection.slug).toBe('meat');
    expect(detection.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('detects yogurt as a distinct food type', () => {
    const detection = detectFoodType('Greek yoghurt', 'cultured dairy cup');
    expect(detection.slug).toBe('yogurt');
    expect(getDefaultCataAttributesForFoodType(detection.slug)).toContain('Tangy');
    expect(getDefaultIntensityAttributesForFoodType(detection.slug)).toContain('Thick');
  });

  it('keeps unknown categories expandable instead of forcing cheese or bread', () => {
    expect(slugifyFoodType('Frozen Dessert Base')).toBe('frozen-dessert-base');
    expect(detectFoodType('Frozen Dessert Base').slug).toBe('frozen-dessert-base');
  });

  it('does not match aliases hidden inside unrelated words', () => {
    expect(detectFoodType('champagne style beverage').slug).toBe('beverage');
    expect(detectFoodType('theater snack concept').slug).toBe('snack');
  });

  it('keeps tied signals as an expandable custom type', () => {
    const detection = detectFoodType('meat yogurt hybrid concept');
    expect(detection.slug).toBe('meat-yogurt-hybrid-concept');
    expect(detection.confidence).toBeLessThan(0.5);
  });
});
