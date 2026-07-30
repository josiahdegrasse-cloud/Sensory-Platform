import { expect, type Page, test } from '@playwright/test';

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

async function loginAsAdmin(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email address').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for the authenticated workspace, not merely the navigation event.
  // The profile and tenant records load asynchronously after Supabase signs in.
  await expect(page.getByRole('heading', { name: 'New Food Innovation' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('heading', { name: 'Live projects' })).toBeVisible();
}

async function openProjectWithPrototype(page: Page) {
  const projectLinks = page.getByRole('link', { name: 'Open project' });
  await expect(projectLinks.first()).toBeVisible({ timeout: 15_000 });
  const projectHrefs = await projectLinks.evaluateAll(links =>
    links.map(link => link.getAttribute('href')).filter((href): href is string => Boolean(href)),
  );

  expect(projectHrefs.length).toBeGreaterThan(0);

  for (const href of projectHrefs) {
    await page.goto(href);
    await expect(page.getByRole('heading', { name: 'Project decision room' })).toBeVisible({
      timeout: 15_000,
    });
    if (await page.getByRole('complementary', { name: 'Project prototypes' }).count()) {
      return href;
    }
  }

  throw new Error('No project with prototype evidence was available for the authenticated smoke test.');
}

test.describe('authenticated admin workflow', () => {
  test.skip(!email || !password, 'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required.');

  test('admin can open a project-level decision room', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    await loginAsAdmin(page);
    await openProjectWithPrototype(page);

    await expect(page.getByRole('complementary', { name: 'Project prototypes' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'R&D workspace' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Evidence lineage' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Prototype action panel' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('project briefs keep prototype evidence visible for each audience', async ({ page }) => {
    await loginAsAdmin(page);
    await openProjectWithPrototype(page);

    const prototypePanel = page.getByRole('complementary', { name: 'Project prototypes' });
    await expect(prototypePanel.getByRole('heading', { name: 'Prototypes' })).toBeVisible();

    await page.getByRole('tab', { name: 'Executive brief' }).click();
    await expect(page.getByText('Executive decision brief')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Evidence on record' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Boundary and open work' })).toBeVisible();

    await page.getByRole('tab', { name: 'Client brief' }).click();
    await expect(page.getByText('Client evidence brief')).toBeVisible();
    await expect(page.getByText(/does not establish demand, purchase intent, or commercial success/i)).toBeVisible();
    await expect(prototypePanel).toBeVisible();
  });

  test('Concept Lab requires a confirmed GO evidence source', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/concept-testing');
    await expect(page.getByRole('heading', { name: 'Concept Lab' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Start concept work from confirmed evidence' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Start without decision/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Review decisions' })).toBeVisible();
  });

  test('unknown routes render the 404 page once authenticated', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/this-route-does-not-exist');
    await expect(page.getByRole('heading', { name: /404 - Page Not Found/i })).toBeVisible();
  });
});
