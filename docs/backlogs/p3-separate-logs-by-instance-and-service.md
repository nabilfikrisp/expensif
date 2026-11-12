# Separate logs by instance and service

Problem: API, Telegram bot, and scheduler logs share one logger without service attribution. Logs need to distinguish each service and each running application instance.

Evidence: The [composition root](../../server/src/index.ts) passes the same [Pino logger](../../server/src/pkg/logger/index.ts) to HTTP, Telegram, the scheduler, and shutdown. [HTTP middleware](../../server/src/pkg/http/logger-middleware.ts) adds request IDs, [bot errors](../../server/src/pkg/bot/telegram/index.ts) include update IDs, and [scheduler events](../../server/src/pkg/scheduler/index.ts) include job names, but these logs have no common service or instance fields.

Done when:

- A unique `instanceId` is generated once per process startup and inherited by all application loggers. Pino's existing `hostname` and `pid` fields remain available.
- Child loggers bind `service` to `api`, `bot`, or `scheduler`. Shared startup, database, and process lifecycle events use `runtime`.
- The composition root injects the appropriate child logger through existing factories and startup functions. Request IDs, update IDs, and job names remain available where currently emitted.
- Service shutdown events carry the corresponding service attribution; shared shutdown events carry runtime attribution.
- The API's direct warning in [rate limiting](../../server/src/pkg/http/rate-limit.ts) uses the injected API logger. Environment-validation errors remain visible before application initialization, and grammY development debug output is explicitly accounted for separately from application JSON logs.
- Application logs remain JSON on stdout and can be filtered or routed by `instanceId` and `service`.
- Captured-log checks verify service attribution, inheritance through nested loggers, and distinct instance IDs across startups. Existing HTTP, bot, and scheduler checks cover attribution while preserving redaction and failure behavior.
- Relevant standalone checks and `pnpm --dir server lintformat` pass.

Scope: Logical log separation within the existing shared process. Separate files, log collector deployment, rotation, retention, process splitting, and database migrations are outside this item.
