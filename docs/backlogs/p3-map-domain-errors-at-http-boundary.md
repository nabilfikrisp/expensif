# Map domain errors at the HTTP boundary

Problem: Domain error classes carry HTTP status policy even when their consumers include Telegram. HTTP controllers currently serialize that policy instead of owning its mapping, and repeat domain-error response handling across route modules.

Evidence: [API-key](../../server/src/modules/api-key/error.ts), [authentication](../../server/src/modules/auth/error.ts), [linked-account](../../server/src/modules/linked-account/error.ts), and [user](../../server/src/modules/user/error.ts) errors contain `statusCode`. Their HTTP route boundaries use it directly; the [linking bot controller](../../server/src/modules/linked-account/controllers/bot.ts) consumes domain codes without HTTP statuses.

Repeated handlers: [API-key](../../server/src/modules/api-key/controllers/http/index.ts), [authentication](../../server/src/modules/auth/controllers/http/index.ts), [linked-account](../../server/src/modules/linked-account/controllers/http/index.ts), and [user](../../server/src/modules/user/controllers/http/index.ts) route modules.

Done when:

- Domain errors retain machine-readable codes without HTTP status fields.
- A shared `handleDomainError` in `server/src/shared/handle-domain-error.ts` maps supported domain codes to explicit HTTP statuses and the existing error envelope.
- Route modules register `app.onError(handleDomainError)`; unknown errors rethrow to the global handler for contextual error logging and the existing 500 response.
- Existing HTTP statuses and error envelopes remain covered, including ownership failures and authentication errors.
- Telegram error handling continues to use domain codes without depending on HTTP policy.

Scope: This is a transport-boundary refactor. Keep the helper directly in `shared/`, without a `shared/http/` directory or module-specific error handling in `pkg/http`. No common error framework, product behavior change, or rewrite of maintainer rationale is required.
