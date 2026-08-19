import type { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initTest, registerAndGetToken } from "./helper";

import { meRespSchema } from "@/modules/auth/controllers/http/me";
import { registerRespSchema } from "@/modules/auth/controllers/http/register";
import { AuthError } from "@/modules/auth/error";
import type { DbClient } from "@/pkg/db";
import { API_PREFIX } from "@/pkg/http";
import { errorRespSchema, successRespSchema, tokenRespSchema } from "@/shared/response.schema";

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

describe("Auth Endpoints", () => {
  const mockUser = { email: "test@example.com", password: "pass123", name: "Test User" };

  describe(`POST ${API_PREFIX}/auth/register`, () => {
    it("returns 201 with accessToken", async () => {
      const res = await app.request(`${API_PREFIX}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockUser),
      });

      expect(res.status).toBe(201);
      const respBody: unknown = await res.json();
      const parseResult = registerRespSchema.safeParse(respBody);

      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        const response = parseResult.data;
        expect(response.data.accessToken).toBeTypeOf("string");
      }
    });

    it("sets refresh_token http only cookie", async () => {
      const res = await app.request(`${API_PREFIX}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockUser),
      });

      expect(res.status).toBe(201);

      const cookies = res.headers.getSetCookie();
      const refreshCookie = cookies.find((c) => c.startsWith("refresh_token="));

      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain("HttpOnly");
      expect(refreshCookie).toContain("Path=/api/v1/auth");
    });

    it("returns 409 when email already exists", async () => {
      await app.request(`${API_PREFIX}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockUser),
      });

      const res = await app.request(`${API_PREFIX}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockUser),
      });

      expect(res.status).toBe(409);
      const respBody: unknown = await res.json();
      const parseResult = errorRespSchema.safeParse(respBody);

      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        const response = parseResult.data;
        expect(response.success).toBe(false);
        expect(response.error).toBe(AuthError.emailAlreadyRegistered().code);
      }
    });
  });

  describe(`POST ${API_PREFIX}/auth/login`, () => {
    it("returns 200 with accessToken for valid credentials", async () => {
      await registerAndGetToken(app, mockUser);

      const res = await app.request(`${API_PREFIX}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: mockUser.email, password: mockUser.password }),
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

    it("returns 401 for wrong password", async () => {
      await registerAndGetToken(app, mockUser);

      const res = await app.request(`${API_PREFIX}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: mockUser.email, password: "wrongpassword" }),
      });

      expect(res.status).toBe(401);
      const respBody: unknown = await res.json();
      const parseResult = errorRespSchema.safeParse(respBody);

      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        const response = parseResult.data;
        expect(response.success).toBe(false);
        expect(response.message).toBe(AuthError.invalidCredentials().message);
      }
    });

    it("returns 401 for nonexistent email", async () => {
      const res = await app.request(`${API_PREFIX}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nonexistent@example.com", password: "pass123" }),
      });

      expect(res.status).toBe(401);
      const respBody: unknown = await res.json();
      const parseResult = errorRespSchema.safeParse(respBody);

      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        const response = parseResult.data;
        expect(response.success).toBe(false);
        expect(response.message).toBe(AuthError.invalidCredentials().message);
      }
    });
  });

  describe(`POST ${API_PREFIX}/auth/refresh`, () => {
    it("returns 200 with new accessToken given valid refresh cookie", async () => {
      const { refreshToken } = await registerAndGetToken(app, mockUser);

      const res = await app.request(`${API_PREFIX}/auth/refresh`, {
        method: "POST",
        headers: { Cookie: `refresh_token=${refreshToken}` },
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
      const res = await app.request(`${API_PREFIX}/auth/refresh`, {
        method: "POST",
        headers: { Cookie: "refresh_token=invalid-token-value" },
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
  });

  describe(`POST ${API_PREFIX}/auth/logout`, () => {
    it("clears refresh_token cookie", async () => {
      const { refreshToken } = await registerAndGetToken(app, mockUser);

      const res = await app.request(`${API_PREFIX}/auth/logout`, {
        method: "POST",
        headers: { Cookie: `refresh_token=${refreshToken}` },
      });

      expect(res.status).toBe(200);
      const respBody: unknown = await res.json();
      const parseResult = successRespSchema.safeParse(respBody);
      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        expect(parseResult.data.success).toBe(true);
      }

      const setCookies = res.headers.getSetCookie();
      const clearedCookie = setCookies.find((c) => c.startsWith("refresh_token="));
      expect(clearedCookie).toBeDefined();
      expect(clearedCookie).toContain("Max-Age=0");
    });
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
});
