import type { OpenAPIHono } from "@hono/zod-openapi";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { initTest } from "../../../../helper";

import { registerRespSchema } from "@/modules/auth/controllers/http/register";
import { AuthError } from "@/modules/auth/error";
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

describe(`POST ${API_PREFIX}/auth/register`, () => {
  const mockUser = { email: "test@example.com", password: "password123", name: "Test User" };

  it.each([
    ["too short", "pass123", "INVALID_PASSWORD_MIN_LENGTH"],
    ["too long", "a".repeat(129), "INVALID_PASSWORD_MAX_LENGTH"],
    ["invalid Unicode", "password-\ud800", "INVALID_PASSWORD_UNICODE"],
  ])("returns 400 when the password is %s", async (_label, password, error) => {
    const res = await app.request(`${API_PREFIX}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...mockUser, password }),
    });

    expect(res.status).toBe(400);
    expect(errorRespSchema.parse(await res.json())).toMatchObject({ success: false, error });
  });

  it("returns 201 with accessToken and secure cookies", async () => {
    const res = await app.request(`${API_PREFIX}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockUser),
    });

    expect(res.status).toBe(201);
    const respBody: unknown = await res.json();
    const response = registerRespSchema.parse(respBody);
    expect(response.data.accessToken).toBeTypeOf("string");

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
    const response = errorRespSchema.parse(respBody);
    expect(response.success).toBe(false);
    expect(response.error).toBe(AuthError.emailAlreadyRegistered().code);
  });
});
