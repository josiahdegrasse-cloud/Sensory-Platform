// ─── Multi-tenant RLS isolation tests ───────────────────────────────────────
// Proves that one organization can never read another's data through the
// row-level-security policies added by the multi-tenancy migrations.
//
// These hit a REAL Postgres, so they are gated behind RLS_TEST_* env vars and
// SKIP during the normal offline unit suite. CI runs scripts/run-local-rls-tests.sh,
// which applies every migration to a disposable local Supabase instance and
// sets REQUIRE_RLS_TEST_ENV=1 so missing configuration fails closed. Never point
// this suite at production; it creates and deletes users, organizations, and rows.
//
//   RLS_TEST_DB_URL=https://<ref>.supabase.co \
//   RLS_TEST_ANON_KEY=<anon key> \
//   RLS_TEST_SERVICE_ROLE_KEY=<service role key> \
//   npx pnpm@10 exec vitest run src/app/lib/rls-isolation.test.ts
//
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const URL = process.env.RLS_TEST_DB_URL;
const ANON = process.env.RLS_TEST_ANON_KEY;
const SERVICE = process.env.RLS_TEST_SERVICE_ROLE_KEY;
const CONFIGURED = Boolean(URL && ANON && SERVICE);

if (process.env.REQUIRE_RLS_TEST_ENV === '1' && !CONFIGURED) {
  throw new Error('RLS isolation is required, but the disposable Supabase environment is not configured.');
}

const stamp = Date.now();
const orgA = { name: `RLS Test A ${stamp}`, slug: `rls-a-${stamp}` };
const orgB = { name: `RLS Test B ${stamp}`, slug: `rls-b-${stamp}` };
const userA = { email: `rls-a-${stamp}@example.test`, password: `Pw-${stamp}-aaaa` };
const userB = { email: `rls-b-${stamp}@example.test`, password: `Pw-${stamp}-bbbb` };

function jwtClaims(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('Access token has no JWT payload.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}

describe.skipIf(!CONFIGURED)('RLS tenant isolation', () => {
  let admin: SupabaseClient;          // service role — bypasses RLS, used for seeding
  let clientA: SupabaseClient;        // signed in as org A's admin
  let clientB: SupabaseClient;        // signed in as org B's admin
  const ids: {
    orgA?: string;
    orgB?: string;
    userA?: string;
    userB?: string;
    productA?: string;
    productB?: string;
    projectA?: string;
    projectB?: string;
    decisionA?: string;
    decisionB?: string;
    responseA?: string;
    responseARepeat?: string;
    responseB?: string;
  } = {};

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false, autoRefreshToken: false } });

    const must = <T,>(label: string, res: { data: T | null; error: { message: string } | null }): T => {
      if (res.error) throw new Error(`${label}: ${res.error.message}`);
      if (res.data == null) throw new Error(`${label}: no data returned`);
      return res.data;
    };

    const a = must('org A insert', await admin.from('organizations').insert(orgA).select().single());
    const b = must('org B insert', await admin.from('organizations').insert(orgB).select().single());
    ids.orgA = (a as unknown as { id: string }).id; ids.orgB = (b as unknown as { id: string }).id;

    // Create confirmed users; handle_new_user seeds their profile with org_id
    // from metadata. Elevate each to admin of their own org.
    const { data: ua } = await admin.auth.admin.createUser({
      email: userA.email, password: userA.password, email_confirm: true,
      user_metadata: { name: 'Admin A', org_id: ids.orgA },
    });
    const { data: ub } = await admin.auth.admin.createUser({
      email: userB.email, password: userB.password, email_confirm: true,
      user_metadata: { name: 'Admin B', org_id: ids.orgB },
    });
    if (!ua.user || !ub.user) throw new Error('createUser returned no user');
    ids.userA = ua.user.id; ids.userB = ub.user.id;
    must('profile A update', await admin.from('profiles').update({ role: 'admin', org_id: ids.orgA }).eq('id', ids.userA).select().single());
    must('profile B update', await admin.from('profiles').update({ role: 'admin', org_id: ids.orgB }).eq('id', ids.userB).select().single());

    const foodType = must('food type lookup', await admin.from('food_types').select('id').eq('slug', 'cheese').limit(1).single());
    const foodTypeId = (foodType as unknown as { id: string }).id;
    const projectA = must('project A insert', await admin.from('projects').insert({
      name: 'Confidential Project A', food_type_id: foodTypeId, created_by: ids.userA, org_id: ids.orgA,
    }).select().single());
    const projectB = must('project B insert', await admin.from('projects').insert({
      name: 'Confidential Project B', food_type_id: foodTypeId, created_by: ids.userB, org_id: ids.orgB,
    }).select().single());
    ids.projectA = (projectA as unknown as { id: string }).id; ids.projectB = (projectB as unknown as { id: string }).id;

    // Seed one product per org. org_id is set explicitly because the service
    // role has no auth.uid() for the trigger to derive from.
    const pa = must('product A insert', await admin.from('products').insert({ name: 'Secret Formula A', category: 'Test', status: 'draft', org_id: ids.orgA }).select().single());
    const pb = must('product B insert', await admin.from('products').insert({ name: 'Secret Formula B', category: 'Test', status: 'draft', org_id: ids.orgB }).select().single());
    ids.productA = (pa as unknown as { id: string }).id; ids.productB = (pb as unknown as { id: string }).id;

    const decisionBase = {
      decision: 'GO', issf_score: 80, confidence: 90, method_version: 'rls-test', note: '',
    };
    const da = must('decision A insert', await admin.from('decision_records').insert({
      ...decisionBase, sample_id: 'A1', sample_name: 'Secret A', decision_fingerprint: `decision-a-${stamp}`,
      created_by: ids.userA, project_id: ids.projectA, org_id: ids.orgA,
    }).select().single());
    const db = must('decision B insert', await admin.from('decision_records').insert({
      ...decisionBase, sample_id: 'B1', sample_name: 'Secret B', decision_fingerprint: `decision-b-${stamp}`,
      created_by: ids.userB, project_id: ids.projectB, org_id: ids.orgB,
    }).select().single());
    ids.decisionA = (da as unknown as { id: string }).id; ids.decisionB = (db as unknown as { id: string }).id;

    const ra = must('response A insert', await admin.from('responses').insert({
      user_id: ids.userA,
      product_id: ids.productA,
      org_id: ids.orgA,
    }).select().single());
    const rb = must('response B insert', await admin.from('responses').insert({
      user_id: ids.userB,
      product_id: ids.productB,
      org_id: ids.orgB,
    }).select().single());
    ids.responseA = (ra as unknown as { id: string }).id;
    ids.responseB = (rb as unknown as { id: string }).id;
    const raRepeat = must('response A repeat insert', await admin.from('responses').insert({
      user_id: ids.userA,
      product_id: ids.productA,
      org_id: ids.orgA,
      run_number: 2,
    }).select().single());
    ids.responseARepeat = (raRepeat as unknown as { id: string }).id;

    clientA = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
    clientB = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
    const [{ data: sessionA, error: signInErrorA }, { data: sessionB, error: signInErrorB }] = await Promise.all([
      clientA.auth.signInWithPassword(userA),
      clientB.auth.signInWithPassword(userB),
    ]);
    if (signInErrorA || !sessionA.session) throw new Error(`org A sign-in failed: ${signInErrorA?.message ?? 'no session'}`);
    if (signInErrorB || !sessionB.session) throw new Error(`org B sign-in failed: ${signInErrorB?.message ?? 'no session'}`);
    expect(jwtClaims(sessionA.session.access_token)).toMatchObject({ tenant_id: orgA.slug, roles: 'admin' });
    expect(jwtClaims(sessionB.session.access_token)).toMatchObject({ tenant_id: orgB.slug, roles: 'admin' });
  }, 30_000);

  afterAll(async () => {
    if (!admin) return;
    if (ids.responseA) await admin.from('responses').delete().eq('id', ids.responseA);
    if (ids.responseARepeat) await admin.from('responses').delete().eq('id', ids.responseARepeat);
    if (ids.responseB) await admin.from('responses').delete().eq('id', ids.responseB);
    if (ids.decisionA) await admin.from('decision_records').delete().eq('id', ids.decisionA);
    if (ids.decisionB) await admin.from('decision_records').delete().eq('id', ids.decisionB);
    if (ids.productA) await admin.from('products').delete().eq('id', ids.productA);
    if (ids.productB) await admin.from('products').delete().eq('id', ids.productB);
    if (ids.projectA) await admin.from('projects').delete().eq('id', ids.projectA);
    if (ids.projectB) await admin.from('projects').delete().eq('id', ids.projectB);
    if (ids.userA) await admin.auth.admin.deleteUser(ids.userA);
    if (ids.userB) await admin.auth.admin.deleteUser(ids.userB);
    if (ids.orgA) await admin.from('organizations').delete().eq('id', ids.orgA);
    if (ids.orgB) await admin.from('organizations').delete().eq('id', ids.orgB);
  });

  it('an admin sees only their own organization\'s products', async () => {
    const { data, error } = await clientA.from('products').select('id, name');
    expect(error).toBeNull();
    const idsSeen = (data ?? []).map(r => r.id);
    expect(idsSeen).toContain(ids.productA);
    expect(idsSeen).not.toContain(ids.productB);
  });

  it('cannot read another organization\'s product even by exact id', async () => {
    const { data } = await clientA.from('products').select('id').eq('id', ids.productB);
    expect(data ?? []).toHaveLength(0);
  });

  it('cannot write into another organization (WITH CHECK blocks it)', async () => {
    // Even if the client forges org_id, the RESTRICTIVE policy's WITH CHECK
    // requires org_id = current_org_id(), so the insert must fail.
    const { error } = await clientA.from('products').insert({
      name: 'Injected', category: 'Test', status: 'draft', org_id: ids.orgB,
    });
    expect(error?.code).toBe('42501');
  });

  it('cannot update another organization\'s product', async () => {
    const { data } = await clientA.from('products').update({ name: 'hijacked' }).eq('id', ids.productB).select();
    // RLS scopes the UPDATE to org A's rows, so zero rows match → no change.
    expect(data ?? []).toHaveLength(0);
    const { data: check } = await admin.from('products').select('name').eq('id', ids.productB).single();
    expect(check!.name).toBe('Secret Formula B');
  });

  it('cannot delete another organization\'s product', async () => {
    const { data, error } = await clientA.from('products').delete().eq('id', ids.productB).select('id');
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    const { data: check, error: checkError } = await admin.from('products').select('id').eq('id', ids.productB).single();
    expect(checkError).toBeNull();
    expect(check?.id).toBe(ids.productB);
  });

  it('the reverse holds: org B cannot see org A\'s product', async () => {
    const { data } = await clientB.from('products').select('id').eq('id', ids.productA);
    expect(data ?? []).toHaveLength(0);
  });

  it('project and decision lineage cannot cross organization boundaries', async () => {
    const [{ data: projects, error: projectError }, { data: decisions, error: decisionError }] = await Promise.all([
      clientA.from('projects').select('id'),
      clientA.from('decision_records').select('id, project_id'),
    ]);
    expect(projectError).toBeNull();
    expect(decisionError).toBeNull();
    expect((projects ?? []).map(row => row.id)).toContain(ids.projectA);
    expect((projects ?? []).map(row => row.id)).not.toContain(ids.projectB);
    expect((decisions ?? []).map(row => row.id)).toContain(ids.decisionA);
    expect((decisions ?? []).map(row => row.id)).not.toContain(ids.decisionB);
  });

  it('aggregate response-count functions preserve tenant isolation', async () => {
    const [{ data: byProduct, error: productError }, { data: byPanelist, error: panelistError }] = await Promise.all([
      clientA.rpc('get_response_counts_by_product'),
      clientA.rpc('get_response_counts_by_panelist'),
    ]);
    expect(productError).toBeNull();
    expect(panelistError).toBeNull();

    const productIds = (byProduct ?? []).map((row: { product_id: string }) => row.product_id);
    const userIds = (byPanelist ?? []).map((row: { user_id: string }) => row.user_id);
    expect(productIds).toContain(ids.productA);
    expect(productIds).not.toContain(ids.productB);
    expect(userIds).toContain(ids.userA);
    expect(userIds).not.toContain(ids.userB);
    expect((byProduct ?? []).find((row: { product_id: string; response_count: number }) => row.product_id === ids.productA)?.response_count).toBe(1);
  });
});
