# Drain bot handlers before shutdown

Problem: Shutdown can acknowledge a Telegram expense command before its handler saves the expense, then close the database and exit. Telegram will not redeliver the acknowledged command.

Evidence: [Shutdown](../../server/src/shutdown.ts) awaits `bot.stop()` before closing PostgreSQL and exiting, while [bot startup](../../server/src/pkg/bot/telegram/index.ts) discards the `bot.start()` promise. Installed grammY documents that `stop()` confirms the current update without waiting for middleware; the `start()` promise resolves after middleware completes. A local reproduction with simulated Telegram responses acknowledged update 42 with offset 43 while its handler remained unfinished.

Done when:

- Shutdown stops polling and waits for active bot handlers before closing the database or reporting successful shutdown.
- Startup preserves the bot lifecycle promise through the existing factory and composition-root wiring, retaining fatal bot-failure handling and intentional shutdown cancellation behavior.
- The existing shutdown deadline remains enforced; a handler that cannot finish within it causes an error log and nonzero exit rather than a successful shutdown report.
- Deterministic coverage with simulated Telegram responses holds an expense handler in progress during shutdown and verifies that database closure and successful exit wait for it. Coverage also verifies the timeout path without live Telegram credentials or paid LLM calls.
- Relevant checks and `pnpm --dir server lintformat` pass. Database-backed checks use only the test runner and dedicated test database; migration execution still requires explicit maintainer approval.

