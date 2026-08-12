import { expect, test } from '@playwright/test';

test('sign-in shell is usable without application errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible();
  await expect(page.locator('.tenant-auth-shell')).toHaveCSS('background-color', 'rgb(17, 17, 17)');
  expect(errors).toEqual([]);
});

test('FermIQ preview applies tenant identity without application errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  const tenantPreviewUrl = process.env.E2E_BASE_URL
    ? `${process.env.E2E_BASE_URL}/?tenant=fermiq`
    : 'http://fermiq.localhost:4173';
  await page.goto(tenantPreviewUrl);

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByText('Open your FermIQ Food workspace')).toBeVisible();
  await expect(page.getByRole('img', { name: 'FermIQ Food' }).first()).toBeVisible();
  await expect(page.locator('.tenant-auth-shell')).toHaveCSS('background-color', 'rgb(14, 58, 95)');
  expect(errors).toEqual([]);
});

test('bare-localhost tenant hints redirect to the canonical local tenant host', async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), 'Canonical localhost redirects apply only to local development.');

  await page.goto('http://localhost:4173/?tenant=fermiq');

  await expect(page).toHaveURL('http://fermiq.localhost:4173/');
  await expect(page.getByText('Open your FermIQ Food workspace')).toBeVisible();
});

test('tenant sign-in fails safely when verified branding cannot load', async ({ page }) => {
  await page.route('**/rest/v1/rpc/get_public_workspace_config', async route => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Public workspace configuration is temporarily unavailable.' }),
    });
  });
  const tenantPreviewUrl = process.env.E2E_BASE_URL
    ? `${process.env.E2E_BASE_URL}/?tenant=fermiq`
    : 'http://fermiq.localhost:4173';

  await page.goto(tenantPreviewUrl);

  await expect(page.getByRole('heading', { name: 'Workspace sign-in is temporarily unavailable' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeEnabled();
  await expect(page.getByText('To avoid showing the wrong company identity')).toBeVisible();
  await expect(page.getByText('Open your NFI workspace')).toHaveCount(0);
});

test('mobile sign-in prioritizes the form without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const kicker = page.getByText('Workspace sign-in');
  const signIn = page.getByRole('button', { name: 'Sign in' });
  await expect(kicker).toBeVisible();
  await expect(signIn).toBeVisible();
  const kickerBox = await kicker.boundingBox();
  const signInBox = await signIn.boundingBox();
  expect(kickerBox?.y).toBeLessThan(220);
  expect(kickerBox?.y).toBeGreaterThan(100);
  expect((signInBox?.y ?? 844) + (signInBox?.height ?? 0)).toBeLessThan(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('public legal routes remain available without authentication', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();

  await page.goto('/terms');
  await expect(page.getByRole('heading', { name: 'Terms of Use' })).toBeVisible();

  await page.goto('/panelist-consent');
  await expect(page.getByRole('heading', { name: 'Panelist Consent' })).toBeVisible();
});

test('protected routes redirect to sign-in when unauthenticated', async ({ page }) => {
  await page.goto('/survey-analysis');
  // ProtectedRoute sends unauthenticated users back to the sign-in shell.
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

  await page.goto('/decision');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('unknown routes fall back to the sign-in shell when unauthenticated', async ({ page }) => {
  // The SPA rewrite serves index.html for any path; the App-level auth gate then
  // shows sign-in for unauthenticated users rather than blanking or erroring.
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/this-route-does-not-exist');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  expect(errors).toEqual([]);
});
