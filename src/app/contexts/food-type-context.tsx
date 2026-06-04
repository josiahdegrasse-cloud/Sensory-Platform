import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type FoodType = string;

const KNOWN_CHEESE_PATTERN = /cheese|dairy|milk|cream|butter|yogurt|pbca|plant.based|cheddar|mozzarella|brie|gouda|parmesan|blue|feta|camembert|ricotta|coconut.based|cashew|almond|oat.based/;
const KNOWN_BREAD_PATTERN  = /bread|bak|loaf|pastry|dough|sourdough|multigrain|sandwich|rye|artisan|brioche|ciabatta|focaccia|bagel|pita|white.sandwich/;
const KNOWN_MEAT_PATTERN = /meat|beef|pork|chicken|poultry|turkey|lamb|mutton|veal|duck|sausage|bacon|ham|steak|burger|patty|mince|jerky|fish|seafood|salmon|tuna|shrimp|protein/;
const KNOWN_YOGURT_PATTERN = /yogurt|yoghurt|skyr|kefir/;

interface FoodTypeContextValue {
  foodType: FoodType;
  subCategory: string | null;
  setSelection: (foodType: FoodType, subCategory?: string | null) => void;
  extraFoodTypes: string[];
  registerFoodTypes: (types: string[]) => void;
  removeFoodTypes: (types: string[]) => void;
  clearExtraFoodTypes: () => void;
}

const FoodTypeContext = createContext<FoodTypeContextValue>({
  foodType: 'all',
  subCategory: null,
  setSelection: () => {},
  extraFoodTypes: [],
  registerFoodTypes: () => {},
  removeFoodTypes: () => {},
  clearExtraFoodTypes: () => {},
});

export function FoodTypeProvider({ children }: { children: ReactNode }) {
  const [foodType, setFoodType] = useState<FoodType>('all');
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [extraFoodTypes, setExtraFoodTypes] = useState<string[]>([]);

  const setSelection = (ft: FoodType, sub: string | null = null) => {
    setFoodType(ft);
    setSubCategory(sub);
  };

  const registerFoodTypes = useCallback((types: string[]) => {
    setExtraFoodTypes([...new Set(types)].sort());
  }, []);

  const removeFoodTypes = useCallback((types: string[]) => {
    setExtraFoodTypes(prev => prev.filter(t => !types.includes(t)));
  }, []);

  const clearExtraFoodTypes = useCallback(() => {
    setExtraFoodTypes([]);
  }, []);

  return (
    <FoodTypeContext.Provider value={{ foodType, subCategory, setSelection, extraFoodTypes, registerFoodTypes, removeFoodTypes, clearExtraFoodTypes }}>
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
