import { supabase } from '../supabase';

export const CURRENT_CONSENT_VERSION = '2026-06-05-v1';

export function dbError(error: { message?: string; code?: string }): Error {
  return new Error(error.message || `Database error (code: ${error.code ?? 'unknown'})`);
}

export function isMissingFoodImportSchema(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /food_types|instrumental_samples|import_batches|e_tongue_measurements|gcms_compounds|composition_profiles/i.test(message) &&
    /schema cache|could not find|does not exist|PGRST205/i.test(message)
  );
}

export async function acceptPanelistConsent(userId: string): Promise<string> {
  const acceptedAt = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({
      consent_accepted_at: acceptedAt,
      consent_version: CURRENT_CONSENT_VERSION,
      consent_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
    .eq('id', userId);

  if (error) throw dbError(error);
  return acceptedAt;
}

export async function insertAuditEvent(input: {
  actorId?: string | null;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('audit_events').insert({
    actor_id: input.actorId ?? null,
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error && !/audit_events|schema cache|does not exist/i.test(error.message ?? '')) throw dbError(error);
}
