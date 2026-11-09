import type { OpenAPIHono } from "@hono/zod-openapi";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { initTest, registerAndGetToken, mockUser } from "../../../../helper";

import { AuthError } from "@/modules/auth/error";
import { API_PREFIX } from "@/pkg/http";
import { errorRespSchema, tokenRespSchema } from "@/shared/response.schema";

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

describe(`POST ${API_PREFIX}/auth/refresh`, () => {
  it("returns an access token and rotates CSRF for a valid refresh", async () => {
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
    const response = tokenRespSchema.parse(respBody);
    expect(response.data.accessToken).toBeTypeOf("string");

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
    const response = errorRespSchema.parse(respBody);
    expect(response.success).toBe(false);
    expect(response.message).toBe(AuthError.invalidToken().message);
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
    const response = errorRespSchema.parse(respBody);
    expect(response.success).toBe(false);
    expect(response.message).toBe(AuthError.invalidToken().message);
  });

  it("returns 403 when CSRF header is missing", async () => {
    const { refreshToken, csrfToken } = await registerAndGetToken(app, mockUser);

    const res = await app.request(`${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: { Cookie: `refresh_token=${refreshToken}; csrf_token=${csrfToken}` },
    });

    expect(res.status).toBe(403);
    const respBody: unknown = await res.json();
    const response = errorRespSchema.parse(respBody);
    expect(response.success).toBe(false);
    expect(response.message).toBe(AuthError.invalidCsrfToken().message);
  });

  it("returns 403 when CSRF header mismatches cookie", async () => {
    const { refreshToken, csrfToken } = await registerAndGetToken(app, mockUser);

    const res = await app.request(`${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: `refresh_token=${refreshToken}; csrf_token=${csrfToken}`,
        "X-CSRF-Token": "wrong-csrf-value",
      },
    });

    expect(res.status).toBe(403);
    const respBody: unknown = await res.json();
    const response = errorRespSchema.parse(respBody);
    expect(response.success).toBe(false);
    expect(response.message).toBe(AuthError.invalidCsrfToken().message);
  });
});
