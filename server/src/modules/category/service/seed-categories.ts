import { sql } from "drizzle-orm";
import { seedCategories as seedCategoryData } from "../data";
import { categories } from "../schema";
import type { SeedCategoriesOutput } from "./dto";
import type { Db } from "@/pkg/db";

interface InitSeedCategoriesDeps {
  db: Db;
  clearCategoriesCache: () => void;
}

export function initSeedCategories({ db, clearCategoriesCache }: InitSeedCategoriesDeps) {
  return async function seedCategories(): Promise<SeedCategoriesOutput> {
    // Match existing slugs without changing IDs referenced by expenses.
    await db
      .insert(categories)
      .values(seedCategoryData)
      .onConflictDoUpdate({ target: categories.slug, set: { name: sql`excluded.name` } });
    clearCategoriesCache();
  };
}
