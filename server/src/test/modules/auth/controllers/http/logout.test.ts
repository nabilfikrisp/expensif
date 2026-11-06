import type { OpenAPIHono } from "@hono/zod-openapi";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { initTest, registerAndGetToken } from "../../../../helper";

import { API_PREFIX } from "@/pkg/http";
import { successRespSchema } from "@/shared/response.schema";

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

describe(`POST ${API_PREFIX}/auth/logout`, () => {
  const mockUser = { email: "test@example.com", password: "pass123", name: "Test User" };

  it("clears refresh_token and csrf_token cookie", async () => {
    const { refreshToken } = await registerAndGetToken(app, mockUser);

    const res = await app.request(`${API_PREFIX}/auth/logout`, {
      method: "POST",
      headers: { Cookie: `refresh_token=${refreshToken}` },
    });

    expect(res.status).toBe(200);
    const respBody: unknown = await res.json();
    const parseResult = successRespSchema.parse(respBody);

    expect(parseResult.success).toBe(true);

    const setCookies = res.headers.getSetCookie();
    const clearedRefreshCookie = setCookies.find((c) => c.startsWith("refresh_token="));
    expect(clearedRefreshCookie).toBeDefined();
    expect(clearedRefreshCookie).toContain("Max-Age=0");

    const clearedCsrfCookie = setCookies.find((c) => c.startsWith("csrf_token="));
    expect(clearedCsrfCookie).toBeDefined();
    expect(clearedCsrfCookie).toContain("Max-Age=0");
  });
});
