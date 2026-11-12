import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  loginAndGetTokens,
  initTest,
  mockUser,
  registerAndGetToken,
  refreshSession,
  sessionCookies,
} from "../../../../helper";

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
  it("does not let a racing old-password login escape revocation", async () => {
    const current = await setup();
    const [login, change] = await Promise.all([
      ctx.app.request(`${API_PREFIX}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: mockUser.email, password: mockUser.password }),
      }),
      ctx.app.request(`${API_PREFIX}/auth/change-password`, {
        method: "POST",
        headers: current.headers,
        body: JSON.stringify({ currentPassword: mockUser.password, newPassword }),
      }),
    ]);
    expect(change.status).toBe(200);
    if (login.status === 200) {
      expect((await refreshSession(ctx.app, sessionCookies(login))).status).toBe(401);
    } else {
      expect(login.status).toBe(401);
      expect(await login.json()).toMatchObject({ error: "INVALID_CREDENTIALS" });
    }
    expect((await refreshSession(ctx.app, current)).status).toBe(401);
  });
  it("revokes every owned session, clears cookies, and requires the new password", async () => {
    const current = await setup();
    const other = await loginAndGetTokens(ctx.app, mockUser.email, mockUser.password);
    const unrelated = await registerAndGetToken(ctx.app, {
      ...mockUser,
      email: "other@example.com",
      name: "Other",
    });
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
    for (const tokens of [current, other]) {
      expect((await refreshSession(ctx.app, tokens)).status).toBe(401);
    }
    const oldLogin = await ctx.app.request(`${API_PREFIX}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: mockUser.email, password: mockUser.password }),
    });
    expect(oldLogin.status).toBe(401);
    await loginAndGetTokens(ctx.app, mockUser.email, newPassword);
    expect((await refreshSession(ctx.app, unrelated)).status).toBe(200);
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
    await loginAndGetTokens(ctx.app, mockUser.email, mockUser.password);
    expect((await refreshSession(ctx.app, current)).status).toBe(200);
  });
});
