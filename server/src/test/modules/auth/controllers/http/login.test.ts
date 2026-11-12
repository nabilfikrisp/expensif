import type { OpenAPIHono } from "@hono/zod-openapi";
import { decodeJwt } from "jose";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AuthError } from "@/modules/auth/error";
import { API_PREFIX } from "@/pkg/http";
import { errorRespSchema, tokenRespSchema } from "@/shared/response.schema";
import { initTest } from "@/test/helper/app";
import { registerAndGetToken, mockUser } from "@/test/helper/auth";

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

describe(`POST ${API_PREFIX}/auth/login`, () => {
  it("returns 200 with accessToken and secure cookies for valid credentials", async () => {
    await registerAndGetToken(app, mockUser);

    const res = await app.request(`${API_PREFIX}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: mockUser.email, password: mockUser.password }),
    });

    expect(res.status).toBe(200);
    const respBody: unknown = await res.json();
    const response = tokenRespSchema.parse(respBody);
    const payload = decodeJwt(response.data.accessToken);
    if (payload.exp === undefined || payload.iat === undefined) {
      throw new Error("Missing access token timestamps");
    }
    expect(payload.exp - payload.iat).toBe(15 * 60);
    const me = await app.request(`${API_PREFIX}/auth/me`, {
      headers: { Authorization: `Bearer ${response.data.accessToken}` },
    });
    expect(me.status).toBe(200);
    const profile = (await me.json()) as { data: { user: { id: string } } };
    expect(payload.sub).toBe(profile.data.user.id);

    const cookies = res.headers.getSetCookie();
    const refreshCookie = cookies.find((c) => c.startsWith("refresh_token="));

    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain("HttpOnly");
    expect(refreshCookie).toContain("Path=/api/v1/auth");
    const csrfCookie = cookies.find((c) => c.startsWith("csrf_token="));

    expect(csrfCookie).toBeDefined();
    expect(csrfCookie).not.toContain("HttpOnly");
    expect(csrfCookie).toContain("Path=/;");
  });

  it("returns 401 for wrong password", async () => {
    await registerAndGetToken(app, mockUser);

    const res = await app.request(`${API_PREFIX}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: mockUser.email, password: "wrongpassword" }),
    });

    expect(res.status).toBe(401);
    const respBody: unknown = await res.json();
    const response = errorRespSchema.parse(respBody);
    expect(response.success).toBe(false);
    expect(response.message).toBe(AuthError.invalidCredentials().message);
  });

  it("returns 401 for nonexistent email", async () => {
    const res = await app.request(`${API_PREFIX}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nonexistent@example.com", password: "pass1234" }),
    });

    expect(res.status).toBe(401);
    const respBody: unknown = await res.json();
    const response = errorRespSchema.parse(respBody);
    expect(response.success).toBe(false);
    expect(response.message).toBe(AuthError.invalidCredentials().message);
  });
});
