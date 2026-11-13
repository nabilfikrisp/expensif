import { eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { initAuthUseCase } from "@/modules/auth/use-case";
import { sessions, users } from "@/pkg/db/schema";
import { initTest } from "@/test/helper/app";
import { mockUser } from "@/test/helper/auth";

let ctx: Awaited<ReturnType<typeof initTest>>;
const register = () => ctx.useCases.auth.register(mockUser.email, mockUser.password, mockUser.name);

beforeAll(async () => {
  ctx = await initTest();
  return () => ctx.client.end();
});
beforeEach(async () => ctx.resetDb());

// These tests inject a PostgreSQL failure at a specific transaction step; HTTP cannot select that step.
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
});
