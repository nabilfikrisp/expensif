import type { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initTest, registerAndGetToken } from "../helper";

import { AuthError } from "@/modules/auth/error";
import type { DbClient } from "@/pkg/db";
import { API_PREFIX } from "@/pkg/http";
import { errorRespSchema, tokenRespSchema } from "@/shared/response.schema";

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

describe(`POST ${API_PREFIX}/auth/refresh`, () => {
  const mockUser = { email: "test@example.com", password: "pass123", name: "Test User" };

  it("returns 200 with new accessToken given valid refresh cookie", async () => {
    const { refreshToken, csrfToken } = await registerAndGetToken(app, mockUser);

    const res = await app.request(`${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: `refresh_token=${refreshToken}; csrf_token=${csrfToken}`,
        "X-CSRF-Token": csrfToken,
      },
    });

    expect(res.status).toBe(200);
    const respBody: unknown = await res.json();
    const parseResult = tokenRespSchema.safeParse(respBody);

    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const response = parseResult.data;
      expect(response.data.accessToken).toBeTypeOf("string");
    }
  });

  it("returns 200 and rotates csrf cookie", async () => {
    const { refreshToken, csrfToken } = await registerAndGetToken(app, mockUser);

    const res = await app.request(`${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: `refresh_token=${refreshToken}; csrf_token=${csrfToken}`,
        "X-CSRF-Token": csrfToken,
      },
    });

    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    const newCsrfCookie = cookies.find((c) => c.startsWith("csrf_token="));
    if (!newCsrfCookie) {
      throw new Error("CSRF cookie not found after refresh");
    }

    const newCsrfToken = newCsrfCookie.split(";")[0].replace(/^csrf_token=/, "");
    expect(newCsrfToken).not.toBe(csrfToken);
  });

  it("returns 401 without refresh cookie", async () => {
    const res = await app.request(`${API_PREFIX}/auth/refresh`, {
      method: "POST",
    });

    expect(res.status).toBe(401);
    const respBody: unknown = await res.json();
    const parseResult = errorRespSchema.safeParse(respBody);

    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const response = parseResult.data;
      expect(response.success).toBe(false);
      expect(response.message).toBe(AuthError.invalidToken().message);
    }
  });

  it("returns 401 with invalid refresh token", async () => {
    const { csrfToken } = await registerAndGetToken(app, mockUser);

    const res = await app.request(`${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: `refresh_token=invalid-token-value; csrf_token=${csrfToken}`,
        "X-CSRF-Token": csrfToken,
      },
    });

    expect(res.status).toBe(401);
    const respBody: unknown = await res.json();
    const parseResult = errorRespSchema.safeParse(respBody);

    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const response = parseResult.data;
      expect(response.success).toBe(false);
      expect(response.message).toBe(AuthError.invalidToken().message);
    }
  });

  it("returns 403 when CSRF header is missing", async () => {
    const { refreshToken } = await registerAndGetToken(app, mockUser);

    const res = await app.request(`${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: { Cookie: `refresh_token=${refreshToken}` },
    });

    expect(res.status).toBe(403);
    const respBody: unknown = await res.json();
    const parseResult = errorRespSchema.safeParse(respBody);

    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const response = parseResult.data;
      expect(response.success).toBe(false);
      expect(response.message).toBe(AuthError.invalidCsrfToken().message);
    }
  });

  it("returns 403 when CSRF header mismatches cookie", async () => {
    const { refreshToken } = await registerAndGetToken(app, mockUser);

    const res = await app.request(`${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: `refresh_token=${refreshToken}`,
        "X-CSRF-Token": "wrong-csrf-value",
      },
    });

    expect(res.status).toBe(403);
    const respBody: unknown = await res.json();
    const parseResult = errorRespSchema.safeParse(respBody);

    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const response = parseResult.data;
      expect(response.success).toBe(false);
      expect(response.message).toBe(AuthError.invalidCsrfToken().message);
    }
  });
});
