import { z } from "zod";

export const seedCategoriesInputSchema = z.void();
export type SeedCategoriesInput = z.infer<typeof seedCategoriesInputSchema>;
export const seedCategoriesOutputSchema = z.void();
export type SeedCategoriesOutput = z.infer<typeof seedCategoriesOutputSchema>;

export const listCategoriesInputSchema = z.void();
export type ListCategoriesInput = z.infer<typeof listCategoriesInputSchema>;
export const listCategoriesOutputSchema = z.array(
  z.object({ id: z.string(), name: z.string(), slug: z.string() })
);
export type ListCategoriesOutput = z.infer<typeof listCategoriesOutputSchema>;

export const resolveCategoryInputSchema = z.object({ slug: z.string() });
export type ResolveCategoryInput = z.infer<typeof resolveCategoryInputSchema>;
export const resolveCategoryOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});
export type ResolveCategoryOutput = z.infer<typeof resolveCategoryOutputSchema>;
