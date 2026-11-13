// Run from server/: pnpm test:standalone:shutdown
import type { ServerType } from "@hono/node-server";
import type { Transformer } from "grammy";
import pino from "pino";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { setImmediate as flush } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { registerExpenseCommands } from "@/modules/expense/controllers/bot";
import { initBot, startBot } from "@/pkg/bot/telegram";
import type { DbClient } from "@/pkg/db";
import { shutdown } from "@/shutdown";

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

// Process exits and polling lifecycle cannot be verified by HTTP or database flows.
// Mock only transport and resource closure; exercise real grammY polling and expense handling.
const scenario = process.argv[2];
if (scenario) {
  const logger = pino({ level: "info" }, pino.destination({ dest: 1, sync: true }));
  const bot = initBot({ token: "123:test", logger });
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
  const parsingStarted = gate();
  const parsing = gate();
  const confirmationStarted = gate();
  const confirmation = gate();
  const jobs = gate();
  let polls = 0;
  let acknowledged = false;
  let saved = false;
  let confirmed = false;
  let dbClosed = false;
  let closeHttp!: () => void;
  let httpCloses = 0;
  let jobStops = 0;

  bot.api.config.use((async (_previous, method, payload) => {
    if (method === "deleteWebhook") {
      return { ok: true, result: true };
    }
    if (method === "getUpdates") {
      polls++;
      if (polls > 1) {
        assert.equal((payload as { offset?: number }).offset, 43);
        acknowledged = true;
        return { ok: true, result: [] };
      }
      return {
        ok: true,
        result: [
          {
            update_id: 42,
            message: {
              message_id: 7,
              date: 0,
              chat: { id: 123, type: "private", first_name: "Test" },
              from: { id: 123, is_bot: false, first_name: "Test" },
              text: "/expense bakso 15k",
              entities: [{ type: "bot_command", offset: 0, length: 8 }],
            },
          },
        ],
      };
    }
    assert.equal(method, "sendMessage");
    confirmationStarted.release();
    await confirmation.promise;
    confirmed = true;
    logger.info("test: expense confirmed");
    return {
      ok: true,
      result: {
        message_id: 8,
        date: 0,
        chat: { id: 123, type: "private", first_name: "Test" },
        text: "Saved expense",
      },
    };
  }) as Transformer);
  registerExpenseCommands({
    bot,
    logger,
    expenseUseCase: {
      async ingestExpense() {
        parsingStarted.release();
        await parsing.promise;
        assert.equal(dbClosed, false);
        saved = true;
        logger.info("test: expense saved");
        return {
          messageId: "message",
          parseStatus: "parsed",
          expense: {
            id: "expense",
            itemName: "bakso",
            amount: "15000",
            currency: "IDR",
            expenseDate: "2026-11-13",
            categoryId: null,
            categorySlug: null,
            note: null,
          },
        };
      },
    },
  });

  const botLifecycle = startBot(bot, logger);
  await parsingStarted.promise;
  const options = {
    logger,
    bot,
    botLifecycle,
    httpServer: {
      close(callback: () => void) {
        httpCloses++;
        closeHttp = callback;
      },
    } as unknown as ServerType,
    dbClient: {
      end() {
        assert.equal(saved, true);
        assert.equal(confirmed, true);
        dbClosed = true;
        logger.info("test: database closed");
        return Promise.resolve();
      },
    } as unknown as DbClient,
    stopJobs: () => {
      jobStops++;
      return jobs.promise;
    },
  };
  void shutdown("SIGTERM", options);
  await shutdown("SIGINT", options);
  await flush();
  assert.equal(acknowledged, true);
  assert.equal(httpCloses, 1);
  assert.equal(jobStops, 1);
  assert.equal(saved, false);
  assert.equal(dbClosed, false);
  logger.info("test: intake stopped while parsing");

  if (scenario === "timeout") {
    jobs.release();
    closeHttp();
    // Keep the handler blocked. The production deadline must log and exit nonzero,
    // even when unresolved promises are the only remaining work.
  } else {
    parsing.release();
    await confirmationStarted.promise;
    assert.equal(dbClosed, false);
    confirmation.release();
    await botLifecycle;
    await flush();
    assert.equal(dbClosed, false, "scheduled work and HTTP requests must also drain");
    jobs.release();
    await flush();
    assert.equal(dbClosed, false, "HTTP requests must finish before database closure");
    closeHttp();
  }
} else {
  for (const testCase of ["drain", "timeout"]) {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", fileURLToPath(import.meta.url), testCase],
      { encoding: "utf8", timeout: 15_000 }
    );
    assert.ifError(result.error);
    assert.equal(result.status, testCase === "drain" ? 0 : 1, result.stdout + result.stderr);
    const entries = result.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { msg: string; level: number });
    const messages = entries.map((entry) => entry.msg);
    assert.ok(messages.includes("test: intake stopped while parsing"));
    if (testCase === "drain") {
      for (const [before, after] of [
        ["test: expense saved", "test: expense confirmed"],
        ["test: expense confirmed", "Telegram bot stopped"],
        ["Telegram bot stopped", "test: database closed"],
        ["HTTP server closed", "test: database closed"],
        ["Scheduled jobs stopped", "test: database closed"],
        ["test: database closed", "Shutdown complete"],
      ]) {
        assert.ok(messages.includes(before) && messages.includes(after));
        assert.ok(messages.indexOf(before) < messages.indexOf(after));
      }
    } else {
      // Completed services report progress even while the bot remains blocked.
      assert.ok(messages.includes("Scheduled jobs stopped"));
      assert.ok(messages.includes("HTTP server closed"));
      assert.ok(
        entries.some(
          (entry) => entry.msg === "Shutdown timed out, forcing exit" && entry.level === 50
        )
      );
      for (const message of [
        "test: expense saved",
        "Telegram bot stopped",
        "test: database closed",
        "Shutdown complete",
      ]) {
        assert.ok(!messages.includes(message));
      }
    }
  }
  console.log("Shutdown drains bot handlers, HTTP requests, and jobs; timeout exits nonzero.");
}
