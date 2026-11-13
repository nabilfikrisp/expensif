import type { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listLinkedAccountsRespSchema } from "@/modules/linked-account/controllers/http/list";
import { meRespSchema } from "@/modules/user/controllers/http/me";
import { UserError } from "@/modules/user/error";
import { sessions, users } from "@/pkg/db/schema";
import { API_PREFIX } from "@/pkg/http";
import { initTest } from "@/test/helper/app";
import { registerAndGetToken, sessionHeaders } from "@/test/helper/auth";
import { createLinkedUser } from "@/test/helper/linked-account";

let app: OpenAPIHono;
let ctx: Awaited<ReturnType<typeof initTest>>;
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

describe(`DELETE ${API_PREFIX}/users/me`, () => {
  it("deletes only the token owner despite another user ID in the request", async () => {
    const owner = await registerAndGetToken(app, {
      email: "owner@example.com",
      password: "pass1234",
      name: "Owner",
    });
    const other = await registerAndGetToken(app, {
      email: "other@example.com",
      password: "pass1234",
      name: "Other",
    });
    const otherHeaders = { Authorization: `Bearer ${other.accessToken}` };
    const otherMe = await app.request(`${API_PREFIX}/users/me`, { headers: otherHeaders });
    expect(otherMe.status).toBe(200);
    const {
      data: { user },
    } = meRespSchema.parse(await otherMe.json());
    const ownerHeaders = { Authorization: `Bearer ${owner.accessToken}` };

    const deleted = await app.request(`${API_PREFIX}/users/me?userId=${user.id}`, {
      method: "DELETE",
      headers: { ...ownerHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ success: true, message: "User deleted" });

    const ownerMe = await app.request(`${API_PREFIX}/users/me`, { headers: ownerHeaders });
    expect(ownerMe.status).toBe(404);
    expect(await ownerMe.json()).toMatchObject({ error: "USER_NOT_FOUND" });
    const remainingUsers = await ctx.db.select().from(users);
    expect(remainingUsers.map((row) => row.id)).toEqual([user.id]);
    expect(await ctx.db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(
      1
    );
    expect(await ctx.db.select().from(sessions)).toHaveLength(1);
    expect(
      (
        await app.request(`${API_PREFIX}/auth/refresh`, {
          method: "POST",
          headers: sessionHeaders(owner),
        })
      ).status
    ).toBe(401);
    const surviving = await app.request(`${API_PREFIX}/users/me`, { headers: otherHeaders });
    expect(surviving.status).toBe(200);
    expect(meRespSchema.parse(await surviving.json()).data.user.id).toBe(user.id);

    const repeated = await app.request(`${API_PREFIX}/users/me`, {
      method: "DELETE",
      headers: ownerHeaders,
    });
    expect(repeated.status).toBe(404);
    expect(await repeated.json()).toEqual({
      success: false,
      message: UserError.notFound().message,
      error: UserError.notFound().code,
    });
  });

  it("deleting a user cascades only their linked accounts", async () => {
    const owner = await createLinkedUser(ctx, "owner");
    const other = await createLinkedUser(ctx, "other");
    const deleted = await app.request(`${API_PREFIX}/users/me`, {
      method: "DELETE",
      headers: owner.headers,
    });
    expect(deleted.status).toBe(200);
    const removed = await app.request(`${API_PREFIX}/linked-accounts`, {
      headers: owner.headers,
    });
    expect(listLinkedAccountsRespSchema.parse(await removed.json()).data).toEqual([]);
    const surviving = await app.request(`${API_PREFIX}/linked-accounts`, {
      headers: other.headers,
    });
    expect(listLinkedAccountsRespSchema.parse(await surviving.json()).data).toEqual([
      other.account,
    ]);
  });

  it.each([undefined, "Bearer invalid-token"])(
    "rejects unauthorized deletion (%s)",
    async (authorization) => {
      const res = await app.request(`${API_PREFIX}/users/me`, {
        method: "DELETE",
        headers: authorization ? { Authorization: authorization } : {},
      });
      expect(res.status).toBe(401);
    }
  );
});
