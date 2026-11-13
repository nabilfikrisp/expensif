import "dotenv/config";

import { initCategoryService } from "@/modules/category/service";
import { initDb } from "@/pkg/db";
import { initLogger } from "@/pkg/logger";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined in your .env file");
}

const logger = initLogger({ NODE_ENV: "production" }).child({
  service: "runtime",
  component: "db",
});
const { db, client } = initDb(databaseUrl, logger);
const categoryService = initCategoryService({ db });
try {
  await categoryService.seedCategories();
  console.log("Category setup complete.");
} catch (err) {
  logger.error({ err }, "Database setup failed while seeding categories");
  throw err;
} finally {
  await client.end();
}
