import type { OpenAPIHono } from "@hono/zod-openapi";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { generateApiKeyRespSchema } from "@/modules/api-key/controllers/http/generate";
import { API_PREFIX } from "@/pkg/http";
import { initTest } from "@/test/helper/app";
import { testBearerAuthentication } from "@/test/helper/assertions";
import { seedUser, registerAndGetToken, mockUser } from "@/test/helper/auth";

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

describe(`POST ${API_PREFIX}/api-key`, () => {
  testBearerAuthentication(() => app, "POST", "/api-key");

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
    const { accessToken } = await seedUser(ctx, mockUser);
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

  it("returns 400 for a non-string label", async () => {
    const { accessToken } = await seedUser(ctx, mockUser);
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
