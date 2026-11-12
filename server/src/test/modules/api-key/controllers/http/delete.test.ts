import type { OpenAPIHono } from "@hono/zod-openapi";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  testBearerAuthentication,
  createApiKey,
  initTest,
  registerAndGetToken,
  mockUser,
} from "../../../../helper";

import { listApiKeysRespSchema } from "@/modules/api-key/controllers/http/list";
import { ApiKeyError } from "@/modules/api-key/error";
import { API_PREFIX } from "@/pkg/http";
import { errorRespSchema, successRespSchema } from "@/shared/response.schema";

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

describe(`DELETE ${API_PREFIX}/api-key/{id}`, () => {
  testBearerAuthentication(() => app, "DELETE", "/api-key/550e8400-e29b-41d4-a716-446655440000");

  it("returns 200 and deletes the key", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    const key = await createApiKey(app, accessToken, "telegram");
    const res = await app.request(`${API_PREFIX}/api-key/${key.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const respBody: unknown = await res.json();
    const response = successRespSchema.parse(respBody);
    expect(response.success).toBe(true);
    expect(response.message).toBe("API key deleted");

    const listed = await app.request(`${API_PREFIX}/api-key?status=all`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(listed.status).toBe(200);
    const listedBody: unknown = await listed.json();
    const listedResult = listApiKeysRespSchema.parse(listedBody);

    expect(listedResult.data).toEqual([]);
    const repeated = await app.request(`${API_PREFIX}/api-key/${key.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(repeated.status).toBe(404);
    expect(await repeated.json()).toMatchObject({ error: ApiKeyError.keyNotFound().code });
  });

  it("returns 404 for a nonexistent key", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    const res = await app.request(`${API_PREFIX}/api-key/550e8400-e29b-41d4-a716-446655440000`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(404);
    const respBody: unknown = await res.json();
    const response = errorRespSchema.parse(respBody);
    expect(response.success).toBe(false);
    expect(response.message).toBe(ApiKeyError.keyNotFound().message);
    expect(response.error).toBe(ApiKeyError.keyNotFound().code);
  });

  it("returns 404 for another user's key and leaves it unchanged", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    const key = await createApiKey(app, accessToken, "telegram");
    const other = await registerAndGetToken(app, { ...mockUser, email: "other@example.com" });
    const res = await app.request(`${API_PREFIX}/api-key/${key.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${other.accessToken}` },
    });
    expect(res.status).toBe(404);
    const respBody: unknown = await res.json();
    const response = errorRespSchema.parse(respBody);
    expect(response.success).toBe(false);
    expect(response.message).toBe(ApiKeyError.keyNotFound().message);
    expect(response.error).toBe(ApiKeyError.keyNotFound().code);

    const listed = await app.request(`${API_PREFIX}/api-key?status=all`, {
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
    const { accessToken } = await registerAndGetToken(app, mockUser);
    const res = await app.request(`${API_PREFIX}/api-key/not-a-uuid`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(400);
    const respBody: unknown = await res.json();
    expect(respBody).toMatchObject({ success: false });
  });
});
