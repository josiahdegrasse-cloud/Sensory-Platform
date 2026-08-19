import { getFoodTypeProfile } from './food-intelligence';

export interface FoodProductFormOption {
  value: string;
  label: string;
}

const PRODUCT_FORMS: Record<string, FoodProductFormOption[]> = {
  cheese: [
    { value: 'shredded', label: 'Shredded' },
    { value: 'block', label: 'Block' },
    { value: 'cubes', label: 'Cubes' },
    { value: 'slices', label: 'Slices' },
    { value: 'wedge', label: 'Wedge' },
    { value: 'spreadable', label: 'Spreadable' },
    { value: 'grated', label: 'Grated' },
  ],
  bread: [
    { value: 'sliced_loaf', label: 'Sliced loaf' },
    { value: 'whole_loaf', label: 'Whole loaf' },
    { value: 'rolls', label: 'Rolls' },
    { value: 'buns', label: 'Buns' },
    { value: 'flatbread', label: 'Flatbread' },
    { value: 'baguette', label: 'Baguette' },
  ],
  meat: [
    { value: 'burger_patties', label: 'Burger patties' },
    { value: 'sausages', label: 'Sausages' },
    { value: 'mince', label: 'Mince' },
    { value: 'slices', label: 'Slices' },
    { value: 'whole_cut', label: 'Whole cut' },
    { value: 'bite_sized_pieces', label: 'Bite-sized pieces' },
  ],
  yogurt: [
    { value: 'spoonable', label: 'Spoonable' },
    { value: 'drinkable', label: 'Drinkable' },
    { value: 'pouch', label: 'Pouch' },
    { value: 'family_tub', label: 'Family tub' },
    { value: 'frozen', label: 'Frozen' },
  ],
  beverage: [
    { value: 'ready_to_drink', label: 'Ready to drink' },
    { value: 'sparkling', label: 'Sparkling' },
    { value: 'still', label: 'Still' },
    { value: 'shot', label: 'Shot' },
    { value: 'concentrate', label: 'Concentrate' },
    { value: 'powder_mix', label: 'Powder mix' },
  ],
  snack: [
    { value: 'bar', label: 'Bar' },
    { value: 'bites', label: 'Bites' },
    { value: 'crisps', label: 'Crisps' },
    { value: 'clusters', label: 'Clusters' },
    { value: 'crackers', label: 'Crackers' },
    { value: 'sharing_pieces', label: 'Sharing pieces' },
  ],
  sauce: [
    { value: 'pourable', label: 'Pourable' },
    { value: 'squeezable', label: 'Squeezable' },
    { value: 'dip', label: 'Dip' },
    { value: 'spread', label: 'Spread' },
    { value: 'drizzle', label: 'Drizzle' },
    { value: 'cooking_sauce', label: 'Cooking sauce' },
  ],
  chocolate: [
    { value: 'bar', label: 'Bar' },
    { value: 'block', label: 'Block' },
    { value: 'bites', label: 'Bites' },
    { value: 'truffles', label: 'Truffles' },
    { value: 'filled_pieces', label: 'Filled pieces' },
    { value: 'sharing_pieces', label: 'Sharing pieces' },
  ],
};

const GENERIC_FORMS: FoodProductFormOption[] = [
  { value: 'whole', label: 'Whole' },
  { value: 'sliced', label: 'Sliced' },
  { value: 'bite_sized', label: 'Bite-sized' },
  { value: 'single_serve', label: 'Single serve' },
  { value: 'sharing_size', label: 'Sharing size' },
];

export function getFoodProductForms(foodTypeSlug: string): FoodProductFormOption[] {
  const profile = getFoodTypeProfile(foodTypeSlug);
  return PRODUCT_FORMS[foodTypeSlug]
    ?? (profile.parentSlug ? PRODUCT_FORMS[profile.parentSlug] : undefined)
    ?? GENERIC_FORMS;
}

export function formatProductForm(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}
