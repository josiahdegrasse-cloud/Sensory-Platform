// NFI's visual identity is monochrome. Keep tenant palettes separate so a
// client's configured colors never alter the neutral platform brand.
export const NFI_BRAND_COLOR = '#111111';
export const NFI_BRAND_COLOR_DARK = '#000000';
export const NFI_LOGO_URL = '/new_foodinnovation_ltd_logo.jpg';
export const NFI_ORGANIZATION_NAME = 'New Food Innovation';

export interface WorkspaceBrandIdentityInput {
  workspaceName?: string | null;
  organizationName?: string | null;
  organizationSlug?: string | null;
  demoModeEnabled?: boolean | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
}

export interface WorkspaceBrandIdentity {
  workspaceName: string | null;
  organizationName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  usesNfiBrand: boolean;
}

/**
 * The public sensory demo demonstrates NFI's platform rather than a fictional
 * client brand. Keep its descriptive workspace name, but use the same NFI
 * identity as the main workspace on every surface that consumes branding.
 */
export function resolveWorkspaceBrandIdentity(
  input: WorkspaceBrandIdentityInput = {},
): WorkspaceBrandIdentity {
  const normalizedSlug = input.organizationSlug?.trim().toLowerCase() ?? null;
  const usesNfiBrand = Boolean(
    input.demoModeEnabled
    || normalizedSlug === 'nfi'
    || normalizedSlug === 'sensory-demo'
    || input.organizationName === NFI_ORGANIZATION_NAME,
  );

  return {
    workspaceName: input.workspaceName ?? null,
    organizationName: usesNfiBrand
      ? NFI_ORGANIZATION_NAME
      : (input.organizationName ?? null),
    logoUrl: usesNfiBrand ? null : (input.logoUrl ?? null),
    primaryColor: usesNfiBrand ? NFI_BRAND_COLOR : (input.primaryColor ?? null),
    accentColor: usesNfiBrand ? NFI_BRAND_COLOR_DARK : (input.accentColor ?? null),
    usesNfiBrand,
  };
}
