import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { initTest } from "../../helper";

import { ApiKeyError } from "@/modules/api-key/error";
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

function consume(token: string) {
  return ctx.db.transaction((tx) => ctx.services.apiKey.consumeApiKey(token, tx));
}

describe("ApiKeyService.consumeApiKey", () => {
  it("consumes a valid key once and returns its owner", async () => {
    const { id, key } = await issueKey();
    await expect(consume(key)).resolves.toEqual({ userId });
    const [row] = await ctx.db.select().from(apiKeys).where(eq(apiKeys.id, id));
    expect(row.lastUsedAt).not.toBeNull();
    await expect(consume(key)).rejects.toMatchObject({ code: ApiKeyError.keyInvalid().code });
  });

  it("rejects an unknown token", async () => {
    await expect(consume("ek_unknown")).rejects.toMatchObject({
      code: ApiKeyError.keyInvalid().code,
    });
  });

  it("rejects a revoked key without consuming it", async () => {
    const { id, key } = await issueKey();
    await ctx.services.apiKey.revokeApiKey(userId, id);
    await expect(consume(key)).rejects.toMatchObject({ code: ApiKeyError.keyInvalid().code });
    const [row] = await ctx.db.select().from(apiKeys).where(eq(apiKeys.id, id));
    expect(row.lastUsedAt).toBeNull();
  });

  it("rejects an expired key without consuming it", async () => {
    const { id, key } = await issueKey();
    await ctx.db
      .update(apiKeys)
      .set({ expiresAt: sql`clock_timestamp() - interval '1 minute'` })
      .where(eq(apiKeys.id, id));
    await expect(consume(key)).rejects.toMatchObject({ code: ApiKeyError.keyInvalid().code });
    const [row] = await ctx.db.select().from(apiKeys).where(eq(apiKeys.id, id));
    expect(row.lastUsedAt).toBeNull();
  });

  it("rejects a key that expires while consumption waits on an unchanged row lock", async () => {
    const context = ctx;
    const { id, key: token } = await issueKey();
    const locker = await context.client.connect();
    const lockerDb = drizzle({ client: locker });
    let settled: Promise<PromiseSettledResult<unknown>[]> | undefined;

    try {
      await lockerDb
        .update(apiKeys)
        .set({ expiresAt: sql`clock_timestamp() + interval '3 seconds'` })
        .where(eq(apiKeys.id, id));
      await locker.query("BEGIN");
      await locker.query("SET LOCAL statement_timeout = '5s'");
      const pidResult = await locker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
      const lockerPid = pidResult.rows[0].pid;
      await lockerDb
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(eq(apiKeys.id, id))
        .for("update");

      settled = Promise.allSettled([
        context.db.transaction(async (tx) => {
          await tx.execute(sql`SET LOCAL statement_timeout = '5s'`);
          return await context.services.apiKey.consumeApiKey(token, tx);
        }),
      ]);

      await expect
        .poll(
          async () => {
            const result = await context.client.query<{ waiting: boolean }>(
              "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1::integer = ANY(pg_blocking_pids(pid))) AS waiting",
              [lockerPid]
            );
            return result.rows[0].waiting;
          },
          { timeout: 2000, interval: 10 }
        )
        .toBe(true);

      const [before] = await lockerDb
        .select({ unexpired: sql<boolean>`${apiKeys.expiresAt} > clock_timestamp()` })
        .from(apiKeys)
        .where(eq(apiKeys.id, id));
      expect(before.unexpired).toBe(true);
      await lockerDb
        .select({
          wait: sql`pg_sleep(GREATEST(0, EXTRACT(EPOCH FROM (${apiKeys.expiresAt} - clock_timestamp())))::double precision + 0.05)`,
        })
        .from(apiKeys)
        .where(eq(apiKeys.id, id));
      const [after] = await lockerDb
        .select({ expired: sql<boolean>`${apiKeys.expiresAt} <= clock_timestamp()` })
        .from(apiKeys)
        .where(eq(apiKeys.id, id));
      expect(after.expired).toBe(true);
    } finally {
      try {
        await locker.query("ROLLBACK");
      } finally {
        locker.release();
        await settled;
      }
    }

    expect(await settled).toMatchObject([
      { status: "rejected", reason: { code: ApiKeyError.keyInvalid().code } },
    ]);
    const [row] = await context.db
      .select({ lastUsedAt: apiKeys.lastUsedAt })
      .from(apiKeys)
      .where(eq(apiKeys.id, id));
    expect(row.lastUsedAt).toBeNull();
  }, 10000);
});
