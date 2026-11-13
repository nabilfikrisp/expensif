import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listLinkedAccountsRespSchema } from "@/modules/linked-account/controllers/http/list";
import { LinkedAccountError } from "@/modules/linked-account/error";
import { API_PREFIX } from "@/pkg/http";
import { initTest } from "@/test/helper/app";
import { createLinkedUser } from "@/test/helper/linked-account";

let ctx: Awaited<ReturnType<typeof initTest>>;

beforeAll(async () => {
  ctx = await initTest();
  return () => ctx.client.end();
});

beforeEach(async () => {
  await ctx.resetDb();
});

describe(`DELETE ${API_PREFIX}/linked-accounts/{id}`, () => {
  it("rejects an invalid account ID without deleting accounts", async () => {
    const owner = await createLinkedUser(ctx, "owner");
    const res = await ctx.app.request(`${API_PREFIX}/linked-accounts/not-a-uuid`, {
      method: "DELETE",
      headers: owner.headers,
    });
    expect(res.status).toBe(400);
    const unchanged = await ctx.app.request(`${API_PREFIX}/linked-accounts`, {
      headers: owner.headers,
    });
    expect(listLinkedAccountsRespSchema.parse(await unchanged.json()).data).toEqual([
      owner.account,
    ]);
  });

  it("rejects cross-user deletion and leaves the owner's account unchanged", async () => {
    const owner = await createLinkedUser(ctx, "owner");
    const other = await createLinkedUser(ctx, "other");
    const denied = await ctx.app.request(`${API_PREFIX}/linked-accounts/${owner.account.id}`, {
      method: "DELETE",
      headers: other.headers,
    });
    expect(denied.status).toBe(404);
    expect(await denied.json()).toEqual({
      success: false,
      message: LinkedAccountError.accountNotFound().message,
      error: LinkedAccountError.accountNotFound().code,
    });
    const unchanged = await ctx.app.request(`${API_PREFIX}/linked-accounts`, {
      headers: owner.headers,
    });
    expect(listLinkedAccountsRespSchema.parse(await unchanged.json()).data).toEqual([
      owner.account,
    ]);

    const deleted = await ctx.app.request(`${API_PREFIX}/linked-accounts/${owner.account.id}`, {
      method: "DELETE",
      headers: owner.headers,
    });
    expect(deleted.status).toBe(200);
    const remaining = await ctx.app.request(`${API_PREFIX}/linked-accounts`, {
      headers: owner.headers,
    });
    expect(listLinkedAccountsRespSchema.parse(await remaining.json()).data).toEqual([]);
    const otherRemaining = await ctx.app.request(`${API_PREFIX}/linked-accounts`, {
      headers: other.headers,
    });
    expect(listLinkedAccountsRespSchema.parse(await otherRemaining.json()).data).toEqual([
      other.account,
    ]);
  });

  it.each([undefined, "Bearer invalid-token"])(
    "rejects unauthenticated access (%s)",
    async (authorization) => {
      const owner = await createLinkedUser(ctx, "owner");
      const headers: Record<string, string> = authorization ? { Authorization: authorization } : {};
      const res = await ctx.app.request(`${API_PREFIX}/linked-accounts/${owner.account.id}`, {
        method: "DELETE",
        headers,
      });
      expect(res.status).toBe(401);
      const unchanged = await ctx.app.request(`${API_PREFIX}/linked-accounts`, {
        headers: owner.headers,
      });
      expect(listLinkedAccountsRespSchema.parse(await unchanged.json()).data).toEqual([
        owner.account,
      ]);
    }
  );
});
