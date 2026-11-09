import type { OpenAPIHono } from "@hono/zod-openapi";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApiKey, initTest, registerAndGetToken, mockUser } from "../../../../helper";

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
    const response = listApiKeysRespSchema.parse(respBody);
    expect(response.success).toBe(true);
    expect(response.data).toEqual([]);
    expect(response.pagination).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
  });

  it("returns only the authenticated user's keys without exposing secrets", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    await createApiKey(app, accessToken, "own key");
    const other = await registerAndGetToken(app, { ...mockUser, email: "other@example.com" });
    await createApiKey(app, other.accessToken, "other key");
    const res = await app.request(`${API_PREFIX}/api-key`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const respBody: unknown = await res.json();
    const response = listApiKeysRespSchema.parse(respBody);
    expect(response.success).toBe(true);
    expect(response.data).toHaveLength(1);
    expect(response.data[0].label).toBe("own key");
    expect(response.data[0].lastUsedAt).toBeNull();
    expect(response.data[0].revokedAt).toBeNull();
    expect(response.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    expect(respBody).not.toHaveProperty("data.0.key");
    expect(respBody).not.toHaveProperty("data.0.keyHash");
    expect(respBody).not.toHaveProperty("data.0.userId");
  });

  it("filters by label with pagination", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    for (const label of ["telegram one", "telegram two", "another platform"]) {
      await createApiKey(app, accessToken, label);
    }
    const res = await app.request(`${API_PREFIX}/api-key?label=telegram&page=2&limit=1`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const respBody: unknown = await res.json();
    const response = listApiKeysRespSchema.parse(respBody);
    expect(response.success).toBe(true);
    expect(response.data).toHaveLength(1);
    expect(response.data[0].label).toContain("telegram");
    expect(response.pagination).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
  });

  it("filters active, revoked, and all keys", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    const active = await createApiKey(app, accessToken);
    const revoked = await createApiKey(app, accessToken);
    const changed = await app.request(`${API_PREFIX}/api-key/${revoked.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(changed.status).toBe(200);
    for (const [query, expected] of [
      ["", [active.id]],
      ["?status=active", [active.id]],
      ["?status=revoked", [revoked.id]],
      ["?status=all", [active.id, revoked.id]],
    ] as const) {
      const response = await app.request(`${API_PREFIX}/api-key${query}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(response.status, query).toBe(200);
      const body = listApiKeysRespSchema.parse(await response.json());
      expect(body.data.map((key) => key.id).sort(), query).toEqual([...expected].sort());
      expect(body.pagination.total, query).toBe(expected.length);
      if (query === "?status=revoked") {
        expect(body.data[0].revokedAt).not.toBeNull();
      }
    }
  });

  it("returns 401 without Authorization header", async () => {
    const res = await app.request(`${API_PREFIX}/api-key`, {
      method: "GET",
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
      method: "GET",
      headers: { Authorization: `Bearer invalid-token-value` },
    });
    expect(res.status).toBe(401);
    const respBody: unknown = await res.json();
    const response = errorRespSchema.parse(respBody);
    expect(response.success).toBe(false);
    expect(response.message).toBe(AuthError.failedVerifyingJwt().message);
    expect(response.error).toBe(AuthError.failedVerifyingJwt().code);
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
