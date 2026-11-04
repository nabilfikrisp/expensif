import type { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initTest, registerAndGetToken } from "../helper";

import { meRespSchema } from "@/modules/auth/controllers/http/me";
import { AuthError } from "@/modules/auth/error";
import type { DbClient } from "@/pkg/db";
import { API_PREFIX } from "@/pkg/http";
import { errorRespSchema } from "@/shared/response.schema";

let app: OpenAPIHono;
let dbClient: DbClient;

beforeEach(async () => {
  const testCtx = await initTest();
  app = testCtx.app;
  dbClient = testCtx.client;
});

afterEach(() => {
  dbClient.close();
});

describe(`GET ${API_PREFIX}/auth/me`, () => {
  const mockUser = { email: "test@example.com", password: "pass123", name: "Test User" };

  it("returns 200 with user data given valid Bearer token", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);

    const res = await app.request(`${API_PREFIX}/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const respBody: unknown = await res.json();
    const parseResult = meRespSchema.safeParse(respBody);

    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const response = parseResult.data;
      expect(response.data.user.email).toBe(mockUser.email);
      expect(response.data.user.name).toBe(mockUser.name);
    }
  });

  it("returns 401 without Authorization header", async () => {
    const res = await app.request(`${API_PREFIX}/auth/me`, {
      method: "GET",
    });

    expect(res.status).toBe(401);
    const respBody: unknown = await res.json();
    const parseResult = errorRespSchema.safeParse(respBody);

    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const response = parseResult.data;
      expect(response.success).toBe(false);
      expect(response.message).toBe(AuthError.missingBearerHeader().message);
    }
  });

  it("returns 401 with invalid token", async () => {
    const res = await app.request(`${API_PREFIX}/auth/me`, {
      method: "GET",
      headers: { Authorization: "Bearer invalid-token-value" },
    });

    expect(res.status).toBe(401);
    const respBody: unknown = await res.json();
    const parseResult = errorRespSchema.safeParse(respBody);

    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const response = parseResult.data;
      expect(response.success).toBe(false);
      expect(response.message).toBe(AuthError.failedVerifyingJwt().message);
    }
  });
});
