import { createContext, useContext, useState, type ReactNode } from 'react';

export type FoodType = 'all' | 'bread' | 'cheese';

interface FoodTypeContextValue {
  foodType: FoodType;
  subCategory: string | null;
  setSelection: (foodType: FoodType, subCategory?: string | null) => void;
}

const FoodTypeContext = createContext<FoodTypeContextValue>({
  foodType: 'all',
  subCategory: null,
  setSelection: () => {},
});

export function FoodTypeProvider({ children }: { children: ReactNode }) {
  const [foodType, setFoodType] = useState<FoodType>('all');
  const [subCategory, setSubCategory] = useState<string | null>(null);

  const setSelection = (ft: FoodType, sub: string | null = null) => {
    setFoodType(ft);
    setSubCategory(sub);
  };

  return (
    <FoodTypeContext.Provider value={{ foodType, subCategory, setSelection }}>
      {children}
    </FoodTypeContext.Provider>
  );
}

export function useFoodType() {
  return useContext(FoodTypeContext);
}

export function matchFoodType(category: string): FoodType {
  const c = category.toLowerCase();
  if (/cheese|dairy|milk|cream|butter|yogurt|pbca|plant.based|cheddar|mozzarella|brie|gouda|parmesan|blue|feta|camembert|ricotta|coconut.based|cashew|almond|oat.based/.test(c)) return 'cheese';
  if (/bread|bak|loaf|pastry|dough|sourdough|multigrain|sandwich|rye|artisan|brioche|ciabatta|focaccia|bagel|pita|white.sandwich/.test(c)) return 'bread';
  return 'all';
}

export function sampleMatchesFoodType(sampleId: string, sampleName: string): FoodType {
  if (sampleId.startsWith('B')) return 'bread';
  if (sampleId.startsWith('S') || sampleId.startsWith('D')) return 'cheese';
  return matchFoodType(sampleName);
}
