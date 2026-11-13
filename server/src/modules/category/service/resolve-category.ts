import { CategoryError } from "../error";
import type { ResolveCategoryInput, ResolveCategoryOutput } from "./dto";

interface InitResolveCategoryDeps {
  listCategories: () => Promise<ResolveCategoryOutput[]>;
}

export function initResolveCategory({ listCategories }: InitResolveCategoryDeps) {
  return async function resolveCategory(
    slug: ResolveCategoryInput["slug"]
  ): Promise<ResolveCategoryOutput> {
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
  };
}
