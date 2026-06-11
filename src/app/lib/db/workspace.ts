import { supabase } from '../supabase';
import { dbError, insertAuditEvent } from './shared';

export interface WorkspaceSettings {
  workspaceName: string;
  organizationName: string;
  adminContactEmail: string;
  defaultTimezone: string;
  dataRetentionMonths: number;
  requirePanelistConsent: boolean;
  allowSelfSignup: boolean;
  defaultPanelSize: number;
  requireHedonicSection: boolean;
  requireIntensitySection: boolean;
  requireEmotionSection: boolean;
  allowPanelistComments: boolean;
  requireAllSamplesBeforeSubmit: boolean;
  autoCreateFoodTypes: boolean;
  autoCreateSurveysFromImports: boolean;
  requireImportReview: boolean;
  duplicateSamplePolicy: 'skip' | 'rename' | 'replace';
  requirePanelistId: boolean;
  allowPanelistsViewHistory: boolean;
  inactivePanelistDays: number;
  conceptMaxGenerationsPerConcept: number;
  conceptMonthlyBudgetCents: number;
  conceptRequireApproval: boolean;
  decisionGoThreshold: number;
  decisionStopThreshold: number;
  decisionMinResponses: number;
  decisionLockConfirmed: boolean;
  anonymizePanelistsInReports: boolean;
  exportFormat: 'xlsx' | 'csv' | 'pdf';
  reportFooter: string;
  /** Voice for generated report narrative: formal, standard, or energetic. */
  reportTone: 'formal' | 'standard' | 'energetic';
  /** Title template for new reports; {sample} expands to the sample name. */
  defaultReportTitle: string;
  notifyOnImport: boolean;
  notifyOnCompletionTarget: boolean;
  notifyOnGenerationFailure: boolean;
  // Per-tenant branding (consumed by subdomain theming + branded login).
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  updatedAt: string | null;
}

export interface PublicWorkspaceConfig {
  workspaceName: string;
  allowSelfSignup: boolean;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
}

export interface AuditEventRecord {
  id: string;
  actorId: string | null;
  actorName: string | null;
  eventType: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DecisionRecord {
  id: string;
  timestamp: string;
  sampleId: string;
  sampleName: string;
  decision: 'GO' | 'TWEAK' | 'STOP';
  issfScore: number;
  confidence: number;
  user: string;
  note: string;
  methodVersion: string;
  decisionFingerprint: string;
}

function defaultWorkspaceSettings(): WorkspaceSettings {
  return {
    workspaceName: 'Sensory Analysis Workspace',
    organizationName: 'New Food Innovation',
    adminContactEmail: '',
    defaultTimezone: 'America/New_York',
    dataRetentionMonths: 24,
    requirePanelistConsent: true,
    allowSelfSignup: true,
    defaultPanelSize: 24,
    requireHedonicSection: true,
    requireIntensitySection: true,
    requireEmotionSection: true,
    allowPanelistComments: true,
    requireAllSamplesBeforeSubmit: true,
    autoCreateFoodTypes: true,
    autoCreateSurveysFromImports: true,
    requireImportReview: false,
    duplicateSamplePolicy: 'skip',
    requirePanelistId: false,
    allowPanelistsViewHistory: false,
    inactivePanelistDays: 90,
    conceptMaxGenerationsPerConcept: 12,
    conceptMonthlyBudgetCents: 2500,
    conceptRequireApproval: false,
    decisionGoThreshold: 75,
    decisionStopThreshold: 45,
    decisionMinResponses: 12,
    decisionLockConfirmed: true,
    anonymizePanelistsInReports: true,
    exportFormat: 'xlsx',
    reportFooter: '',
    reportTone: 'standard',
    defaultReportTitle: '',
    notifyOnImport: true,
    notifyOnCompletionTarget: true,
    notifyOnGenerationFailure: true,
    logoUrl: null,
    primaryColor: null,
    accentColor: null,
    updatedAt: null,
  };
}

function toWorkspaceSettings(row: Record<string, unknown>): WorkspaceSettings {
  return {
    workspaceName: (row.workspace_name as string) ?? 'Sensory Analysis Workspace',
    organizationName: (row.organization_name as string) ?? 'New Food Innovation',
    adminContactEmail: (row.admin_contact_email as string) ?? '',
    defaultTimezone: (row.default_timezone as string) ?? 'America/New_York',
    dataRetentionMonths: Number(row.data_retention_months ?? 24),
    requirePanelistConsent: Boolean(row.require_panelist_consent ?? true),
    allowSelfSignup: Boolean(row.allow_self_signup ?? true),
    defaultPanelSize: Number(row.default_panel_size ?? 24),
    requireHedonicSection: Boolean(row.require_hedonic_section ?? true),
    requireIntensitySection: Boolean(row.require_intensity_section ?? true),
    requireEmotionSection: Boolean(row.require_emotion_section ?? true),
    allowPanelistComments: Boolean(row.allow_panelist_comments ?? true),
    requireAllSamplesBeforeSubmit: Boolean(row.require_all_samples_before_submit ?? true),
    autoCreateFoodTypes: Boolean(row.auto_create_food_types ?? true),
    autoCreateSurveysFromImports: Boolean(row.auto_create_surveys_from_imports ?? true),
    requireImportReview: Boolean(row.require_import_review ?? false),
    duplicateSamplePolicy: ((row.duplicate_sample_policy as WorkspaceSettings['duplicateSamplePolicy']) ?? 'skip'),
    requirePanelistId: Boolean(row.require_panelist_id ?? false),
    allowPanelistsViewHistory: Boolean(row.allow_panelists_view_history ?? false),
    inactivePanelistDays: Number(row.inactive_panelist_days ?? 90),
    conceptMaxGenerationsPerConcept: Number(row.concept_max_generations_per_concept ?? 12),
    conceptMonthlyBudgetCents: Number(row.concept_monthly_budget_cents ?? 2500),
    conceptRequireApproval: Boolean(row.concept_require_approval ?? false),
    decisionGoThreshold: Number(row.decision_go_threshold ?? 75),
    decisionStopThreshold: Number(row.decision_stop_threshold ?? 45),
    decisionMinResponses: Number(row.decision_min_responses ?? 12),
    decisionLockConfirmed: Boolean(row.decision_lock_confirmed ?? true),
    anonymizePanelistsInReports: Boolean(row.anonymize_panelists_in_reports ?? true),
    exportFormat: ((row.export_format as WorkspaceSettings['exportFormat']) ?? 'xlsx'),
    reportFooter: (row.report_footer as string) ?? '',
    reportTone: ((row.report_tone as WorkspaceSettings['reportTone']) ?? 'standard'),
    defaultReportTitle: (row.default_report_title as string) ?? '',
    notifyOnImport: Boolean(row.notify_on_import ?? true),
    notifyOnCompletionTarget: Boolean(row.notify_on_completion_target ?? true),
    notifyOnGenerationFailure: Boolean(row.notify_on_generation_failure ?? true),
    logoUrl: (row.logo_url as string) ?? null,
    primaryColor: (row.primary_color as string) ?? null,
    accentColor: (row.accent_color as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
  };
}

export async function fetchWorkspaceSettings(): Promise<WorkspaceSettings> {
  // RLS scopes this to exactly the caller's organization row (per-org settings).
  const { data, error } = await supabase
    .from('workspace_settings')
    .select('*')
    .maybeSingle();

  if (error) {
    if (/workspace_settings|schema cache|does not exist/i.test(error.message ?? '')) return defaultWorkspaceSettings();
    throw dbError(error);
  }
  return data ? toWorkspaceSettings(data) : defaultWorkspaceSettings();
}

// Pre-login config for the (eventually branded) login page. `orgSlug` resolves a
// tenant by subdomain; with none it returns platform defaults.
export async function fetchPublicWorkspaceConfig(orgSlug?: string): Promise<PublicWorkspaceConfig> {
  const { data, error } = await supabase.rpc('get_public_workspace_config', {
    org_slug: orgSlug ?? null,
  });
  if (error) {
    if (/get_public_workspace_config|schema cache|does not exist/i.test(error.message ?? '')) {
      return { workspaceName: 'Sensory Analysis Workspace', allowSelfSignup: true };
    }
    throw dbError(error);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    workspaceName: (row?.workspace_name as string) ?? 'Sensory Analysis Workspace',
    allowSelfSignup: Boolean(row?.allow_self_signup ?? true),
    logoUrl: (row?.logo_url as string) ?? null,
    primaryColor: (row?.primary_color as string) ?? null,
    accentColor: (row?.accent_color as string) ?? null,
  };
}

export async function updateWorkspaceSettings(
  updates: WorkspaceSettings,
  actorId?: string | null,
): Promise<WorkspaceSettings> {
  const decisionStopThreshold = Math.min(99, Math.max(0, Number(updates.decisionStopThreshold) || 45));
  const decisionGoThreshold = Math.min(100, Math.max(decisionStopThreshold + 1, Number(updates.decisionGoThreshold) || 75));
  const patch = {
    workspace_name: updates.workspaceName.trim() || 'Sensory Analysis Workspace',
    organization_name: updates.organizationName.trim() || 'New Food Innovation',
    admin_contact_email: updates.adminContactEmail.trim() || null,
    default_timezone: updates.defaultTimezone.trim() || 'America/New_York',
    data_retention_months: Math.min(120, Math.max(1, Number(updates.dataRetentionMonths) || 24)),
    require_panelist_consent: updates.requirePanelistConsent,
    allow_self_signup: updates.allowSelfSignup,
    default_panel_size: Math.min(500, Math.max(1, Number(updates.defaultPanelSize) || 24)),
    require_hedonic_section: updates.requireHedonicSection,
    require_intensity_section: updates.requireIntensitySection,
    require_emotion_section: updates.requireEmotionSection,
    allow_panelist_comments: updates.allowPanelistComments,
    require_all_samples_before_submit: updates.requireAllSamplesBeforeSubmit,
    auto_create_food_types: updates.autoCreateFoodTypes,
    auto_create_surveys_from_imports: updates.autoCreateSurveysFromImports,
    require_import_review: updates.requireImportReview,
    duplicate_sample_policy: updates.duplicateSamplePolicy,
    require_panelist_id: updates.requirePanelistId,
    allow_panelists_view_history: updates.allowPanelistsViewHistory,
    inactive_panelist_days: Math.min(730, Math.max(1, Number(updates.inactivePanelistDays) || 90)),
    concept_max_generations_per_concept: Math.min(100, Math.max(1, Number(updates.conceptMaxGenerationsPerConcept) || 12)),
    concept_monthly_budget_cents: Math.min(1000000, Math.max(0, Number(updates.conceptMonthlyBudgetCents) || 0)),
    concept_require_approval: updates.conceptRequireApproval,
    decision_go_threshold: decisionGoThreshold,
    decision_stop_threshold: decisionStopThreshold,
    decision_min_responses: Math.min(500, Math.max(1, Number(updates.decisionMinResponses) || 12)),
    decision_lock_confirmed: updates.decisionLockConfirmed,
    anonymize_panelists_in_reports: updates.anonymizePanelistsInReports,
    export_format: updates.exportFormat,
    report_footer: updates.reportFooter.trim(),
    // jsonb_populate_record ignores keys without a matching column, so these
    // are safe to send before the report-branding migration has been applied.
    report_tone: updates.reportTone,
    default_report_title: updates.defaultReportTitle.trim(),
    notify_on_import: updates.notifyOnImport,
    notify_on_completion_target: updates.notifyOnCompletionTarget,
    notify_on_generation_failure: updates.notifyOnGenerationFailure,
    logo_url: updates.logoUrl ?? null,
    primary_color: updates.primaryColor ?? null,
    accent_color: updates.accentColor ?? null,
    updated_at: new Date().toISOString(),
  };

  // org_id is derived server-side from the caller's profile (current_org_id()),
  // so the client never has to know which tenant it is writing.
  const { data, error } = await supabase.rpc('upsert_workspace_settings', { patch });
  if (error) throw dbError(error);
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;

  await insertAuditEvent({
    actorId: actorId ?? null,
    eventType: 'workspace_settings_updated',
    entityType: 'workspace_settings',
    metadata: {
      workspaceName: patch.workspace_name,
      organizationName: patch.organization_name,
      dataRetentionMonths: patch.data_retention_months,
      requirePanelistConsent: patch.require_panelist_consent,
      allowSelfSignup: patch.allow_self_signup,
      defaultPanelSize: patch.default_panel_size,
      importAutomation: patch.auto_create_surveys_from_imports,
      decisionThresholds: `${patch.decision_stop_threshold}/${patch.decision_go_threshold}`,
      governance: {
        anonymizeReports: patch.anonymize_panelists_in_reports,
        exportFormat: patch.export_format,
      },
    },
  });

  return toWorkspaceSettings(row);
}

export async function fetchAuditEvents(limit = 80): Promise<AuditEventRecord[]> {
  const { data, error } = await supabase
    .from('audit_events')
    .select('id, actor_id, event_type, entity_type, entity_id, metadata, created_at, profiles(name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (/audit_events|schema cache|does not exist/i.test(error.message ?? '')) return [];
    throw dbError(error);
  }

  return (data ?? []).map(row => {
    const profile = row.profiles as { name?: string } | null;
    return {
      id: row.id as string,
      actorId: (row.actor_id as string) ?? null,
      actorName: profile?.name ?? null,
      eventType: row.event_type as string,
      entityType: row.entity_type as string,
      entityId: (row.entity_id as string) ?? null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.created_at as string,
    };
  });
}

export async function fetchDecisionRecords(limit = 200): Promise<DecisionRecord[]> {
  const { data, error } = await supabase
    .from('decision_records')
    .select('*, profiles(name)')
    .order('created_at', { ascending: false })
    .limit(Math.min(500, Math.max(1, limit)));
  if (error) {
    if (/decision_records|schema cache|does not exist/i.test(error.message ?? '')) return [];
    throw dbError(error);
  }
  return (data ?? []).map(row => ({
    id: row.id as string,
    timestamp: row.created_at as string,
    sampleId: row.sample_id as string,
    sampleName: row.sample_name as string,
    decision: row.decision as DecisionRecord['decision'],
    issfScore: Number(row.issf_score),
    confidence: Number(row.confidence),
    user: ((row.profiles as { name?: string } | null)?.name) ?? 'Administrator',
    note: (row.note as string) ?? '',
    methodVersion: row.method_version as string,
    decisionFingerprint: row.decision_fingerprint as string,
  }));
}

export async function insertDecisionRecord(input: {
  sampleId: string;
  sampleName: string;
  decision: DecisionRecord['decision'];
  issfScore: number;
  confidence: number;
  note: string;
  methodVersion: string;
  decisionFingerprint: string;
  createdBy: string;
}): Promise<void> {
  const { error } = await supabase.from('decision_records').insert({
    sample_id: input.sampleId,
    sample_name: input.sampleName,
    decision: input.decision,
    issf_score: input.issfScore,
    confidence: input.confidence,
    note: input.note,
    method_version: input.methodVersion,
    decision_fingerprint: input.decisionFingerprint,
    created_by: input.createdBy,
  });
  if (error) throw dbError(error);
}
