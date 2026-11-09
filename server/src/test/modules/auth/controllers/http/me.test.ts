import type { OpenAPIHono } from "@hono/zod-openapi";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { initTest, registerAndGetToken, mockUser } from "../../../../helper";

import { meRespSchema } from "@/modules/auth/controllers/http/me";
import { AuthError } from "@/modules/auth/error";
import { UserError } from "@/modules/user/error";
import { API_PREFIX } from "@/pkg/http";
import { errorRespSchema } from "@/shared/response.schema";

let app: OpenAPIHono;
let resetDb: () => Promise<void>;
beforeAll(async () => {
  const ctx = await initTest();
  app = ctx.app;
  resetDb = ctx.resetDb;
  return () => ctx.client.end();
});

beforeEach(async () => {
  await resetDb();
});

describe(`GET ${API_PREFIX}/auth/me`, () => {
  it("returns 200 with user data given valid Bearer token", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);

    const res = await app.request(`${API_PREFIX}/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const respBody: unknown = await res.json();
    const response = meRespSchema.parse(respBody);
    expect(response.data.user.email).toBe(mockUser.email);
    expect(response.data.user.name).toBe(mockUser.name);
  });

  it("returns 404 when the token owner no longer exists", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    const deleted = await app.request(`${API_PREFIX}/user/me`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(deleted.status).toBe(200);

    const res = await app.request(`${API_PREFIX}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      success: false,
      message: UserError.notFound().message,
      error: UserError.notFound().code,
    });
  });

  it("returns 401 without Authorization header", async () => {
    const res = await app.request(`${API_PREFIX}/auth/me`, {
      method: "GET",
    });

    expect(res.status).toBe(401);
    const respBody: unknown = await res.json();
    const response = errorRespSchema.parse(respBody);
    expect(response.success).toBe(false);
    expect(response.message).toBe(AuthError.missingBearerHeader().message);
  });

  it("returns 401 with invalid token", async () => {
    const res = await app.request(`${API_PREFIX}/auth/me`, {
      method: "GET",
      headers: { Authorization: "Bearer invalid-token-value" },
    });

    expect(res.status).toBe(401);
    const respBody: unknown = await res.json();
    const response = errorRespSchema.parse(respBody);
    expect(response.success).toBe(false);
    expect(response.message).toBe(AuthError.failedVerifyingJwt().message);
  });
});
