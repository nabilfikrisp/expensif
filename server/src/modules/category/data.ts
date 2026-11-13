import type { categories } from "./schema";

export type Category = typeof categories.$inferSelect;

export const seedCategories: Category[] = [
  { id: "category_bills", name: "Bills & Utilities", slug: "bills" },
  { id: "category_entertainment", name: "Entertainment", slug: "entertainment" },
  { id: "category_food", name: "Food & Drinks", slug: "food" },
  { id: "category_health", name: "Health", slug: "health" },
  { id: "category_other", name: "Other", slug: "other" },
  { id: "category_shopping", name: "Shopping", slug: "shopping" },
  { id: "category_transport", name: "Transportation", slug: "transport" },
];
