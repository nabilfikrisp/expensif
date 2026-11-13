import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { initApp } from "@/app";
import { seedCategories } from "@/modules/category/data";
import { categories } from "@/modules/category/schema";
import { initCategoryService } from "@/modules/category/service";
import { initLogger } from "@/pkg/logger";
import { initTest } from "@/test/helper/app";

let ctx: Awaited<ReturnType<typeof initTest>>;

beforeAll(async () => {
  ctx = await initTest();
  return () => ctx.client.end();
});
beforeEach(async () => ctx.resetDb());
afterEach(async () => ctx.resetDb());

function initializeApp() {
  return initApp({ env: ctx.env, db: ctx.db, logger: initLogger(ctx.env) });
}

describe("category setup", () => {
  it("seeds the seven choices during startup with stable IDs, including after a reset", async () => {
    await initializeApp();
    const first = await ctx.db.select().from(categories).orderBy(categories.slug);
    expect(first).toEqual([...seedCategories].sort((a, b) => a.slug.localeCompare(b.slug)));
    await initializeApp();
    expect(await ctx.db.select().from(categories).orderBy(categories.slug)).toEqual(first);
    await ctx.resetDb();
    await initializeApp();
    expect(await ctx.db.select().from(categories).orderBy(categories.slug)).toEqual(first);
  });

  // Startup creates fresh services, so direct seeding is needed to verify that
  // manual setup refreshes choices already loaded by a running service.
  it("preserves existing IDs and custom choices while refreshing loaded category names", async () => {
    await ctx.db.insert(categories).values([
      { id: "existing-food-id", name: "Old food name", slug: "food" },
      { id: "custom-id", name: "Custom", slug: "custom" },
      { id: "category_other", name: "Other", slug: "other" },
    ]);
    const service = initCategoryService(ctx.db);
    expect(
      (await service.listCategories()).find((category) => category.slug === "food")?.name
    ).toBe("Old food name");
    await service.seedCategories();
    await service.seedCategories();
    const available = await service.listCategories();
    expect(available).toHaveLength(8);
    expect(available.find((category) => category.slug === "food")?.name).toBe("Food & Drinks");
    expect(await service.resolveCategory("food")).toEqual({
      id: "existing-food-id",
      name: "Food & Drinks",
      slug: "food",
    });
    expect(await service.resolveCategory("custom")).toEqual({
      id: "custom-id",
      name: "Custom",
      slug: "custom",
    });
  });

  it("rejects startup on ID conflicts without partially seeding", async () => {
    await ctx.db
      .insert(categories)
      .values({ id: "category_health", name: "Custom", slug: "custom" });
    await expect(initializeApp()).rejects.toMatchObject({
      cause: { code: "23505" },
    });
    expect(await ctx.db.select().from(categories)).toEqual([
      { id: "category_health", name: "Custom", slug: "custom" },
    ]);
  });
});
