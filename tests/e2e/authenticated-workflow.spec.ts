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
});
