import { supabase } from '../supabase';
import { dbError, fromJson, insertAuditEvent } from './shared';
import { validateCompanyDomain } from '../company-email';
import type { Database } from './database.types';
import { tenantSignInUrl } from '../tenant';
import { resolveWorkspaceBrandIdentity } from '../nfi-brand';

type Tables = Database['public']['Tables'];

/**
 * The org's durable concept-visual house style. Seeded only by an explicit
 * admin "Set as company brand" action on an approved concept image; applied
 * (image + descriptors) to subsequent concept-image generations so new
 * concepts read as the same brand family.
 */
export interface ConceptBrandKit {
  /** Storage path (concept-images bucket) of the adopted reference image. */
  referenceImagePath: string | null;
  /** concept_images id the kit was adopted from. */
  sourceImageId: string | null;
  /** Concept name the kit was adopted from, for display. */
  sourceConceptName: string;
  /** Free-text house-style notes (materials, mood, typography voice). */
  brandDescriptor: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

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
  demoModeEnabled: boolean;
  conceptImageGenerationEnabled: boolean;
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
  /** PDF layout for commercialization reports: navy/blue editorial or NFI cream/sage masthead. */
  reportTemplate: 'standard' | 'editorial-sage';
  notifyOnImport: boolean;
  notifyOnCompletionTarget: boolean;
  notifyOnGenerationFailure: boolean;
  // Per-tenant branding (consumed by subdomain theming + branded login).
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  /** Concept-visual house style; null/absent until an admin adopts one. */
  brandKit?: ConceptBrandKit | null;
  // Connected Google Drive folder for the monitored-import source.
  driveFolderId?: string | null;
  driveFolderName?: string | null;
  updatedAt: string | null;
}

// Accepts a pasted Drive folder URL or a bare id and returns the folder id.
// e.g. https://drive.google.com/drive/folders/<id>?usp=sharing -> <id>
export function parseDriveFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Bare id (Drive ids are url-safe base64-ish, no slashes/spaces)
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}

export interface PublicWorkspaceConfig {
  workspaceName: string;
  allowSelfSignup: boolean;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
}

export interface PlatformOrganizationInput {
  organizationName: string;
  organizationSlug: string;
  administratorEmail: string;
  emailDomains: string[];
  workspaceName?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
}

export interface PlatformOrganizationResult {
  organizationId: string;
  organizationSlug: string;
  administratorEmail: string;
  signInUrl: string;
}

export interface WorkspaceOperationalHealth {
  databaseOnline: boolean;
  checkedAt: string;
  unresolvedLineageCount: number;
  failedImageGenerationsThisMonth: number;
  failedPendingImports: number;
  latestAuditEventAt: string | null;
  warnings: string[];
}

export interface PrototypeLineageIssue {
  entityType: string;
  entityId: string;
  projectId: string | null;
  sampleKey: string | null;
  reason: string;
  createdAt: string | null;
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
  projectId?: string | null;
  /** Canonical imported prototype evaluated by this decision. */
  instrumentalSampleId?: string | null;
  /** Set when this decision was made after a retest triggered by a prior TWEAK/STOP. */
  parentDecisionId?: string | null;
  /** Immutable formulation snapshot evaluated when this decision was saved. */
  formulationVersionId?: string | null;
  /** Immutable product-evidence bundle evaluated when this decision was saved. */
  evidenceBundleId?: string | null;
  researchRefreshedAt?: string | null;
  researchFingerprint?: string | null;
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
    autoCreateSurveysFromImports: false,
    requireImportReview: true,
    duplicateSamplePolicy: 'skip',
    requirePanelistId: false,
    allowPanelistsViewHistory: false,
    inactivePanelistDays: 90,
    demoModeEnabled: false,
    conceptImageGenerationEnabled: true,
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
    reportTemplate: 'editorial-sage',
    notifyOnImport: true,
    notifyOnCompletionTarget: true,
    notifyOnGenerationFailure: true,
    logoUrl: null,
    primaryColor: null,
    accentColor: null,
    brandKit: null,
    driveFolderId: null,
    driveFolderName: null,
    updatedAt: null,
  };
}

/** Tolerant parse of the brand_kit jsonb column (absent pre-migration). */
function toConceptBrandKit(value: unknown): ConceptBrandKit | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const kit: ConceptBrandKit = {
    referenceImagePath: typeof record.referenceImagePath === 'string' && record.referenceImagePath ? record.referenceImagePath : null,
    sourceImageId: typeof record.sourceImageId === 'string' && record.sourceImageId ? record.sourceImageId : null,
    sourceConceptName: typeof record.sourceConceptName === 'string' ? record.sourceConceptName : '',
    brandDescriptor: typeof record.brandDescriptor === 'string' ? record.brandDescriptor : '',
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
    updatedBy: typeof record.updatedBy === 'string' ? record.updatedBy : null,
  };
  return kit.referenceImagePath || kit.brandDescriptor ? kit : null;
}

function toWorkspaceSettings(row: Tables['workspace_settings']['Row']): WorkspaceSettings {
  const demoModeEnabled = Boolean(row.demo_mode_enabled ?? false);
  const brandIdentity = resolveWorkspaceBrandIdentity({
    workspaceName: row.workspace_name as string | null,
    organizationName: row.organization_name as string | null,
    demoModeEnabled,
    logoUrl: row.logo_url as string | null,
    primaryColor: row.primary_color as string | null,
    accentColor: row.accent_color as string | null,
  });

  return {
    workspaceName: brandIdentity.workspaceName ?? 'Sensory Analysis Workspace',
    organizationName: brandIdentity.organizationName ?? 'New Food Innovation',
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
    autoCreateSurveysFromImports: Boolean(row.auto_create_surveys_from_imports ?? false),
    requireImportReview: Boolean(row.require_import_review ?? true),
    duplicateSamplePolicy: ((row.duplicate_sample_policy as WorkspaceSettings['duplicateSamplePolicy']) ?? 'skip'),
    requirePanelistId: Boolean(row.require_panelist_id ?? false),
    allowPanelistsViewHistory: Boolean(row.allow_panelists_view_history ?? false),
    inactivePanelistDays: Number(row.inactive_panelist_days ?? 90),
    demoModeEnabled,
    conceptImageGenerationEnabled: Boolean(row.concept_image_generation_enabled ?? true),
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
    reportTemplate: ((row.report_template as WorkspaceSettings['reportTemplate']) ?? 'editorial-sage'),
    notifyOnImport: Boolean(row.notify_on_import ?? true),
    notifyOnCompletionTarget: Boolean(row.notify_on_completion_target ?? true),
    notifyOnGenerationFailure: Boolean(row.notify_on_generation_failure ?? true),
    logoUrl: brandIdentity.logoUrl,
    primaryColor: brandIdentity.primaryColor,
    accentColor: brandIdentity.accentColor,
    // Cast: brand_kit lands with the concept_brand_kit migration and may not
    // be in the generated types yet (regenerate database.types.ts after it).
    brandKit: toConceptBrandKit((row as Record<string, unknown>).brand_kit),
    driveFolderId: (row.drive_folder_id as string) ?? null,
    driveFolderName: (row.drive_folder_name as string) ?? null,
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

export async function fetchIsPlatformOperator(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_platform_operator');
  if (error) throw dbError(error);
  return Boolean(data);
}

export async function provisionPlatformOrganization(
  input: PlatformOrganizationInput,
): Promise<PlatformOrganizationResult> {
  const { data, error } = await supabase.rpc('platform_provision_organization', {
    p_org_name: input.organizationName,
    p_org_slug: input.organizationSlug,
    p_admin_email: input.administratorEmail,
    p_email_domains: input.emailDomains,
    p_workspace_name: input.workspaceName || undefined,
    p_logo_url: input.logoUrl || undefined,
    p_primary_color: input.primaryColor || undefined,
    p_accent_color: input.accentColor || undefined,
  });
  if (error) throw dbError(error);
  const row = data?.[0];
  if (!row) throw new Error('Organization provisioning completed without a result.');

  return {
    organizationId: row.organization_id,
    organizationSlug: row.organization_slug,
    administratorEmail: row.administrator_email,
    signInUrl: tenantSignInUrl(row.organization_slug),
  };
}

export async function fetchWorkspaceOperationalHealth(): Promise<WorkspaceOperationalHealth> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [database, lineage, imageFailures, importFailures, latestAudit] = await Promise.all([
    supabase.from('projects').select('id', { count: 'exact', head: true }),
    supabase.from('prototype_lineage_reconciliation').select('entity_id', { count: 'exact', head: true }),
    supabase
      .from('concept_image_generations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', monthStart.toISOString()),
    supabase
      .from('pending_imports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed'),
    supabase
      .from('audit_events')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const checks = [database, lineage, imageFailures, importFailures, latestAudit];
  const warnings = checks
    .map(check => check.error?.message)
    .filter((message): message is string => Boolean(message));

  return {
    databaseOnline: !database.error,
    checkedAt: new Date().toISOString(),
    unresolvedLineageCount: lineage.count ?? 0,
    failedImageGenerationsThisMonth: imageFailures.count ?? 0,
    failedPendingImports: importFailures.count ?? 0,
    latestAuditEventAt: latestAudit.data?.created_at ?? null,
    warnings,
  };
}

/** Read-only review queue. Historical scientific records are never guessed or mutated automatically. */
export async function fetchPrototypeLineageIssues(): Promise<PrototypeLineageIssue[]> {
  const { data, error } = await supabase
    .from('prototype_lineage_reconciliation')
    .select('entity_type, entity_id, project_id, sample_key, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw dbError(error);
  return (data ?? []).flatMap(row => row.entity_id && row.entity_type && row.reason ? [{
    entityType: row.entity_type,
    entityId: row.entity_id,
    projectId: row.project_id,
    sampleKey: row.sample_key,
    reason: row.reason,
    createdAt: row.created_at,
  }] : []);
}

// Pre-login config for the (eventually branded) login page. `orgSlug` resolves a
// tenant by subdomain; with none it returns platform defaults.
export async function fetchPublicWorkspaceConfig(orgSlug?: string): Promise<PublicWorkspaceConfig> {
  const { data, error } = await supabase.rpc('get_public_workspace_config', {
    // The arg defaults to NULL in SQL, so omitting (undefined) is equivalent to
    // the previous explicit null — but satisfies the generated optional-arg type.
    org_slug: orgSlug ?? undefined,
  });
  if (error) {
    if (/get_public_workspace_config|schema cache|does not exist/i.test(error.message ?? '')) {
      if (orgSlug) throw dbError(error);
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
    demo_mode_enabled: updates.demoModeEnabled,
    concept_image_generation_enabled: updates.conceptImageGenerationEnabled,
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
    report_template: updates.reportTemplate,
    notify_on_import: updates.notifyOnImport,
    notify_on_completion_target: updates.notifyOnCompletionTarget,
    notify_on_generation_failure: updates.notifyOnGenerationFailure,
    logo_url: updates.logoUrl ?? null,
    primary_color: updates.primaryColor ?? null,
    accent_color: updates.accentColor ?? null,
    // jsonb_populate_record ignores unknown keys, so this is safe to send
    // before the concept_brand_kit migration has been applied.
    brand_kit: updates.brandKit ?? {},
    drive_folder_id: updates.driveFolderId ?? null,
    drive_folder_name: updates.driveFolderName ?? null,
    updated_at: new Date().toISOString(),
  };

  // org_id is derived server-side from the caller's profile (current_org_id()),
  // so the client never has to know which tenant it is writing.
  const { data, error } = await supabase.rpc('upsert_workspace_settings', { patch });
  if (error) throw dbError(error);
  const row = (Array.isArray(data) ? data[0] : data) as Tables['workspace_settings']['Row'];

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

/**
 * Adopts an approved concept image as the org's concept brand kit. Explicit,
 * audited admin action — the kit then anchors future concept-image batches.
 * Goes through updateWorkspaceSettings (full merge) because the settings RPC
 * replaces the whole row; a partial patch would wipe other settings.
 */
export async function adoptConceptImageAsBrandKit(input: {
  imageId: string;
  sourceConceptName: string;
  brandDescriptor?: string;
  actorId?: string | null;
}): Promise<WorkspaceSettings> {
  const { data: imageRow, error: imageError } = await supabase
    .from('concept_images')
    .select('id, storage_path')
    .eq('id', input.imageId)
    .single();
  if (imageError) throw dbError(imageError);
  const storagePath = (imageRow?.storage_path as string | null) ?? null;
  if (!storagePath) throw new Error('This image has no stored file to adopt as the brand reference.');

  const current = await fetchWorkspaceSettings();
  const updated = await updateWorkspaceSettings({
    ...current,
    brandKit: {
      referenceImagePath: storagePath,
      sourceImageId: input.imageId,
      sourceConceptName: input.sourceConceptName.trim(),
      brandDescriptor: input.brandDescriptor?.trim() || current.brandKit?.brandDescriptor || '',
      updatedAt: new Date().toISOString(),
      updatedBy: input.actorId ?? null,
    },
  }, input.actorId);

  await insertAuditEvent({
    actorId: input.actorId ?? null,
    eventType: 'concept_brand_kit_adopted',
    entityType: 'workspace_settings',
    entityId: input.imageId,
    metadata: { sourceImageId: input.imageId, sourceConceptName: input.sourceConceptName },
  });
  return updated;
}

/** Removes the org brand kit (audited); future batches generate unanchored. */
export async function clearConceptBrandKit(actorId?: string | null): Promise<WorkspaceSettings> {
  const current = await fetchWorkspaceSettings();
  const updated = await updateWorkspaceSettings({ ...current, brandKit: null }, actorId);
  await insertAuditEvent({
    actorId: actorId ?? null,
    eventType: 'concept_brand_kit_cleared',
    entityType: 'workspace_settings',
    metadata: {},
  });
  return updated;
}

export interface OrgEmailDomain {
  domain: string;
  createdAt: string;
}

// Domains this organization owns; signups from these email domains auto-join
// the org (RLS scopes reads to the caller's org, writes to its admins).
export async function fetchOrgEmailDomains(): Promise<OrgEmailDomain[]> {
  const { data, error } = await supabase
    .from('org_email_domains')
    .select('domain, created_at')
    .order('domain');
  if (error) {
    if (/org_email_domains|schema cache|does not exist/i.test(error.message ?? '')) return [];
    throw dbError(error);
  }
  return (data ?? []).map(row => ({
    domain: row.domain as string,
    createdAt: row.created_at as string,
  }));
}

export async function addOrgEmailDomain(input: string, actorId?: string | null): Promise<string> {
  const result = validateCompanyDomain(input);
  if ('error' in result) throw new Error(result.error);

  // org_id is stamped by the set_org_id BEFORE INSERT trigger, so it is omitted
  // here on purpose; the generated Insert type can't see the trigger.
  const { error } = await supabase
    .from('org_email_domains')
    .insert({ domain: result.domain } as Database['public']['Tables']['org_email_domains']['Insert']);
  if (error) {
    if (/duplicate key|already exists/i.test(error.message ?? '')) {
      throw new Error(`${result.domain} is already registered — a domain can only belong to one workspace.`);
    }
    throw dbError(error);
  }

  await insertAuditEvent({
    actorId: actorId ?? null,
    eventType: 'org_email_domain_added',
    entityType: 'org_email_domain',
    entityId: result.domain,
    metadata: { domain: result.domain },
  });
  return result.domain;
}

export async function removeOrgEmailDomain(domain: string, actorId?: string | null): Promise<void> {
  const { error } = await supabase.from('org_email_domains').delete().eq('domain', domain);
  if (error) throw dbError(error);

  await insertAuditEvent({
    actorId: actorId ?? null,
    eventType: 'org_email_domain_removed',
    entityType: 'org_email_domain',
    entityId: domain,
    metadata: { domain },
  });
}

// Anonymous pre-signup check: is this email's domain registered to a company
// workspace? Fails open when the migration hasn't been applied yet so signup
// keeps working against older databases.
export async function emailDomainHasWorkspace(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('email_domain_has_workspace', { p_email: email });
  if (error) {
    if (/email_domain_has_workspace|schema cache|does not exist/i.test(error.message ?? '')) return true;
    throw dbError(error);
  }
  return Boolean(data);
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
      metadata: fromJson<Record<string, unknown>>(row.metadata) ?? {},
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
    projectId: (row.project_id as string) ?? null,
    instrumentalSampleId: (row.instrumental_sample_id as string) ?? null,
    parentDecisionId: (row.parent_decision_id as string) ?? null,
    formulationVersionId: (row.formulation_version_id as string) ?? null,
    evidenceBundleId: (row.evidence_bundle_id as string) ?? null,
    researchRefreshedAt: (row.research_refreshed_at as string) ?? null,
    researchFingerprint: (row.research_fingerprint as string) ?? null,
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
  projectId?: string | null;
  instrumentalSampleId?: string | null;
  /** ID of the TWEAK/STOP decision that triggered the retest leading to this one. */
  parentDecisionId?: string | null;
  formulationVersionId?: string | null;
  evidenceBundleId?: string | null;
}): Promise<string | null> {
  const { data, error } = await supabase.from('decision_records').insert({
    sample_id: input.sampleId,
    sample_name: input.sampleName,
    decision: input.decision,
    issf_score: input.issfScore,
    confidence: input.confidence,
    note: input.note,
    method_version: input.methodVersion,
    decision_fingerprint: input.decisionFingerprint,
    created_by: input.createdBy,
    project_id: input.projectId ?? null,
    instrumental_sample_id: input.instrumentalSampleId ?? null,
    parent_decision_id: input.parentDecisionId ?? null,
    formulation_version_id: input.formulationVersionId ?? null,
    evidence_bundle_id: input.evidenceBundleId ?? null,
  }).select('id').single();
  if (error) throw dbError(error);
  return (data as { id: string } | null)?.id ?? null;
}
