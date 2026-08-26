import { describe, expect, it } from 'vitest';
import {
  NFI_BRAND_COLOR,
  NFI_BRAND_COLOR_DARK,
  NFI_ORGANIZATION_NAME,
  resolveWorkspaceBrandIdentity,
} from './nfi-brand';

describe('resolveWorkspaceBrandIdentity', () => {
  it('keeps the sensory demo descriptor but presents it as NFI', () => {
    expect(resolveWorkspaceBrandIdentity({
      workspaceName: 'Sensory Demo Workspace',
      organizationName: 'Sensory Demo Lab',
      demoModeEnabled: true,
      logoUrl: 'https://example.com/demo.svg',
      primaryColor: '#166534',
      accentColor: '#D97706',
    })).toEqual({
      workspaceName: 'Sensory Demo Workspace',
      organizationName: NFI_ORGANIZATION_NAME,
      logoUrl: null,
      primaryColor: NFI_BRAND_COLOR,
      accentColor: NFI_BRAND_COLOR_DARK,
      usesNfiBrand: true,
    });
  });

  it('uses NFI branding before sign-in on the sensory demo tenant', () => {
    expect(resolveWorkspaceBrandIdentity({
      organizationSlug: 'sensory-demo',
      workspaceName: 'Sensory Demo Workspace',
      primaryColor: '#166534',
    })).toMatchObject({
      organizationName: NFI_ORGANIZATION_NAME,
      primaryColor: NFI_BRAND_COLOR,
      accentColor: NFI_BRAND_COLOR_DARK,
      usesNfiBrand: true,
    });
  });

  it('preserves a client tenant brand', () => {
    expect(resolveWorkspaceBrandIdentity({
      organizationSlug: 'acme-foods',
      workspaceName: 'Acme Sensory Lab',
      organizationName: 'Acme Foods',
      logoUrl: 'https://example.com/acme.svg',
      primaryColor: '#0E3A5F',
      accentColor: '#5EB12E',
    })).toEqual({
      workspaceName: 'Acme Sensory Lab',
      organizationName: 'Acme Foods',
      logoUrl: 'https://example.com/acme.svg',
      primaryColor: '#0E3A5F',
      accentColor: '#5EB12E',
      usesNfiBrand: false,
    });
  });
});
