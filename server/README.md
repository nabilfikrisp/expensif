# Server

This document covers server configuration, endpoint discovery, and commands. Commands in this document run from `server/`.

Installation, database setup, and migrations are in the [root README](../README.md#local-setup).

## Configuration

Copy `.env.example` to `.env` and fill in credentials.

| Variable                          | Default / requirement                                              |
| --------------------------------- | ------------------------------------------------------------------ |
| `NODE_ENV`                        | `development`; also accepts `production` and `test`                |
| `DEPLOY_PROXY`                    | `none`; also accepts `cloudflare` and `nginx`                      |
| `DATABASE_URL`                    | Required PostgreSQL URL; example targets the development container |
| `API_ORIGIN` | `http://localhost:3000`; exact API origin, no trailing slash; HTTPS in production |
| `FRONTEND_ORIGIN` | `http://localhost:5173`; exact dashboard origin, no trailing slash; HTTPS and same-site with the API in production (for example `https://app.example.com` with `https://api.example.com`) |
| `PORT`                            | `3000`, positive integer                                           |
| `TELEGRAM_BOT_TOKEN`              | Required Telegram bot token                                        |
| `OPENROUTER_API_KEY`              | Required OpenRouter API key                                        |
| `OPENROUTER_MODEL`                | `openrouter/free`                                                  |
| `JWT_SECRET`                      | Required, at least 32 characters                                   |
| `ACCESS_TOKEN_EXPIRES_IN_MINUTES` | `5m`; despite the name, accepts a JWT duration string             |
| `SESSION_IDLE_SECONDS` | `7200`, positive integer |
| `SESSION_ABSOLUTE_SECONDS` | `86400`, positive integer |
| `API_KEY_SECRET`                  | Required, at least 32 characters; separate from the JWT secret     |
| `API_KEY_REDEEM_WINDOW_MINUTES`   | `15`, positive integer                                             |

With `DEPLOY_PROXY=none`, rate limits use the socket address. `cloudflare` trusts `CF-Connecting-IP`; `nginx` trusts `X-Real-IP` and requires `proxy_set_header X-Real-IP $remote_addr;`. Only enable these modes behind a proxy that overwrites the chosen header and prevents direct access to the origin.

## HTTP API

Interactive documentation is at `/api/v1/docs`, with the schema at `/api/v1/doc`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Create an account. |
| POST | `/api/v1/auth/login` | Sign in. |
| GET | `/api/v1/auth/csrf` | Read the CSRF token for credentialed browser requests. |
| POST | `/api/v1/auth/refresh` | Refresh authentication tokens. |
| POST | `/api/v1/auth/change-password` | Change the password and revoke all refresh sessions. |
| POST | `/api/v1/auth/logout-all` | Log out all devices, including the current session. |
| POST | `/api/v1/auth/logout` | Sign out. |
| GET | `/api/v1/auth/me` | Retrieve the current user. |
| DELETE | `/api/v1/user/me` | Delete the current user. |
| POST | `/api/v1/api-key` | Create a linking key. |
| GET | `/api/v1/api-key` | List owned linking keys. |
| PATCH | `/api/v1/api-key/{id}` | Revoke an owned linking key. |
| DELETE | `/api/v1/api-key/{id}` | Delete an owned linking key. |
| GET | `/api/v1/linked-account` | List owned linked accounts. |
| DELETE | `/api/v1/linked-account/{id}` | Unlink an owned account. |

Import the [Postman collection](../docs/expensif.postman_collection.json). Set `baseUrl`, register or log in to capture `accessToken`, and allow Postman's cookie jar to retain cookies. Refresh and logout read the CSRF cookie into their headers. Set `apiKeyId` or `linkedAccountId` for mutation requests.

## Telegram

- `/start`: show the welcome message.
- `/link <key>`: link a Telegram account.
- `/expense <description>`: parse an expense description; requires a linked account.

## Structure and commands

```sh
pnpm dev
pnpm build
pnpm start
pnpm lintformat
pnpm test:run
```

`dev` enables grammY debug output. `start` runs the built server; apply migrations separately first. `test:run` and `test` manage the dedicated test database automatically; [test setup](../README.md#checks-and-tests) covers requirements and recovery.
