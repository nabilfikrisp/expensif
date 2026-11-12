import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { LinkedAccountError } from "@/modules/linked-account/error";
import { initTest } from "@/test/helper/app";
import { mockUser, seedUser } from "@/test/helper/auth";

let ctx: Awaited<ReturnType<typeof initTest>>;
let userId: string;

const platformArgs = {
  platform: "telegram",
  platformUserId: "tg-123",
  platformUsername: "tester",
};

async function issueKey() {
  return await ctx.services.apiKey.generateApiKey(userId, "telegram");
}

beforeAll(async () => {
  ctx = await initTest();
  return () => ctx.client.end();
});

beforeEach(async () => {
  await ctx.resetDb();

  ({ userId } = await seedUser(ctx));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Failures after key consumption and after link insertion require injection at specific transaction steps.
// The bot reports generic failures, so this boundary also verifies that unknown errors retain their identity.
describe("linking transaction rollback", () => {
  it("preserves an unexpected consumption failure instead of classifying it as an invalid key", async () => {
    const error = new Error("database unavailable");
    vi.spyOn(ctx.services.apiKey, "consumeApiKey").mockRejectedValueOnce(error);
    await expect(
      ctx.useCases.linkedAccount.redeemApiKey({ token: "ek_unknown", ...platformArgs })
    ).rejects.toBe(error);
    expect(await ctx.services.linkedAccount.listLinkedAccounts(userId)).toEqual([]);
  });

  it("does not consume the key when linkAccount fails", async () => {
    const { key: token } = await issueKey();
    const boom = new Error("link failed");
    vi.spyOn(ctx.services.linkedAccount, "linkAccount").mockRejectedValueOnce(boom);

    await expect(ctx.useCases.linkedAccount.redeemApiKey({ token, ...platformArgs })).rejects.toBe(
      boom
    );

    // The mock was one-shot, so this call uses the real implementation.
    const retry = await ctx.useCases.linkedAccount.redeemApiKey({
      token,
      ...platformArgs,
    });
    expect(retry.userEmail).toBe(mockUser.email);
  });

  it("does not consume the key when getUser fails", async () => {
    const { key: token } = await issueKey();
    const boom = new Error("user lookup failed");
    vi.spyOn(ctx.services.user, "getUser").mockRejectedValueOnce(boom);

    await expect(ctx.useCases.linkedAccount.redeemApiKey({ token, ...platformArgs })).rejects.toBe(
      boom
    );

    // linkAccount succeeded before getUser failed, so the insert must be rolled back too.
    await expect(
      ctx.services.linkedAccount.getLinkedAccount(
        platformArgs.platform,
        platformArgs.platformUserId
      )
    ).rejects.toMatchObject({ message: LinkedAccountError.accountNotFound().message });

    const retry = await ctx.useCases.linkedAccount.redeemApiKey({
      token,
      ...platformArgs,
    });
    expect(retry.userEmail).toBe(mockUser.email);
  });
});
