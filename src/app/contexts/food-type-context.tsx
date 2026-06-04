import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useAuth } from './auth-context';
import { detectFoodType, slugifyFoodType } from '../lib/food-intelligence';
import { useArchiveFoodType, useDeleteFoodType, useFoodTypes, useRestoreFoodType } from '../lib/hooks';

export type FoodType = string;
type FoodTypeStatus = 'active' | 'archived';
interface LocalFoodTypeRecord {
  type: string;
  status: FoodTypeStatus;
}

const FOOD_TYPE_STORAGE_KEY = 'sensory-dashboard-food-types';
const IMPORTED_DATA_STORAGE_KEY = 'sensory-dashboard-imported-machine-data';

interface FoodTypeContextValue {
  foodType: FoodType;
  subCategory: string | null;
  setSelection: (foodType: FoodType, subCategory?: string | null) => void;
  extraFoodTypes: string[];
  archivedFoodTypes: string[];
  registerFoodTypes: (types: string[]) => void;
  archiveFoodType: (type: string) => void;
  restoreFoodType: (type: string) => void;
  deleteFoodType: (type: string) => void;
  clearExtraFoodTypes: () => void;
}

const FoodTypeContext = createContext<FoodTypeContextValue>({
  foodType: 'cheese',
  subCategory: null,
  setSelection: () => {},
  extraFoodTypes: [],
  archivedFoodTypes: [],
  registerFoodTypes: () => {},
  archiveFoodType: () => {},
  restoreFoodType: () => {},
  deleteFoodType: () => {},
  clearExtraFoodTypes: () => {},
});

function loadFoodTypeRecords(): LocalFoodTypeRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FOOD_TYPE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is LocalFoodTypeRecord =>
      typeof item?.type === 'string' && (item.status === 'active' || item.status === 'archived')
    );
  } catch {
    return [];
  }
}

export function FoodTypeProvider({ children }: { children: ReactNode }) {
  const [foodType, setFoodType] = useState<FoodType>('cheese');
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [localFoodTypeRecords, setLocalFoodTypeRecords] = useState<LocalFoodTypeRecord[]>(loadFoodTypeRecords);
  const { isAuthenticated, user } = useAuth();
  const foodTypesQuery = useFoodTypes(isAuthenticated && user?.role === 'admin');
  const archiveFoodTypeMutation = useArchiveFoodType();
  const restoreFoodTypeMutation = useRestoreFoodType();
  const deleteFoodTypeMutation = useDeleteFoodType();

  const foodTypeRecords = useMemo(() => {
    const recordsByType = new Map<string, LocalFoodTypeRecord>();
    localFoodTypeRecords.forEach(record => recordsByType.set(record.type, record));
    (foodTypesQuery.data ?? [])
      .filter(record => record.source !== 'system')
      .forEach(record => recordsByType.set(record.slug, { type: record.slug, status: record.status }));
    return [...recordsByType.values()].sort((a, b) => a.type.localeCompare(b.type));
  }, [foodTypesQuery.data, localFoodTypeRecords]);

  const extraFoodTypes = foodTypeRecords.filter(record => record.status === 'active').map(record => record.type);
  const archivedFoodTypes = foodTypeRecords.filter(record => record.status === 'archived').map(record => record.type);

  useEffect(() => {
    window.localStorage.setItem(FOOD_TYPE_STORAGE_KEY, JSON.stringify(localFoodTypeRecords));
  }, [localFoodTypeRecords]);

  const setSelection = (ft: FoodType, sub: string | null = null) => {
    setFoodType(ft);
    setSubCategory(sub);
  };

  const registerFoodTypes = useCallback((types: string[]) => {
    setLocalFoodTypeRecords(prev => {
      const recordsByType = new Map(prev.map(record => [record.type, record]));
      types.map(slugifyFoodType).forEach(type => {
        if (!recordsByType.has(type)) recordsByType.set(type, { type, status: 'active' });
      });
      return [...recordsByType.values()].sort((a, b) => a.type.localeCompare(b.type));
    });
  }, []);

  const archiveFoodType = useCallback((type: string) => {
    const slug = slugifyFoodType(type);
    setLocalFoodTypeRecords(prev => prev.map(record => record.type === slug ? { ...record, status: 'archived' } : record));
    setFoodType(current => current === slug ? 'cheese' : current);
    void archiveFoodTypeMutation.mutateAsync(slug).catch(() => undefined);
  }, [archiveFoodTypeMutation]);

  const restoreFoodType = useCallback((type: string) => {
    const slug = slugifyFoodType(type);
    setLocalFoodTypeRecords(prev => prev.map(record => record.type === slug ? { ...record, status: 'active' } : record));
    setSelection(slug, null);
    void restoreFoodTypeMutation.mutateAsync(slug).catch(() => undefined);
  }, [restoreFoodTypeMutation]);

  const deleteFoodType = useCallback((type: string) => {
    const slug = slugifyFoodType(type);
    setLocalFoodTypeRecords(prev => prev.filter(record => record.type !== slug));
    setFoodType(current => current === slug ? 'cheese' : current);
    void deleteFoodTypeMutation.mutateAsync(slug).catch(() => undefined);
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(IMPORTED_DATA_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const sampleIds = Array.isArray(parsed?.eTongueData)
            ? parsed.eTongueData.filter((sample: { type?: string }) => sample.type === slug).map((sample: { sampleId: string }) => sample.sampleId)
            : [];
          const gcmsData = { ...(parsed?.gcmsData ?? {}) };
          const compositionData = { ...(parsed?.compositionData ?? {}) };
          sampleIds.forEach((sampleId: string) => {
            delete gcmsData[sampleId];
            delete compositionData[sampleId];
          });
          const eTongueData = (parsed?.eTongueData ?? []).filter((sample: { type?: string }) => sample.type !== slug);
          if (eTongueData.length === 0) {
            window.localStorage.removeItem(IMPORTED_DATA_STORAGE_KEY);
          } else {
            window.localStorage.setItem(IMPORTED_DATA_STORAGE_KEY, JSON.stringify({ eTongueData, gcmsData, compositionData }));
          }
        }
      } catch {
        window.localStorage.removeItem(IMPORTED_DATA_STORAGE_KEY);
      }
      window.dispatchEvent(new CustomEvent('sensory-food-type-delete', { detail: { type: slug } }));
    }
  }, [deleteFoodTypeMutation]);

  const clearExtraFoodTypes = useCallback(() => {
    setLocalFoodTypeRecords([]);
  }, []);

  return (
    <FoodTypeContext.Provider value={{ foodType, subCategory, setSelection, extraFoodTypes, archivedFoodTypes, registerFoodTypes, archiveFoodType, restoreFoodType, deleteFoodType, clearExtraFoodTypes }}>
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
