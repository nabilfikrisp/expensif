// Run from server/: pnpm test:standalone:bot-startup
import { Bot } from "grammy";
import pino from "pino";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { startBot } from "@/pkg/bot/telegram";

const scenario = process.argv[2];
if (scenario) {
  const bot = new Bot("123:test");
  const logger = pino({ level: "info" }, pino.destination({ dest: 1, sync: true }));
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
  }
  console.log("Bot startup failures exit; shutdown cancellation is ignored.");
}
