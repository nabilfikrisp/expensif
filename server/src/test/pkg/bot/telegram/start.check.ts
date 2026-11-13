// Run from server/: pnpm test:standalone:bot-startup
import { Bot, BotError, Context } from "grammy";
import pino from "pino";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { initBot, startBot } from "@/pkg/bot/telegram";
import { initLogger } from "@/pkg/logger";

const scenario = process.argv[2];
if (scenario) {
  const bot = new Bot("123:test");
  const root = initLogger({ NODE_ENV: "production" }, pino.destination({ dest: 1, sync: true }));
  const logger = root.child({ service: "bot" });
  bot.start = () =>
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Verify unknown rejection values also fail the process.
    Promise.reject(
      scenario === "cancel"
        ? new Error("Aborted delay")
        : scenario === "error"
          ? new Error("Invalid bot token")
          : "Unexpected bot failure"
    );
  // An active handle must not keep the process alive after a bot failure.
  if (scenario !== "cancel") {
    setInterval(() => {}, 1000);
  }
  await startBot(bot, logger);
} else {
  // Exercise the polling error boundary directly without network polling or database state.
  const logs: string[] = [];
  const root = initLogger({ NODE_ENV: "production" }, { write: (line) => logs.push(line) });
  const bot = initBot({ token: "123:test", logger: root.child({ service: "bot" }) });
  const me = {
    id: 999,
    is_bot: true as const,
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
  await bot.errorHandler(
    new BotError(new Error("update failed"), new Context({ update_id: 42 }, bot.api, me))
  );
  assert.equal(logs.length, 1);
  const updateError = JSON.parse(logs[0]) as {
    service: string;
    updateId: number;
    level: number;
    err: { message: string };
  };
  assert.equal(updateError.service, "bot");
  assert.equal(updateError.updateId, 42);
  assert.equal(updateError.level, 50);
  assert.equal(updateError.err.message, "update failed");

  for (const failure of ["error", "non-error", "cancel"]) {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", fileURLToPath(import.meta.url), failure],
      { encoding: "utf8", timeout: 5000 }
    );
    assert.ifError(result.error);
    assert.equal(result.status, failure === "cancel" ? 0 : 1, result.stderr);
    assert.equal(result.stdout.includes("Bot stopped with error"), failure !== "cancel");
    assert.equal(result.stdout.includes("Telegram Bot is running"), false);
    if (failure !== "cancel") {
      const entry = JSON.parse(result.stdout.trim()) as {
        service: string;
        level: number;
      };
      assert.equal(entry.service, "bot");
      assert.equal(entry.level, 50);
    }
  }
  console.log("Bot startup failures exit; shutdown cancellation is ignored.");
}
