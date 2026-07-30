import { NFI_BRAND_COLOR, NFI_BRAND_COLOR_DARK } from './nfi-brand';

export interface BrandThemeInput {
  primaryColor?: string | null;
  accentColor?: string | null;
}

export interface BrandTheme {
  primary: string;
  accent: string;
  onPrimary: '#ffffff' | '#0f172a';
  onAccent: '#ffffff' | '#0f172a';
}

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeHexColor(value: string | null | undefined, fallback: string): string {
  const candidate = value?.trim();
  if (!candidate || !HEX_COLOR.test(candidate)) return fallback;
  if (candidate.length === 4) {
    return `#${candidate.slice(1).split('').map(character => `${character}${character}`).join('')}`.toUpperCase();
  }
  return candidate.toUpperCase();
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels.map(channel => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function accessibleForeground(background: string): '#ffffff' | '#0f172a' {
  const luminance = relativeLuminance(background);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const inkLuminance = relativeLuminance('#0f172a');
  const inkContrast = (luminance + 0.05) / (inkLuminance + 0.05);
  return whiteContrast >= inkContrast ? '#ffffff' : '#0f172a';
}

export function resolveBrandTheme(input?: BrandThemeInput): BrandTheme {
  const primary = normalizeHexColor(input?.primaryColor, NFI_BRAND_COLOR);
  const accent = normalizeHexColor(input?.accentColor, NFI_BRAND_COLOR_DARK);
  return {
    primary,
    accent,
    onPrimary: accessibleForeground(primary),
    onAccent: accessibleForeground(accent),
  };
}

export function brandThemeVariables(input?: BrandThemeInput): Record<string, string> {
  const theme = resolveBrandTheme(input);
  const strong = `color-mix(in oklch, ${theme.primary} 82%, black)`;
  const soft = `color-mix(in oklch, ${theme.primary} 8%, white)`;
  const accentSoft = `color-mix(in oklch, ${theme.accent} 10%, white)`;
  const canvas = `color-mix(in oklch, ${theme.primary} 4%, white)`;
  const border = `color-mix(in oklch, ${theme.primary} 18%, white)`;
  return {
    '--brand': theme.primary,
    '--brand-accent': theme.accent,
    '--brand-strong': strong,
    '--brand-soft': soft,
    '--brand-accent-soft': accentSoft,
    '--brand-canvas': canvas,
    '--brand-border': border,
    '--primary': theme.primary,
    '--primary-foreground': theme.onPrimary,
    '--secondary': soft,
    '--accent': accentSoft,
    '--ring': theme.primary,
    '--sidebar-primary': theme.primary,
    '--sidebar-primary-foreground': theme.onPrimary,
    '--sidebar-accent': soft,
    '--sidebar-border': border,
    '--sidebar-ring': theme.primary,
    '--brand-accent-foreground': theme.onAccent,
  };
}

export function applyBrandTheme(
  target: Pick<CSSStyleDeclaration, 'setProperty'>,
  input?: BrandThemeInput,
): void {
  Object.entries(brandThemeVariables(input)).forEach(([property, value]) => {
    target.setProperty(property, value);
  });
}
