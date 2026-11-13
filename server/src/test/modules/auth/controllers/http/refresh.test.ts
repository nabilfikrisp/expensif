import type { OpenAPIHono } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

import { AuthError } from "@/modules/auth/error";
import { sessions } from "@/pkg/db/schema";
import { API_PREFIX } from "@/pkg/http";
import { errorRespSchema, tokenRespSchema } from "@/shared/response.schema";
import { initTest } from "@/test/helper/app";
import {
  registerAndGetToken,
  seedSession,
  mockUser,
  sessionHeaders,
  sessionCookies,
} from "@/test/helper/auth";
import { withSessionWritesBlocked } from "@/test/helper/failures";

let ctx: Awaited<ReturnType<typeof initTest>>;
let app: OpenAPIHono;
let resetDb: () => Promise<void>;

beforeAll(async () => {
  ctx = await initTest();
  app = ctx.app;
  resetDb = ctx.resetDb;
  return () => ctx.client.end();
});

beforeEach(async () => {
  await resetDb();
});

describe(`POST ${API_PREFIX}/auth/refresh`, () => {
  const refresh = (tokens: { refreshToken: string; csrfToken: string }) =>
    app.request(`${API_PREFIX}/auth/refresh`, { method: "POST", headers: sessionHeaders(tokens) });

  it.each(["idle", "absolute"])("bounds rotated cookies by the %s deadline", async (kind) => {
    const original = await seedSession(ctx);
    if (kind === "absolute") {
      await ctx.db
        .update(sessions)
        .set({ absoluteExpiresAt: sql`clock_timestamp() + interval '1 minute'` });
    }
    const [before] = await ctx.db.select().from(sessions);
    const response = await refresh(original);
    expect(response.status).toBe(200);
    const [after] = await ctx.db.select().from(sessions);
    const absoluteDeadline = new Date(after.absoluteExpiresAt).getTime();
    const idleDeadline = new Date(after.lastUsedAt).getTime() + ctx.env.SESSION_IDLE_SECONDS * 1000;
    const deadline = Math.min(absoluteDeadline, idleDeadline);
    expect(after.absoluteExpiresAt).toBe(before.absoluteExpiresAt);
    for (const cookie of response.headers
      .getSetCookie()
      .filter((item) => !item.includes("Max-Age=0"))) {
      const expires = /Expires=([^;]+)/i.exec(cookie)?.[1];
      if (!expires) {
        throw new Error("Expected a bounded cookie expiry");
      }
      const expiry = Date.parse(expires);
      expect(expiry).toBeLessThanOrEqual(deadline);
      expect(deadline - expiry).toBeLessThan(1000);
    }
  });

  it("concurrent refreshes rotate once and return usable access tokens without grace cookies", async () => {
    const original = await seedSession(ctx);
    const [before] = await ctx.db.select().from(sessions);
    expect(before.tokenHash).toBe(createHash("sha256").update(original.refreshToken).digest("hex"));
    expect(Buffer.from(original.refreshToken, "base64url")).toHaveLength(32);
    const responses = await Promise.all([refresh(original), refresh(original), refresh(original)]);
    for (const response of responses) {
      expect(response.status).toBe(200);
      const { data } = tokenRespSchema.parse(await response.json());
      expect(
        (
          await app.request(`${API_PREFIX}/users/me`, {
            headers: { Authorization: `Bearer ${data.accessToken}` },
          })
        ).status
      ).toBe(200);
    }
    const rotations = responses.filter((response) => response.headers.getSetCookie().length > 0);
    expect(rotations).toHaveLength(1);
    const current = sessionCookies(rotations[0]);
    expect(current.refreshToken).not.toBe(original.refreshToken);
    const [after] = await ctx.db.select().from(sessions);
    expect(after.tokenHash).toBe(createHash("sha256").update(current.refreshToken).digest("hex"));
    expect(after.prevTokenHash).toBe(before.tokenHash);
    expect(after.absoluteExpiresAt).toBe(before.absoluteExpiresAt);
    expect((await refresh(current)).status).toBe(200);
  });

  it("commits reuse revocation before returning 401 and rejects the current token afterward", async () => {
    const original = await seedSession(ctx);
    const rotated = await refresh(original);
    expect(rotated.status).toBe(200);
    const current = sessionCookies(rotated);
    await ctx.db
      .update(sessions)
      .set({ rotatedAt: sql`clock_timestamp() - interval '31 seconds'` });
    const reuse = await refresh(original);
    expect(reuse.status).toBe(401);
    expect(errorRespSchema.parse(await reuse.json()).error).toBe("INVALID_TOKEN");
    expect(reuse.headers.getSetCookie()).toEqual([]);
    expect((await ctx.db.select().from(sessions))[0].revokedAt).not.toBeNull();
    expect((await refresh(current)).status).toBe(401);
  });

  it("rejects unknown and older tokens without changing the surviving session", async () => {
    const original = await seedSession(ctx);
    const first = await refresh(original);
    expect(first.status).toBe(200);
    const second = await refresh(sessionCookies(first));
    expect(second.status).toBe(200);
    const before = await ctx.db.select().from(sessions);
    for (const refreshToken of [original.refreshToken, "unknown-token"]) {
      const response = await refresh({ ...original, refreshToken });
      expect(response.status).toBe(401);
      expect(response.headers.getSetCookie()).toEqual([]);
    }
    expect(await ctx.db.select().from(sessions)).toEqual(before);
    expect((await refresh(sessionCookies(second))).status).toBe(200);
  });

  it.each(["idle", "absolute"])(
    "rejects %s expiry for current and previous tokens without cleanup",
    async (kind) => {
      const original = await seedSession(ctx);
      const rotated = await refresh(original);
      expect(rotated.status).toBe(200);
      if (kind === "idle") {
        await ctx.db.update(sessions).set({
          lastUsedAt: sql`clock_timestamp() - make_interval(secs => ${ctx.env.SESSION_IDLE_SECONDS}::integer)`,
        });
      } else {
        await ctx.db.update(sessions).set({ absoluteExpiresAt: sql`clock_timestamp()` });
      }
      const before = await ctx.db.select().from(sessions);
      for (const tokens of [original, sessionCookies(rotated)]) {
        const response = await refresh(tokens);
        expect(response.status).toBe(401);
        expect(response.headers.getSetCookie()).toEqual([]);
      }
      expect(await ctx.db.select().from(sessions)).toEqual(before);
    }
  );

  it.each(["idle", "absolute"])(
    "rechecks %s expiry after waiting for an unchanged row lock",
    async (kind) => {
      const original = await seedSession(ctx);
      const deadline = sql`clock_timestamp() + interval '3 seconds'`;
      if (kind === "absolute") {
        await ctx.db.update(sessions).set({ absoluteExpiresAt: deadline });
      } else {
        await ctx.db.update(sessions).set({
          lastUsedAt: sql`${deadline} - make_interval(secs => ${ctx.env.SESSION_IDLE_SECONDS}::integer)`,
        });
      }
      const before = await ctx.db.select().from(sessions);
      const locker = await ctx.client.connect();
      const lockerDb = drizzle({ client: locker });
      let pending: Promise<Response> | undefined;
      try {
        await locker.query("BEGIN");
        await locker.query("SET LOCAL statement_timeout = '5s'");
        const {
          rows: [{ pid }],
        } = await locker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
        await lockerDb.select().from(sessions).for("update");
        pending = Promise.resolve(refresh(original));
        await expect
          .poll(
            async () => {
              const result = await ctx.client.query<{ waiting: boolean }>(
                "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1::integer = ANY(pg_blocking_pids(pid))) AS waiting",
                [pid]
              );
              return result.rows[0].waiting;
            },
            { timeout: 2000, interval: 10 }
          )
          .toBe(true);
        const expires =
          kind === "absolute"
            ? sql`${sessions.absoluteExpiresAt}`
            : sql`${sessions.lastUsedAt} + make_interval(secs => ${ctx.env.SESSION_IDLE_SECONDS}::integer)`;
        const [row] = await lockerDb
          .select({ unexpired: sql<boolean>`${expires} > clock_timestamp()` })
          .from(sessions);
        expect(row.unexpired).toBe(true);
        await lockerDb
          .select({
            wait: sql`pg_sleep(GREATEST(0, EXTRACT(EPOCH FROM (${expires} - clock_timestamp())))::double precision + 0.05)`,
          })
          .from(sessions);
      } finally {
        try {
          await locker.query("ROLLBACK");
        } finally {
          locker.release();
          await pending;
        }
      }
      const response = await pending;
      expect(response.status).toBe(401);
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(await ctx.db.select().from(sessions)).toEqual(before);
    },
    10000
  );

  it("returns 500 without cookies or session changes when PostgreSQL cannot rotate", async () => {
    const original = await seedSession(ctx);
    const before = await ctx.db.select().from(sessions);
    await withSessionWritesBlocked(ctx, async (blockedApp) => {
      const response = await blockedApp.request(`${API_PREFIX}/auth/refresh`, {
        method: "POST",
        headers: sessionHeaders(original),
      });
      expect(response.status).toBe(500);
      expect(errorRespSchema.parse(await response.json()).success).toBe(false);
      expect(response.headers.getSetCookie()).toEqual([]);
    });
    expect(await ctx.db.select().from(sessions)).toEqual(before);
    expect((await refresh(original)).status).toBe(200);
  });

  it("extends idle expiry on grace acceptance without changing the absolute deadline or cookies", async () => {
    const original = await seedSession(ctx);
    expect((await refresh(original)).status).toBe(200);
    await ctx.db.update(sessions).set({ lastUsedAt: sql`clock_timestamp() - interval '1 hour'` });
    const [before] = await ctx.db.select().from(sessions);
    const grace = await refresh(original);
    expect(grace.status).toBe(200);
    expect(grace.headers.getSetCookie()).toEqual([]);
    const [after] = await ctx.db.select().from(sessions);
    expect(new Date(after.lastUsedAt).getTime()).toBeGreaterThan(
      new Date(before.lastUsedAt).getTime()
    );
    expect(after).toMatchObject({
      tokenHash: before.tokenHash,
      prevTokenHash: before.prevTokenHash,
      rotatedAt: before.rotatedAt,
      absoluteExpiresAt: before.absoluteExpiresAt,
    });
  });
  it("returns an access token and rotates CSRF for a valid refresh", async () => {
    const { refreshToken, csrfToken } = await registerAndGetToken(app, mockUser);

    const res = await app.request(`${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: `refresh_token=${refreshToken}; csrf_token=${csrfToken}`,
        "X-CSRF-Token": csrfToken,
      },
    });

    expect(res.status).toBe(200);
    const respBody: unknown = await res.json();
    const response = tokenRespSchema.parse(respBody);
    expect(response.data.accessToken).toBeTypeOf("string");

    const cookies = res.headers.getSetCookie();
    const newCsrfCookie = cookies.find((c) => c.startsWith("csrf_token="));
    if (!newCsrfCookie) {
      throw new Error("CSRF cookie not found after refresh");
    }

    const newCsrfToken = newCsrfCookie.split(";")[0].replace(/^csrf_token=/, "");
    expect(newCsrfToken).not.toBe(csrfToken);
  });

  it("returns 401 without refresh cookie", async () => {
    const res = await app.request(`${API_PREFIX}/auth/refresh`, {
      method: "POST",
    });

    expect(res.status).toBe(401);
    const respBody: unknown = await res.json();
    const response = errorRespSchema.parse(respBody);
    expect(response.success).toBe(false);
    expect(response.message).toBe(AuthError.invalidToken().message);
  });
});
