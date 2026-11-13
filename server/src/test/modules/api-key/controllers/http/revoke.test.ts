import type { OpenAPIHono } from "@hono/zod-openapi";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listApiKeysRespSchema } from "@/modules/api-key/controllers/http/list";
import { ApiKeyError } from "@/modules/api-key/error";
import { API_PREFIX } from "@/pkg/http";
import { errorRespSchema, successRespSchema } from "@/shared/response.schema";
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

describe(`POST ${API_PREFIX}/api-keys/{id}/revoke`, () => {
  testBearerAuthentication(
    () => app,
    "POST",
    "/api-keys/550e8400-e29b-41d4-a716-446655440000/revoke"
  );

  it("returns 200 and revokes the key", async () => {
    const { accessToken } = await seedUser(ctx, mockUser);
    const key = await createApiKey(app, accessToken, "telegram");
    const res = await app.request(`${API_PREFIX}/api-keys/${key.id}/revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const respBody: unknown = await res.json();
    const response = successRespSchema.parse(respBody);
    expect(response.success).toBe(true);
    expect(response.message).toBe("API key revoked");

    const listed = await app.request(`${API_PREFIX}/api-keys?status=all`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(listed.status).toBe(200);
    const listedBody: unknown = await listed.json();
    const listedResult = listApiKeysRespSchema.parse(listedBody);

    expect(listedResult.data).toHaveLength(1);
    expect(listedResult.data[0].id).toBe(key.id);
    expect(listedResult.data[0].revokedAt).not.toBeNull();
    const repeated = await app.request(`${API_PREFIX}/api-keys/${key.id}/revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(repeated.status).toBe(400);
    expect(await repeated.json()).toMatchObject({ error: ApiKeyError.keyAlreadyRevoked().code });
  });

  it("returns 404 for a nonexistent key", async () => {
    const { accessToken } = await seedUser(ctx, mockUser);
    const res = await app.request(
      `${API_PREFIX}/api-keys/550e8400-e29b-41d4-a716-446655440000/revoke`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    expect(res.status).toBe(404);
    const respBody: unknown = await res.json();
    const response = errorRespSchema.parse(respBody);
    expect(response.success).toBe(false);
    expect(response.message).toBe(ApiKeyError.keyNotFound().message);
    expect(response.error).toBe(ApiKeyError.keyNotFound().code);
  });

  it("returns 404 for another user's key and leaves it unchanged", async () => {
    const { accessToken } = await seedUser(ctx, mockUser);
    const key = await createApiKey(app, accessToken, "telegram");
    const other = await seedUser(ctx, { ...mockUser, email: "other@example.com" });
    const res = await app.request(`${API_PREFIX}/api-keys/${key.id}/revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${other.accessToken}` },
    });
    expect(res.status).toBe(404);
    const respBody: unknown = await res.json();
    const response = errorRespSchema.parse(respBody);
    expect(response.success).toBe(false);
    expect(response.message).toBe(ApiKeyError.keyNotFound().message);
    expect(response.error).toBe(ApiKeyError.keyNotFound().code);

    const listed = await app.request(`${API_PREFIX}/api-keys?status=all`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(listed.status).toBe(200);
    const listedBody: unknown = await listed.json();
    const listedResult = listApiKeysRespSchema.parse(listedBody);

    expect(listedResult.data).toHaveLength(1);
    expect(listedResult.data[0].id).toBe(key.id);
    expect(listedResult.data[0].revokedAt).toBeNull();
    expect(listedResult.data[0].lastUsedAt).toBeNull();
  });

  it("returns 400 for an invalid key ID", async () => {
    const { accessToken } = await seedUser(ctx, mockUser);
    const res = await app.request(`${API_PREFIX}/api-keys/not-a-uuid/revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(400);
    const respBody: unknown = await res.json();
    expect(respBody).toMatchObject({ success: false });
  });
});
