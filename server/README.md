# Server

This document describes server configuration, HTTP APIs, Telegram behavior, and runtime wiring. Commands in this document run from `server/`.

Installation, database setup, and migrations are in the [root README](../README.md#local-setup).

## Configuration

Copy `.env.example` to `.env` and fill in credentials. `src/pkg/env/index.ts` validates configuration at startup.

| Variable                          | Default / requirement                                              |
| --------------------------------- | ------------------------------------------------------------------ |
| `NODE_ENV`                        | `development`; also accepts `production` and `test`                |
| `DEPLOY_PROXY`                    | `none`; also accepts `cloudflare` and `nginx`                      |
| `DATABASE_URL`                    | Required PostgreSQL URL; example targets the development container |
| `PORT`                            | `3000`, positive integer                                           |
| `TELEGRAM_BOT_TOKEN`              | Required Telegram bot token                                        |
| `OPENROUTER_API_KEY`              | Required OpenRouter API key                                        |
| `OPENROUTER_MODEL`                | `openrouter/free`                                                  |
| `JWT_SECRET`                      | Required, at least 32 characters                                   |
| `ACCESS_TOKEN_EXPIRES_IN_MINUTES` | `15m`; despite the name, accepts a JWT duration string             |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS`   | `7d`; accepts a JWT duration string                                |
| `API_KEY_SECRET`                  | Required, at least 32 characters; separate from the JWT secret     |
| `API_KEY_REDEEM_WINDOW_MINUTES`   | `15`, positive integer                                             |

Refresh and CSRF cookie lifetimes are currently fixed at seven days, independent of the refresh JWT duration. Production cookies use `Secure` and `SameSite=Strict`; other environments use `SameSite=Lax` without `Secure`.

With `DEPLOY_PROXY=none`, rate limits use the socket address. `cloudflare` trusts `CF-Connecting-IP`; `nginx` trusts `X-Real-IP` and requires `proxy_set_header X-Real-IP $remote_addr;`. Only enable these modes behind a proxy that overwrites the chosen header and prevents direct access to the origin.

## HTTP API

Interactive documentation is at `/api/v1/docs`, with the schema at `/api/v1/doc`.

| Method | Path                          | Authentication / behavior                                                         |
| ------ | ----------------------------- | --------------------------------------------------------------------------------- |
| POST   | `/api/v1/auth/register`       | JSON `email`, `password`, `name`; creates user and tokens                         |
| POST   | `/api/v1/auth/login`          | JSON `email`, `password`; issues tokens                                           |
| POST   | `/api/v1/auth/refresh`        | Refresh cookie plus matching CSRF cookie/header                                   |
| POST   | `/api/v1/auth/logout`         | Clears cookies; no server-side token revocation                                   |
| GET    | `/api/v1/auth/me`             | Bearer access token                                                               |
| DELETE | `/api/v1/user/me`             | Bearer access token; deletes only the token owner and cascades to owned data        |
| POST   | `/api/v1/api-key`             | Bearer access token; JSON object with optional `label`                            |
| GET    | `/api/v1/api-key`             | Bearer access token; optional `label`, `status`, `page`, `limit` query parameters |
| PATCH  | `/api/v1/api-key/{id}`        | Bearer access token; revokes an owned key                                         |
| DELETE | `/api/v1/api-key/{id}`        | Bearer access token; deletes an owned key                                         |
| GET    | `/api/v1/linked-account`      | Bearer access token; lists owned linked accounts                                  |
| DELETE | `/api/v1/linked-account/{id}` | Bearer access token; unlinks an owned account                                     |

Register, login, and refresh return `data.accessToken`. Send it as `Authorization: Bearer <token>`. The `refresh_token` cookie is HttpOnly and scoped to `/api/v1/auth`. The readable `csrf_token` cookie is scoped to `/`; send its value as `X-CSRF-Token` when refreshing. Issuing or clearing CSRF cookies also deletes the legacy API-scoped cookie.

Refresh issues tokens again but does not invalidate the old refresh token. Logout only clears browser cookies; copied tokens remain valid until expiry. The unimplemented design is in the [refresh-session proposal](../docs/session-revocation.md).

CORS permits the server's own origin with credentials; there is no separate frontend-origin allowlist. In-memory HTTP limits are 100 requests/minute globally, plus 20/minute for login and 10/minute for registration, per client IP. Limits are per process and do not apply to Telegram commands.

Import the [Postman collection](../docs/expensif.postman_collection.json). Set `baseUrl`, register or log in to capture `accessToken`, and allow Postman's cookie jar to retain cookies. Refresh reads the CSRF cookie into its header. Set `apiKeyId` or `linkedAccountId` for mutation requests.

## Telegram

- `/start`: welcome message.
- `/link <key>`: links the sender's Telegram account to the key owner in a private chat. Keys pasted in non-private chats are revoked without linking or changing their usage timestamp. The original message is not deleted.
- `/expense <description>`: asks the LLM for one structured expense and displays it. No persistence or linked-account authorization yet. Relative dates use the current date in `Asia/Jakarta`.

Amount and display conventions follow the [currency policy](../docs/product-intent.md#why-a-particular-currency-policy).

Unhandled update errors are logged by `bot.catch` so subsequent updates can continue. A rejected `bot.start()` is logged and terminates the process with exit code 1, stopping HTTP as well. Retry-delay cancellation during intentional bot shutdown is ignored. The running message is logged only after bot initialization succeeds.

## Structure and commands

`src/index.ts` constructs dependencies, registers Telegram commands before the catch-all message handler, and starts HTTP and Telegram. `initBot` creates the bot and configures its error handler. Module controllers handle transport, services handle operations, and the linked-account use case owns the transaction spanning key consumption, linking, and user lookup. `src/pkg/` contains database, HTTP, cookies, logging, bot, LLM, and environment infrastructure.

```sh
pnpm dev
pnpm build
pnpm start
pnpm lintformat
pnpm test:run
```

`dev` enables grammY debug output. `start` runs the built server; apply migrations separately first. The dedicated test database must be running for `test:run`; [test setup](../README.md#checks-and-tests) explains how to switch containers safely.
