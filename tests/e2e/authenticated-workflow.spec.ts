import { expect, type Page, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const email = process.env.DEMO_ADMIN_EMAIL;
const password = process.env.DEMO_ADMIN_PASSWORD;
const panelistEmail = process.env.DEMO_PANELIST_EMAIL;
const panelistPassword = process.env.DEMO_PANELIST_PASSWORD;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

async function loginAsAdmin(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email address').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for the authenticated workspace, not merely the navigation event.
  // The profile and tenant records load asynchronously after Supabase signs in.
  await expect(page.getByRole('heading', { name: 'Live projects' })).toBeVisible({ timeout: 20_000 });
}

async function loginAsPanelist(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email address').fill(panelistEmail!);
  await page.getByLabel('Password').fill(panelistPassword!);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Your task inbox' })).toBeVisible({ timeout: 20_000 });
}

async function openProjectWithPrototype(page: Page) {
  const projectLinks = page.getByRole('link', { name: 'Open project' });
  await expect(projectLinks.first()).toBeVisible({ timeout: 15_000 });
  const projectHrefs = await projectLinks.evaluateAll(links =>
    links.map(link => link.getAttribute('href')).filter((href): href is string => Boolean(href)),
  );

  expect(projectHrefs.length).toBeGreaterThan(0);

  for (const href of projectHrefs) {
    const projectId = href.match(/^\/project\/([^/]+)/)?.[1];
    if (!projectId) continue;
    const projectHref = `/project/${projectId}`;
    await page.goto(projectHref);
    await expect(page.getByRole('heading', { name: 'Project decision room' })).toBeVisible({
      timeout: 15_000,
    });
    const prototypePanel = page.getByRole('complementary', { name: 'Project prototypes' });
    if (await prototypePanel.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false)) {
      return projectHref;
    }
  }

  throw new Error('No project with prototype evidence was available for the authenticated smoke test.');
}

test.describe('authenticated admin workflow', () => {
  test.skip(!email || !password, 'Dedicated DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD secrets are required.');

  test('admin can open a project-level decision room', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    await loginAsAdmin(page);
    await openProjectWithPrototype(page);

    await expect(page.getByRole('complementary', { name: 'Project prototypes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Evidence lineage' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Prototype action panel' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('confirmed GO prototypes expose their downstream evidence boundary', async ({ page }) => {
    await loginAsAdmin(page);
    await openProjectWithPrototype(page);

    const prototypePanel = page.getByRole('complementary', { name: 'Project prototypes' });
    await expect(prototypePanel.getByRole('heading', { name: 'Prototypes' })).toBeVisible();
    await prototypePanel.getByRole('button', { name: /\bGO\b/ }).click();
    await expect(page.getByRole('heading', { name: 'Evidence lineage' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Eligible for concept and report work' })).toBeVisible();
  });

  test('Concept Lab requires a confirmed GO evidence source', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/concept-testing');
    await expect(page.getByRole('heading', { name: 'Concept Lab' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Work queue' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Continue working' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Start without decision/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Decision review' })).toBeVisible();
  });

  test('Concept Lab saves progress, returns to drafts, and resumes the exact survey step', async ({ page }) => {
    test.skip(!supabaseUrl || !supabaseAnonKey, 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.');
    const client = createClient(supabaseUrl!, supabaseAnonKey!);
    const { data: auth, error: authError } = await client.auth.signInWithPassword({ email: email!, password: password! });
    expect(authError).toBeNull();
    const userId = auth.user?.id;
    expect(userId).toBeTruthy();

    const [{ data: profile }, { data: existingDrafts }, { data: decisions }] = await Promise.all([
      client.from('profiles').select('org_id').eq('id', userId!).single(),
      client.from('concept_workspace_drafts').select('decision_record_id'),
      client
        .from('decision_records')
        .select('id, project_id, evidence_bundle_id, formulation_version_id, sample_id, sample_name, issf_score, confidence, created_at')
        .eq('decision', 'GO')
        .not('project_id', 'is', null)
        .not('evidence_bundle_id', 'is', null)
        .order('created_at', { ascending: false }),
    ]);
    const occupiedDecisionIds = new Set((existingDrafts ?? []).map(item => item.decision_record_id));
    const decision = (decisions ?? []).find(item => !occupiedDecisionIds.has(item.id));
    test.skip(!decision || !profile?.org_id, 'A confirmed GO decision without an existing draft is required.');

    const initialName = `E2E concept ${Date.now()}`;
    const editedName = `${initialName} edited`;
    const savedAt = new Date().toISOString();
    const draftPayload = {
      version: 2,
      draft: {
        name: initialName,
        category: 'Cheese',
        projectName: 'E2E draft persistence',
        description: 'A familiar creamy cheese made for everyday lunches.',
        marketingImages: ['https://placehold.co/600x600/png'],
        marketingImageIds: [],
        marketingImageReviews: [{ imageId: 'e2e-visual', status: 'approved', qa: {}, notes: '', source: 'external' }],
        targetMarket: 'Households looking for familiar everyday cheese.',
        targetOccasion: 'Everyday lunches',
        productAppearance: 'A believable cheese product.',
        packageFormat: 'Retail pack',
        visualSetting: 'Kitchen',
        colorDirection: 'Natural',
        mustShow: 'Product and serving suggestion',
        pricePoint: '',
        keyBenefits: 'Creamy, familiar flavour',
        technicalChallenges: '',
        promptStyle: 'balanced',
        visualNotes: '',
        forbiddenClaims: '',
        approvalStatus: 'draft',
        variantDimensions: {
          productForm: 'slices', positioning: null, visualComplexity: null, appeal: null,
          channel: null, packagingFormat: null, brandColorScheme: null,
          targetDemographic: null, pricePositioning: null,
        },
        brandReference: null,
      },
      questions: [{ id: 'e2e-q1', text: 'How appealing is this concept?', type: 'scale', required: true, category: 'appeal' }],
      questionsReviewState: 'approved',
      panelSize: 12,
      segments: [],
      assignedPanelistIds: [],
      sourceDecision: {
        id: decision!.id,
        sampleId: decision!.sample_id,
        sampleName: decision!.sample_name,
        issfScore: decision!.issf_score,
        confidence: decision!.confidence,
        timestamp: decision!.created_at,
        likedSignals: ['Creamy'],
        formulationVersionId: decision!.formulation_version_id,
        evidenceBundleId: decision!.evidence_bundle_id,
      },
      conceptSourceChosen: true,
      step: 'concept',
      savedAt,
    };

    const { data: seededDraft, error: seedError } = await client
      .from('concept_workspace_drafts')
      .insert({
        org_id: profile!.org_id,
        project_id: decision!.project_id!,
        decision_record_id: decision!.id,
        evidence_bundle_id: decision!.evidence_bundle_id!,
        formulation_version_id: decision!.formulation_version_id,
        created_by: userId!,
        current_step: 'concept',
        draft_payload: draftPayload,
      })
      .select('id')
      .single();
    expect(seedError).toBeNull();

    try {
      await loginAsAdmin(page);
      await page.goto(`/project/${decision!.project_id}/concept`);
      await expect(page.getByRole('heading', { name: 'Continue working' })).toBeVisible();
      await page.getByRole('button', { name: `Continue ${initialName}` }).click();
      await page.getByLabel('Product name').fill(editedName);
      await page.getByRole('button', { name: 'Continue to Visuals' }).click();
      await expect(page.getByRole('heading', { name: 'Create visual options' })).toBeVisible();
      await page.getByRole('button', { name: 'Continue to Survey' }).click();
      await expect(page.getByRole('heading', { name: 'Design your survey' })).toBeVisible();
      await expect(page.getByText(/Saved to workspace/)).toBeVisible({ timeout: 10_000 });

      await page.goto(`/project/${decision!.project_id}/data`);
      await page.goto(`/project/${decision!.project_id}/concept`);
      await expect(page.getByRole('button', { name: `Continue ${editedName}` })).toBeVisible();
      await page.getByRole('button', { name: `Continue ${editedName}` }).click();
      await expect(page.getByRole('heading', { name: 'Design your survey' })).toBeVisible();
    } finally {
      if (seededDraft?.id) await client.from('concept_workspace_drafts').delete().eq('id', seededDraft.id);
      await client.auth.signOut();
    }
  });

  test('unknown routes render the 404 page once authenticated', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/this-route-does-not-exist');
    await expect(page.getByRole('heading', { name: /404 - Page Not Found/i })).toBeVisible();
  });
});

test.describe('authenticated panelist workflow', () => {
  test.skip(
    !panelistEmail || !panelistPassword,
    'Dedicated DEMO_PANELIST_EMAIL and DEMO_PANELIST_PASSWORD secrets are required.',
  );

  test('panelist can open the assigned synthetic tasting and concept tasks', async ({ page }) => {
    await loginAsPanelist(page);

    await expect(page.getByRole('heading', { name: 'Assigned tasting tasks' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Start this task' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Marketing Evaluations' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Begin Marketing Evaluation' })).toBeVisible();
  });
});
