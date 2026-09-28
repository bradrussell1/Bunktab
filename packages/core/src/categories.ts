/**
 * The fixed two-level category list (spec: Feature specs → Categories).
 * Categories with no subcategories hide the second dropdown. Hotels &
 * Resorts and Rentals turn the nights-based lodging split on by default.
 */
export type Category = {
  key: string;
  label: string;
  subcategories: { key: string; label: string; lodging?: boolean }[];
};

export const CATEGORIES: Category[] = [
  {
    key: "travel",
    label: "Travel & Lodging",
    subcategories: [
      { key: "airfare", label: "Airlines & Airfare" },
      { key: "hotels", label: "Hotels & Resorts", lodging: true },
      { key: "rentals", label: "Rentals: Airbnb/Vrbo/Camp", lodging: true },
      { key: "vacation-misc", label: "Vacations Misc" },
    ],
  },
  {
    key: "dining",
    label: "Dining, Food, Beverage",
    subcategories: [
      { key: "restaurants", label: "Restaurants" },
      { key: "bars", label: "Bars, Lounges & Nightlife" },
      { key: "delivery", label: "Food Delivery" },
      { key: "catering", label: "Catering" },
    ],
  },
  { key: "groceries", label: "Groceries", subcategories: [] },
  { key: "alcohol", label: "Beer, Wine, Spirits", subcategories: [] },
  {
    key: "transportation",
    label: "Transportation",
    subcategories: [
      { key: "rideshare", label: "Rideshare" },
      { key: "parking", label: "Parking" },
      { key: "misc", label: "Misc" },
    ],
  },
  { key: "recreation", label: "Recreation", subcategories: [] },
  { key: "other", label: "Other", subcategories: [] },
];

export function categoryByKey(key: string): Category | null {
  return CATEGORIES.find((c) => c.key === key) ?? null;
}

/** True when the pair is on the fixed list (a category without subcategories takes null). */
export function isValidCategory(category: string, subcategory: string | null): boolean {
  const c = categoryByKey(category);
  if (!c) return false;
  if (c.subcategories.length === 0) return subcategory === null;
  return subcategory !== null && c.subcategories.some((s) => s.key === subcategory);
}

export function isLodgingCategory(category: string, subcategory: string | null): boolean {
  const c = categoryByKey(category);
  return !!c?.subcategories.find((s) => s.key === subcategory)?.lodging;
}

export function categoryLabel(category: string, subcategory: string | null): string {
  const c = categoryByKey(category);
  if (!c) return category;
  const sub = c.subcategories.find((s) => s.key === subcategory);
  return sub ? `${c.label} · ${sub.label}` : c.label;
}
