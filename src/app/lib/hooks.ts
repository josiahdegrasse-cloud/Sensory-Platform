import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchProducts, fetchActiveProducts, fetchTemplates,
  fetchPanelists, fetchPanelistReliability,
  fetchAllResponses, fetchUserResponses,
  fetchConceptTestsForPanelist, fetchUserConceptResponses,
  fetchConceptTest, fetchConceptGenerationSettings, updateConceptGenerationSettings,
  fetchConceptImageGenerations, fetchConceptProjectSummaries, fetchConceptLabDiagnostics,
  fetchFoodTypes, fetchInstrumentalDataset, fetchImportBatches,
  insertProduct, updateProduct, deleteProduct,
  insertTemplate, deleteTemplate, updatePanelistId, updatePanelistTrainingLevel,
  insertConceptTest, insertConceptResponse,
  insertInstrumentalImport, archiveFoodTypeRecord, restoreFoodTypeRecord, deleteFoodTypeRecord,
  type Template, type ConceptTest, type InstrumentalImportInput, type ConceptGenerationSettings,
} from './database'
import type { TrainingLevel } from '../utils/panelist-metrics'
import type { Product } from '../data/mock-users'

export const queryKeys = {
  products: ['products'] as const,
  activeProducts: ['activeProducts'] as const,
  templates: ['templates'] as const,
  panelists: ['panelists'] as const,
  panelistReliability: ['panelistReliability'] as const,
  allResponses: ['allResponses'] as const,
  userResponses: (userId: string) => ['userResponses', userId] as const,
  conceptTests: (userId: string) => ['conceptTests', userId] as const,
  conceptResponses: (userId: string) => ['conceptResponses', userId] as const,
  conceptTest: (id: string) => ['conceptTest', id] as const,
  conceptGenerationSettings: ['conceptGenerationSettings'] as const,
  conceptImageGenerations: ['conceptImageGenerations'] as const,
  conceptProjects: ['conceptProjects'] as const,
  conceptLabDiagnostics: ['conceptLabDiagnostics'] as const,
  foodTypes: ['foodTypes'] as const,
  instrumentalDataset: ['instrumentalDataset'] as const,
  importBatches: ['importBatches'] as const,
}

export function useProducts() {
  return useQuery({ queryKey: queryKeys.products, queryFn: fetchProducts })
}

export function useActiveProducts() {
  return useQuery({ queryKey: queryKeys.activeProducts, queryFn: fetchActiveProducts })
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
  return useQuery({ queryKey: queryKeys.allResponses, queryFn: fetchAllResponses })
}

export function useUserResponses(userId: string) {
  return useQuery({
    queryKey: queryKeys.userResponses(userId),
    queryFn: () => fetchUserResponses(userId),
    enabled: !!userId,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.foodTypes })
      qc.invalidateQueries({ queryKey: queryKeys.instrumentalDataset })
      qc.invalidateQueries({ queryKey: queryKeys.importBatches })
    },
  })
}

export function useRestoreFoodType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => restoreFoodTypeRecord(slug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.foodTypes })
      qc.invalidateQueries({ queryKey: queryKeys.instrumentalDataset })
      qc.invalidateQueries({ queryKey: queryKeys.importBatches })
    },
  })
}

export function useDeleteFoodType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => deleteFoodTypeRecord(slug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.foodTypes })
      qc.invalidateQueries({ queryKey: queryKeys.instrumentalDataset })
      qc.invalidateQueries({ queryKey: queryKeys.importBatches })
    },
  })
}

export function useImportBatches(enabled = true) {
  return useQuery({
    queryKey: queryKeys.importBatches,
    queryFn: fetchImportBatches,
    enabled,
  })
}
