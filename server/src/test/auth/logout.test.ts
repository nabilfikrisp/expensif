import type { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initTest, registerAndGetToken } from "../helper";

import type { DbClient } from "@/pkg/db";
import { API_PREFIX } from "@/pkg/http";
import { successRespSchema } from "@/shared/response.schema";

let app: OpenAPIHono;
let dbClient: DbClient | undefined;

beforeEach(async () => {
  dbClient = undefined;
  const testCtx = await initTest();
  app = testCtx.app;
  dbClient = testCtx.client;
});

afterEach(async () => {
  if (dbClient) {
    await dbClient.end();
    dbClient = undefined;
  }
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
    const parseResult = successRespSchema.safeParse(respBody);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.success).toBe(true);
    }

    const setCookies = res.headers.getSetCookie();
    const clearedRefreshCookie = setCookies.find((c) => c.startsWith("refresh_token="));
    expect(clearedRefreshCookie).toBeDefined();
    expect(clearedRefreshCookie).toContain("Max-Age=0");

    const clearedCsrfCookie = setCookies.find((c) => c.startsWith("csrf_token="));
    expect(clearedCsrfCookie).toBeDefined();
    expect(clearedCsrfCookie).toContain("Max-Age=0");
  });
});
