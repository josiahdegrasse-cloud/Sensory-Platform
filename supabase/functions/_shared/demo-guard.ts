import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export const PUBLIC_DEMO_EXTERNAL_ACTION_ERROR =
  'This action is disabled in the public demo workspace.';

export async function isPublicDemoWorkspace(
  client: SupabaseClient,
  orgId: string | null | undefined,
): Promise<boolean> {
  if (!orgId) return false;
  const { data, error } = await client
    .from('workspace_settings')
    .select('demo_mode_enabled')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw error;
  return data?.demo_mode_enabled === true;
}
