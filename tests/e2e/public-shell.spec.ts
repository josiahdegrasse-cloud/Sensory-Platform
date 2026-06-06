import { expect, test } from '@playwright/test';

test('sign-in shell is usable without application errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible();
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
