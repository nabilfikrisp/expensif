# Log incoming bot messages and polling errors

Problem: Incoming Telegram messages have no structured receipt log, and recoverable polling failures are reported through grammY DEBUG rather than the application logger. Add application logs for incoming messages and failed polls while keeping successful polling quiet in application logs.

Evidence: The [bot factory](../../server/src/pkg/bot/telegram/index.ts) logs update-handler errors and terminal polling failures but has no incoming-message middleware or polling-error instrumentation. The [development script](../../server/package.json) enables `DEBUG='grammy*'`, which produces grammY polling diagnostics independently of Pino.

Done when:

- Middleware registered before command handlers emits one Pino `info` entry per incoming message update, including update ID, message ID, chat ID, chat type, and sender ID when available. Message text, captions, raw update objects, credentials, and command arguments are excluded.
- A grammY API transformer instruments `getUpdates` failures and emits Pino `error` entries for both thrown network errors and unsuccessful Telegram API responses. Logs identify the method and error type, with sanitized diagnostic codes where available; raw request URLs, bot tokens, and request payloads are excluded.
- Successful polls, empty results, and polling starts emit no application polling logs. Intentional shutdown cancellation emits no polling-error entry and is distinguished from an unexpected request failure.
- Instrumentation returns responses or rethrows failures unchanged, preserving grammY retry behavior, fatal failure handling, and process exit behavior.
- Development retains `DEBUG='grammy*'` in `pnpm dev`. Its verbose polling diagnostics remain separate from application logging; the errors-only requirement applies to application polling logs.
- Deterministic checks through bot update handling and polling verify message attribution, exclusion of sensitive content, quiet successful polling, Telegram and network failures, intentional shutdown cancellation, and recovery after a transient failure. Use simulated Telegram responses without live credentials or paid LLM calls. Retain a brief explanation for focused infrastructure coverage where broader flows cannot verify the behavior.
- Relevant checks and `pnpm --dir server lintformat` pass. Correct the existing polling verification limitation in [status](../status.md) only to the extent supported by the resulting coverage; simulated recovery does not establish live-platform verification.

Scope: Incoming-message receipt and polling-error logging only. [Service and instance attribution](p3-separate-logs-by-instance-and-service.md) remains a separate backlog item. No changes to grammY development DEBUG settings, retry or timeout policy, command behavior, database schema, or log hosting are included.
