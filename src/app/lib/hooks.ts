import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchProducts, fetchActiveProducts, fetchTemplates,
  fetchPanelists, fetchPanelistReliability, invitePanelistAccount,
  fetchAllResponses, fetchResponseCountsByProduct, fetchResponsesForProducts, fetchUserResponses,
  fetchConceptTestsForPanelist, fetchUserConceptResponses,
  fetchConceptTestsForAdmin, fetchConceptTestsForStudyDashboard, fetchConceptResponsesForTest,
  fetchConceptResponseCounts,
  fetchCommercializationReports, createCommercializationReport, updateCommercializationReportStatus,
  fetchEvidenceBundles, saveEvidenceBundle, generateReportNarrative, type ReportNarrativeRequest,
  fetchConceptTest, fetchConceptGenerationSettings, updateConceptGenerationSettings,
  fetchConceptImageUsage,
  fetchConceptImageGenerations, fetchConceptProjectSummaries, fetchConceptLabDiagnostics,
  fetchFoodTypes, fetchInstrumentalDataset, fetchFormulationVersions, fetchImportBatches,
  fetchProjects, createProject, renameProject, assignBatchToProject,
  fetchWorkspaceSettings, updateWorkspaceSettings, fetchAuditEvents,
  fetchIsPlatformOperator, provisionPlatformOrganization,
  fetchWorkspaceOperationalHealth, fetchPrototypeLineageIssues,
  adoptConceptImageAsBrandKit, clearConceptBrandKit,
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
  insertInstrumentalImport, archiveFoodTypeRecord, restoreFoodTypeRecord, deleteFoodTypeRecord, updateImportBatchStatus, updateImportBatchName, deleteImportBatch, updateIngredientStatement, reviewFormulationVersion,
  fetchPendingImports, dismissPendingImport, markPendingImportImported, uploadAndQueueImport,
  rejectPendingImport, listDriveFiles, importDriveFiles,
  type ConceptTest, type InstrumentalImportInput, type ConceptGenerationSettings,
  type WorkspaceSettings, type PanelistInfo,
  type PlatformOrganizationInput,
  type CommercializationReportRecord,
  type EvidenceBundleRecord,
  type PendingImportRecord,
  fetchFormulationExperiments, createFormulationExperiment, updateFormulationExperimentDraft,
  fetchApprovedFormulationLearnings,
  addFormulationExperimentArm, deleteFormulationExperimentArm, lockFormulationExperiment,
  advanceFormulationExperiment, recordFormulationEvaluation, fetchDecisionFreshness,
  markDecisionResearchRefreshed, saveFormulationExperimentLearning,
} from './database'
import type { TrainingLevel } from '../utils/panelist-metrics'
import type { Product } from './study-types'
import { fetchLiteratureImports, uploadLiteratureBatch } from './literature-imports'
import { getTenantSlug } from './tenant'
import { buildEvidenceBundle } from './report-evidence-source'
import {
  fetchRagStatus,
  fetchTweakDiagnosis,
  tweakDiagnosisCacheKey,
  type TweakDiagnosisRequest,
} from './tweak-intelligence'
import {
  fetchLibraryDocuments,
  fetchLibraryStatus,
  ingestLibrary,
  reviewLibraryDocuments,
  reviewLibraryDocument,
  scanLibrary,
  type LibraryDocumentReview,
  type LibraryBulkReview,
  type LibraryRequest,
} from './nfi-library'

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
  responseCountsByProduct: ['responseCountsByProduct'] as const,
  responsesForProducts: (productIds: readonly string[]) => ['responsesForProducts', ...productIds] as const,
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
  conceptImageUsage: ['conceptImageUsage'] as const,
  conceptImageGenerations: ['conceptImageGenerations'] as const,
  conceptProjects: ['conceptProjects'] as const,
  conceptLabDiagnostics: ['conceptLabDiagnostics'] as const,
  foodTypes: ['foodTypes'] as const,
  instrumentalDataset: ['instrumentalDataset'] as const,
  formulationVersions: (projectId?: string) => ['formulationVersions', projectId ?? 'all'] as const,
  formulationExperiments: (projectId: string) => ['formulationExperiments', projectId] as const,
  approvedFormulationLearnings: ['approvedFormulationLearnings'] as const,
  decisionFreshness: (decisionRecordId: string) => ['decisionFreshness', decisionRecordId] as const,
  importBatches: ['importBatches'] as const,
  projects: ['projects'] as const,
  workspaceSettings: ['workspaceSettings'] as const,
  workspaceOperationalHealth: ['workspaceOperationalHealth'] as const,
  prototypeLineageIssues: ['prototypeLineageIssues'] as const,
  platformOperator: ['platformOperator'] as const,
  publicWorkspaceConfig: ['publicWorkspaceConfig'] as const,
  orgEmailDomains: ['orgEmailDomains'] as const,
  auditEvents: ['auditEvents'] as const,
  decisionRecords: ['decisionRecords'] as const,
  ragStatus: ['ragStatus'] as const,
  libraryStatus: ['libraryStatus'] as const,
  libraryDocuments: ['libraryDocuments'] as const,
  literatureImports: ['literatureImports'] as const,
  tweakDiagnoses: ['tweakDiagnosis'] as const,
  tweakDiagnosis: (request: TweakDiagnosisRequest) => ['tweakDiagnosis', tweakDiagnosisCacheKey(request)] as const,
}

// A diagnosis is immutable for its evidence fingerprint. New responses,
// thresholds, or measurements produce a new key; this window keeps a warmed
// result fresh for the rest of a normal working session.
export const TWEAK_DIAGNOSIS_STALE_TIME_MS = 6 * 60 * 60 * 1000
export const TWEAK_DIAGNOSIS_GC_TIME_MS = 12 * 60 * 60 * 1000

export function tweakDiagnosisQueryOptions(request: TweakDiagnosisRequest) {
  return {
    queryKey: queryKeys.tweakDiagnosis(request),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchTweakDiagnosis(request, signal),
    retry: false,
    staleTime: TWEAK_DIAGNOSIS_STALE_TIME_MS,
    gcTime: TWEAK_DIAGNOSIS_GC_TIME_MS,
    refetchOnMount: true,
    refetchOnReconnect: true,
  }
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

export function useInvitePanelist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ email, redirectTo }: { email: string; redirectTo: string }) => invitePanelistAccount(email, redirectTo),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.panelists }),
  })
}

export function usePanelistReliability() {
  return useQuery({ queryKey: queryKeys.panelistReliability, queryFn: fetchPanelistReliability })
}

export function useAllResponses() {
  return useQuery({
    queryKey: queryKeys.allResponses,
    queryFn: () => fetchAllResponses(),
    // Responses must stay fresh for decisions, but remounting adjacent
    // workflow screens should not repeatedly download the same large payload.
    staleTime: 15_000,
    refetchOnMount: true,
  })
}

export function useResponseCountsByProduct() {
  return useQuery({
    queryKey: queryKeys.responseCountsByProduct,
    queryFn: fetchResponseCountsByProduct,
    staleTime: 15_000,
    refetchInterval: 60_000,
  })
}

export function useResponsesForProducts(productIds: readonly string[]) {
  const stableProductIds = [...productIds].sort();
  return useQuery({
    queryKey: queryKeys.responsesForProducts(stableProductIds),
    queryFn: () => fetchResponsesForProducts(stableProductIds),
    enabled: stableProductIds.length > 0,
    staleTime: 15_000,
  })
}

export function useDecisionRecords() {
  return useQuery({ queryKey: queryKeys.decisionRecords, queryFn: () => fetchDecisionRecords(500) })
}

export function useRagStatus() {
  return useQuery({
    queryKey: queryKeys.ragStatus,
    queryFn: fetchRagStatus,
    retry: false,
    staleTime: 30_000,
  })
}

export function useLibraryStatus() {
  return useQuery({
    queryKey: queryKeys.libraryStatus,
    queryFn: fetchLibraryStatus,
    retry: false,
    staleTime: 30_000,
  })
}

export function useLibraryDocuments() {
  return useQuery({
    queryKey: queryKeys.libraryDocuments,
    queryFn: fetchLibraryDocuments,
    retry: false,
    staleTime: 30_000,
  })
}

export function useScanLibrary() {
  return useMutation({ mutationFn: (request?: LibraryRequest) => scanLibrary(request) })
}

export function useIngestLibrary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (request?: LibraryRequest) => ingestLibrary(request),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.libraryStatus })
      qc.invalidateQueries({ queryKey: queryKeys.libraryDocuments })
      qc.invalidateQueries({ queryKey: queryKeys.ragStatus })
      qc.invalidateQueries({ queryKey: queryKeys.tweakDiagnoses })
    },
  })
}

export function useReviewLibraryDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (review: LibraryDocumentReview) => reviewLibraryDocument(review),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.libraryDocuments })
      qc.invalidateQueries({ queryKey: queryKeys.libraryStatus })
      qc.invalidateQueries({ queryKey: queryKeys.tweakDiagnoses })
    },
  })
}

export function useReviewLibraryDocuments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (review: LibraryBulkReview) => reviewLibraryDocuments(review),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.libraryDocuments })
      qc.invalidateQueries({ queryKey: queryKeys.libraryStatus })
      qc.invalidateQueries({ queryKey: queryKeys.tweakDiagnoses })
    },
  })
}

export function useLiteratureImports() {
  return useQuery({ queryKey: queryKeys.literatureImports, queryFn: fetchLiteratureImports, staleTime: 10_000 })
}

export function useUploadLiterature() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => uploadLiteratureBatch(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.literatureImports })
      qc.invalidateQueries({ queryKey: queryKeys.libraryDocuments })
      qc.invalidateQueries({ queryKey: queryKeys.libraryStatus })
      qc.invalidateQueries({ queryKey: queryKeys.ragStatus })
    },
  })
}

export function useTweakDiagnosis(request: TweakDiagnosisRequest | null) {
  const options = request ? tweakDiagnosisQueryOptions(request) : null
  return useQuery({
    queryKey: options?.queryKey ?? ['tweakDiagnosis', 'disabled'],
    queryFn: options?.queryFn ?? (() => Promise.reject(new Error('Tweak diagnosis request is not ready.'))),
    enabled: Boolean(request),
    retry: options?.retry ?? false,
    staleTime: options?.staleTime ?? TWEAK_DIAGNOSIS_STALE_TIME_MS,
    gcTime: options?.gcTime ?? TWEAK_DIAGNOSIS_GC_TIME_MS,
    refetchOnMount: options?.refetchOnMount ?? true,
    refetchOnReconnect: options?.refetchOnReconnect ?? true,
  })
}

/**
 * On-demand LLM narrative generation. Kept out of useTweakDiagnosis's default
 * (deterministic_only) load deliberately: the local Ollama pass can take
 * 15-45s and is sometimes rejected by the RAG service's own anti-hallucination
 * gate, so it must be an explicit user action rather than block every panel load.
 */
export function useTweakNarrative() {
  return useMutation({
    mutationFn: (request: TweakDiagnosisRequest) =>
      fetchTweakDiagnosis({ ...request, options: { ...request.options, reportMode: 'ollama_report_writer' } }),
  })
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
    mutationFn: (input: {
      projectId: string
      canonicalProjectId?: string | null
      decisionRecordId?: string | null
      formulationVersionId?: string | null
      schemaVersion: string
      sourceDataVersion: string
      payload: Record<string, unknown>
    }) =>
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

// Calls the local Food RAG report writer. The backend uses Ollama when it is
// available and deterministic local writing when it is not.
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

/** Powers the "concept image credits" usage bar. Refetches after any
 *  generation/refine call so the bar reflects spend immediately. */
export function useConceptImageUsage(enabled = true) {
  return useQuery({
    queryKey: queryKeys.conceptImageUsage,
    queryFn: fetchConceptImageUsage,
    enabled,
    staleTime: 15_000,
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

export function useFormulationVersions(projectId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.formulationVersions(projectId),
    queryFn: () => fetchFormulationVersions(projectId),
    enabled,
  })
}

export function useFormulationExperiments(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.formulationExperiments(projectId ?? 'none'),
    queryFn: () => fetchFormulationExperiments(projectId!),
    enabled: Boolean(projectId),
  })
}

export function useApprovedFormulationLearnings(enabled = true) {
  return useQuery({
    queryKey: queryKeys.approvedFormulationLearnings,
    queryFn: fetchApprovedFormulationLearnings,
    enabled,
    staleTime: 15 * 60 * 1000,
  })
}

export function useCreateFormulationExperiment(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createFormulationExperiment,
    onSuccess: () => {
      if (projectId) qc.invalidateQueries({ queryKey: queryKeys.formulationExperiments(projectId) })
    },
  })
}

export function useUpdateFormulationExperimentDraft(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateFormulationExperimentDraft,
    onSuccess: () => {
      if (projectId) qc.invalidateQueries({ queryKey: queryKeys.formulationExperiments(projectId) })
    },
  })
}

export function useAddFormulationExperimentArm(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: addFormulationExperimentArm,
    onSuccess: () => {
      if (projectId) qc.invalidateQueries({ queryKey: queryKeys.formulationExperiments(projectId) })
    },
  })
}

export function useDeleteFormulationExperimentArm(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteFormulationExperimentArm,
    onSuccess: () => {
      if (projectId) qc.invalidateQueries({ queryKey: queryKeys.formulationExperiments(projectId) })
    },
  })
}

export function useLockFormulationExperiment(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: lockFormulationExperiment,
    onSuccess: () => {
      if (projectId) qc.invalidateQueries({ queryKey: queryKeys.formulationExperiments(projectId) })
    },
  })
}

export function useAdvanceFormulationExperiment(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: advanceFormulationExperiment,
    onSuccess: () => {
      if (projectId) qc.invalidateQueries({ queryKey: queryKeys.formulationExperiments(projectId) })
    },
  })
}

export function useRecordFormulationEvaluation(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: recordFormulationEvaluation,
    onSuccess: () => {
      if (projectId) qc.invalidateQueries({ queryKey: queryKeys.formulationExperiments(projectId) })
    },
  })
}

export function useSaveFormulationExperimentLearning(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveFormulationExperimentLearning,
    onSuccess: () => {
      if (projectId) qc.invalidateQueries({ queryKey: queryKeys.formulationExperiments(projectId) })
    },
  })
}

export function useDecisionFreshness(decisionRecordId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.decisionFreshness(decisionRecordId ?? 'none'),
    queryFn: () => fetchDecisionFreshness(decisionRecordId!),
    enabled: Boolean(decisionRecordId),
  })
}

export function useMarkDecisionResearchRefreshed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markDecisionResearchRefreshed,
    onSuccess: (_result, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.decisionFreshness(input.decisionRecordId) })
      qc.invalidateQueries({ queryKey: queryKeys.decisionRecords })
    },
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

export function usePlatformOperator(enabled = true) {
  return useQuery({
    queryKey: queryKeys.platformOperator,
    queryFn: fetchIsPlatformOperator,
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

export function useProvisionPlatformOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PlatformOrganizationInput) => provisionPlatformOrganization(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.auditEvents })
    },
  })
}

export function useWorkspaceOperationalHealth(enabled = true) {
  return useQuery({
    queryKey: queryKeys.workspaceOperationalHealth,
    queryFn: fetchWorkspaceOperationalHealth,
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function usePrototypeLineageIssues(enabled = true) {
  return useQuery({
    queryKey: queryKeys.prototypeLineageIssues,
    queryFn: fetchPrototypeLineageIssues,
    enabled,
  })
}

export function usePublicWorkspaceConfig() {
  const slug = getTenantSlug();
  return useQuery({
    queryKey: [...queryKeys.publicWorkspaceConfig, slug] as const,
    queryFn: () => fetchPublicWorkspaceConfig(slug ?? undefined),
    staleTime: 30 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
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

/** Adopt an approved concept image as the org's concept brand kit. */
export function useAdoptBrandKit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { imageId: string; sourceConceptName: string; brandDescriptor?: string; actorId?: string | null }) =>
      adoptConceptImageAsBrandKit(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workspaceSettings })
      qc.invalidateQueries({ queryKey: queryKeys.auditEvents })
    },
  })
}

export function useClearBrandKit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (actorId?: string | null) => clearConceptBrandKit(actorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workspaceSettings })
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

export function useUpdateIngredientStatement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateIngredientStatement,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.instrumentalDataset })
      qc.invalidateQueries({ queryKey: ['formulationVersions'] })
    },
  })
}

export function useReviewFormulationVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: reviewFormulationVersion,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.instrumentalDataset })
      qc.invalidateQueries({ queryKey: ['formulationVersions'] })
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

export function usePendingImports(
  enabled = true,
  options: { pollIntervalMs?: number | false } = {},
) {
  return useQuery({
    queryKey: queryKeys.pendingImports,
    queryFn: fetchPendingImports,
    enabled,
    refetchInterval: options.pollIntervalMs ?? 30_000,
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
