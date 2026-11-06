# Map domain errors at the HTTP boundary

Problem: Domain error classes carry HTTP status policy even when their consumers include Telegram. HTTP controllers currently serialize that policy instead of owning its mapping.

Evidence: [API-key](../../server/src/modules/api-key/error.ts), [authentication](../../server/src/modules/auth/error.ts), [linked-account](../../server/src/modules/linked-account/error.ts), and [user](../../server/src/modules/user/error.ts) errors contain `statusCode`. Their HTTP route boundaries use it directly; the [linking bot controller](../../server/src/modules/linked-account/controllers/bot.ts) consumes domain codes without HTTP statuses.

Done when:

- Domain errors retain machine-readable codes without HTTP status fields.
- HTTP controllers map supported domain codes to explicit HTTP statuses; unknown failures continue to propagate.
- Existing HTTP statuses and error envelopes remain covered, including ownership failures and authentication errors.
- Telegram error handling continues to use domain codes without depending on HTTP policy.

Scope: This is a transport-boundary refactor. No common error framework, product behavior change, or rewrite of maintainer rationale is required.
