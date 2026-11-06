import type { OpenAPIHono } from "@hono/zod-openapi";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { initTest, registerAndGetToken } from "../../../../helper";

import { generateApiKeyRespSchema } from "@/modules/api-key/controllers/http/generate";
import { listApiKeysRespSchema } from "@/modules/api-key/controllers/http/list";
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

describe(`GET ${API_PREFIX}/api-key`, () => {
  const mockUser = { email: "test@example.com", password: "pass123", name: "Test User" };

  it("documents query defaults and numeric constraints in OpenAPI", async () => {
    const res = await app.request(`${API_PREFIX}/doc`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      paths: {
        [`${API_PREFIX}/api-key`]: {
          get: {
            parameters: [
              { name: "label" },
              {
                name: "status",
                required: false,
                schema: {
                  enum: ["active", "revoked", "all"],
                  default: "active",
                },
              },
              {
                name: "page",
                required: false,
                schema: {
                  type: "integer",
                  minimum: 0,
                  exclusiveMinimum: true,
                  default: 1,
                },
              },
              {
                name: "limit",
                required: false,
                schema: {
                  type: "integer",
                  minimum: 0,
                  exclusiveMinimum: true,
                  maximum: 100,
                  default: 10,
                },
              },
            ],
          },
        },
      },
    });
  });

  it("returns 200 with an empty list when the user has no keys", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    const res = await app.request(`${API_PREFIX}/api-key`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const respBody: unknown = await res.json();
    const parseResult = listApiKeysRespSchema.safeParse(respBody);

    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const response = parseResult.data;
      expect(response.success).toBe(true);
      expect(response.data).toEqual([]);
      expect(response.pagination).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
    }
  });

  it("returns only the authenticated user's keys without exposing secrets", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    const ownKey = await app.request(`${API_PREFIX}/api-key`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ label: "own key" }),
    });
    expect(ownKey.status).toBe(201);
    const other = await registerAndGetToken(app, { ...mockUser, email: "other@example.com" });
    const otherKey = await app.request(`${API_PREFIX}/api-key`, {
      method: "POST",
      headers: { Authorization: `Bearer ${other.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ label: "other key" }),
    });
    expect(otherKey.status).toBe(201);
    const res = await app.request(`${API_PREFIX}/api-key`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const respBody: unknown = await res.json();
    const parseResult = listApiKeysRespSchema.safeParse(respBody);

    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const response = parseResult.data;
      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(1);
      expect(response.data[0].label).toBe("own key");
      expect(response.data[0].lastUsedAt).toBeNull();
      expect(response.data[0].revokedAt).toBeNull();
      expect(response.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
      expect(respBody).not.toHaveProperty("data.0.key");
      expect(respBody).not.toHaveProperty("data.0.keyHash");
      expect(respBody).not.toHaveProperty("data.0.userId");
    }
  });

  it("filters by label with pagination", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    for (const label of ["telegram one", "telegram two", "another platform"]) {
      const generated = await app.request(`${API_PREFIX}/api-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      expect(generated.status).toBe(201);
    }
    const res = await app.request(`${API_PREFIX}/api-key?label=telegram&page=2&limit=1`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const respBody: unknown = await res.json();
    const parseResult = listApiKeysRespSchema.safeParse(respBody);

    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const response = parseResult.data;
      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(1);
      expect(response.data[0].label).toContain("telegram");
      expect(response.pagination).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
    }
  });

  it("excludes revoked keys by default", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    const generated = await app.request(`${API_PREFIX}/api-key`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ label: "telegram" }),
    });
    expect(generated.status).toBe(201);
    const generatedBody: unknown = await generated.json();
    const generatedResult = generateApiKeyRespSchema.safeParse(generatedBody);
    expect(generatedResult.success).toBe(true);
    if (generatedResult.success) {
      const { data: key } = generatedResult.data;
      const revoked = await app.request(`${API_PREFIX}/api-key/${key.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(revoked.status).toBe(200);
      const res = await app.request(`${API_PREFIX}/api-key`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const respBody: unknown = await res.json();
      const parseResult = listApiKeysRespSchema.safeParse(respBody);

      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        const response = parseResult.data;
        expect(response.success).toBe(true);
        expect(response.data).toHaveLength(0);
        expect(response.pagination.total).toBe(0);
      }
    }
  });

  it("lists revoked keys when requested", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    const generated = await app.request(`${API_PREFIX}/api-key`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ label: "telegram" }),
    });
    expect(generated.status).toBe(201);
    const generatedBody: unknown = await generated.json();
    const generatedResult = generateApiKeyRespSchema.safeParse(generatedBody);
    expect(generatedResult.success).toBe(true);
    if (generatedResult.success) {
      const { data: key } = generatedResult.data;
      const revoked = await app.request(`${API_PREFIX}/api-key/${key.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(revoked.status).toBe(200);
      const res = await app.request(`${API_PREFIX}/api-key?status=revoked`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const respBody: unknown = await res.json();
      const parseResult = listApiKeysRespSchema.safeParse(respBody);

      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        const response = parseResult.data;
        expect(response.success).toBe(true);
        expect(response.data).toHaveLength(1);
        expect(response.pagination.total).toBe(1);
        expect(response.data[0].id).toBe(key.id);
        expect(response.data[0].revokedAt).not.toBeNull();
      }
    }
  });

  it("includes revoked keys when requesting all statuses", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    const generated = await app.request(`${API_PREFIX}/api-key`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ label: "telegram" }),
    });
    expect(generated.status).toBe(201);
    const generatedBody: unknown = await generated.json();
    const generatedResult = generateApiKeyRespSchema.safeParse(generatedBody);
    expect(generatedResult.success).toBe(true);
    if (generatedResult.success) {
      const { data: key } = generatedResult.data;
      const revoked = await app.request(`${API_PREFIX}/api-key/${key.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(revoked.status).toBe(200);
      const res = await app.request(`${API_PREFIX}/api-key?status=all`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const respBody: unknown = await res.json();
      const parseResult = listApiKeysRespSchema.safeParse(respBody);

      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        const response = parseResult.data;
        expect(response.success).toBe(true);
        expect(response.data).toHaveLength(1);
        expect(response.pagination.total).toBe(1);
        expect(response.data[0].id).toBe(key.id);
        expect(response.data[0].revokedAt).not.toBeNull();
      }
    }
  });

  it("returns 401 without Authorization header", async () => {
    const res = await app.request(`${API_PREFIX}/api-key`, {
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
      expect(response.error).toBe(AuthError.missingBearerHeader().code);
    }
  });

  it("returns 401 with invalid token", async () => {
    const res = await app.request(`${API_PREFIX}/api-key`, {
      method: "GET",
      headers: { Authorization: `Bearer invalid-token-value` },
    });
    expect(res.status).toBe(401);
    const respBody: unknown = await res.json();
    const parseResult = errorRespSchema.safeParse(respBody);

    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const response = parseResult.data;
      expect(response.success).toBe(false);
      expect(response.message).toBe(AuthError.failedVerifyingJwt().message);
      expect(response.error).toBe(AuthError.failedVerifyingJwt().code);
    }
  });

  it("returns 400 for a non-positive page", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    const res = await app.request(`${API_PREFIX}/api-key?page=0`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(400);
    const respBody: unknown = await res.json();
    expect(respBody).toMatchObject({ success: false });
  });

  it("returns 400 for a limit above 100", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    const res = await app.request(`${API_PREFIX}/api-key?limit=101`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(400);
    const respBody: unknown = await res.json();
    expect(respBody).toMatchObject({ success: false });
  });

  it("returns 400 for an invalid status", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    const res = await app.request(`${API_PREFIX}/api-key?status=invalid`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(400);
    const respBody: unknown = await res.json();
    expect(respBody).toMatchObject({ success: false });
  });
});
