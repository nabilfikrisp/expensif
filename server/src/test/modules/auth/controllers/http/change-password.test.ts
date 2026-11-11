import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { initTest, mockUser, registerAndGetToken } from "../../../../helper";

import { API_PREFIX } from "@/pkg/http";

let ctx: Awaited<ReturnType<typeof initTest>>;
const newPassword = "updated-password-123";
beforeAll(async () => {
  ctx = await initTest();
  return () => ctx.client.end();
});
beforeEach(async () => ctx.resetDb());

async function setup() {
  const tokens = await registerAndGetToken(ctx.app, mockUser);
  return {
    ...tokens,
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json",
      Cookie: `refresh_token=${tokens.refreshToken}; csrf_token=${tokens.csrfToken}`,
      "X-CSRF-Token": tokens.csrfToken,
    },
  };
}

describe("POST /auth/change-password", () => {
  it("revokes every owned session, clears cookies, and requires the new password", async () => {
    const current = await setup();
    const other = await ctx.useCases.auth.login(mockUser.email, mockUser.password);
    const unrelated = await ctx.useCases.auth.register(
      "other@example.com",
      mockUser.password,
      "Other"
    );
    const response = await ctx.app.request(`${API_PREFIX}/auth/change-password`, {
      method: "POST",
      headers: current.headers,
      body: JSON.stringify({ currentPassword: mockUser.password, newPassword }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^refresh_token=.*Max-Age=0/),
        expect.stringMatching(/^csrf_token=.*Max-Age=0/),
      ])
    );
    for (const token of [current.refreshToken, other.refreshToken]) {
      await expect(ctx.useCases.auth.refreshSession(token)).rejects.toMatchObject({
        code: "INVALID_TOKEN",
      });
    }
    await expect(ctx.useCases.auth.login(mockUser.email, mockUser.password)).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    expect((await ctx.useCases.auth.login(mockUser.email, newPassword)).accessToken).toBeTypeOf(
      "string"
    );
    expect((await ctx.useCases.auth.refreshSession(unrelated.refreshToken)).accessToken).toBeTypeOf(
      "string"
    );
  });

  it.each([
    "wrong-password",
    "invalid-new-password",
    "missing-auth",
    "missing-csrf",
    "supplied-user-id",
  ])("rejects %s without changing credentials or sessions", async (failure) => {
    const current = await setup();
    const headers: Record<string, string> = { ...current.headers };
    const body: Record<string, string> = { currentPassword: mockUser.password, newPassword };
    let status = 400;
    if (failure === "wrong-password") {
      body.currentPassword = "wrong";
      status = 401;
    }
    if (failure === "invalid-new-password") {
      body.newPassword = "short";
    }
    if (failure === "missing-auth") {
      delete headers.Authorization;
      status = 401;
    }
    if (failure === "missing-csrf") {
      delete headers["X-CSRF-Token"];
      status = 403;
    }
    if (failure === "supplied-user-id") {
      body.userId = crypto.randomUUID();
    }
    const response = await ctx.app.request(`${API_PREFIX}/auth/change-password`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(status);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(
      (
        await ctx.db.transaction((tx) =>
          ctx.services.auth.login(mockUser.email, mockUser.password, tx)
        )
      ).userId
    ).toBeTypeOf("string");
    expect((await ctx.useCases.auth.refreshSession(current.refreshToken)).accessToken).toBeTypeOf(
      "string"
    );
  });
});
