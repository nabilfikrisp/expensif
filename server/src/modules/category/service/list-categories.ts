import { CategoryError } from "../error";
import { categories } from "../schema";
import type { ListCategoriesOutput } from "./dto";
import type { Db } from "@/pkg/db";

interface InitListCategoriesDeps {
  db: Db;
  getCachedCategories: () => ListCategoriesOutput | undefined;
  setCachedCategories: (categories: ListCategoriesOutput) => void;
}

export function initListCategories({
  db,
  getCachedCategories,
  setCachedCategories,
}: InitListCategoriesDeps) {
  return async function listCategories(): Promise<ListCategoriesOutput> {
    const cachedCategories = getCachedCategories();
    if (cachedCategories) {
      return cachedCategories;
    }

    const rows = await db.select().from(categories).orderBy(categories.slug);
    if (!rows.some((category) => category.slug === "other")) {
      throw CategoryError.setupRequired();
    }
    setCachedCategories(rows);
    return rows;
  };
}
