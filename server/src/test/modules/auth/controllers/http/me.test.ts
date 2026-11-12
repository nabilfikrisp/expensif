import type { OpenAPIHono } from "@hono/zod-openapi";
import { SignJWT } from "jose";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  testBearerAuthentication,
  initTest,
  registerAndGetToken,
  mockUser,
} from "../../../../helper";

import { meRespSchema } from "@/modules/auth/controllers/http/me";
import { AuthError } from "@/modules/auth/error";
import { API_PREFIX } from "@/pkg/http";

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

describe(`GET ${API_PREFIX}/auth/me`, () => {
  testBearerAuthentication(() => app, "GET", "/auth/me");

  it("rejects a correctly signed token without an owner identity", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("15m")
      .sign(ctx.services.auth.encodeSecret(ctx.env.JWT_SECRET));
    const response = await app.request(`${API_PREFIX}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: AuthError.invalidJwtPayload().code });
  });
  it("returns 200 with user data given valid Bearer token", async () => {
    const { accessToken } = await registerAndGetToken(app, mockUser);

    const res = await app.request(`${API_PREFIX}/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const respBody: unknown = await res.json();
    const response = meRespSchema.parse(respBody);
    expect(response.data.user.email).toBe(mockUser.email);
    expect(response.data.user.name).toBe(mockUser.name);
  });
});
