import { expect, test } from '@playwright/test';

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe('authenticated admin workflow', () => {
  test.skip(!email || !password, 'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required.');

  test('admin can reach the core production workflow', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Machine Testing')).toBeVisible();
    await page.getByText('Machine Testing').click();
    await expect(page.getByRole('heading', { name: /Machine Testing/i })).toBeVisible();

    await page.getByText('Configure Products').click();
    await expect(page.getByRole('heading', { name: /Configure .* Surveys/i })).toBeVisible();

    await page.getByText('Final Decision').click();
    await expect(page.getByRole('heading', { name: 'Final Decision' })).toBeVisible();
  });

  test('analyze results screen marks data provenance and switches analysis type', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.goto('/survey-analysis');
    await expect(page.getByRole('heading', { name: 'Analyze Results' })).toBeVisible();

    // The provenance badge must always disclose whether the charts are backed by
    // live panel responses or the simulated reference dataset.
    await expect(page.getByText(/Live panel data|Reference data/).first()).toBeVisible();

    // Analysis-type switching keeps the screen functional.
    await page.getByRole('button', { name: /Multi-Sample Analysis/ }).click();
    await page.getByRole('button', { name: /Concept Tests/ }).click();
    await page.getByRole('button', { name: /Single-Sample Analysis/ }).click();
    await expect(page.getByText(/Live panel data|Reference data/).first()).toBeVisible();
  });

  test('unknown routes render the 404 page once authenticated', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Machine Testing')).toBeVisible();

    await page.goto('/this-route-does-not-exist');
    await expect(page.getByRole('heading', { name: /404 - Page Not Found/i })).toBeVisible();
  });
});
