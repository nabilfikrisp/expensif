import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createLinkedUser, initTest } from "../../../../helper";

import { meRespSchema } from "@/modules/auth/controllers/http/me";
import { listLinkedAccountsRespSchema } from "@/modules/linked-account/controllers/http/list";
import { API_PREFIX } from "@/pkg/http";

let ctx: Awaited<ReturnType<typeof initTest>>;

beforeAll(async () => {
  ctx = await initTest();
  return () => ctx.client.end();
});

beforeEach(async () => {
  await ctx.resetDb();
});

describe(`GET ${API_PREFIX}/linked-account`, () => {
  it("lists only the token owner's accounts despite a supplied userId", async () => {
    const owner = await createLinkedUser(ctx, "owner");
    const other = await createLinkedUser(ctx, "other");
    const me = await ctx.app.request(`${API_PREFIX}/auth/me`, { headers: other.headers });
    expect(me.status).toBe(200);
    const {
      data: { user },
    } = meRespSchema.parse(await me.json());

    const res = await ctx.app.request(`${API_PREFIX}/linked-account?userId=${user.id}`, {
      headers: owner.headers,
    });
    expect(res.status).toBe(200);
    expect(listLinkedAccountsRespSchema.parse(await res.json()).data).toEqual([owner.account]);
  });

  it.each([undefined, "Bearer invalid-token"])(
    "rejects unauthenticated access (%s)",
    async (authorization) => {
      const owner = await createLinkedUser(ctx, "owner");
      const headers: Record<string, string> = authorization ? { Authorization: authorization } : {};
      const res = await ctx.app.request(`${API_PREFIX}/linked-account`, {
        method: "GET",
        headers,
      });
      expect(res.status).toBe(401);
      const unchanged = await ctx.app.request(`${API_PREFIX}/linked-account`, {
        headers: owner.headers,
      });
      expect(listLinkedAccountsRespSchema.parse(await unchanged.json()).data).toEqual([
        owner.account,
      ]);
    }
  );
});
