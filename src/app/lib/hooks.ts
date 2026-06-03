import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchProducts, fetchActiveProducts, fetchTemplates,
  fetchPanelists, fetchPanelistReliability,
  fetchAllResponses, fetchUserResponses,
  fetchConceptTestsForPanelist, fetchUserConceptResponses,
  fetchConceptTest,
  insertProduct, updateProduct,
  insertTemplate, deleteTemplate, updatePanelistId, updatePanelistTrainingLevel,
  insertConceptTest, insertConceptResponse,
  type Template, type ConceptTest,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.panelists }),
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
