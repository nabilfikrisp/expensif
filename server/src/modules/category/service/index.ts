import type { ListCategoriesOutput } from "./dto";
import type { CategoryService } from "./interface";
import { initListCategories } from "./list-categories";
import { initResolveCategory } from "./resolve-category";
import { initSeedCategories } from "./seed-categories";
import type { Db } from "@/pkg/db";

interface InitCategoryServiceDeps {
  db: Db;
}

export function initCategoryService({ db }: InitCategoryServiceDeps): CategoryService {
  let cachedCategories: ListCategoriesOutput | undefined;
  const listCategories = initListCategories({
    db,
    getCachedCategories: () => cachedCategories,
    setCachedCategories: (categories) => {
      cachedCategories = categories;
    },
  });
  return {
    seedCategories: initSeedCategories({
      db,
      clearCategoriesCache: () => {
        cachedCategories = undefined;
      },
    }),
    listCategories,
    resolveCategory: initResolveCategory({ listCategories }),
  };
}
