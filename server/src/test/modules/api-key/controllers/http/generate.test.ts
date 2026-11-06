import type { OpenAPIHono } from "@hono/zod-openapi";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { initTest, registerAndGetToken } from "../../../../helper";

import { generateApiKeyRespSchema } from "@/modules/api-key/controllers/http/generate";
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

describe(`POST ${API_PREFIX}/api-key`, () => {
  const mockUser = { email: "test@example.com", password: "pass123", name: "Test User" };

  it("returns 201 with a labeled API key", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    const res = await app.request(`${API_PREFIX}/api-key`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ label: "telegram link" }),
    });
    expect(res.status).toBe(201);
    const respBody: unknown = await res.json();
    const response = generateApiKeyRespSchema.parse(respBody);
    expect(response.success).toBe(true);
    expect(response.data.label).toBe("telegram link");
    expect(response.data.key).toMatch(/^ek_[a-f0-9]{32}$/);
    expect(response.data.keyHint).toBe(`ek_****${response.data.key.slice(-4)}`);
    expect(Date.parse(response.data.expiresAt)).toBeGreaterThan(
      Date.parse(response.data.createdAt)
    );
    expect(respBody).not.toHaveProperty("data.keyHash");
    expect(respBody).not.toHaveProperty("data.userId");
  });

  it("returns 201 without an optional label", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    const res = await app.request(`${API_PREFIX}/api-key`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const respBody: unknown = await res.json();
    const response = generateApiKeyRespSchema.parse(respBody);
    expect(response.success).toBe(true);
    expect(response.data.label).toBeNull();
    expect(response.data.key).toMatch(/^ek_[a-f0-9]{32}$/);
  });

  it("returns 401 without Authorization header", async () => {
    const res = await app.request(`${API_PREFIX}/api-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
    const respBody: unknown = await res.json();
    const response = errorRespSchema.parse(respBody);
    expect(response.success).toBe(false);
    expect(response.message).toBe(AuthError.missingBearerHeader().message);
    expect(response.error).toBe(AuthError.missingBearerHeader().code);
  });

  it("returns 401 with invalid token", async () => {
    const res = await app.request(`${API_PREFIX}/api-key`, {
      method: "POST",
      headers: { Authorization: `Bearer invalid-token-value`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
    const respBody: unknown = await res.json();
    const response = errorRespSchema.parse(respBody);
    expect(response.success).toBe(false);
    expect(response.message).toBe(AuthError.failedVerifyingJwt().message);
    expect(response.error).toBe(AuthError.failedVerifyingJwt().code);
  });

  it("returns 400 for a non-string label", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    const res = await app.request(`${API_PREFIX}/api-key`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ label: 123 }),
    });
    expect(res.status).toBe(400);
    const respBody: unknown = await res.json();
    expect(respBody).toMatchObject({ success: false });
  });
});
