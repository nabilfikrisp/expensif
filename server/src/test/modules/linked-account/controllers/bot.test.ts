import { eq, sql } from "drizzle-orm";
import { Context } from "grammy";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { listLinkedAccountsRespSchema } from "@/modules/linked-account/controllers/http/list";
import { apiKeys, linkedAccounts } from "@/pkg/db/schema";
import { API_PREFIX } from "@/pkg/http";
import { initTest } from "@/test/helper/app";
import { mockUser, seedUser } from "@/test/helper/auth";
import { botCommand, initTestBot } from "@/test/helper/bot";
import { createApiKey } from "@/test/helper/linked-account";

let ctx: Awaited<ReturnType<typeof initTest>>;
let tokens: Awaited<ReturnType<typeof seedUser>>;
const reply = vi.fn<Context["reply"]>();

beforeAll(async () => {
  ctx = await initTest();
  return () => ctx.client.end();
});
beforeEach(async () => {
  await ctx.resetDb();
  tokens = await seedUser(ctx);
  reply.mockReset().mockResolvedValue({ message_id: 1 } as Awaited<ReturnType<Context["reply"]>>);
  vi.spyOn(Context.prototype, "reply").mockImplementation(reply);
});
afterEach(() => vi.restoreAllMocks());

const issueKey = () => createApiKey(ctx.app, tokens.accessToken, "telegram");
async function listAccounts() {
  const response = await ctx.app.request(`${API_PREFIX}/linked-accounts`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  expect(response.status).toBe(200);
  return listLinkedAccountsRespSchema.parse(await response.json()).data;
}
async function keyRow(id: string) {
  const [row] = await ctx.db.select().from(apiKeys).where(eq(apiKeys.id, id));
  return row;
}

describe("Telegram account linking", () => {
  it.each(["tester", undefined])("links the key owner with username %s", async (username) => {
    const { id, key } = await issueKey();
    await initTestBot(ctx).handleUpdate(botCommand(`/link ${key}`, 123, "private", username));
    expect(reply).toHaveBeenCalledWith(`Linked to ${mockUser.name} (${mockUser.email})`);
    expect(await listAccounts()).toEqual([
      expect.objectContaining({
        platform: "telegram",
        platformUserId: "123",
        platformUsername: username ?? null,
      }),
    ]);
    expect((await keyRow(id)).lastUsedAt).not.toBeNull();
    const [stored] = await ctx.db.select().from(linkedAccounts);
    expect(stored.idempotencyKey).toBe("telegram:link:123:123");
    const publicResponse = await ctx.app.request(`${API_PREFIX}/linked-accounts`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(await publicResponse.json()).toEqual({
      success: true,
      message: "success",
      data: [
        {
          id: stored.id,
          platform: "telegram",
          platformUserId: "123",
          platformUsername: username ?? null,
          linkedAt: stored.linkedAt,
        },
      ],
    });
  });

  it.each(["unknown", "revoked", "expired", "consumed"])(
    "rejects a %s key without creating a link",
    async (state) => {
      const { id, key } = await issueKey();
      const bot = initTestBot(ctx);
      if (state === "revoked") {
        const response = await ctx.app.request(`${API_PREFIX}/api-keys/${id}/revoke`, {
          method: "POST",
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });
        expect(response.status).toBe(200);
      }
      if (state === "expired") {
        await ctx.db
          .update(apiKeys)
          .set({ expiresAt: sql`clock_timestamp() - interval '1 minute'` })
          .where(eq(apiKeys.id, id));
      }
      if (state === "consumed") {
        await bot.handleUpdate(botCommand(`/link ${key}`, 456));
      }
      const before = await listAccounts();
      const keyBefore = await keyRow(id);
      reply.mockClear();
      await bot.handleUpdate(botCommand(`/link ${state === "unknown" ? "ek_unknown" : key}`));
      expect(reply).toHaveBeenCalledWith("Invalid, expired, or already-used key.");
      expect(await listAccounts()).toEqual(before);
      expect(await keyRow(id)).toEqual(keyBefore);
    }
  );

  it.each(["unchanged", "expired", "revoked", "deleted"])(
    "returns the completed link when the same command is retried and its key is %s",
    async (state) => {
      const { id, key } = await issueKey();
      const bot = initTestBot(ctx);
      const command = botCommand(`/link ${key}`);
      await bot.handleUpdate(command);
      if (state === "expired") {
        await ctx.db
          .update(apiKeys)
          .set({ expiresAt: sql`clock_timestamp() - interval '1 minute'` })
          .where(eq(apiKeys.id, id));
      }
      if (state === "revoked" || state === "deleted") {
        const response = await ctx.app.request(
          `${API_PREFIX}/api-keys/${id}${state === "revoked" ? "/revoke" : ""}`,
          {
            method: state === "revoked" ? "POST" : "DELETE",
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }
        );
        expect(response.status).toBe(200);
      }
      const linksBefore = await ctx.db.select().from(linkedAccounts);
      const keyBefore = await keyRow(id);
      reply.mockClear();

      await bot.handleUpdate(command);

      expect(reply).toHaveBeenCalledExactlyOnceWith(
        `Linked to ${mockUser.name} (${mockUser.email})`
      );
      expect(await ctx.db.select().from(linkedAccounts)).toEqual(linksBefore);
      expect(await keyRow(id)).toEqual(keyBefore);
    }
  );

  it.each(["same key", "different keys"])(
    "completes concurrent deliveries of one command once with %s",
    async (payload) => {
      const first = await issueKey();
      const second = payload === "same key" ? first : await issueKey();
      const bot = initTestBot(ctx);
      await Promise.all(
        [first.key, second.key].map((key) => bot.handleUpdate(botCommand(`/link ${key}`)))
      );
      expect(reply).toHaveBeenCalledTimes(2);
      for (const [text] of reply.mock.calls) {
        expect(text).toBe(`Linked to ${mockUser.name} (${mockUser.email})`);
      }
      expect(await ctx.db.select().from(linkedAccounts)).toHaveLength(1);
      const keys = await ctx.db.select().from(apiKeys);
      expect(keys.filter((key) => key.lastUsedAt !== null)).toHaveLength(1);
    }
  );

  it("rejects a new command containing the same consumed key", async () => {
    const { id, key } = await issueKey();
    const bot = initTestBot(ctx);
    await bot.handleUpdate(botCommand(`/link ${key}`));
    const linksBefore = await ctx.db.select().from(linkedAccounts);
    const keyBefore = await keyRow(id);
    reply.mockClear();

    await bot.handleUpdate(botCommand(`/link ${key}`, 123, "private", undefined, 124));

    expect(reply).toHaveBeenCalledExactlyOnceWith("Invalid, expired, or already-used key.");
    expect(await ctx.db.select().from(linkedAccounts)).toEqual(linksBefore);
    expect(await keyRow(id)).toEqual(keyBefore);
  });

  it("rejects another sender presenting the completed command identity", async () => {
    const { id, key } = await issueKey();
    const bot = initTestBot(ctx);
    await bot.handleUpdate(botCommand(`/link ${key}`));
    const linksBefore = await ctx.db.select().from(linkedAccounts);
    const keyBefore = await keyRow(id);
    const forged = botCommand(`/link ${key}`, 456, "private", undefined, 123);
    if (!("message" in forged) || !forged.message) {
      throw new Error("Expected a message update");
    }
    forged.message.chat.id = 123;
    reply.mockClear();

    await bot.handleUpdate(forged);

    expect(reply).toHaveBeenCalledExactlyOnceWith("Invalid, expired, or already-used key.");
    expect(await ctx.db.select().from(linkedAccounts)).toEqual(linksBefore);
    expect(await keyRow(id)).toEqual(keyBefore);
  });

  it.each(["unlinked", "linked to another owner"])(
    "rejects an old command when the sender is %s",
    async (state) => {
      const { id, key } = await issueKey();
      const bot = initTestBot(ctx);
      const command = botCommand(`/link ${key}`);
      await bot.handleUpdate(command);
      const [account] = await listAccounts();
      const response = await ctx.app.request(`${API_PREFIX}/linked-accounts/${account.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      expect(response.status).toBe(200);
      if (state === "linked to another owner") {
        const other = await seedUser(ctx, { email: "other@example.com", name: "Other" });
        const otherKey = await createApiKey(ctx.app, other.accessToken, "telegram");
        await bot.handleUpdate(botCommand(`/link ${otherKey.key}`, 123, "private", undefined, 124));
      }
      const linksBefore = await ctx.db.select().from(linkedAccounts);
      const keyBefore = await keyRow(id);
      reply.mockClear();

      await bot.handleUpdate(command);

      expect(reply).toHaveBeenCalledExactlyOnceWith("Invalid, expired, or already-used key.");
      expect(await ctx.db.select().from(linkedAccounts)).toEqual(linksBefore);
      expect(await keyRow(id)).toEqual(keyBefore);
    }
  );

  it("returns the completed link after its first Telegram confirmation fails", async () => {
    const { id, key } = await issueKey();
    const bot = initTestBot(ctx);
    const command = botCommand(`/link ${key}`);
    const error = new Error("Telegram unavailable");
    reply.mockRejectedValueOnce(error);
    await expect(bot.handleUpdate(command)).rejects.toMatchObject({ error });
    const linksBefore = await ctx.db.select().from(linkedAccounts);
    expect(linksBefore).toHaveLength(1);
    const keyBefore = await keyRow(id);

    await bot.handleUpdate(command);

    expect(reply).toHaveBeenLastCalledWith(`Linked to ${mockUser.name} (${mockUser.email})`);
    expect(await ctx.db.select().from(linkedAccounts)).toEqual(linksBefore);
    expect(await keyRow(id)).toEqual(keyBefore);
  });

  it("rolls back key consumption for an already-linked sender and permits another sender to redeem it", async () => {
    const bot = initTestBot(ctx);
    const first = await issueKey();
    await bot.handleUpdate(botCommand(`/link ${first.key}`));
    const second = await issueKey();
    await bot.handleUpdate(botCommand(`/link ${second.key}`, 123, "private", undefined, 124));
    expect(reply).toHaveBeenLastCalledWith("This Telegram account is already linked.");
    expect((await keyRow(second.id)).lastUsedAt).toBeNull();
    expect(await listAccounts()).toHaveLength(1);
    await bot.handleUpdate(botCommand(`/link ${second.key}`, 456));
    expect(await listAccounts()).toHaveLength(2);
  });

  it("lets exactly one concurrent sender redeem the same key", async () => {
    const { key } = await issueKey();
    const bot = initTestBot(ctx);
    await Promise.all(
      [1, 2, 3, 4, 5].map((id) => bot.handleUpdate(botCommand(`/link ${key}`, id)))
    );
    expect(await listAccounts()).toHaveLength(1);
    const replies = reply.mock.calls.map(([text]) => text);
    expect(
      replies.filter((text) => text === `Linked to ${mockUser.name} (${mockUser.email})`)
    ).toHaveLength(1);
    expect(
      replies.filter((text) => text === "Invalid, expired, or already-used key.")
    ).toHaveLength(4);
  });

  it.each(["unused", "consumed", "unknown"])(
    "returns a static group reply for an exposed %s key without changing state",
    async (state) => {
      const { id, key } = await issueKey();
      const bot = initTestBot(ctx);
      if (state === "consumed") {
        await bot.handleUpdate(botCommand(`/link ${key}`));
      }
      const before = await listAccounts();
      const keyBefore = await keyRow(id);
      const exposed = state === "unknown" ? "ek_unknown" : key;
      reply.mockClear();
      await bot.handleUpdate(botCommand(`/link ${exposed}`, 123, "group"));
      expect(reply).toHaveBeenCalledExactlyOnceWith("Please use this bot in a private chat.");
      expect(await keyRow(id)).toEqual(keyBefore);
      expect(await listAccounts()).toEqual(before);
      reply.mockRejectedValueOnce(new Error("Telegram unavailable"));
      await expect(
        bot.handleUpdate(botCommand(`/link ${exposed}`, 123, "group"))
      ).rejects.toThrow();
      expect(await keyRow(id)).toEqual(keyBefore);
      expect(await listAccounts()).toEqual(before);
    }
  );

  it("revoking a consumed key preserves its existing linked account", async () => {
    const { id, key } = await issueKey();
    await initTestBot(ctx).handleUpdate(botCommand(`/link ${key}`));
    const before = await listAccounts();
    expect(before).toHaveLength(1);
    const revoked = await ctx.app.request(`${API_PREFIX}/api-keys/${id}/revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(revoked.status).toBe(200);
    expect(await listAccounts()).toEqual(before);
    expect(await ctx.db.select().from(linkedAccounts)).toHaveLength(1);
  });
});
