import type { OpenAPIHono } from "@hono/zod-openapi";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  initTest,
  registerAndGetToken,
  mockUser,
  sessionHeaders,
  sessionCookies,
  withSessionWritesBlocked,
} from "../../../../helper";
import { sessions } from "@/pkg/db/schema";

import { API_PREFIX } from "@/pkg/http";
import { errorRespSchema, tokenRespSchema } from "@/shared/response.schema";

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

describe(`POST ${API_PREFIX}/auth/logout`, () => {
  const post = (operation: string, tokens: { refreshToken: string; csrfToken: string }) =>
    app.request(`${API_PREFIX}/auth/${operation}`, {
      method: "POST",
      headers: sessionHeaders(tokens),
    });

  it("a concurrent logout revokes any token returned by the racing refresh", async () => {
    const original = await registerAndGetToken(app, mockUser);
    const [refresh, logout] = await Promise.all([
      post("refresh", original),
      post("logout", original),
    ]);
    expect(logout.status).toBe(200);
    expect([200, 401]).toContain(refresh.status);
    expect((await ctx.db.select().from(sessions))[0].revokedAt).not.toBeNull();
    expect((await post("refresh", original)).status).toBe(401);
    if (refresh.status === 200) {
      expect((await post("refresh", sessionCookies(refresh))).status).toBe(401);
    }
  });

  it("late refresh cookies replayed by either tab cannot restore a logged-out session", async () => {
    const original = await registerAndGetToken(app, mockUser);
    // Hold the response at the transport boundary while another tab logs out using its old cookie.
    const delayedRefresh = await post("refresh", original);
    expect(delayedRefresh.status).toBe(200);
    const logout = await post("logout", original);
    expect(logout.status).toBe(200);
    expect(logout.headers.getSetCookie().every((cookie) => cookie.includes("Max-Age=0"))).toBe(
      true
    );

    const lateCookies = sessionCookies(delayedRefresh);
    const tabResponses = await Promise.all([
      post("refresh", lateCookies),
      post("refresh", lateCookies),
    ]);
    for (const response of tabResponses) {
      expect(response.status).toBe(401);
      expect(response.headers.getSetCookie()).toEqual([]);
    }
    // Logout revokes refresh sessions; access JWTs already issued still expire naturally.
    const { data } = tokenRespSchema.parse(await delayedRefresh.json());
    expect(
      (
        await app.request(`${API_PREFIX}/auth/me`, {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        })
      ).status
    ).toBe(200);
  });

  it("returns 500 and clears cookies when PostgreSQL cannot revoke, leaving the session unchanged", async () => {
    const original = await registerAndGetToken(app, mockUser);
    const before = await ctx.db.select().from(sessions);
    await withSessionWritesBlocked(ctx, async (blockedApp) => {
      const response = await blockedApp.request(`${API_PREFIX}/auth/logout`, {
        method: "POST",
        headers: sessionHeaders(original),
      });
      expect(response.status).toBe(500);
      expect(errorRespSchema.parse(await response.json()).success).toBe(false);
      const cookies = response.headers.getSetCookie();
      expect(
        cookies.some(
          (cookie) => cookie.startsWith("refresh_token=") && cookie.includes("Max-Age=0")
        )
      ).toBe(true);
      expect(
        cookies.some((cookie) => cookie.startsWith("csrf_token=") && cookie.includes("Max-Age=0"))
      ).toBe(true);
    });
    expect(await ctx.db.select().from(sessions)).toEqual(before);
    expect((await post("refresh", original)).status).toBe(200);
  });

  it("allows repeated logout, missing cookies, and unknown tokens", async () => {
    const original = await registerAndGetToken(app, mockUser);
    const login = () =>
      app.request(`${API_PREFIX}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: mockUser.email, password: mockUser.password }),
      });
    const otherLogin = await login();
    expect(otherLogin.status).toBe(200);
    const other = sessionCookies(otherLogin);
    const logout = await post("logout", original);
    expect(logout.status).toBe(200);
    expect(await logout.json()).toMatchObject({ success: true });
    expect(logout.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^refresh_token=.*Max-Age=0/),
        expect.stringMatching(/^csrf_token=.*Max-Age=0/),
      ])
    );
    expect((await post("refresh", original)).status).toBe(401);
    expect((await post("refresh", other)).status).toBe(200);
    const fresh = await login();
    expect(fresh.status).toBe(200);
    expect((await post("refresh", sessionCookies(fresh))).status).toBe(200);
    expect((await post("logout", original)).status).toBe(200);
    expect((await post("logout", { ...original, refreshToken: "unknown" })).status).toBe(200);
    expect((await app.request(`${API_PREFIX}/auth/logout`, { method: "POST" })).status).toBe(200);
  });

  it.each(["refresh", "logout"])(
    "%s rejects invalid CSRF without changing session state",
    async (operation) => {
      const original = await registerAndGetToken(app, mockUser);
      const before = await ctx.db.select().from(sessions);
      const invalidHeaders: Record<string, string>[] = [
        { Cookie: `refresh_token=${original.refreshToken}`, "X-CSRF-Token": original.csrfToken },
        { ...sessionHeaders(original), "X-CSRF-Token": "mismatch" },
        { Cookie: sessionHeaders(original).Cookie },
      ];
      for (const headers of invalidHeaders) {
        const response = await app.request(`${API_PREFIX}/auth/${operation}`, {
          method: "POST",
          headers,
        });
        expect(response.status).toBe(403);
        expect(response.headers.getSetCookie()).toEqual([]);
        expect(await ctx.db.select().from(sessions)).toEqual(before);
      }
      expect((await post("refresh", original)).status).toBe(200);
    }
  );
});
