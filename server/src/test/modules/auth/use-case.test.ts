import { eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { initTest, mockUser } from "../../helper";
import { initAuthUseCase } from "@/modules/auth/use-case";
import { initSessionService } from "@/modules/session/service";
import { sessions, users } from "@/pkg/db/schema";

let ctx: Awaited<ReturnType<typeof initTest>>;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
function requireRefresh(result: { refresh: { token: string; expiresAt: string } | null }) {
  if (!result.refresh) {
    throw new Error("Expected a rotated refresh token");
  }
  return result.refresh;
}
const register = () => ctx.useCases.auth.register(mockUser.email, mockUser.password, mockUser.name);

beforeAll(async () => {
  ctx = await initTest();
  return () => ctx.client.end();
});
beforeEach(async () => ctx.resetDb());

describe("AuthUseCase", () => {
  it("stores only a hash, rotates once under concurrency, and accepts the previous token", async () => {
    const original = await register();
    const [before] = await ctx.db.select().from(sessions);
    expect(before.tokenHash).toBe(hash(original.refreshToken));
    expect(Buffer.from(original.refreshToken, "base64url")).toHaveLength(32);

    const results = await Promise.all([
      ctx.useCases.auth.refreshSession(original.refreshToken),
      ctx.useCases.auth.refreshSession(original.refreshToken),
    ]);
    expect(results.filter((r) => r.refresh !== null)).toHaveLength(1);
    const [after] = await ctx.db.select().from(sessions);
    expect(after.prevTokenHash).toBe(before.tokenHash);
    expect(after.absoluteExpiresAt).toBe(before.absoluteExpiresAt);
    expect(after.tokenHash).toBe(
      hash(requireRefresh(results.find((r) => r.refresh) ?? results[0]).token)
    );
  });

  it("commits revocation when a previous token is reused outside grace", async () => {
    const original = await register();
    const rotated = await ctx.useCases.auth.refreshSession(original.refreshToken);
    await ctx.db
      .update(sessions)
      .set({ rotatedAt: sql`clock_timestamp() - interval '31 seconds'` });
    await expect(ctx.useCases.auth.refreshSession(original.refreshToken)).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
    const [session] = await ctx.db.select().from(sessions);
    expect(session.revokedAt).not.toBeNull();
    await expect(
      ctx.useCases.auth.refreshSession(requireRefresh(rotated).token)
    ).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
  });

  it("rejects older and unknown tokens without revoking the session", async () => {
    const original = await register();
    const first = await ctx.useCases.auth.refreshSession(original.refreshToken);
    const second = await ctx.useCases.auth.refreshSession(requireRefresh(first).token);
    for (const token of [original.refreshToken, "unknown-token"]) {
      await expect(ctx.useCases.auth.refreshSession(token)).rejects.toMatchObject({
        code: "INVALID_TOKEN",
      });
    }
    expect((await ctx.db.select().from(sessions))[0].revokedAt).toBeNull();
    expect(
      (await ctx.useCases.auth.refreshSession(requireRefresh(second).token)).refresh
    ).not.toBeNull();
  });

  it.each(["idle", "absolute"])("rejects %s expiry without advancing last use", async (kind) => {
    const original = await register();
    if (kind === "idle") {
      await ctx.db
        .update(sessions)
        .set({ lastUsedAt: sql`clock_timestamp() - interval '3 hours'` });
    } else {
      await ctx.db
        .update(sessions)
        .set({ absoluteExpiresAt: sql`clock_timestamp() - interval '1 second'` });
    }
    const [before] = await ctx.db.select().from(sessions);
    await expect(ctx.useCases.auth.refreshSession(original.refreshToken)).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
    expect((await ctx.db.select().from(sessions))[0].lastUsedAt).toBe(before.lastUsedAt);
  });

  it("logs out only the identified session and permits a fresh login", async () => {
    const original = await register();
    const other = await ctx.useCases.auth.login(mockUser.email, mockUser.password);
    await ctx.useCases.auth.logout(original.refreshToken);
    await ctx.useCases.auth.logout(original.refreshToken);
    await ctx.useCases.auth.logout(undefined);
    await ctx.useCases.auth.logout("unknown-token");
    await expect(ctx.useCases.auth.refreshSession(original.refreshToken)).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
    expect((await ctx.useCases.auth.refreshSession(other.refreshToken)).refresh).not.toBeNull();
    const fresh = await ctx.useCases.auth.login(mockUser.email, mockUser.password);
    expect((await ctx.useCases.auth.refreshSession(fresh.refreshToken)).refresh).not.toBeNull();
  });

  it("deleting the user removes sessions and prevents refresh", async () => {
    const original = await register();
    await ctx.db.delete(users).where(eq(users.email, mockUser.email));
    expect(await ctx.db.select().from(sessions)).toHaveLength(0);
    await expect(ctx.useCases.auth.refreshSession(original.refreshToken)).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
  });
  it("rolls back registration when PostgreSQL rejects session creation", async () => {
    const sessionService = initSessionService(
      { ...ctx.env, SESSION_ABSOLUTE_SECONDS: NaN },
      ctx.db
    );
    const useCase = initAuthUseCase({ db: ctx.db, authService: ctx.services.auth, sessionService });
    await expect(
      useCase.register(mockUser.email, mockUser.password, mockUser.name)
    ).rejects.toThrow();
    expect(await ctx.db.select().from(users)).toHaveLength(0);
    expect(await ctx.db.select().from(sessions)).toHaveLength(0);
  });

  it("serializes refresh and logout on the same session", async () => {
    const original = await register();
    const results = await Promise.allSettled([
      ctx.useCases.auth.refreshSession(original.refreshToken),
      ctx.useCases.auth.logout(original.refreshToken),
    ]);
    expect(results[1].status).toBe("fulfilled");
    const [session] = await ctx.db.select().from(sessions);
    expect(session.revokedAt).not.toBeNull();
    if (results[0].status === "fulfilled" && results[0].value.refresh) {
      await expect(
        ctx.useCases.auth.refreshSession(results[0].value.refresh.token)
      ).rejects.toMatchObject({ code: "INVALID_TOKEN" });
    } else {
      expect(results[0]).toMatchObject({ status: "rejected", reason: { code: "INVALID_TOKEN" } });
    }
  });
});

// These checks exercise the transaction shared by credential changes and session revocation.
describe("password change transactions", () => {
  const newPassword = "updated-password-123";
  it("rolls back the password when revocation encounters a PostgreSQL failure", async () => {
    await register();
    const [user] = await ctx.db.select().from(users).where(eq(users.email, mockUser.email));
    const useCase = initAuthUseCase({
      db: ctx.db,
      authService: ctx.services.auth,
      sessionService: {
        ...ctx.services.session,
        async revokeAllSessions(_userId, tx) {
          await tx.execute(sql`SELECT 1 / 0`);
        },
      },
    });
    await expect(useCase.changePassword(user.id, mockUser.password, newPassword)).rejects.toThrow();
    expect((await ctx.db.select().from(users))[0].passwordHash).toBe(user.passwordHash);
    expect((await ctx.db.select().from(sessions))[0].revokedAt).toBeNull();
  });

  it("does not let a racing old-password login escape revocation", async () => {
    await register();
    const [user] = await ctx.db.select().from(users).where(eq(users.email, mockUser.email));
    const [login, change] = await Promise.allSettled([
      ctx.useCases.auth.login(mockUser.email, mockUser.password),
      ctx.useCases.auth.changePassword(user.id, mockUser.password, newPassword),
    ]);
    expect(change.status).toBe("fulfilled");
    if (login.status === "fulfilled") {
      await expect(
        ctx.useCases.auth.refreshSession(login.value.refreshToken)
      ).rejects.toMatchObject({ code: "INVALID_TOKEN" });
    } else {
      expect(login.reason).toMatchObject({ code: "INVALID_CREDENTIALS" });
    }
    const owned = await ctx.db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(owned.every((session) => session.revokedAt !== null)).toBe(true);
  });
});

describe("logout all transactions", () => {
  it("rolls back revocation and propagates PostgreSQL failure", async () => {
    const original = await register();
    const [user] = await ctx.db.select().from(users).where(eq(users.email, mockUser.email));
    const useCase = initAuthUseCase({
      db: ctx.db,
      authService: ctx.services.auth,
      sessionService: {
        ...ctx.services.session,
        async revokeAllSessions(userId, tx) {
          await ctx.services.session.revokeAllSessions(userId, tx);
          await tx.execute(sql`SELECT 1 / 0`);
        },
      },
    });
    await expect(useCase.logoutAll(user.id, mockUser.password)).rejects.toThrow();
    expect((await ctx.db.select().from(sessions))[0].revokedAt).toBeNull();
    expect((await ctx.useCases.auth.refreshSession(original.refreshToken)).accessToken).toBeTypeOf(
      "string"
    );
  });

  it("is idempotent and does not change the password", async () => {
    await register();
    const [user] = await ctx.db.select().from(users).where(eq(users.email, mockUser.email));
    await ctx.useCases.auth.logoutAll(user.id, mockUser.password);
    const [first] = await ctx.db.select().from(sessions);
    await ctx.useCases.auth.logoutAll(user.id, mockUser.password);
    expect((await ctx.db.select().from(sessions))[0].revokedAt).toBe(first.revokedAt);
    expect((await ctx.db.select().from(users))[0].passwordHash).toBe(user.passwordHash);
  });
});
