import type { OpenAPIHono } from "@hono/zod-openapi";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { initTest, registerAndGetToken } from "../../../../helper";

import { generateApiKeyRespSchema } from "@/modules/api-key/controllers/http/generate";
import { listApiKeysRespSchema } from "@/modules/api-key/controllers/http/list";
import { ApiKeyError } from "@/modules/api-key/error";
import { AuthError } from "@/modules/auth/error";
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
  const mockUser = { email: "test@example.com", password: "pass123", name: "Test User" };

  it("returns 200 and deletes the key", async () => {
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
      const res = await app.request(`${API_PREFIX}/api-key/${key.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const respBody: unknown = await res.json();
      const parseResult = successRespSchema.safeParse(respBody);

      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        const response = parseResult.data;
        expect(response.success).toBe(true);
        expect(response.message).toBe("API key deleted");
      }
      const listed = await app.request(`${API_PREFIX}/api-key?status=all`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(listed.status).toBe(200);
      const listedBody: unknown = await listed.json();
      const listedResult = listApiKeysRespSchema.safeParse(listedBody);
      expect(listedResult.success).toBe(true);
      if (listedResult.success) {
        expect(listedResult.data.data).toEqual([]);
      }
    }
  });

  it("returns 404 for an already-deleted key", async () => {
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
      const first = await app.request(`${API_PREFIX}/api-key/${key.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(first.status).toBe(200);
      const res = await app.request(`${API_PREFIX}/api-key/${key.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(404);
      const respBody: unknown = await res.json();
      const parseResult = errorRespSchema.safeParse(respBody);

      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        const response = parseResult.data;
        expect(response.success).toBe(false);
        expect(response.message).toBe(ApiKeyError.keyNotFound().message);
        expect(response.error).toBe(ApiKeyError.keyNotFound().code);
      }
    }
  });

  it("returns 404 for a nonexistent key", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);
    const res = await app.request(`${API_PREFIX}/api-key/550e8400-e29b-41d4-a716-446655440000`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(404);
    const respBody: unknown = await res.json();
    const parseResult = errorRespSchema.safeParse(respBody);

    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const response = parseResult.data;
      expect(response.success).toBe(false);
      expect(response.message).toBe(ApiKeyError.keyNotFound().message);
      expect(response.error).toBe(ApiKeyError.keyNotFound().code);
    }
  });

  it("returns 404 for another user's key and leaves it unchanged", async () => {
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
      const other = await registerAndGetToken(app, { ...mockUser, email: "other@example.com" });
      const res = await app.request(`${API_PREFIX}/api-key/${key.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${other.accessToken}` },
      });
      expect(res.status).toBe(404);
      const respBody: unknown = await res.json();
      const parseResult = errorRespSchema.safeParse(respBody);

      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        const response = parseResult.data;
        expect(response.success).toBe(false);
        expect(response.message).toBe(ApiKeyError.keyNotFound().message);
        expect(response.error).toBe(ApiKeyError.keyNotFound().code);
      }
      const listed = await app.request(`${API_PREFIX}/api-key?status=all`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(listed.status).toBe(200);
      const listedBody: unknown = await listed.json();
      const listedResult = listApiKeysRespSchema.safeParse(listedBody);
      expect(listedResult.success).toBe(true);
      if (listedResult.success) {
        expect(listedResult.data.data).toHaveLength(1);
        expect(listedResult.data.data[0].id).toBe(key.id);
        expect(listedResult.data.data[0].revokedAt).toBeNull();
        expect(listedResult.data.data[0].lastUsedAt).toBeNull();
      }
    }
  });

  it("returns 401 without Authorization header", async () => {
    const res = await app.request(`${API_PREFIX}/api-key/550e8400-e29b-41d4-a716-446655440000`, {
      method: "DELETE",
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
    const res = await app.request(`${API_PREFIX}/api-key/550e8400-e29b-41d4-a716-446655440000`, {
      method: "DELETE",
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
