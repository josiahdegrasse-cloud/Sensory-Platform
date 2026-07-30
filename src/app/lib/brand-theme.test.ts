import { describe, expect, it, vi } from 'vitest';
import { applyBrandTheme, brandThemeVariables, resolveBrandTheme } from './brand-theme';

describe('resolveBrandTheme', () => {
  it('preserves the Fermiq navy and green palette with accessible foregrounds', () => {
    expect(resolveBrandTheme({ primaryColor: '#0E3A5F', accentColor: '#5EB12E' })).toEqual({
      primary: '#0E3A5F',
      accent: '#5EB12E',
      onPrimary: '#ffffff',
      onAccent: '#0f172a',
    });
  });

  it('normalizes shorthand colors and rejects unsafe CSS values', () => {
    expect(resolveBrandTheme({ primaryColor: '#036', accentColor: 'url(example)' })).toMatchObject({
      primary: '#003366',
      accent: '#000000',
    });
  });

  it('keeps the neutral NFI fallback black', () => {
    expect(resolveBrandTheme()).toMatchObject({
      primary: '#111111',
      accent: '#000000',
      onPrimary: '#ffffff',
    });
  });

  it('returns the complete CSS-variable contract', () => {
    expect(brandThemeVariables({ primaryColor: '#0E3A5F', accentColor: '#5EB12E' })).toMatchObject({
      '--brand': '#0E3A5F',
      '--brand-accent': '#5EB12E',
      '--primary': '#0E3A5F',
      '--primary-foreground': '#ffffff',
      '--ring': '#0E3A5F',
      '--brand-accent-foreground': '#0f172a',
    });
  });
});

describe('applyBrandTheme', () => {
  it('writes tenant variables to the supplied style declaration', () => {
    const setProperty = vi.fn();
    applyBrandTheme({ setProperty }, { primaryColor: '#0E3A5F', accentColor: '#5EB12E' });
    expect(setProperty).toHaveBeenCalledWith('--brand', '#0E3A5F');
    expect(setProperty).toHaveBeenCalledWith('--brand-accent', '#5EB12E');
    expect(setProperty).toHaveBeenCalledWith('--primary-foreground', '#ffffff');
  });
});
