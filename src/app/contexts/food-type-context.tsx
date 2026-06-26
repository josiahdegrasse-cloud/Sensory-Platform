import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useAuth } from './auth-context';
import { detectFoodType, slugifyFoodType } from '../lib/food-intelligence';
import { useArchiveFoodType, useDeleteFoodType, useFoodTypes, useRestoreFoodType } from '../lib/hooks';

export type FoodType = string;
type FoodTypeStatus = 'active' | 'archived' | 'deleted';

// Persisted selection (food type + subCategory) so the current project/batch
// survives a reload instead of resetting to 'cheese' every time (discovery §C5).
// The /project/:batchId route remains the source of truth — it writes into the
// context, the context persists; nothing reads this back to drive the route, so
// there is no update loop.
const SELECTION_STORAGE_KEY = 'sensory.foodTypeSelection';

function readPersistedSelection(): { foodType: FoodType; subCategory: string | null } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SELECTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { foodType?: string; subCategory?: string | null };
    if (!parsed.foodType) return null;
    return { foodType: parsed.foodType, subCategory: parsed.subCategory ?? null };
  } catch {
    return null;
  }
}
interface LocalFoodTypeRecord {
  type: string;
  status: FoodTypeStatus;
}

export function mergeFoodTypeRecords(
  databaseRecords: LocalFoodTypeRecord[],
  localRecords: LocalFoodTypeRecord[],
): LocalFoodTypeRecord[] {
  const recordsByType = new Map<string, LocalFoodTypeRecord>();
  databaseRecords.forEach(record => recordsByType.set(record.type, record));
  localRecords.forEach(record => recordsByType.set(record.type, record));
  return [...recordsByType.values()].sort((a, b) => a.type.localeCompare(b.type));
}

export function registerActiveFoodTypes(
  records: LocalFoodTypeRecord[],
  types: string[],
): LocalFoodTypeRecord[] {
  const recordsByType = new Map(records.map(record => [record.type, record]));
  types.map(slugifyFoodType).forEach(type => {
    recordsByType.set(type, { type, status: 'active' });
  });
  return [...recordsByType.values()].sort((a, b) => a.type.localeCompare(b.type));
}

interface FoodTypeContextValue {
  foodType: FoodType;
  subCategory: string | null;
  setSelection: (foodType: FoodType, subCategory?: string | null) => void;
  extraFoodTypes: string[];
  archivedFoodTypes: string[];
  deletedFoodTypes: string[];
  registerFoodTypes: (types: string[]) => void;
  archiveFoodType: (type: string) => void;
  restoreFoodType: (type: string) => void;
  deleteFoodType: (type: string) => void;
  clearExtraFoodTypes: () => void;
  actionError: string;
  clearActionError: () => void;
}

const FoodTypeContext = createContext<FoodTypeContextValue>({
  foodType: 'cheese',
  subCategory: null,
  setSelection: () => {},
  extraFoodTypes: [],
  archivedFoodTypes: [],
  deletedFoodTypes: [],
  registerFoodTypes: () => {},
  archiveFoodType: () => {},
  restoreFoodType: () => {},
  deleteFoodType: () => {},
  clearExtraFoodTypes: () => {},
  actionError: '',
  clearActionError: () => {},
});

export function FoodTypeProvider({ children }: { children: ReactNode }) {
  const persistedSelection = useMemo(() => readPersistedSelection(), []);
  const [foodType, setFoodType] = useState<FoodType>(persistedSelection?.foodType ?? 'cheese');
  const [subCategory, setSubCategory] = useState<string | null>(persistedSelection?.subCategory ?? null);
  const [localFoodTypeRecords, setLocalFoodTypeRecords] = useState<LocalFoodTypeRecord[]>([]);
  const [actionError, setActionError] = useState('');
  const { isAuthenticated, user } = useAuth();
  const foodTypesQuery = useFoodTypes(isAuthenticated && user?.role === 'admin');
  const archiveFoodTypeMutation = useArchiveFoodType();
  const restoreFoodTypeMutation = useRestoreFoodType();
  const deleteFoodTypeMutation = useDeleteFoodType();

  const foodTypeRecords = useMemo(() => {
    const databaseRecords = (foodTypesQuery.data ?? [])
      .map(record => ({ type: record.slug, status: record.status }));
    return mergeFoodTypeRecords(databaseRecords, localFoodTypeRecords);
  }, [foodTypesQuery.data, localFoodTypeRecords]);

  const extraFoodTypes = foodTypeRecords.filter(record => record.status === 'active').map(record => record.type);
  const archivedFoodTypes = foodTypeRecords.filter(record => record.status === 'archived').map(record => record.type);
  const deletedFoodTypes = foodTypeRecords.filter(record => record.status === 'deleted').map(record => record.type);

  useEffect(() => {
    if (!foodTypesQuery.data) return;
    if (foodTypeRecords.some(record => record.type === foodType && record.status === 'active')) return;
    setFoodType(foodTypeRecords.find(record => record.status === 'active')?.type ?? '');
    setSubCategory(null);
  }, [foodType, foodTypeRecords, foodTypesQuery.data]);

  useEffect(() => {
    if (!foodTypesQuery.data) return;
    const databaseRecords = foodTypesQuery.data
      .map(record => ({ type: record.slug, status: record.status }));
    const databaseTypes = new Set(databaseRecords.map(record => record.type));
    setLocalFoodTypeRecords(previous => mergeFoodTypeRecords(
      databaseRecords,
      previous.filter(record => !databaseTypes.has(record.type)),
    ));
  }, [foodTypesQuery.data]);

  const setSelection = (ft: FoodType, sub: string | null = null) => {
    setFoodType(ft);
    setSubCategory(sub);
  };

  // Mirror the current selection into localStorage so a reload restores it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify({ foodType, subCategory }));
    } catch {
      // Storage may be unavailable (private mode / quota) — selection just won't persist.
    }
  }, [foodType, subCategory]);

  const registerFoodTypes = useCallback((types: string[]) => {
    setLocalFoodTypeRecords(prev => registerActiveFoodTypes(prev, types));
  }, []);

  const archiveFoodType = useCallback((type: string) => {
    const slug = slugifyFoodType(type);
    const previousStatus = foodTypeRecords.find(record => record.type === slug)?.status ?? 'active';
    const fallbackType = foodTypeRecords.find(record => record.type !== slug && record.status === 'active')?.type ?? '';
    setLocalFoodTypeRecords(prev => {
      const exists = prev.some(record => record.type === slug);
      if (!exists) return [...prev, { type: slug, status: 'archived' as const }].sort((a, b) => a.type.localeCompare(b.type));
      return prev.map(record => record.type === slug ? { ...record, status: 'archived' as const } : record);
    });
    setFoodType(current => current === slug ? fallbackType : current);
    setActionError('');
    void archiveFoodTypeMutation.mutateAsync(slug).catch(error => {
      setLocalFoodTypeRecords(prev => prev.map(record =>
        record.type === slug ? { ...record, status: previousStatus } : record
      ));
      setActionError(error instanceof Error ? error.message : `Could not archive ${slug}.`);
    });
  }, [archiveFoodTypeMutation, foodTypeRecords]);

  const restoreFoodType = useCallback((type: string) => {
    const slug = slugifyFoodType(type);
    const previousStatus = foodTypeRecords.find(record => record.type === slug)?.status ?? 'archived';
    setLocalFoodTypeRecords(prev => prev.map(record => record.type === slug ? { ...record, status: 'active' } : record));
    setSelection(slug, null);
    setActionError('');
    void restoreFoodTypeMutation.mutateAsync(slug).catch(error => {
      setLocalFoodTypeRecords(prev => prev.map(record =>
        record.type === slug ? { ...record, status: previousStatus } : record
      ));
      setFoodType(current => current === slug ? '' : current);
      setActionError(error instanceof Error ? error.message : `Could not restore ${slug}.`);
    });
  }, [foodTypeRecords, restoreFoodTypeMutation]);

  const deleteFoodType = useCallback((type: string) => {
    const slug = slugifyFoodType(type);
    const previousStatus = foodTypeRecords.find(record => record.type === slug)?.status ?? 'active';
    const fallbackType = foodTypeRecords.find(record => record.type !== slug && record.status === 'active')?.type ?? '';
    setLocalFoodTypeRecords(prev => {
      const exists = prev.some(record => record.type === slug);
      if (!exists) return [...prev, { type: slug, status: 'deleted' as const }].sort((a, b) => a.type.localeCompare(b.type));
      return prev.map(record => record.type === slug ? { ...record, status: 'deleted' as const } : record);
    });
    setFoodType(current => current === slug ? fallbackType : current);
    setActionError('');
    void deleteFoodTypeMutation.mutateAsync(slug)
      .then(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sensory-food-type-delete', { detail: { type: slug } }));
        }
      })
      .catch(error => {
        setLocalFoodTypeRecords(prev => prev.map(record =>
          record.type === slug ? { ...record, status: previousStatus } : record
        ));
        setActionError(error instanceof Error ? error.message : `Could not delete ${slug}.`);
      });
  }, [deleteFoodTypeMutation, foodTypeRecords]);

  const clearExtraFoodTypes = useCallback(() => {
    setLocalFoodTypeRecords([]);
  }, []);
  const clearActionError = useCallback(() => setActionError(''), []);

  return (
    <FoodTypeContext.Provider value={{ foodType, subCategory, setSelection, extraFoodTypes, archivedFoodTypes, deletedFoodTypes, registerFoodTypes, archiveFoodType, restoreFoodType, deleteFoodType, clearExtraFoodTypes, actionError, clearActionError }}>
      {children}
    </FoodTypeContext.Provider>
  );
}

export function useFoodType() {
  return useContext(FoodTypeContext);
}

export function matchFoodType(category: string): string {
  return detectFoodType(category).slug;
}

export function sampleMatchesFoodType(sampleId: string, sampleName: string): FoodType {
  if (sampleId.startsWith('B')) return 'bread';
  if (sampleId.startsWith('Y')) return 'yogurt';
  if (sampleId.startsWith('M')) return 'meat';
  if (sampleId.startsWith('S') || sampleId.startsWith('D')) return 'cheese';
  return matchFoodType(sampleName);
}
