import { MockLanguageModelV4 } from "ai/test";
import { Api, BotError, Context } from "grammy";
import type { Message, Update, User } from "grammy/types";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { initTest } from "../../../helper";

import { initBotApp } from "@/app";
import * as expenseParser from "@/modules/expense/parser";
import { initRequireLinkedAccountMiddleware } from "@/modules/linked-account/controllers/bot-middleware";
import { users } from "@/modules/user/schema";
import { initDb } from "@/pkg/db";
import { initLogger } from "@/pkg/logger";

let ctx: Awaited<ReturnType<typeof initTest>>;
const reply = vi.fn<Context["reply"]>();
const editMessageText = vi.fn<Api["editMessageText"]>();
const sender: User = { id: 123, is_bot: false, first_name: "Test", username: "tester" };
const message = {
  message_id: 1,
  date: 0,
  chat: { id: -100, type: "group", title: "Test" },
  text: "",
} satisfies Message.TextMessage;

function command(text: string): Update {
  return {
    update_id: 1,
    message: {
      ...message,
      from: sender,
      text,
      entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }],
    },
  };
}

function createBot(db = ctx.db) {
  const logger = initLogger(ctx.env);
  const logError = vi.spyOn(logger, "error");
  const bot = initBotApp({
    env: ctx.env,
    db,
    logger,
    llm: { model: new MockLanguageModelV4() },
    linkedAccountUseCase: ctx.useCases.linkedAccount,
  });
  bot.botInfo = {
    id: 999,
    is_bot: true,
    first_name: "Bot",
    username: "test_bot",
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false,
  };
  return { bot, logError };
}

beforeAll(async () => {
  ctx = await initTest();
  return () => ctx.client.end();
});

beforeEach(async () => {
  await ctx.resetDb();
  await ctx.db.insert(users).values({
    id: "owner",
    name: "Owner",
    email: "owner@example.com",
    passwordHash: "unused",
  });
  reply.mockReset().mockResolvedValue(message);
  vi.spyOn(Context.prototype, "reply").mockImplementation(reply);
  editMessageText.mockReset().mockResolvedValue(true);
  vi.spyOn(Api.prototype, "editMessageText").mockImplementation(editMessageText);
  vi.spyOn(expenseParser, "execParseExpense").mockResolvedValue({
    item_name: "bakso",
    amount: "15000",
    currency: "IDR",
    date: "2026-11-09",
    category: "food",
  });
});

afterEach(() => vi.restoreAllMocks());

describe("linked-account bot middleware", () => {
  it.each(["/expense bakso 15k", "/expense"])(
    "blocks unlinked senders before the handler (%s)",
    async (text) => {
      const { bot } = createBot();
      await bot.handleUpdate(command(text));
      expect(reply).toHaveBeenCalledExactlyOnceWith(
        "Link your account first using /link <api-key> in a private chat with the bot."
      );
      expect(expenseParser.execParseExpense).not.toHaveBeenCalled();
      expect(editMessageText).not.toHaveBeenCalled();
    }
  );

  it("preserves parsing for linked senders and blocks the next command after unlinking", async () => {
    const account = await ctx.services.linkedAccount.linkAccount({
      userId: "owner",
      platform: "telegram",
      platformUserId: sender.id.toString(),
      platformUsername: "old_username",
    });
    const { bot } = createBot();
    await bot.handleUpdate(command("/expense bakso 15k"));
    expect(expenseParser.execParseExpense).toHaveBeenCalledOnce();
    expect(editMessageText).toHaveBeenCalledWith(
      message.chat.id,
      message.message_id,
      expect.stringContaining("Item: bakso")
    );

    await ctx.services.linkedAccount.unlinkAccount("owner", account.id);
    reply.mockClear();
    await bot.handleUpdate(command("/expense bakso 15k"));
    expect(reply).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("Link your account first")
    );
    expect(expenseParser.execParseExpense).toHaveBeenCalledOnce();
  });

  it.each([
    ["discord", "123"],
    ["telegram", "-100"],
    ["telegram", "456"],
  ])("does not authorize through %s identity %s or a matching username", async (platform, id) => {
    await ctx.services.linkedAccount.linkAccount({
      userId: "owner",
      platform,
      platformUserId: id,
      platformUsername: sender.username,
    });
    const { bot } = createBot();
    await bot.handleUpdate(command("/expense bakso 15k"));
    expect(reply).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("Link your account first")
    );
    expect(expenseParser.execParseExpense).not.toHaveBeenCalled();
  });

  it("rejects commands without sender identity", async () => {
    const { bot } = createBot();
    const update: Update = {
      update_id: 1,
      channel_post: {
        ...message,
        chat: { id: -100, type: "channel", title: "Test" },
        text: "/expense bakso 15k",
        entities: [{ type: "bot_command", offset: 0, length: 8 }],
      },
    };
    await bot.handleUpdate(update);
    expect(reply).toHaveBeenCalledExactlyOnceWith("Cannot identify your Telegram account.");
    expect(expenseParser.execParseExpense).not.toHaveBeenCalled();
  });

  it.each([
    ["/start", "Welcome! Up and running."],
    ["/link", "Usage: /link <api-key>"],
  ])("keeps %s available without a link", async (text, expectedReply) => {
    const { bot } = createBot();
    await bot.handleUpdate(command(text));
    expect(reply).toHaveBeenCalledExactlyOnceWith(expect.stringContaining(expectedReply));
    expect(expenseParser.execParseExpense).not.toHaveBeenCalled();
  });

  it("propagates a real lookup failure to the logging boundary and continues processing", async () => {
    const url = new URL(ctx.env.DATABASE_URL);
    url.searchParams.set("options", "-c search_path=pg_catalog");
    const database = initDb(url.toString());
    try {
      const { bot, logError } = createBot(database.db);
      const error = await bot.handleUpdate(command("/expense bakso 15k")).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BotError);
      if (!(error instanceof BotError)) {
        throw new Error("Expected a bot error");
      }
      expect(error.error).toMatchObject({ cause: { code: "42P01" } });
      expect(reply).not.toHaveBeenCalled();
      expect(expenseParser.execParseExpense).not.toHaveBeenCalled();
      await bot.errorHandler(error as BotError);
      expect(logError).toHaveBeenCalledWith({ err: error.error, updateId: 1 }, "Bot update failed");
      await bot.handleUpdate(command("/start"));
      expect(reply).toHaveBeenCalledExactlyOnceWith("Welcome! Up and running.");
    } finally {
      await database.client.end();
    }
  });

  it("does not translate downstream errors as missing links", async () => {
    await ctx.services.linkedAccount.linkAccount({
      userId: "owner",
      platform: "telegram",
      platformUserId: sender.id.toString(),
    });
    const { bot } = createBot();
    const middleware = initRequireLinkedAccountMiddleware(ctx.services.linkedAccount);
    const error = new Error("Downstream failure");
    await expect(
      middleware(
        new Context(command("/expense"), bot.api, bot.botInfo),
        vi.fn<() => Promise<void>>().mockRejectedValue(error)
      )
    ).rejects.toBe(error);
    expect(reply).not.toHaveBeenCalled();
  });
});
