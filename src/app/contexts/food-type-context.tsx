import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export type FoodType = string;
type FoodTypeStatus = 'active' | 'archived';
interface FoodTypeRecord {
  type: string;
  status: FoodTypeStatus;
}

const FOOD_TYPE_STORAGE_KEY = 'sensory-dashboard-food-types';
const IMPORTED_DATA_STORAGE_KEY = 'sensory-dashboard-imported-machine-data';

const KNOWN_CHEESE_PATTERN = /cheese|dairy|milk|cream|butter|yogurt|pbca|plant.based|cheddar|mozzarella|brie|gouda|parmesan|blue|feta|camembert|ricotta|coconut.based|cashew|almond|oat.based/;
const KNOWN_BREAD_PATTERN  = /bread|bak|loaf|pastry|dough|sourdough|multigrain|sandwich|rye|artisan|brioche|ciabatta|focaccia|bagel|pita|white.sandwich/;
const KNOWN_MEAT_PATTERN = /meat|beef|pork|chicken|poultry|turkey|lamb|mutton|veal|duck|sausage|bacon|ham|steak|burger|patty|mince|jerky|fish|seafood|salmon|tuna|shrimp|protein/;
const KNOWN_YOGURT_PATTERN = /yogurt|yoghurt|skyr|kefir/;

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
  foodType: 'all',
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

function loadFoodTypeRecords(): FoodTypeRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FOOD_TYPE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is FoodTypeRecord =>
      typeof item?.type === 'string' && (item.status === 'active' || item.status === 'archived')
    );
  } catch {
    return [];
  }
}

export function FoodTypeProvider({ children }: { children: ReactNode }) {
  const [foodType, setFoodType] = useState<FoodType>('all');
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [foodTypeRecords, setFoodTypeRecords] = useState<FoodTypeRecord[]>(loadFoodTypeRecords);

  const extraFoodTypes = foodTypeRecords.filter(record => record.status === 'active').map(record => record.type);
  const archivedFoodTypes = foodTypeRecords.filter(record => record.status === 'archived').map(record => record.type);

  useEffect(() => {
    window.localStorage.setItem(FOOD_TYPE_STORAGE_KEY, JSON.stringify(foodTypeRecords));
  }, [foodTypeRecords]);

  const setSelection = (ft: FoodType, sub: string | null = null) => {
    setFoodType(ft);
    setSubCategory(sub);
  };

  const registerFoodTypes = useCallback((types: string[]) => {
    setFoodTypeRecords(prev => {
      const recordsByType = new Map(prev.map(record => [record.type, record]));
      types.forEach(type => {
        if (!recordsByType.has(type)) recordsByType.set(type, { type, status: 'active' });
      });
      return [...recordsByType.values()].sort((a, b) => a.type.localeCompare(b.type));
    });
  }, []);

  const archiveFoodType = useCallback((type: string) => {
    setFoodTypeRecords(prev => prev.map(record => record.type === type ? { ...record, status: 'archived' } : record));
    setFoodType(current => current === type ? 'all' : current);
  }, []);

  const restoreFoodType = useCallback((type: string) => {
    setFoodTypeRecords(prev => prev.map(record => record.type === type ? { ...record, status: 'active' } : record));
    setSelection(type, null);
  }, []);

  const deleteFoodType = useCallback((type: string) => {
    setFoodTypeRecords(prev => prev.filter(record => record.type !== type));
    setFoodType(current => current === type ? 'all' : current);
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(IMPORTED_DATA_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const sampleIds = Array.isArray(parsed?.eTongueData)
            ? parsed.eTongueData.filter((sample: { type?: string }) => sample.type === type).map((sample: { sampleId: string }) => sample.sampleId)
            : [];
          const gcmsData = { ...(parsed?.gcmsData ?? {}) };
          const compositionData = { ...(parsed?.compositionData ?? {}) };
          sampleIds.forEach((sampleId: string) => {
            delete gcmsData[sampleId];
            delete compositionData[sampleId];
          });
          const eTongueData = (parsed?.eTongueData ?? []).filter((sample: { type?: string }) => sample.type !== type);
          if (eTongueData.length === 0) {
            window.localStorage.removeItem(IMPORTED_DATA_STORAGE_KEY);
          } else {
            window.localStorage.setItem(IMPORTED_DATA_STORAGE_KEY, JSON.stringify({ eTongueData, gcmsData, compositionData }));
          }
        }
      } catch {
        window.localStorage.removeItem(IMPORTED_DATA_STORAGE_KEY);
      }
      window.dispatchEvent(new CustomEvent('sensory-food-type-delete', { detail: { type } }));
    }
  }, []);

  const clearExtraFoodTypes = useCallback(() => {
    setFoodTypeRecords([]);
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
  const c = category.toLowerCase();
  if (KNOWN_YOGURT_PATTERN.test(c)) return 'yogurt';
  if (KNOWN_MEAT_PATTERN.test(c)) return 'meat';
  if (KNOWN_CHEESE_PATTERN.test(c)) return 'cheese';
  if (KNOWN_BREAD_PATTERN.test(c))  return 'bread';
  return c; // unknown: return normalized category as its own type
}

export function sampleMatchesFoodType(sampleId: string, sampleName: string): FoodType {
  if (sampleId.startsWith('B')) return 'bread';
  if (sampleId.startsWith('Y')) return 'yogurt';
  if (sampleId.startsWith('M')) return 'meat';
  if (sampleId.startsWith('S') || sampleId.startsWith('D')) return 'cheese';
  return matchFoodType(sampleName);
}
