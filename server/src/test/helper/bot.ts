import { MockLanguageModelV4 } from "ai/test";
import type { Update } from "grammy/types";
import type { TestContext } from "./app";
import { initBotApp } from "@/app";
import type { Llm } from "@/pkg/llm";
import type { Logger } from "@/pkg/logger";
import { initLogger } from "@/pkg/logger";

export function initTestBot(
  context: TestContext,
  db = context.db,
  logger: Logger = initLogger(context.env),
  llm: Llm = { model: new MockLanguageModelV4() }
) {
  const bot = initBotApp({
    env: context.env,
    db,
    logger,
    llm,
    linkedAccountUseCase: context.useCases.linkedAccount,
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
  return bot;
}

export function botCommand(
  text: string,
  id = 123,
  chatType: "private" | "group" = "private",
  username?: string,
  messageId = id
): Update {
  const chat =
    chatType === "private"
      ? { id, type: "private" as const, first_name: "Test" }
      : { id: -100, type: "group" as const, title: "Test" };
  return {
    update_id: messageId,
    message: {
      message_id: messageId,
      date: 0,
      chat,
      from: { id, is_bot: false, first_name: "Test", username },
      text,
      entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }],
    },
  };
}
