import { eq, sql } from "drizzle-orm";
import { BotError, Context } from "grammy";
import type { Message, Update } from "grammy/types";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { categories } from "@/modules/category/schema";
import { initCategoryService } from "@/modules/category/service";
import { expenses } from "@/modules/expense/schema";
import { linkedAccounts } from "@/modules/linked-account/schema";
import { messages } from "@/modules/message/schema";
import { users } from "@/modules/user/schema";
import { initDb } from "@/pkg/db";
import { initLogger } from "@/pkg/logger";
import { initTest } from "@/test/helper/app";
import { botCommand, initTestBot } from "@/test/helper/bot";
import { expenseModel } from "@/test/helper/expense-model";

let ctx: Awaited<ReturnType<typeof initTest>>;
const userId = crypto.randomUUID();
const reply = vi.fn<Context["reply"]>();
const modelResponse = vi.fn<() => Promise<unknown>>();
const response = {
  message_id: 1,
  date: 0,
  chat: { id: 123, type: "private", first_name: "Test" },
  text: "",
} satisfies Message.TextMessage;
const parsed = {
  item_name: "bakso",
  amount: "15000",
  currency: "IDR" as const,
  date: "2026-11-09",
  category: "food",
};

function command(text = "/expense bakso 15k", messageId = 42, chatId = 123): Update {
  return {
    update_id: messageId,
    message: {
      ...response,
      message_id: messageId,
      chat: { ...response.chat, id: chatId },
      from: { id: 123, is_bot: false, first_name: "Test", username: "tester" },
      text,
      entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }],
    },
  };
}

function createBot(db = ctx.db) {
  const logger = initLogger(ctx.env);
  const model = expenseModel(modelResponse);
  return {
    bot: initTestBot(ctx, db, logger, { model }),
    model,
    logError: vi.spyOn(logger, "error"),
  };
}

async function link(ownerId = userId) {
  return ctx.services.linkedAccount.linkAccount({
    userId: ownerId,
    platform: "telegram",
    platformUserId: "123",
  });
}

async function expectNoWrites() {
  expect(await ctx.db.select().from(messages)).toEqual([]);
  expect(await ctx.db.select().from(expenses)).toEqual([]);
}

beforeAll(async () => {
  ctx = await initTest();
  return () => ctx.client.end();
});
beforeEach(async () => {
  await ctx.resetDb();
  await initCategoryService({ db: ctx.db }).seedCategories();
  await ctx.db
    .insert(users)
    .values({ id: userId, name: "Owner", email: "owner@example.com", passwordHash: "unused" });
  reply.mockReset().mockResolvedValue(response);
  vi.spyOn(Context.prototype, "reply").mockImplementation(reply);
  modelResponse.mockReset().mockResolvedValue(parsed);
});
afterEach(() => vi.restoreAllMocks());

describe("expense command ingestion", () => {
  it.each(["group", "supergroup"] as const)(
    "redirects every message in a %s without parsing or saving",
    async (chatType) => {
      await link();
      const { bot } = createBot();
      for (const text of ["/expense bakso 15k", "/start", "hello"]) {
        const update = botCommand(text, 123, "group");
        if (!("message" in update) || !update.message) {
          throw new Error("Expected a message update");
        }
        update.message.chat = { id: -100, type: chatType, title: "Test" };
        reply.mockClear();
        await bot.handleUpdate(update);
        expect(reply).toHaveBeenCalledExactlyOnceWith("Please use this bot in a private chat.");
      }
      expect(modelResponse).not.toHaveBeenCalled();
      await expectNoWrites();
    }
  );

  it.each([
    { text: "bakso 15k", itemName: "bakso", amount: "15000" },
    {
      text: "gua beli rokok, mie, es teh, totalnya 50k",
      itemName: "rokok, mie, es teh",
      amount: "50000",
    },
    { text: "barang 9007199254740993", itemName: "barang", amount: "9007199254740993" },
  ])(
    "saves one expense for $text with exact amount $amount and returns it on retry",
    async ({ text, itemName, amount }) => {
      const account = await link();
      modelResponse.mockResolvedValue({
        ...parsed,
        item_name: itemName,
        amount,
      });
      const { bot, model } = createBot();
      const update = command(`/expense ${text}`);
      reply.mockImplementationOnce(async () => {
        // This pool read sees the expense only after the use-case transaction commits.
        expect(await ctx.db.select().from(expenses)).toHaveLength(1);
        return response;
      });
      await bot.handleUpdate(update);
      expect(
        model.doGenerateCalls[0].prompt.find((message) => message.role === "user")?.content
      ).toEqual([{ type: "text", text }]);
      const savedMessages = await ctx.db.select().from(messages);
      const savedExpenses = await ctx.db.select().from(expenses);
      expect(savedMessages).toEqual([
        expect.objectContaining({
          userId,
          linkedAccountId: account.id,
          rawText: `/expense ${text}`,
          idempotencyKey: "telegram:expense:123:42",
          externalConversationId: "123",
          externalMessageId: "42",
          parseStatus: "parsed",
        }),
      ]);
      expect(savedExpenses).toEqual([
        expect.objectContaining({
          userId,
          messageId: savedMessages[0].id,
          itemName,
          amount,
          currency: "IDR",
          categoryId: "category_food",
          expenseDate: parsed.date,
        }),
      ]);
      expect(reply).toHaveBeenCalledWith(expect.stringContaining("✅ Saved expense:"));
      await bot.handleUpdate(update);
      expect(modelResponse).toHaveBeenCalledOnce();
      expect(await ctx.db.select().from(messages)).toEqual(savedMessages);
      expect(await ctx.db.select().from(expenses)).toEqual(savedExpenses);
      expect(reply).toHaveBeenLastCalledWith(expect.stringContaining("Category: food"));
    }
  );

  it.each(["custom", "unknown"])(
    "loads database categories and persists the resolved category for %j",
    async (slug) => {
      await link();
      await ctx.db
        .insert(categories)
        .values({ id: "custom-id", name: "Database choice", slug: "custom" });
      modelResponse.mockResolvedValue({ ...parsed, category: slug });
      const { bot } = createBot();
      await bot.handleUpdate(command());
      expect(await ctx.db.select().from(expenses)).toEqual([
        expect.objectContaining({ categoryId: slug === "custom" ? "custom-id" : "category_other" }),
      ]);
    }
  );

  it("saves one result for concurrent duplicate deliveries", async () => {
    await link();
    let arrivals = 0;
    let release!: () => void;
    const bothParsing = new Promise<void>((resolve) => {
      release = resolve;
    });
    modelResponse.mockImplementation(async () => {
      if (++arrivals === 2) {
        release();
      }
      await bothParsing;
      return parsed;
    });
    const { bot, logError } = createBot();
    await Promise.all([bot.handleUpdate(command()), bot.handleUpdate(command())]);
    expect(await ctx.db.select().from(messages)).toHaveLength(1);
    expect(await ctx.db.select().from(expenses)).toHaveLength(1);
    expect(reply).toHaveBeenCalledTimes(2);
    expect(reply).toHaveBeenNthCalledWith(1, expect.stringContaining("✅ Saved expense:"));
    expect(reply).toHaveBeenNthCalledWith(2, expect.stringContaining("✅ Saved expense:"));
    expect(logError).not.toHaveBeenCalled();
  });

  it("rolls back the message when PostgreSQL rejects the expense write", async () => {
    await link();
    const url = new URL(ctx.env.DATABASE_URL);
    url.searchParams.set("options", "-c lock_timeout=100ms");
    const database = initDb(url.toString());
    try {
      const { bot, logError } = createBot(database.db);
      await ctx.db.transaction(async (tx) => {
        await tx.execute(sql`LOCK TABLE ${expenses} IN SHARE MODE`);
        await bot.handleUpdate(command());
      });
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.objectContaining({
            cause: expect.objectContaining({ code: "55P03" }) as unknown,
          }) as unknown,
        }),
        "Failed to save expense"
      );
      await expectNoWrites();
      await bot.handleUpdate(command());
      expect(await ctx.db.select().from(messages)).toHaveLength(1);
      expect(await ctx.db.select().from(expenses)).toHaveLength(1);
    } finally {
      await database.client.end();
    }
  });

  it("does not classify a message primary-key collision as a completed retry", async () => {
    await link();
    const { bot, logError } = createBot();
    await bot.handleUpdate(command());
    const savedMessages = await ctx.db.select().from(messages);
    const savedExpenses = await ctx.db.select().from(expenses);
    vi.spyOn(crypto, "randomUUID").mockReturnValueOnce(
      savedMessages[0].id as ReturnType<typeof crypto.randomUUID>
    );
    reply.mockClear();
    await bot.handleUpdate(command(undefined, 43));
    expect(reply).toHaveBeenCalledExactlyOnceWith("❌ Failed to save expense. Please try again.");
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({
          cause: expect.objectContaining({ code: "23505", constraint: "messages_pkey" }) as unknown,
        }) as unknown,
      }),
      "Failed to save expense"
    );
    expect(await ctx.db.select().from(messages)).toEqual(savedMessages);
    expect(await ctx.db.select().from(expenses)).toEqual(savedExpenses);
  });

  it("fails a retained message with a missing expense instead of parsing again", async () => {
    await link();
    const { bot, logError } = createBot();
    await bot.handleUpdate(command());
    await ctx.db.delete(expenses);
    reply.mockClear();
    await bot.handleUpdate(command());
    expect(reply).toHaveBeenCalledExactlyOnceWith("❌ Failed to save expense. Please try again.");
    expect(modelResponse).toHaveBeenCalledOnce();
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({ code: "EXPENSE_SAVED_RESULT_INCOMPLETE" }) as unknown,
      }),
      "Failed to save expense"
    );
    expect(await ctx.db.select().from(messages)).toHaveLength(1);
    expect(await ctx.db.select().from(expenses)).toEqual([]);
  });

  it("keeps identical text and message IDs distinct across chats", async () => {
    await link();
    const { bot } = createBot();
    await bot.handleUpdate(command());
    await bot.handleUpdate(command(undefined, 43));
    await bot.handleUpdate(command(undefined, 42, -200));
    expect(await ctx.db.select().from(messages)).toHaveLength(3);
    expect(await ctx.db.select().from(expenses)).toHaveLength(3);
  });

  it.each([
    ...["0", "-1", "1.5", "1e3", "15k", "15000\n"].map((amount) => ({ amount })),
    { amount: 15000 },
    { currency: "USD" },
    { item_name: "" },
    { date: "2026-02-30" },
  ])("leaves no records for invalid parsed output %j", async (invalid) => {
    await link();
    modelResponse.mockResolvedValue({
      ...parsed,
      ...invalid,
    });
    const { bot } = createBot();
    await bot.handleUpdate(command());
    expect(reply).toHaveBeenCalledExactlyOnceWith("❌ Failed to save expense. Please try again.");
    await expectNoWrites();
  });

  it("logs parser failures without revealing them or saving a message", async () => {
    await link();
    const error = new Error("private provider detail");
    modelResponse.mockRejectedValue(error);
    const { bot, logError } = createBot();
    await bot.handleUpdate(command());
    expect(reply).toHaveBeenCalledExactlyOnceWith("❌ Failed to save expense. Please try again.");
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ err: error }),
      "Failed to save expense"
    );
    await expectNoWrites();
  });

  it("fails before parsing when the required fallback category is missing", async () => {
    await link();
    await ctx.db.delete(categories).where(eq(categories.slug, "other"));
    const { bot, logError } = createBot();
    await bot.handleUpdate(command());
    expect(modelResponse).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({ code: "CATEGORY_SETUP_REQUIRED" }) as unknown,
      }),
      "Failed to save expense"
    );
    expect(reply).toHaveBeenCalledExactlyOnceWith("❌ Failed to save expense. Please try again.");
    await expectNoWrites();
  });

  it("allows unlinking during parsing and rejects a new owner before writing", async () => {
    const account = await link();
    const nextOwner = crypto.randomUUID();
    await ctx.db.insert(users).values({
      id: nextOwner,
      name: "New owner",
      email: "next@example.com",
      passwordHash: "unused",
    });
    modelResponse.mockImplementation(async () => {
      // A real lock timeout detects a lookup transaction held across the model call.
      await ctx.db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL lock_timeout = '500ms'`);
        await tx.delete(linkedAccounts).where(eq(linkedAccounts.id, account.id));
      });
      await link(nextOwner);
      return parsed;
    });
    const { bot, logError } = createBot();
    await bot.handleUpdate(command());
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({ code: "EXPENSE_IDEMPOTENCY_CONFLICT" }) as unknown,
      }),
      "Failed to save expense"
    );
    await expectNoWrites();
  });

  it("does not expose an old result after unlinking and relinking to another owner", async () => {
    const account = await link();
    const { bot, logError } = createBot();
    await bot.handleUpdate(command());
    const saved = await ctx.db.select().from(expenses);
    await ctx.services.linkedAccount.unlinkAccount(userId, account.id);
    const nextOwner = crypto.randomUUID();
    await ctx.db.insert(users).values({
      id: nextOwner,
      name: "New owner",
      email: "next@example.com",
      passwordHash: "unused",
    });
    await link(nextOwner);
    reply.mockClear();
    await bot.handleUpdate(command());
    expect(reply).toHaveBeenCalledExactlyOnceWith("❌ Failed to save expense. Please try again.");
    expect(modelResponse).toHaveBeenCalledOnce();
    expect(await ctx.db.select().from(expenses)).toEqual(saved);
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({ code: "EXPENSE_IDEMPOTENCY_CONFLICT" }) as unknown,
      }),
      "Failed to save expense"
    );
  });

  it("returns the saved result after relinking to the same owner without rewriting its source", async () => {
    const account = await link();
    const { bot } = createBot();
    await bot.handleUpdate(command());
    const savedMessages = await ctx.db.select().from(messages);
    const savedExpenses = await ctx.db.select().from(expenses);
    await ctx.services.linkedAccount.unlinkAccount(userId, account.id);
    const retainedMessages = savedMessages.map((message) => ({
      ...message,
      linkedAccountId: null,
    }));
    expect(await ctx.db.select().from(messages)).toEqual(retainedMessages);

    reply.mockClear();
    await bot.handleUpdate(command());
    expect(reply).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("Link your account first")
    );
    await link();
    reply.mockClear();
    await bot.handleUpdate(command());
    expect(reply).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("✅ Saved expense:"));
    expect(modelResponse).toHaveBeenCalledOnce();
    expect(await ctx.db.select().from(messages)).toEqual(retainedMessages);
    expect(await ctx.db.select().from(expenses)).toEqual(savedExpenses);
  });

  it("keeps committed rows when confirmation fails and retries without reparsing", async () => {
    await link();
    const failure = new Error("Telegram unavailable");
    reply.mockRejectedValueOnce(failure);
    const { bot, logError } = createBot();
    await expect(bot.handleUpdate(command())).rejects.toBeInstanceOf(BotError);
    const saved = await ctx.db.select().from(expenses);
    expect(saved).toHaveLength(1);
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ err: failure, expenseId: saved[0].id }),
      "Expense saved but confirmation failed"
    );
    expect(reply).toHaveBeenCalledTimes(1);
    await bot.handleUpdate(command());
    expect(modelResponse).toHaveBeenCalledOnce();
    expect(await ctx.db.select().from(expenses)).toEqual(saved);
    expect(await ctx.db.select().from(messages)).toHaveLength(1);
  });

  it.each([
    ["discord", "123"],
    ["telegram", "-100"],
    ["telegram", "456"],
  ])("does not authorize through %s identity %s", async (platform, platformUserId) => {
    await ctx.services.linkedAccount.linkAccount({
      userId,
      platform,
      platformUserId,
      platformUsername: "tester",
    });
    const { bot } = createBot();
    await bot.handleUpdate(command());
    expect(reply).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("Link your account first")
    );
    expect(modelResponse).not.toHaveBeenCalled();
  });

  it("rejects an unlinked sender before parsing", async () => {
    const { bot } = createBot();
    await bot.handleUpdate(command());
    expect(reply).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("Link your account first")
    );
    expect(modelResponse).not.toHaveBeenCalled();
  });

  it("shows usage for an empty command without parsing", async () => {
    const { bot } = createBot();
    await bot.handleUpdate(command("/expense"));
    expect(reply).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("Usage: /expense"));
    expect(modelResponse).not.toHaveBeenCalled();
  });

  it("redirects channel commands to private chat without parsing", async () => {
    const { bot } = createBot();
    await bot.handleUpdate({
      update_id: 1,
      channel_post: {
        ...response,
        chat: { id: -100, type: "channel", title: "Test" },
        text: "/expense bakso 15k",
        entities: [{ type: "bot_command", offset: 0, length: 8 }],
      },
    });
    expect(reply).toHaveBeenCalledExactlyOnceWith("Please use this bot in a private chat.");
    expect(modelResponse).not.toHaveBeenCalled();
  });

  it("logs a real database lookup failure and keeps processing commands", async () => {
    const url = new URL(ctx.env.DATABASE_URL);
    url.searchParams.set("options", "-c search_path=pg_catalog");
    const database = initDb(url.toString());
    try {
      const { bot, logError } = createBot(database.db);
      await bot.handleUpdate(command());
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.objectContaining({
            cause: expect.objectContaining({ code: "42P01" }) as unknown,
          }) as unknown,
        }),
        "Failed to save expense"
      );
      expect(reply).toHaveBeenCalledExactlyOnceWith("❌ Failed to save expense. Please try again.");
      expect(modelResponse).not.toHaveBeenCalled();
      reply.mockClear();
      await bot.handleUpdate(command("/start"));
      expect(reply).toHaveBeenCalledExactlyOnceWith("Welcome! Up and running.");
    } finally {
      await database.client.end();
    }
  });
});
