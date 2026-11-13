import type { OpenAPIHono } from "@hono/zod-openapi";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listApiKeysRespSchema } from "@/modules/api-key/controllers/http/list";
import { apiKeys } from "@/modules/api-key/schema";
import { API_PREFIX } from "@/pkg/http";
import { initTest } from "@/test/helper/app";
import { testBearerAuthentication } from "@/test/helper/assertions";
import { seedUser, mockUser } from "@/test/helper/auth";
import { createApiKey } from "@/test/helper/linked-account";

let ctx: Awaited<ReturnType<typeof initTest>>;
let app: OpenAPIHono;
let resetDb: () => Promise<void>;

beforeAll(async () => {
  ctx = await initTest();
  app = ctx.app;
  resetDb = ctx.resetDb;
  return () => ctx.client.end();
});

beforeEach(async () => {
  await resetDb();
});

describe(`GET ${API_PREFIX}/api-keys`, () => {
  testBearerAuthentication(() => app, "GET", "/api-keys");

  it("documents query defaults and numeric constraints in OpenAPI", async () => {
    const res = await app.request(`${API_PREFIX}/doc`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      paths: {
        [`${API_PREFIX}/api-keys`]: {
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
    const { accessToken } = await seedUser(ctx, mockUser);
    const res = await app.request(`${API_PREFIX}/api-keys`, {
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
    const { accessToken } = await seedUser(ctx, mockUser);
    await createApiKey(app, accessToken, "own key");
    const other = await seedUser(ctx, { ...mockUser, email: "other@example.com" });
    await createApiKey(app, other.accessToken, "other key");
    const res = await app.request(`${API_PREFIX}/api-keys`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const respBody: unknown = await res.json();
    const response = listApiKeysRespSchema.parse(respBody);
    expect(response.success).toBe(true);
    expect(response.data).toHaveLength(1);
    expect(Object.keys((respBody as { data: object[] }).data[0]).sort()).toEqual(
      ["id", "keyHint", "label", "createdAt", "expiresAt", "lastUsedAt", "revokedAt"].sort()
    );
    expect(response.data[0].label).toBe("own key");
    expect(response.data[0].lastUsedAt).toBeNull();
    expect(response.data[0].revokedAt).toBeNull();
    expect(response.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    expect(respBody).not.toHaveProperty("data.0.key");
    expect(respBody).not.toHaveProperty("data.0.keyHash");
    expect(respBody).not.toHaveProperty("data.0.userId");
  });

  it("filters by label with pagination", async () => {
    const { accessToken } = await seedUser(ctx, mockUser);
    for (const label of ["telegram one", "telegram two", "another platform"]) {
      await createApiKey(app, accessToken, label);
    }
    const res = await app.request(`${API_PREFIX}/api-keys?label=telegram&page=2&limit=1`, {
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

  it("paginates in creation and ID order with timestamp ties and filters", async () => {
    const { userId, accessToken } = await seedUser(ctx, mockUser);
    const other = await seedUser(ctx, { ...mockUser, email: "other@example.com" });
    const earlier = "2026-01-01T00:00:00.000Z";
    const later = "2026-01-02T00:00:00.000Z";
    const fixtures = [
      { id: "key-7", createdAt: later, revokedAt: null },
      { id: "key-4", createdAt: earlier, revokedAt: earlier },
      { id: "key-2", createdAt: earlier, revokedAt: null },
      { id: "key-6", createdAt: later, revokedAt: later },
      { id: "key-1", createdAt: later, revokedAt: null },
      { id: "key-5", createdAt: earlier, revokedAt: null },
      { id: "key-3", createdAt: earlier, revokedAt: null },
    ];
    await ctx.db.insert(apiKeys).values(
      [
        ...fixtures.map((key) => ({ ...key, userId, label: "Telegram" })),
        { id: "key-0", createdAt: earlier, revokedAt: null, userId, label: "other" },
        {
          id: "key-8",
          createdAt: earlier,
          revokedAt: null,
          userId: other.userId,
          label: "Telegram",
        },
      ].map((key) => ({
        ...key,
        keyHash: `hash-${key.id}`,
        keyHint: "ek_****test",
        expiresAt: "2026-01-03T00:00:00.000Z",
      }))
    );

    for (const [status, expectedIds] of [
      ["active", ["key-2", "key-3", "key-5", "key-1", "key-7"]],
      ["revoked", ["key-4", "key-6"]],
      ["all", ["key-2", "key-3", "key-4", "key-5", "key-1", "key-6", "key-7"]],
    ] as const) {
      const limit = 2;
      const totalPages = Math.ceil(expectedIds.length / limit);
      for (let pass = 0; pass < 2; pass++) {
        const seenIds: string[] = [];
        for (let page = 1; page <= totalPages + 1; page++) {
          const res = await app.request(
            `${API_PREFIX}/api-keys?label=telegram&status=${status}&page=${page}&limit=${limit}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          expect(res.status).toBe(200);
          const body = listApiKeysRespSchema.parse(await res.json());
          expect(body.success).toBe(true);
          expect(body.pagination).toEqual({
            page,
            limit,
            total: expectedIds.length,
            totalPages,
          });
          const ids = body.data.map((key) => key.id);
          expect(ids).toEqual(expectedIds.slice((page - 1) * limit, page * limit));
          seenIds.push(...ids);
        }
        expect(seenIds).toEqual(expectedIds);
        expect(new Set(seenIds).size).toBe(expectedIds.length);
      }
    }
  });

  it("filters active, revoked, and all keys", async () => {
    const { accessToken } = await seedUser(ctx, mockUser);
    const active = await createApiKey(app, accessToken);
    const revoked = await createApiKey(app, accessToken);
    const changed = await app.request(`${API_PREFIX}/api-keys/${revoked.id}/revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(changed.status).toBe(200);
    for (const [query, expected] of [
      ["", [active.id]],
      ["?status=active", [active.id]],
      ["?status=revoked", [revoked.id]],
      ["?status=all", [active.id, revoked.id]],
    ] as const) {
      const response = await app.request(`${API_PREFIX}/api-keys${query}`, {
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

  it("returns 400 for a non-positive page", async () => {
    const { accessToken } = await seedUser(ctx, mockUser);
    const res = await app.request(`${API_PREFIX}/api-keys?page=0`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(400);
    const respBody: unknown = await res.json();
    expect(respBody).toMatchObject({ success: false });
  });

  it("returns 400 for a limit above 100", async () => {
    const { accessToken } = await seedUser(ctx, mockUser);
    const res = await app.request(`${API_PREFIX}/api-keys?limit=101`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(400);
    const respBody: unknown = await res.json();
    expect(respBody).toMatchObject({ success: false });
  });

  it("returns 400 for an invalid status", async () => {
    const { accessToken } = await seedUser(ctx, mockUser);
    const res = await app.request(`${API_PREFIX}/api-keys?status=invalid`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(400);
    const respBody: unknown = await res.json();
    expect(respBody).toMatchObject({ success: false });
  });
});
