// ─── Multi-tenant RLS isolation tests ───────────────────────────────────────
// Proves that one organization can never read another's data through the
// row-level-security policies added by the multi-tenancy migrations.
//
// These hit a REAL Postgres, so they are gated behind RLS_TEST_* env vars and
// SKIP entirely otherwise (so the default offline `pnpm test` + CI stay green).
// Point them at a Supabase PREVIEW/branch DB that has the tenancy migrations
// applied — NEVER production (the suite creates and deletes users/orgs/rows):
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

const stamp = Date.now();
const orgA = { name: `RLS Test A ${stamp}`, slug: `rls-a-${stamp}` };
const orgB = { name: `RLS Test B ${stamp}`, slug: `rls-b-${stamp}` };
const userA = { email: `rls-a-${stamp}@example.test`, password: `Pw-${stamp}-aaaa` };
const userB = { email: `rls-b-${stamp}@example.test`, password: `Pw-${stamp}-bbbb` };

describe.skipIf(!CONFIGURED)('RLS tenant isolation', () => {
  let admin: SupabaseClient;          // service role — bypasses RLS, used for seeding
  let clientA: SupabaseClient;        // signed in as org A's admin
  let clientB: SupabaseClient;        // signed in as org B's admin
  const ids: { orgA?: string; orgB?: string; userA?: string; userB?: string; productA?: string; productB?: string } = {};

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: a } = await admin.from('organizations').insert(orgA).select().single();
    const { data: b } = await admin.from('organizations').insert(orgB).select().single();
    ids.orgA = a!.id; ids.orgB = b!.id;

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
    ids.userA = ua.user!.id; ids.userB = ub.user!.id;
    await admin.from('profiles').update({ role: 'admin', org_id: ids.orgA }).eq('id', ids.userA);
    await admin.from('profiles').update({ role: 'admin', org_id: ids.orgB }).eq('id', ids.userB);

    // Seed one product per org. org_id is set explicitly because the service
    // role has no auth.uid() for the trigger to derive from.
    const { data: pa } = await admin.from('products').insert({ name: 'Secret Formula A', org_id: ids.orgA }).select().single();
    const { data: pb } = await admin.from('products').insert({ name: 'Secret Formula B', org_id: ids.orgB }).select().single();
    ids.productA = pa!.id; ids.productB = pb!.id;

    clientA = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
    clientB = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
    await clientA.auth.signInWithPassword(userA);
    await clientB.auth.signInWithPassword(userB);
  }, 30_000);

  afterAll(async () => {
    if (!admin) return;
    if (ids.productA) await admin.from('products').delete().eq('id', ids.productA);
    if (ids.productB) await admin.from('products').delete().eq('id', ids.productB);
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
    const { error } = await clientA.from('products').insert({ name: 'Injected', org_id: ids.orgB });
    expect(error).not.toBeNull();
  });

  it('cannot update another organization\'s product', async () => {
    const { data } = await clientA.from('products').update({ name: 'hijacked' }).eq('id', ids.productB).select();
    // RLS scopes the UPDATE to org A's rows, so zero rows match → no change.
    expect(data ?? []).toHaveLength(0);
    const { data: check } = await admin.from('products').select('name').eq('id', ids.productB).single();
    expect(check!.name).toBe('Secret Formula B');
  });

  it('the reverse holds: org B cannot see org A\'s product', async () => {
    const { data } = await clientB.from('products').select('id').eq('id', ids.productA);
    expect(data ?? []).toHaveLength(0);
  });
});
