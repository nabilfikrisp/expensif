import { eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

import { sessions } from "@/pkg/db/schema";
import { initTest } from "@/test/helper/app";
import { seedUser } from "@/test/helper/auth";

let ctx: Awaited<ReturnType<typeof initTest>>;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
beforeAll(async () => {
  ctx = await initTest();
  return () => ctx.client.end();
});
beforeEach(async () => ctx.resetDb());

// Cleanup has no request entry point; call the operation directly without waiting for the daily scheduler.
describe("SessionService.cleanupExpiredSessions", () => {
  it("deletes idle and absolute expired sessions while preserving unexpired rows", async () => {
    const { userId } = await seedUser(ctx);
    const active = await ctx.services.session.createSession(userId);
    const idle = await ctx.services.session.createSession(userId);
    const absolute = await ctx.services.session.createSession(userId);
    const revoked = await ctx.services.session.createSession(userId);
    await ctx.useCases.auth.logout(revoked.refreshToken);
    await ctx.db
      .update(sessions)
      .set({ lastUsedAt: sql`clock_timestamp() - interval '3 hours'` })
      .where(eq(sessions.tokenHash, tokenHash(idle.refreshToken)));
    await ctx.db
      .update(sessions)
      .set({ absoluteExpiresAt: sql`clock_timestamp() - interval '1 second'` })
      .where(eq(sessions.tokenHash, tokenHash(absolute.refreshToken)));

    expect(await ctx.db.select().from(sessions)).toHaveLength(4);
    await ctx.services.session.cleanupExpiredSessions();
    const remaining = await ctx.db.select().from(sessions);
    expect(remaining.map((session) => session.tokenHash).sort()).toEqual(
      [tokenHash(active.refreshToken), tokenHash(revoked.refreshToken)].sort()
    );
    await ctx.services.session.cleanupExpiredSessions();
    expect(await ctx.db.select().from(sessions)).toEqual(remaining);
    expect((await ctx.useCases.auth.refreshSession(active.refreshToken)).accessToken).toBeTypeOf(
      "string"
    );
  });
});
