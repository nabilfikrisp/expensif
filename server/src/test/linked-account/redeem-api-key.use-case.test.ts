import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initUseCaseTest } from "../helper";

import { ApiKeyError } from "@/modules/api-key/error";
import { apiKeys } from "@/modules/api-key/schema";
import { LinkedAccountError } from "@/modules/linked-account/error";

let ctx: Awaited<ReturnType<typeof initUseCaseTest>> | undefined;

function getContext() {
  if (!ctx) {
    throw new Error("Test context has not been initialized");
  }
  return ctx;
}
let userId: string;

const mockUser = { email: "test@example.com", password: "pass123", name: "Test User" };
const platformArgs = {
  platform: "telegram",
  platformUserId: "tg-123",
  platformUsername: "tester",
};
const keyInvalidMessage = () => LinkedAccountError.keyInvalid().message;

async function issueKey() {
  return await getContext().services.apiKey.generateApiKey(userId, "telegram");
}

beforeEach(async () => {
  ctx = undefined;
  ctx = await initUseCaseTest();

  await getContext().services.auth.register(mockUser.email, mockUser.password, mockUser.name);

  const user = await getContext().services.user.getUserByEmail(mockUser.email);
  userId = user.id;
});

afterEach(async () => {
  vi.restoreAllMocks();
  const current = ctx;
  ctx = undefined;
  await current?.cleanup();
});

describe("LinkedAccountUseCase.redeemApiKey", () => {
  it("redeems a valid key and returns the owner's name and email", async () => {
    const { key: token } = await issueKey();

    const result = await getContext().useCases.linkedAccount.redeemApiKey({
      token,
      ...platformArgs,
    });

    expect(result).toEqual({ userName: mockUser.name, userEmail: mockUser.email });
  });

  it("links the account to the key's owner with the given platform data", async () => {
    const { key: token } = await issueKey();
    const linkSpy = vi.spyOn(getContext().services.linkedAccount, "linkAccount");

    await getContext().useCases.linkedAccount.redeemApiKey({ token, ...platformArgs });

    expect(linkSpy).toHaveBeenCalledTimes(1);
    expect(linkSpy).toHaveBeenCalledWith(expect.objectContaining({ userId, ...platformArgs }));

    const linked = await getContext().services.linkedAccount.getLinkedAccount(
      platformArgs.platform,
      platformArgs.platformUserId
    );
    expect(linked.userId).toBe(userId);
    expect(linked.platformUsername).toBe(platformArgs.platformUsername);
  });

  it("works without platformUsername", async () => {
    const { key: token } = await issueKey();

    const result = await getContext().useCases.linkedAccount.redeemApiKey({
      token,
      platform: platformArgs.platform,
      platformUserId: platformArgs.platformUserId,
    });

    expect(result.userEmail).toBe(mockUser.email);
  });

  it("passes the same transaction to every service call", async () => {
    const { key: token } = await issueKey();
    const consumeSpy = vi.spyOn(getContext().services.apiKey, "consumeApiKey");
    const linkSpy = vi.spyOn(getContext().services.linkedAccount, "linkAccount");
    const getUserSpy = vi.spyOn(getContext().services.user, "getUser");

    await getContext().useCases.linkedAccount.redeemApiKey({ token, ...platformArgs });

    const consumeTx = consumeSpy.mock.calls[0][1];
    const linkTx = linkSpy.mock.calls[0][0].tx;
    const getUserTx = getUserSpy.mock.calls[0][1];

    expect(linkTx).toBe(consumeTx);
    expect(getUserTx).toBe(consumeTx);
    expect(consumeTx).not.toBe(getContext().db);
  });

  describe("invalid keys", () => {
    it("rejects an unknown token with keyInvalid and links nothing", async () => {
      const linkSpy = vi.spyOn(getContext().services.linkedAccount, "linkAccount");

      await expect(
        getContext().useCases.linkedAccount.redeemApiKey({ token: "ek_unknown", ...platformArgs })
      ).rejects.toMatchObject({ message: keyInvalidMessage() });

      expect(linkSpy).not.toHaveBeenCalled();
    });

    it("rejects a token that was already redeemed", async () => {
      const { key: token } = await issueKey();
      await getContext().useCases.linkedAccount.redeemApiKey({ token, ...platformArgs });

      await expect(
        getContext().useCases.linkedAccount.redeemApiKey({
          token,
          ...platformArgs,
          platformUserId: "tg-456",
        })
      ).rejects.toMatchObject({ message: keyInvalidMessage() });
    });

    it("rejects a revoked key", async () => {
      const { id, key: token } = await issueKey();
      await getContext().services.apiKey.revokeApiKey(userId, id);

      await expect(
        getContext().useCases.linkedAccount.redeemApiKey({ token, ...platformArgs })
      ).rejects.toMatchObject({ message: keyInvalidMessage() });
    });

    it("rejects an expired key", async () => {
      const { id, key: token } = await issueKey();

      // Expiry uses database time, so move expiresAt into the past instead of mocking JS time.
      await getContext()
        .db.update(apiKeys)
        .set({ expiresAt: sql`clock_timestamp() - interval '1 minute'` })
        .where(eq(apiKeys.id, id));

      await expect(
        getContext().useCases.linkedAccount.redeemApiKey({ token, ...platformArgs })
      ).rejects.toMatchObject({ message: keyInvalidMessage() });
    });
  });

  describe("concurrency", () => {
    it("allows independent writes to overlap before either transaction commits", async () => {
      const context = getContext();
      const keys = [await issueKey(), await issueKey()];
      const barrier = Promise.withResolvers<undefined>();
      let arrived = 0;
      const settled = Promise.allSettled(
        keys.map(({ id }, index) =>
          context.db.transaction(async (tx) => {
            await tx.execute(sql`SET LOCAL statement_timeout = '3s'`);
            await tx
              .update(apiKeys)
              .set({ label: `overlap-${index}` })
              .where(eq(apiKeys.id, id));
            arrived++;
            await barrier.promise;
          })
        )
      );

      try {
        await expect.poll(() => arrived, { timeout: 2000 }).toBe(2);
      } finally {
        barrier.resolve(undefined);
        await settled;
      }

      expect(await settled).toEqual([
        { status: "fulfilled", value: undefined },
        { status: "fulfilled", value: undefined },
      ]);
      const rows = await context.db
        .select({ label: apiKeys.label })
        .from(apiKeys)
        .orderBy(apiKeys.label);
      expect(rows).toEqual([{ label: "overlap-0" }, { label: "overlap-1" }]);
    });

    it("rejects a key that expires while consumption waits on an unchanged row lock", async () => {
      const context = getContext();
      const { id, key: token } = await issueKey();
      const locker = await context.client.connect();
      let settled: Promise<PromiseSettledResult<unknown>[]> | undefined;

      try {
        await locker.query(
          "UPDATE api_keys SET expires_at = clock_timestamp() + interval '3 seconds' WHERE id = $1",
          [id]
        );
        await locker.query("BEGIN");
        await locker.query("SET LOCAL statement_timeout = '5s'");
        const pidResult = await locker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
        const lockerPid = pidResult.rows[0].pid;
        await locker.query("SELECT id FROM api_keys WHERE id = $1 FOR UPDATE", [id]);

        settled = Promise.allSettled([
          context.db.transaction(async (tx) => {
            await tx.execute(sql`SET LOCAL statement_timeout = '5s'`);
            return await context.services.apiKey.consumeApiKey(token, tx);
          }),
        ]);

        await expect
          .poll(
            async () => {
              const result = await context.client.query<{ waiting: boolean }>(
                "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1::integer = ANY(pg_blocking_pids(pid))) AS waiting",
                [lockerPid]
              );
              return result.rows[0].waiting;
            },
            { timeout: 2000, interval: 10 }
          )
          .toBe(true);

        const before = await locker.query<{ unexpired: boolean }>(
          "SELECT expires_at > clock_timestamp() AS unexpired FROM api_keys WHERE id = $1",
          [id]
        );
        expect(before.rows[0].unexpired).toBe(true);
        await locker.query(
          "SELECT pg_sleep(GREATEST(0, EXTRACT(EPOCH FROM (expires_at - clock_timestamp())))::double precision + 0.05) FROM api_keys WHERE id = $1",
          [id]
        );
        const after = await locker.query<{ expired: boolean }>(
          "SELECT expires_at <= clock_timestamp() AS expired FROM api_keys WHERE id = $1",
          [id]
        );
        expect(after.rows[0].expired).toBe(true);
      } finally {
        try {
          await locker.query("ROLLBACK");
        } finally {
          locker.release();
          await settled;
        }
      }

      expect(await settled).toMatchObject([
        { status: "rejected", reason: { code: ApiKeyError.keyInvalid().code } },
      ]);
      const [row] = await context.db
        .select({ lastUsedAt: apiKeys.lastUsedAt })
        .from(apiKeys)
        .where(eq(apiKeys.id, id));
      expect(row.lastUsedAt).toBeNull();
      expect(await context.services.linkedAccount.listLinkedAccounts(userId)).toEqual([]);
    }, 10000);

    it("lets exactly one of several concurrent redeems of the same key succeed", async () => {
      const { key: token } = await issueKey();

      // Different platformUserIds, so the linked account unique constraint can't be
      // what rejects the losers: only the single-use key check can.
      const results = await Promise.allSettled(
        ["tg-1", "tg-2", "tg-3", "tg-4", "tg-5"].map((platformUserId) =>
          getContext().useCases.linkedAccount.redeemApiKey({
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

      const linked = await getContext().services.linkedAccount.listLinkedAccounts(userId);
      expect(linked).toHaveLength(1);
    });

    it("handles the same redeem request arriving twice at once (webhook retry)", async () => {
      const { key: token } = await issueKey();
      const args = {
        token,
        platform: platformArgs.platform,
        platformUserId: "tg-1",
      };

      const results = await Promise.allSettled([
        getContext().useCases.linkedAccount.redeemApiKey(args),
        getContext().useCases.linkedAccount.redeemApiKey(args),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

      // Don't assert which call wins; the order isn't deterministic.
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toMatchObject({ message: keyInvalidMessage() });

      // The account is linked exactly once...
      const linked = await getContext().services.linkedAccount.listLinkedAccounts(userId);
      expect(linked).toHaveLength(1);

      // ...and the key is really spent: a later attempt is rejected too.
      await expect(getContext().useCases.linkedAccount.redeemApiKey(args)).rejects.toMatchObject({
        message: keyInvalidMessage(),
      });
    });
  });

  describe("error mapping", () => {
    it("maps any ApiKeyError from consumeApiKey to keyInvalid", async () => {
      vi.spyOn(getContext().services.apiKey, "consumeApiKey").mockRejectedValueOnce(
        ApiKeyError.keyNotFound()
      );

      await expect(
        getContext().useCases.linkedAccount.redeemApiKey({ token: "whatever", ...platformArgs })
      ).rejects.toMatchObject({ message: keyInvalidMessage() });
    });

    it("rethrows non-ApiKeyError errors unchanged", async () => {
      const boom = new Error("db exploded");
      vi.spyOn(getContext().services.apiKey, "consumeApiKey").mockRejectedValueOnce(boom);

      await expect(
        getContext().useCases.linkedAccount.redeemApiKey({ token: "whatever", ...platformArgs })
      ).rejects.toBe(boom);
    });
  });

  describe("transaction rollback", () => {
    it("does not consume the key when linkAccount fails", async () => {
      const { key: token } = await issueKey();
      const boom = new Error("link failed");
      vi.spyOn(getContext().services.linkedAccount, "linkAccount").mockRejectedValueOnce(boom);

      await expect(
        getContext().useCases.linkedAccount.redeemApiKey({ token, ...platformArgs })
      ).rejects.toBe(boom);

      // The mock was one-shot, so this call uses the real implementation.
      const retry = await getContext().useCases.linkedAccount.redeemApiKey({
        token,
        ...platformArgs,
      });
      expect(retry.userEmail).toBe(mockUser.email);
    });

    it("does not consume the key when getUser fails", async () => {
      const { key: token } = await issueKey();
      const boom = new Error("user lookup failed");
      vi.spyOn(getContext().services.user, "getUser").mockRejectedValueOnce(boom);

      await expect(
        getContext().useCases.linkedAccount.redeemApiKey({ token, ...platformArgs })
      ).rejects.toBe(boom);

      // linkAccount succeeded before getUser failed, so the insert must be rolled back too.
      await expect(
        getContext().services.linkedAccount.getLinkedAccount(
          platformArgs.platform,
          platformArgs.platformUserId
        )
      ).rejects.toMatchObject({ message: LinkedAccountError.accountNotFound().message });

      const retry = await getContext().useCases.linkedAccount.redeemApiKey({
        token,
        ...platformArgs,
      });
      expect(retry.userEmail).toBe(mockUser.email);
    });

    it("rejects an already linked platform account and leaves the key unused", async () => {
      const first = await issueKey();
      await getContext().useCases.linkedAccount.redeemApiKey({ token: first.key, ...platformArgs });

      const second = await issueKey();
      await expect(
        getContext().useCases.linkedAccount.redeemApiKey({ token: second.key, ...platformArgs })
      ).rejects.toMatchObject({ message: LinkedAccountError.accountAlreadyLinked().message });

      const [row] = await getContext()
        .db.select({ lastUsedAt: apiKeys.lastUsedAt })
        .from(apiKeys)
        .where(eq(apiKeys.id, second.id));
      expect(row.lastUsedAt).toBeNull();

      await expect(
        getContext().useCases.linkedAccount.redeemApiKey({
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

    await getContext().useCases.linkedAccount.burnApiKey(token);

    await expect(
      getContext().useCases.linkedAccount.redeemApiKey({ token, ...platformArgs })
    ).rejects.toMatchObject({ message: keyInvalidMessage() });
  });

  it("does not throw for an unknown token", async () => {
    await expect(
      getContext().useCases.linkedAccount.burnApiKey("ek_unknown")
    ).resolves.toBeUndefined();
  });
});
