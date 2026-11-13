import { sql } from "drizzle-orm";

import { seedCategories } from "./data";
import type { Category } from "./data";
import { CategoryError } from "./error";
import { categories } from "./schema";
import type { Db } from "@/pkg/db";

export function initCategoryService(db: Db) {
  let cachedCategories: Category[] | undefined;

  async function listCategories(): Promise<Category[]> {
    if (cachedCategories) {
      return cachedCategories;
    }

    const rows = await db.select().from(categories).orderBy(categories.slug);
    if (!rows.some((category) => category.slug === "other")) {
      throw CategoryError.setupRequired();
    }
    cachedCategories = rows;
    return rows;
  }

  return {
    async seedCategories() {
      // Match existing slugs without changing IDs referenced by expenses.
      await db
        .insert(categories)
        .values(seedCategories)
        .onConflictDoUpdate({ target: categories.slug, set: { name: sql`excluded.name` } });
      cachedCategories = undefined;
    },
    listCategories,
    async resolveCategory(slug: string): Promise<Category> {
      const availableCategories = await listCategories();
      const category = availableCategories.find((category) => category.slug === slug);
      if (category) {
        return category;
      }

      const other = availableCategories.find((category) => category.slug === "other");
      if (!other) {
        throw CategoryError.setupRequired();
      }
      return other;
    },
  };
}

export type CategoryService = ReturnType<typeof initCategoryService>;
