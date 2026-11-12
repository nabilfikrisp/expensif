import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { initTestDb } from "../../helper";

import { linkedAccounts } from "@/modules/linked-account/schema";
import { messages } from "@/modules/message/schema";
import { users } from "@/modules/user/schema";

let ctx: Awaited<ReturnType<typeof initTestDb>>;
const userId = crypto.randomUUID();

beforeAll(async () => {
  ctx = await initTestDb();
  return () => ctx.client.end();
});

beforeEach(async () => {
  await ctx.resetDb();
  await ctx.db
    .insert(users)
    .values({ id: userId, email: "message@example.com", name: "Owner", passwordHash: "unused" });
});

function insertMessage(
  platform: string,
  externalChatId: string,
  externalMessageId: string | null = "42",
  linkedAccountId?: string
) {
  return ctx.db
    .insert(messages)
    .values({
      id: crypto.randomUUID(),
      userId,
      rawText: "bakso 15k",
      parseStatus: "pending",
      platform,
      externalChatId,
      externalMessageId,
      linkedAccountId,
    })
    .returning();
}

// Runtime ingestion is not implemented, so source-identity constraints require direct persistence coverage.
describe("external source identity", () => {
  it("allows the same message ID in different chats or platforms", async () => {
    await insertMessage("telegram", "chat-a");
    await insertMessage("telegram", "chat-b");
    await insertMessage("discord", "chat-a");
    expect(await ctx.db.select().from(messages)).toHaveLength(3);
  });

  it("rejects duplicate source identities, including after unlinking", async () => {
    const accountId = "linked-account";
    await ctx.db
      .insert(linkedAccounts)
      .values({ id: accountId, userId, platform: "telegram", platformUserId: "123" });
    const [source] = await insertMessage("telegram", "chat-a", "42", accountId);
    await expect(insertMessage("telegram", "chat-a")).rejects.toMatchObject({
      cause: { code: "23505" },
    });
    await ctx.db.delete(linkedAccounts).where(eq(linkedAccounts.id, accountId));
    const [retained] = await ctx.db.select().from(messages).where(eq(messages.id, source.id));
    expect(retained.linkedAccountId).toBeNull();
    expect(retained.platform).toBe("telegram");
    expect(retained.externalChatId).toBe("chat-a");
    await expect(insertMessage("telegram", "chat-a")).rejects.toMatchObject({
      cause: { code: "23505" },
    });
    expect(await ctx.db.select().from(messages)).toHaveLength(1);
  });

  it("preserves nullable external message IDs", async () => {
    await insertMessage("telegram", "chat-a", null);
    await insertMessage("telegram", "chat-a", null);
    expect(await ctx.db.select().from(messages)).toHaveLength(2);
  });
});
