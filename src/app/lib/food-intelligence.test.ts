import { describe, expect, it } from 'vitest';
import {
  detectFoodType,
  FOOD_TYPE_MODIFIERS,
  FOOD_TYPE_PROFILES,
  formatFoodTypeDetectionLabel,
  getDefaultCataAttributesForFoodType,
  getDefaultIntensityAttributesForFoodType,
  slugifyFoodType,
} from './food-intelligence';

describe('food intelligence', () => {
  it('ships a broad deterministic food-type library', () => {
    expect(FOOD_TYPE_PROFILES.length).toBeGreaterThanOrEqual(1500);
    expect(FOOD_TYPE_PROFILES.map(profile => profile.slug)).toEqual(expect.arrayContaining([
      'cheese',
      'bread',
      'meat',
      'seafood',
      'egg',
      'yogurt',
      'beverage',
      'snack',
      'sauce',
      'fruit',
      'vegetable',
      'grain-cereal',
      'pasta-noodle',
      'rice',
      'legume',
      'nut-seed',
      'dessert',
      'frozen-dessert',
      'confectionery',
      'soup',
      'ready-meal',
      'salad',
      'oil-fat',
      'fermented-pickle',
    ]));
  });

  it('ships composable product modifier tags', () => {
    expect(FOOD_TYPE_MODIFIERS.map(modifier => modifier.slug)).toEqual(expect.arrayContaining([
      'plant-based',
      'gluten-free',
      'organic',
      'low-sugar',
      'high-protein',
      'low-sodium',
      'ready-to-eat',
      'spicy',
    ]));
  });

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
    expect(detectFoodType('Lab Prototype Alpha').slug).toBe('lab-prototype-alpha');
  });

  it('detects common broad categories without AI', () => {
    expect(detectFoodType('Atlantic salmon fillet').slug).toBe('salmon');
    expect(detectFoodType('Frozen Dessert Base').slug).toBe('frozen-dessert');
    expect(detectFoodType('tomato vegetable medley').slug).toBe('vegetable');
    expect(detectFoodType('dark chocolate confectionery').slug).toBe('chocolate');
    expect(detectFoodType('lentil chickpea hummus').slug).toBe('legume');
    expect(getDefaultCataAttributesForFoodType('fruit')).toContain('Juicy');
    expect(getDefaultIntensityAttributesForFoodType('soup')).toContain('Umami');
  });

  it('detects specific preset food subtypes when available', () => {
    expect(detectFoodType('sharp cheddar sample').slug).toBe('cheddar');
    expect(detectFoodType('brie').slug).toBe('brie');
    expect(detectFoodType('sourdough boule').slug).toBe('sourdough');
    expect(detectFoodType('ramen noodles').slug).toBe('ramen');
    expect(detectFoodType('extra virgin olive oil').slug).toBe('olive-oil');
    expect(detectFoodType('kimchi jar').slug).toBe('kimchi');
    expect(getDefaultCataAttributesForFoodType('cheddar')).toContain('Sharp');
    expect(getDefaultCataAttributesForFoodType('kimchi')).toContain('Fermented');
  });

  it('composes modifier tags with food types instead of duplicating every profile', () => {
    const plantBasedCheddar = detectFoodType('plant-based sharp cheddar sample');
    expect(plantBasedCheddar.slug).toBe('cheddar');
    expect(plantBasedCheddar.modifiers.map(modifier => modifier.slug)).toContain('plant-based');
    expect(formatFoodTypeDetectionLabel(plantBasedCheddar)).toBe('Plant-Based Cheddar');

    const glutenFreeSourdough = detectFoodType('gluten-free sourdough loaf');
    expect(glutenFreeSourdough.slug).toBe('sourdough');
    expect(glutenFreeSourdough.modifiers.map(modifier => modifier.slug)).toContain('gluten-free');

    const lowSugarYogurt = detectFoodType('low sugar yogurt');
    expect(lowSugarYogurt.slug).toBe('yogurt');
    expect(lowSugarYogurt.modifiers.map(modifier => modifier.slug)).toContain('low-sugar');
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
