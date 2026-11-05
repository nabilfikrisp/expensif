import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { initTest } from "../helper";

import { ApiKeyError } from "@/modules/api-key/error";
import { apiKeys } from "@/modules/api-key/schema";
import { LinkedAccountError } from "@/modules/linked-account/error";

let ctx: Awaited<ReturnType<typeof initTest>>;
let userId: string;

const mockUser = { email: "test@example.com", password: "pass123", name: "Test User" };
const platformArgs = {
  platform: "telegram",
  platformUserId: "tg-123",
  platformUsername: "tester",
};
const keyInvalidMessage = () => LinkedAccountError.keyInvalid().message;

async function issueKey() {
  return await ctx.services.apiKey.generateApiKey(userId, "telegram");
}

beforeAll(async () => {
  ctx = await initTest();
  return () => ctx.client.end();
});

beforeEach(async () => {
  await ctx.resetDb();

  await ctx.services.auth.register(mockUser.email, mockUser.password, mockUser.name);

  const user = await ctx.services.user.getUserByEmail(mockUser.email);
  userId = user.id;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LinkedAccountUseCase.redeemApiKey", () => {
  it("returns the owner's identity and links the account with the given platform data", async () => {
    const { key: token } = await issueKey();
    const result = await ctx.useCases.linkedAccount.redeemApiKey({ token, ...platformArgs });
    expect(result).toEqual({ userName: mockUser.name, userEmail: mockUser.email });
    const linked = await ctx.services.linkedAccount.getLinkedAccount(
      platformArgs.platform,
      platformArgs.platformUserId
    );
    expect(linked).toMatchObject({ userId, ...platformArgs });
  });

  it("works without platformUsername", async () => {
    const { key: token } = await issueKey();

    const result = await ctx.useCases.linkedAccount.redeemApiKey({
      token,
      platform: platformArgs.platform,
      platformUserId: platformArgs.platformUserId,
    });

    expect(result.userEmail).toBe(mockUser.email);
    const linked = await ctx.services.linkedAccount.getLinkedAccount(
      platformArgs.platform,
      platformArgs.platformUserId
    );
    expect(linked.platformUsername).toBeNull();
  });

  describe("invalid keys", () => {
    it("rejects an unknown token with keyInvalid and links nothing", async () => {
      const linkSpy = vi.spyOn(ctx.services.linkedAccount, "linkAccount");

      await expect(
        ctx.useCases.linkedAccount.redeemApiKey({ token: "ek_unknown", ...platformArgs })
      ).rejects.toMatchObject({ message: keyInvalidMessage() });

      expect(linkSpy).not.toHaveBeenCalled();
      expect(await ctx.services.linkedAccount.listLinkedAccounts(userId)).toEqual([]);
    });
  });

  describe("concurrency", () => {
    it("lets exactly one of several concurrent redeems of the same key succeed", async () => {
      const { key: token } = await issueKey();

      // Different platformUserIds, so the linked account unique constraint can't be
      // what rejects the losers: only the single-use key check can.
      const results = await Promise.allSettled(
        ["tg-1", "tg-2", "tg-3", "tg-4", "tg-5"].map((platformUserId) =>
          ctx.useCases.linkedAccount.redeemApiKey({
            token,
            platform: platformArgs.platform,
            platformUserId,
          })
        )
      );

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      for (const r of rejected) {
        expect(r.reason).toMatchObject({ message: keyInvalidMessage() });
      }

      const linked = await ctx.services.linkedAccount.listLinkedAccounts(userId);
      expect(linked).toHaveLength(1);
    });
  });

  describe("error mapping", () => {
    it("maps any ApiKeyError from consumeApiKey to keyInvalid", async () => {
      vi.spyOn(ctx.services.apiKey, "consumeApiKey").mockRejectedValueOnce(
        ApiKeyError.keyNotFound()
      );

      await expect(
        ctx.useCases.linkedAccount.redeemApiKey({ token: "whatever", ...platformArgs })
      ).rejects.toMatchObject({ message: keyInvalidMessage() });
    });

    it("rethrows non-ApiKeyError errors unchanged", async () => {
      const boom = new Error("db exploded");
      vi.spyOn(ctx.services.apiKey, "consumeApiKey").mockRejectedValueOnce(boom);

      await expect(
        ctx.useCases.linkedAccount.redeemApiKey({ token: "whatever", ...platformArgs })
      ).rejects.toBe(boom);
    });
  });

  describe("transaction rollback", () => {
    it("does not consume the key when linkAccount fails", async () => {
      const { key: token } = await issueKey();
      const boom = new Error("link failed");
      vi.spyOn(ctx.services.linkedAccount, "linkAccount").mockRejectedValueOnce(boom);

      await expect(
        ctx.useCases.linkedAccount.redeemApiKey({ token, ...platformArgs })
      ).rejects.toBe(boom);

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

      await expect(
        ctx.useCases.linkedAccount.redeemApiKey({ token, ...platformArgs })
      ).rejects.toBe(boom);

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

    it("rejects an already linked platform account and leaves the key unused", async () => {
      const first = await issueKey();
      await ctx.useCases.linkedAccount.redeemApiKey({ token: first.key, ...platformArgs });

      const second = await issueKey();
      await expect(
        ctx.useCases.linkedAccount.redeemApiKey({ token: second.key, ...platformArgs })
      ).rejects.toMatchObject({ message: LinkedAccountError.accountAlreadyLinked().message });

      const [row] = await ctx.db
        .select({ lastUsedAt: apiKeys.lastUsedAt })
        .from(apiKeys)
        .where(eq(apiKeys.id, second.id));
      expect(row.lastUsedAt).toBeNull();

      await expect(
        ctx.useCases.linkedAccount.redeemApiKey({
          token: second.key,
          ...platformArgs,
          platformUserId: "tg-other",
        })
      ).resolves.toEqual({ userName: mockUser.name, userEmail: mockUser.email });
    });
  });
});

describe("LinkedAccountUseCase.burnApiKey", () => {
  it("makes a valid key unredeemable", async () => {
    const { key: token } = await issueKey();

    await ctx.useCases.linkedAccount.burnApiKey(token);

    await expect(
      ctx.useCases.linkedAccount.redeemApiKey({ token, ...platformArgs })
    ).rejects.toMatchObject({ message: keyInvalidMessage() });
  });

  it("does not throw for an unknown token", async () => {
    await expect(ctx.useCases.linkedAccount.burnApiKey("ek_unknown")).resolves.toBeUndefined();
  });
});
