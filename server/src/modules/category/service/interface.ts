import type {
  ListCategoriesOutput,
  ResolveCategoryInput,
  ResolveCategoryOutput,
  SeedCategoriesOutput,
} from "./dto";

export interface CategoryService {
  seedCategories(): Promise<SeedCategoriesOutput>;
  listCategories(): Promise<ListCategoriesOutput>;
  resolveCategory(slug: ResolveCategoryInput["slug"]): Promise<ResolveCategoryOutput>;
}
