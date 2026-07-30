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
