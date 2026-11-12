import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  initTest,
  mockUser,
  registerAndGetToken,
  loginAndGetTokens,
  refreshSession,
} from "../../../../helper";

import { API_PREFIX } from "@/pkg/http";

let ctx: Awaited<ReturnType<typeof initTest>>;
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

describe("POST /auth/logout-all", () => {
  it("revokes all owned sessions including the current one, without affecting other users", async () => {
    const current = await setup();
    const other = await loginAndGetTokens(ctx.app, mockUser.email, mockUser.password);
    const unrelated = await registerAndGetToken(ctx.app, {
      ...mockUser,
      email: "other@example.com",
      name: "Other",
    });
    const response = await ctx.app.request(`${API_PREFIX}/auth/logout-all`, {
      method: "POST",
      headers: current.headers,
      body: JSON.stringify({ currentPassword: mockUser.password }),
    });
    expect(response.status).toBe(200);
    expect(
      (
        await ctx.app.request(`${API_PREFIX}/auth/logout-all`, {
          method: "POST",
          headers: current.headers,
          body: JSON.stringify({ currentPassword: mockUser.password }),
        })
      ).status
    ).toBe(200);
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^refresh_token=.*Max-Age=0/),
        expect.stringMatching(/^csrf_token=.*Max-Age=0/),
      ])
    );
    for (const tokens of [current, other]) {
      expect((await refreshSession(ctx.app, tokens)).status).toBe(401);
    }
    expect((await refreshSession(ctx.app, unrelated)).status).toBe(200);
    const fresh = await loginAndGetTokens(ctx.app, mockUser.email, mockUser.password);
    expect((await refreshSession(ctx.app, fresh)).status).toBe(200);
  });

  it.each(["wrong-password", "missing-auth", "missing-csrf", "supplied-user-id"])(
    "rejects %s without revoking sessions or clearing cookies",
    async (failure) => {
      const current = await setup();
      const headers: Record<string, string> = { ...current.headers };
      const body: Record<string, string> = { currentPassword: mockUser.password };
      let status = 400;
      if (failure === "wrong-password") {
        body.currentPassword = "wrong";
        status = 401;
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
      const response = await ctx.app.request(`${API_PREFIX}/auth/logout-all`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(status);
      expect(response.headers.getSetCookie()).toEqual([]);
      expect((await refreshSession(ctx.app, current)).status).toBe(200);
    }
  );
});
