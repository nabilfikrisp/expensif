import "dotenv/config";

import { initCategoryService } from "@/modules/category/service";
import { initDb } from "@/pkg/db";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined in your .env file");
}

const { db, client } = initDb(databaseUrl);
const categoryService = initCategoryService({ db });
try {
  await categoryService.seedCategories();
  console.log("Category setup complete.");
} finally {
  await client.end();
}
