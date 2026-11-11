import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { initTest, mockUser } from "../../helper";

let ctx: Awaited<ReturnType<typeof initTest>>;

beforeAll(async () => {
  ctx = await initTest();
  return () => ctx.client.end();
});
beforeEach(async () => ctx.resetDb());

describe("AuthService", () => {
  it("registers and authenticates without issuing refresh JWTs", async () => {
    const registered = await ctx.services.auth.register(
      mockUser.email,
      mockUser.password,
      mockUser.name
    );
    expect(
      await ctx.db.transaction((tx) =>
        ctx.services.auth.login(mockUser.email, mockUser.password, tx)
      )
    ).toEqual(registered);
    await expect(
      ctx.db.transaction((tx) => ctx.services.auth.login(mockUser.email, "incorrect", tx))
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    await expect(
      ctx.db.transaction((tx) =>
        ctx.services.auth.login("unknown@example.com", mockUser.password, tx)
      )
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("issues an access JWT with the configured lifetime and access secret", async () => {
    const { auth } = ctx.services;
    const token = await auth.issueAccessToken("user-id");
    const payload = await auth.verifyToken(token, auth.encodeSecret(ctx.env.JWT_SECRET));
    expect(payload.sub).toBe("user-id");
    if (payload.exp === undefined || payload.iat === undefined) {
      throw new Error("Missing access token timestamps");
    }
    expect(payload.exp - payload.iat).toBe(15 * 60);
  });
});
