import { eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { initTest } from "../../helper";

import { apiKeys } from "@/modules/api-key/schema";

let ctx: Awaited<ReturnType<typeof initTest>>;
let userId: string;

const mockUser = { email: "test@example.com", password: "pass123", name: "Test User" };
async function issueKey() {
  return await ctx.services.apiKey.generateApiKey(userId, "telegram");
}

beforeAll(async () => {
  ctx = await initTest();
  return () => ctx.client.end();
});

beforeEach(async () => {
  await ctx.resetDb();

  await ctx.services.auth.register(mockUser.email, mockUser.password, mockUser.name);

  const user = await ctx.services.user.getUserByEmail(mockUser.email);
  userId = user.id;
});

describe("PostgreSQL transaction concurrency", () => {
  it("allows independent writes to overlap before either transaction commits", async () => {
    const context = ctx;
    const keys = [await issueKey(), await issueKey()];
    const barrier = Promise.withResolvers<undefined>();
    let arrived = 0;
    const settled = Promise.allSettled(
      keys.map(({ id }, index) =>
        context.db.transaction(async (tx) => {
          await tx.execute(sql`SET LOCAL statement_timeout = '3s'`);
          await tx
            .update(apiKeys)
            .set({ label: `overlap-${index}` })
            .where(eq(apiKeys.id, id));
          arrived++;
          await barrier.promise;
        })
      )
    );

    try {
      await expect.poll(() => arrived, { timeout: 2000 }).toBe(2);
    } finally {
      barrier.resolve(undefined);
      await settled;
    }

    expect(await settled).toEqual([
      { status: "fulfilled", value: undefined },
      { status: "fulfilled", value: undefined },
    ]);
    const rows = await context.db
      .select({ label: apiKeys.label })
      .from(apiKeys)
      .orderBy(apiKeys.label);
    expect(rows).toEqual([{ label: "overlap-0" }, { label: "overlap-1" }]);
  });
});
