import { expect, test } from '@playwright/test';

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe('authenticated admin workflow', () => {
  test.skip(!email || !password, 'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required.');

  test('admin can reach the complete demo workflow', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByRole('link', { name: 'Instruments' })).toBeVisible();
    await page.getByRole('link', { name: 'Instruments' }).click();
    await expect(page.getByRole('heading', { name: /Machine Testing/i })).toBeVisible();

    await page.getByRole('link', { name: 'Configure' }).click();
    await expect(page.getByRole('heading', { name: /Configure .* Surveys/i })).toBeVisible();

    await page.getByRole('link', { name: 'Insights' }).click();
    await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();

    await page.getByRole('link', { name: 'Final Decision' }).click();
    await expect(page.getByRole('heading', { name: /Decision Review|Final Decision/ })).toBeVisible();

    await page.getByRole('link', { name: 'Concept Testing' }).click();
    await expect(page.getByRole('heading', { name: 'Concept Lab' })).toBeVisible();

    await page.getByRole('link', { name: 'Reports' }).click();
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  });

  test('insights screen marks provenance and exposes detailed evidence', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.goto('/survey-analysis');
    await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();

    // The provenance badge must always disclose whether the charts are backed by
    // live panel responses or the simulated reference dataset.
    await expect(page.getByText(/Live panel data|Reference data/).first()).toBeVisible();

    await page.getByRole('tab', { name: 'Descriptors' }).click();
    await page.getByRole('tab', { name: 'Intensity' }).click();
    await page.getByRole('tab', { name: 'Emotional' }).click();
    await page.getByText('Explore detailed evidence', { exact: false }).click();
    await expect(page.getByText('Instrumental evidence')).toBeVisible();
    await expect(page.getByText('Concept feedback')).toBeVisible();
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
