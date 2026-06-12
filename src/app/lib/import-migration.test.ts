import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL(
  '../../../supabase/migrations/20260611190000_fix_tenant_instrumental_import.sql',
  import.meta.url,
);
const reimportMigrationPath = new URL(
  '../../../supabase/migrations/20260611193000_reimport_deleted_instrumental_project.sql',
  import.meta.url,
);

describe('tenant-safe instrumental import migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('loads workspace settings by organization instead of the removed singleton id', () => {
    expect(sql).toContain('WHERE org_id = caller_org');
    expect(sql).not.toContain('WHERE id = true');
  });

  it('scopes the security-definer import to the caller organization', () => {
    expect(sql).toContain('caller_org uuid := public.current_org_id()');
    expect(sql).toContain('b.org_id = caller_org');
    expect(sql).toContain('org_id = caller_org');
    expect(sql).toContain('No organization context for instrument import');
  });

  it('keeps import idempotency isolated per organization', () => {
    expect(sql).toContain('ON public.import_batches(org_id, idempotency_key)');
    expect(sql).toContain('WHERE idempotency_key IS NOT NULL');
  });

  it('allows deleted projects to be imported again without disabling active retry protection', () => {
    const reimportSql = readFileSync(reimportMigrationPath, 'utf8');
    expect(reimportSql).toContain("AND b.status = 'active'");
    expect(reimportSql).toContain("WHERE idempotency_key IS NOT NULL AND status = 'active'");
  });
});
