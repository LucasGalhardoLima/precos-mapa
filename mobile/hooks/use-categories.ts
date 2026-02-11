import { categories } from "@/data/categories";

export function useCategories() {
  return {
    categories: categories.sort((a, b) => a.sortOrder - b.sortOrder),
  };
}
