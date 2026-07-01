import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchProducts, fetchActiveProducts, fetchTemplates,
  fetchPanelists, fetchPanelistReliability,
  fetchAllResponses, fetchUserResponses,
  fetchConceptTestsForPanelist, fetchUserConceptResponses,
  fetchConceptTestsForAdmin, fetchConceptTestsForStudyDashboard, fetchConceptResponsesForTest,
  fetchConceptResponseCounts,
  fetchCommercializationReports, createCommercializationReport, updateCommercializationReportStatus,
  fetchEvidenceBundles, saveEvidenceBundle, generateReportNarrative, type ReportNarrativeRequest,
  fetchConceptTest, fetchConceptGenerationSettings, updateConceptGenerationSettings,
  fetchConceptImageGenerations, fetchConceptProjectSummaries, fetchConceptLabDiagnostics,
  fetchFoodTypes, fetchInstrumentalDataset, fetchImportBatches,
  fetchProjects, createProject, renameProject, assignBatchToProject,
  fetchWorkspaceSettings, updateWorkspaceSettings, fetchAuditEvents,
  fetchDecisionRecords,
  fetchPanelistKits, fetchPanelistKitInvite, fetchPanelistKitInviteByManualCode, generatePanelistKits,
  claimPanelistKit, markPanelistKitStarted, markPanelistKitSubmitted,
  updatePanelistKitFulfillment, reportPanelistKitIssue, recordPanelistKitReminder,
  voidPanelistKit, createReplacementPanelistKit, fetchPanelistKitEvents,
  fetchAdminAccessRequests, fetchMyAdminAccessRequest, requestAdminAccess, resolveAdminAccessRequest,
  fetchPublicWorkspaceConfig,
  fetchOrgEmailDomains, addOrgEmailDomain, removeOrgEmailDomain,
  insertProduct, updateProduct, updateProductAssignments, deleteProduct,
  insertTemplate, deleteTemplate, updatePanelistId, updatePanelistTrainingLevel, updatePanelistStatus,
  insertConceptTest, updateConceptTestStatus, insertConceptResponse,
  insertInstrumentalImport, archiveFoodTypeRecord, restoreFoodTypeRecord, deleteFoodTypeRecord, updateImportBatchStatus, updateImportBatchName, deleteImportBatch,
  fetchPendingImports, dismissPendingImport, markPendingImportImported, uploadAndQueueImport,
  rejectPendingImport, listDriveFiles, importDriveFiles,
  type ConceptTest, type InstrumentalImportInput, type ConceptGenerationSettings,
  type WorkspaceSettings, type PanelistInfo,
  type CommercializationReportRecord,
  type EvidenceBundleRecord,
  type PendingImportRecord,
} from './database'
import type { TrainingLevel } from '../utils/panelist-metrics'
import type { Product } from './study-types'
import { getTenantSlug } from './tenant'
import { buildEvidenceBundle } from './report-evidence-source'

export const queryKeys = {
  pendingImports: ['pendingImports'] as const,
  driveFiles: ['driveFiles'] as const,
  products: ['products'] as const,
  panelistKits: (productId: string) => ['panelistKits', productId] as const,
  panelistKitInvite: (token: string) => ['panelistKitInvite', token] as const,
  panelistKitManualInvite: (code: string) => ['panelistKitManualInvite', code] as const,
  panelistKitEvents: (kitId: string) => ['panelistKitEvents', kitId] as const,
  adminAccessRequests: ['adminAccessRequests'] as const,
  myAdminAccessRequest: ['myAdminAccessRequest'] as const,
  activeProducts: ['activeProducts'] as const,
  templates: ['templates'] as const,
  panelists: ['panelists'] as const,
  panelistReliability: ['panelistReliability'] as const,
  allResponses: ['allResponses'] as const,
  userResponses: (userId: string) => ['userResponses', userId] as const,
  conceptTests: (userId: string) => ['conceptTests', userId] as const,
  conceptResponses: (userId: string) => ['conceptResponses', userId] as const,
  conceptTest: (id: string) => ['conceptTest', id] as const,
  adminConceptTests: ['adminConceptTests'] as const,
  studyConceptTests: ['studyConceptTests'] as const,
  conceptResponseCounts: ['conceptResponseCounts'] as const,
  conceptTestResponses: (id: string) => ['conceptTestResponses', id] as const,
  commercializationReports: ['commercializationReports'] as const,
  evidenceBundles: (projectId?: string) => ['evidenceBundles', projectId ?? 'all'] as const,
  projectEvidence: (projectId: string) => ['projectEvidence', projectId] as const,
  conceptGenerationSettings: ['conceptGenerationSettings'] as const,
  conceptImageGenerations: ['conceptImageGenerations'] as const,
  conceptProjects: ['conceptProjects'] as const,
  conceptLabDiagnostics: ['conceptLabDiagnostics'] as const,
  foodTypes: ['foodTypes'] as const,
  instrumentalDataset: ['instrumentalDataset'] as const,
  importBatches: ['importBatches'] as const,
  projects: ['projects'] as const,
  workspaceSettings: ['workspaceSettings'] as const,
  publicWorkspaceConfig: ['publicWorkspaceConfig'] as const,
  orgEmailDomains: ['orgEmailDomains'] as const,
  auditEvents: ['auditEvents'] as const,
  decisionRecords: ['decisionRecords'] as const,
}

export function useProducts() {
  return useQuery({ queryKey: queryKeys.products, queryFn: fetchProducts })
}

export function useActiveProducts() {
  return useQuery({ queryKey: queryKeys.activeProducts, queryFn: fetchActiveProducts })
}

export function usePanelistKits(productId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.panelistKits(productId ?? ''),
    queryFn: () => fetchPanelistKits(productId!),
    enabled: !!productId,
  })
}

export function useGeneratePanelistKits() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: generatePanelistKits,
    onSuccess: (_kits, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.panelistKits(input.productId) })
      qc.invalidateQueries({ queryKey: queryKeys.products })
      qc.invalidateQueries({ queryKey: queryKeys.activeProducts })
    },
  })
}

export function usePanelistKitInvite(token: string | undefined) {
  return useQuery({
    queryKey: queryKeys.panelistKitInvite(token ?? ''),
    queryFn: () => fetchPanelistKitInvite(token!),
    enabled: !!token,
    retry: false,
  })
}

export function usePanelistKitInviteByManualCode(code: string | undefined) {
  return useQuery({
    queryKey: queryKeys.panelistKitManualInvite(code ?? ''),
    queryFn: () => fetchPanelistKitInviteByManualCode(code!),
    enabled: !!code,
    retry: false,
  })
}

export function useClaimPanelistKit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: claimPanelistKit,
    onSuccess: (invite, input) => {
      if (input.token) qc.invalidateQueries({ queryKey: queryKeys.panelistKitInvite(input.token) })
      if (input.manualCode) qc.invalidateQueries({ queryKey: queryKeys.panelistKitManualInvite(input.manualCode) })
      qc.invalidateQueries({ queryKey: queryKeys.panelistKits(invite.productId) })
      qc.invalidateQueries({ queryKey: queryKeys.products })
      qc.invalidateQueries({ queryKey: queryKeys.activeProducts })
    },
  })
}

export function useMarkPanelistKitStarted() {
  return useMutation({ mutationFn: markPanelistKitStarted })
}

export function useMarkPanelistKitSubmitted() {
  return useMutation({ mutationFn: markPanelistKitSubmitted })
}

export function useUpdatePanelistKitFulfillment(productId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updatePanelistKitFulfillment,
    onSuccess: () => {
      if (productId) qc.invalidateQueries({ queryKey: queryKeys.panelistKits(productId) })
    },
  })
}

export function useReportPanelistKitIssue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: reportPanelistKitIssue,
    onSuccess: (_result, input) => {
      if (input.token) qc.invalidateQueries({ queryKey: queryKeys.panelistKitInvite(input.token) })
      if (input.manualCode) qc.invalidateQueries({ queryKey: queryKeys.panelistKitManualInvite(input.manualCode) })
    },
  })
}

export function useRecordPanelistKitReminder(productId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: recordPanelistKitReminder,
    onSuccess: () => {
      if (productId) qc.invalidateQueries({ queryKey: queryKeys.panelistKits(productId) })
    },
  })
}

export function useVoidPanelistKit(productId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: voidPanelistKit,
    onSuccess: () => {
      if (productId) qc.invalidateQueries({ queryKey: queryKeys.panelistKits(productId) })
    },
  })
}

export function useCreateReplacementPanelistKit(productId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createReplacementPanelistKit,
    onSuccess: () => {
      if (productId) qc.invalidateQueries({ queryKey: queryKeys.panelistKits(productId) })
    },
  })
}

export function usePanelistKitEvents(kitId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.panelistKitEvents(kitId ?? ''),
    queryFn: () => fetchPanelistKitEvents(kitId!),
    enabled: !!kitId,
  })
}

export function useTemplates() {
  return useQuery({ queryKey: queryKeys.templates, queryFn: fetchTemplates })
}

export function usePanelists() {
  return useQuery({ queryKey: queryKeys.panelists, queryFn: fetchPanelists })
}

export function usePanelistReliability() {
  return useQuery({ queryKey: queryKeys.panelistReliability, queryFn: fetchPanelistReliability })
}

export function useAllResponses() {
  return useQuery({
    queryKey: queryKeys.allResponses,
    queryFn: () => fetchAllResponses(),
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

export function useDecisionRecords() {
  return useQuery({ queryKey: queryKeys.decisionRecords, queryFn: () => fetchDecisionRecords(500) })
}

export function useUserResponses(userId: string) {
  return useQuery({
    queryKey: queryKeys.userResponses(userId),
    queryFn: () => fetchUserResponses(userId),
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

export function useConceptTestsForPanelist(userId: string) {
  return useQuery({
    queryKey: queryKeys.conceptTests(userId),
    queryFn: () => fetchConceptTestsForPanelist(userId),
    enabled: !!userId,
  })
}

export function useConceptResponses(userId: string) {
  return useQuery({
    queryKey: queryKeys.conceptResponses(userId),
    queryFn: () => fetchUserConceptResponses(userId),
    enabled: !!userId,
  })
}

export function useConceptTest(conceptId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.conceptTest(conceptId ?? ''),
    queryFn: () => fetchConceptTest(conceptId!),
    enabled: !!conceptId,
  })
}

export function useAdminConceptTests() {
  return useQuery({ queryKey: queryKeys.adminConceptTests, queryFn: fetchConceptTestsForAdmin })
}

export function useStudyConceptTests() {
  return useQuery({ queryKey: queryKeys.studyConceptTests, queryFn: fetchConceptTestsForStudyDashboard })
}

export function useConceptResponseCounts() {
  return useQuery({ queryKey: queryKeys.conceptResponseCounts, queryFn: fetchConceptResponseCounts })
}

export function useConceptTestResponses(conceptId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.conceptTestResponses(conceptId ?? ''),
    queryFn: () => fetchConceptResponsesForTest(conceptId!),
    enabled: !!conceptId,
  })
}

export function useCommercializationReports() {
  return useQuery({ queryKey: queryKeys.commercializationReports, queryFn: fetchCommercializationReports })
}

export function useEvidenceBundles(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.evidenceBundles(projectId),
    queryFn: () => fetchEvidenceBundles(projectId),
  })
}

export function useCreateCommercializationReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCommercializationReport,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.commercializationReports }),
  })
}

export function useSaveEvidenceBundle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { projectId: string; schemaVersion: string; sourceDataVersion: string; payload: Record<string, unknown> }) =>
      saveEvidenceBundle(input),
    onSuccess: (bundle: EvidenceBundleRecord) => {
      qc.invalidateQueries({ queryKey: queryKeys.evidenceBundles(bundle.projectId) })
      qc.invalidateQueries({ queryKey: queryKeys.evidenceBundles() })
    },
  })
}

// Deterministic, in-memory evidence bundle for a project/sample key (not saved).
// Drives the report builder's "Data evidence" panel and the persisted payload.
export function useProjectEvidenceBundle(projectId: string | null | undefined, createdBy?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.projectEvidence(projectId ?? 'none'),
    queryFn: () => buildEvidenceBundle(projectId as string, createdBy),
    enabled: enabled && !!projectId,
    staleTime: 60_000,
  })
}

// Calls the evidence-constrained narrative Edge Function (OpenAI).
export function useGenerateReportNarrative() {
  return useMutation({
    mutationFn: (input: ReportNarrativeRequest) => generateReportNarrative(input),
  })
}

export function useUpdateCommercializationReportStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; status: CommercializationReportRecord['status']; actorId: string }) =>
      updateCommercializationReportStatus(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.commercializationReports }),
  })
}

export function useOrgEmailDomains() {
  return useQuery({ queryKey: queryKeys.orgEmailDomains, queryFn: fetchOrgEmailDomains })
}

export function useAdminAccessRequests(enabled = true) {
  return useQuery({ queryKey: queryKeys.adminAccessRequests, queryFn: fetchAdminAccessRequests, enabled })
}

export function useMyAdminAccessRequest(enabled = true) {
  return useQuery({ queryKey: queryKeys.myAdminAccessRequest, queryFn: fetchMyAdminAccessRequest, enabled })
}

export function useRequestAdminAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: requestAdminAccess,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.myAdminAccessRequest })
      qc.invalidateQueries({ queryKey: queryKeys.adminAccessRequests })
    },
  })
}

export function useResolveAdminAccessRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { requestId: string; decision: 'approved' | 'rejected'; note?: string }) =>
      resolveAdminAccessRequest(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminAccessRequests })
      qc.invalidateQueries({ queryKey: queryKeys.panelists })
    },
  })
}

export function useAddOrgEmailDomain() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { domain: string; actorId?: string | null }) =>
      addOrgEmailDomain(input.domain, input.actorId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.orgEmailDomains }),
  })
}

export function useRemoveOrgEmailDomain() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { domain: string; actorId?: string | null }) =>
      removeOrgEmailDomain(input.domain, input.actorId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.orgEmailDomains }),
  })
}

export function useConceptGenerationSettings(enabled = true) {
  return useQuery({
    queryKey: queryKeys.conceptGenerationSettings,
    queryFn: fetchConceptGenerationSettings,
    enabled,
  })
}

export function useConceptImageGenerations(enabled = true) {
  return useQuery({
    queryKey: queryKeys.conceptImageGenerations,
    queryFn: fetchConceptImageGenerations,
    enabled,
  })
}

export function useConceptProjectSummaries(enabled = true) {
  return useQuery({
    queryKey: queryKeys.conceptProjects,
    queryFn: fetchConceptProjectSummaries,
    enabled,
  })
}

export function useConceptLabDiagnostics(enabled = true) {
  return useQuery({
    queryKey: queryKeys.conceptLabDiagnostics,
    queryFn: fetchConceptLabDiagnostics,
    enabled,
  })
}

export function useFoodTypes(enabled = true) {
  return useQuery({
    queryKey: queryKeys.foodTypes,
    queryFn: fetchFoodTypes,
    enabled,
  })
}

export function useInstrumentalDataset(enabled = true) {
  return useQuery({
    queryKey: queryKeys.instrumentalDataset,
    queryFn: fetchInstrumentalDataset,
    enabled,
  })
}

export function useInsertProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: Omit<Product, 'id' | 'createdDate'>) => insertProduct(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.products })
      qc.invalidateQueries({ queryKey: queryKeys.activeProducts })
    },
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Omit<Product, 'id' | 'createdDate'>> }) =>
      updateProduct(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.products })
      qc.invalidateQueries({ queryKey: queryKeys.activeProducts })
    },
  })
}

export function useUpdateProductAssignments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productIds, assignedPanelistIds }: { productIds: string[]; assignedPanelistIds: string[] }) =>
      updateProductAssignments(productIds, assignedPanelistIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.products })
      qc.invalidateQueries({ queryKey: queryKeys.activeProducts })
    },
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.products })
      qc.invalidateQueries({ queryKey: queryKeys.activeProducts })
    },
  })
}

export function useInsertTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, attributes }: { name: string; attributes: string[] }) =>
      insertTemplate(name, attributes),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.templates }),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.templates }),
  })
}

export function useUpdatePanelistId() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, panelistId }: { userId: string; panelistId: string }) =>
      updatePanelistId(userId, panelistId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.panelists }),
  })
}

export function useUpdatePanelistTrainingLevel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, level }: { userId: string; level: TrainingLevel }) =>
      updatePanelistTrainingLevel(userId, level),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.panelists }),
  })
}

export function useUpdatePanelistStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, status, actorId }: { userId: string; status: PanelistInfo['status']; actorId?: string | null }) =>
      updatePanelistStatus(userId, status, actorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.panelists })
      qc.invalidateQueries({ queryKey: queryKeys.auditEvents })
    },
  })
}

export function useWorkspaceSettings() {
  return useQuery({ queryKey: queryKeys.workspaceSettings, queryFn: fetchWorkspaceSettings })
}

export function usePublicWorkspaceConfig() {
  const slug = getTenantSlug();
  return useQuery({
    queryKey: [...queryKeys.publicWorkspaceConfig, slug] as const,
    queryFn: () => fetchPublicWorkspaceConfig(slug ?? undefined),
  })
}

export function useUpdateWorkspaceSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ settings, actorId }: { settings: WorkspaceSettings; actorId?: string | null }) =>
      updateWorkspaceSettings(settings, actorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workspaceSettings })
      qc.invalidateQueries({ queryKey: queryKeys.publicWorkspaceConfig })
      qc.invalidateQueries({ queryKey: queryKeys.auditEvents })
    },
  })
}

export function useAuditEvents() {
  return useQuery({ queryKey: queryKeys.auditEvents, queryFn: () => fetchAuditEvents(80) })
}

export function useInsertConceptTest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (test: Omit<ConceptTest, 'id' | 'createdAt'>) => insertConceptTest(test),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conceptTests'] })
      qc.invalidateQueries({ queryKey: ['conceptTest'] })
    },
  })
}

export function useUpdateConceptTestStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ConceptTest['status'] }) =>
      updateConceptTestStatus(id, status),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.adminConceptTests }),
        qc.invalidateQueries({ queryKey: queryKeys.studyConceptTests }),
        qc.invalidateQueries({ queryKey: queryKeys.conceptResponseCounts }),
        qc.invalidateQueries({ queryKey: ['conceptTests'] }),
        qc.invalidateQueries({ queryKey: ['conceptTest'] }),
      ])
    },
  })
}

export function useUpdateConceptGenerationSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (updates: Partial<Omit<ConceptGenerationSettings, 'id'>>) =>
      updateConceptGenerationSettings(updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conceptGenerationSettings })
    },
  })
}

export function useInsertConceptResponse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, conceptTestId, answers }: {
      userId: string
      conceptTestId: string
      answers: Record<string, string | number | string[]>
    }) => insertConceptResponse(userId, conceptTestId, answers),
    onSuccess: (_data, { userId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.conceptResponses(userId) })
      qc.invalidateQueries({ queryKey: queryKeys.conceptTests(userId) })
    },
  })
}

export function useInsertInstrumentalImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InstrumentalImportInput) => insertInstrumentalImport(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.foodTypes })
      qc.invalidateQueries({ queryKey: queryKeys.instrumentalDataset })
      qc.invalidateQueries({ queryKey: queryKeys.importBatches })
    },
  })
}

export function useArchiveFoodType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => archiveFoodTypeRecord(slug),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.foodTypes }),
        qc.invalidateQueries({ queryKey: queryKeys.instrumentalDataset }),
        qc.invalidateQueries({ queryKey: queryKeys.importBatches }),
        qc.invalidateQueries({ queryKey: queryKeys.products }),
        qc.invalidateQueries({ queryKey: queryKeys.activeProducts }),
      ])
    },
  })
}

export function useRestoreFoodType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => restoreFoodTypeRecord(slug),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.foodTypes }),
        qc.invalidateQueries({ queryKey: queryKeys.instrumentalDataset }),
        qc.invalidateQueries({ queryKey: queryKeys.importBatches }),
        qc.invalidateQueries({ queryKey: queryKeys.products }),
        qc.invalidateQueries({ queryKey: queryKeys.activeProducts }),
      ])
    },
  })
}

export function useDeleteFoodType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => deleteFoodTypeRecord(slug),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.foodTypes }),
        qc.invalidateQueries({ queryKey: queryKeys.instrumentalDataset }),
        qc.invalidateQueries({ queryKey: queryKeys.importBatches }),
        qc.invalidateQueries({ queryKey: queryKeys.products }),
        qc.invalidateQueries({ queryKey: queryKeys.activeProducts }),
      ])
    },
  })
}

export function useUpdateImportBatchStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'archived' | 'deleted' }) =>
      updateImportBatchStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.importBatches })
      qc.invalidateQueries({ queryKey: queryKeys.instrumentalDataset })
      qc.invalidateQueries({ queryKey: queryKeys.products })
      qc.invalidateQueries({ queryKey: queryKeys.activeProducts })
    },
  })
}

export function useUpdateImportBatchName() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateImportBatchName(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.importBatches })
    },
  })
}

export function useDeleteImportBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteImportBatch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.importBatches })
      qc.invalidateQueries({ queryKey: queryKeys.instrumentalDataset })
      qc.invalidateQueries({ queryKey: queryKeys.products })
      qc.invalidateQueries({ queryKey: queryKeys.activeProducts })
    },
  })
}

export function useProjects(enabled = true) {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: fetchProjects,
    enabled,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, foodTypeId }: { name: string; foodTypeId: string }) =>
      createProject(name, foodTypeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects })
    },
  })
}

export function useRenameProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameProject(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects })
      qc.invalidateQueries({ queryKey: queryKeys.importBatches })
    },
  })
}

export function useAssignBatchToProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ batchId, projectId }: { batchId: string; projectId: string | null }) =>
      assignBatchToProject(batchId, projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.importBatches })
      qc.invalidateQueries({ queryKey: queryKeys.projects })
    },
  })
}

export function usePendingImports(enabled = true) {
  return useQuery({
    queryKey: queryKeys.pendingImports,
    queryFn: fetchPendingImports,
    enabled,
    refetchInterval: 30_000,
  })
}

export function useUploadAndQueueImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, userId }: { file: File; userId: string }) =>
      uploadAndQueueImport(file, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pendingImports }),
  })
}

export function useDismissPendingImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => dismissPendingImport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pendingImports }),
  })
}

export function useMarkPendingImportImported() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markPendingImportImported(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pendingImports })
      qc.invalidateQueries({ queryKey: queryKeys.importBatches })
    },
  })
}

export function useRejectPendingImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectPendingImport(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pendingImports }),
  })
}

// Lists supported files in the connected Drive folder. Manual-fetch only (no polling) —
// the modal triggers it on open via `enabled`.
export function useDriveFiles(enabled = false) {
  return useQuery({
    queryKey: queryKeys.driveFiles,
    queryFn: listDriveFiles,
    enabled,
    refetchOnWindowFocus: false,
    staleTime: 0,
  })
}

export function useImportDriveFiles() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fileIds: string[]) => importDriveFiles(fileIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pendingImports })
      qc.invalidateQueries({ queryKey: queryKeys.driveFiles })
    },
  })
}

// Re-export type so consumers don't need a second import
export type { PendingImportRecord }

export function useImportBatches(enabled = true) {
  return useQuery({
    queryKey: queryKeys.importBatches,
    queryFn: fetchImportBatches,
    enabled,
    // Status changes (delete/restore/archive) must always be reflected immediately —
    // a 5-minute staleTime previously let the dashboard and Configure disagree on
    // which batches were active.
    refetchOnMount: 'always',
  })
}
