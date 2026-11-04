import type { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initTest } from "../helper";

import { registerRespSchema } from "@/modules/auth/controllers/http/register";
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

describe(`POST ${API_PREFIX}/auth/register`, () => {
  const mockUser = { email: "test@example.com", password: "pass123", name: "Test User" };

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

  it("sets csrf_token cookie without HttpOnly", async () => {
    const res = await app.request(`${API_PREFIX}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockUser),
    });

    expect(res.status).toBe(201);

    const cookies = res.headers.getSetCookie();
    const csrfCookie = cookies.find((c) => c.startsWith("csrf_token="));

    expect(csrfCookie).toBeDefined();
    expect(csrfCookie).not.toContain("HttpOnly");
    expect(csrfCookie).toContain("Path=/api/v1/auth");
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
