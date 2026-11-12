import { eq, sql } from "drizzle-orm";
import { Api, Context } from "grammy";
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
const editMessageText = vi.fn<Api["editMessageText"]>();

beforeAll(async () => {
  ctx = await initTest();
  return () => ctx.client.end();
});
beforeEach(async () => {
  await ctx.resetDb();
  tokens = await seedUser(ctx);
  reply.mockReset().mockResolvedValue({ message_id: 1 } as Awaited<ReturnType<Context["reply"]>>);
  editMessageText.mockReset().mockResolvedValue(true);
  vi.spyOn(Context.prototype, "reply").mockImplementation(reply);
  vi.spyOn(Api.prototype, "editMessageText").mockImplementation(editMessageText);
});
afterEach(() => vi.restoreAllMocks());

const issueKey = () => createApiKey(ctx.app, tokens.accessToken, "telegram");
async function listAccounts() {
  const response = await ctx.app.request(`${API_PREFIX}/linked-account`, {
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
  });

  it.each(["unknown", "revoked", "expired", "consumed"])(
    "rejects a %s key without creating a link",
    async (state) => {
      const { id, key } = await issueKey();
      const bot = initTestBot(ctx);
      if (state === "revoked") {
        const response = await ctx.app.request(`${API_PREFIX}/api-key/${id}`, {
          method: "PATCH",
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

  it("rolls back key consumption for an already-linked sender and permits another sender to redeem it", async () => {
    const bot = initTestBot(ctx);
    const first = await issueKey();
    await bot.handleUpdate(botCommand(`/link ${first.key}`));
    const second = await issueKey();
    await bot.handleUpdate(botCommand(`/link ${second.key}`));
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
    "burns an exposed %s key without changing links or usage",
    async (state) => {
      const { id, key } = await issueKey();
      const bot = initTestBot(ctx);
      if (state === "consumed") {
        await bot.handleUpdate(botCommand(`/link ${key}`));
      }
      const before = await listAccounts();
      const keyBefore = await keyRow(id);
      const exposed = state === "unknown" ? "ek_unknown" : key;
      await bot.handleUpdate(botCommand(`/link ${exposed}`, 123, "group"));
      expect(editMessageText).toHaveBeenLastCalledWith(
        -100,
        1,
        expect.stringContaining("API key has been disabled")
      );
      const burned = await keyRow(id);
      if (state === "unknown") {
        expect(burned).toEqual(keyBefore);
      } else {
        expect(burned.revokedAt).not.toBeNull();
      }
      expect(burned.lastUsedAt).toBe(keyBefore.lastUsedAt);
      expect(await listAccounts()).toEqual(before);
      await bot.handleUpdate(botCommand(`/link ${exposed}`, 123, "group"));
      expect(await keyRow(id)).toEqual(burned);
      await bot.handleUpdate(botCommand(`/link ${exposed}`, 789));
      expect(reply).toHaveBeenLastCalledWith("Invalid, expired, or already-used key.");
      expect(await listAccounts()).toEqual(before);
    }
  );

  it("revoking a consumed key preserves its existing linked account", async () => {
    const { id, key } = await issueKey();
    await initTestBot(ctx).handleUpdate(botCommand(`/link ${key}`));
    const before = await listAccounts();
    expect(before).toHaveLength(1);
    const revoked = await ctx.app.request(`${API_PREFIX}/api-key/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(revoked.status).toBe(200);
    expect(await listAccounts()).toEqual(before);
    expect(await ctx.db.select().from(linkedAccounts)).toHaveLength(1);
  });
});
