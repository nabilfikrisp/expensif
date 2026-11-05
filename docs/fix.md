# Codebase review status

This document tracks confirmed behavior after the review fixes. Product targets are in the [PRD](prd.md); proposed session revocation is separate in [the token plan](2-token-plan.md).

## Fixed

| Finding                                                                       | Current behavior                                                                                                                               |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Generated API keys and sensitive headers reached HTTP logs                    | Structured field redaction covers keys, passwords, authorization, cookies, and CSRF headers; token patterns are also redacted in string values |
| Escaped quotes in passwords corrupted logging JSON and produced 500 responses | Redaction uses a JSON replacer instead of rewriting serialized JSON with a field regex                                                         |
| An unhandled Telegram update error stopped polling                            | `bot.catch` logs update failures without rethrowing                                                                                            |
| CSRF cookie was unreadable from dashboard paths                               | CSRF cookie uses `/`; setting/clearing it also deletes the legacy `/api/v1/auth` cookie                                                        |
| Linked-account authentication errors returned 500                             | Route error handler handles `AuthError` and returns 401                                                                                        |

## Remaining work

- `/expense` parses one item without linking authorization or saving messages/expenses. Complete this flow before presenting it as expense tracking.
- Expense parsing errors expose their message to Telegram users. Keep details in logs and provide a generic failure response.
- Parser date, currency, and category fields accept arbitrary strings. Validate these before persistence; relative dates currently use UTC rather than a user timezone.
- Logout does not revoke JWTs, and refresh does not invalidate previously issued refresh tokens.
- Production database initialization does not set a connection timeout. The DB factory supports `connectionTimeoutMillis`; the test helper sets it to 5000 ms.
- Categories are hardcoded for parsing; the category table has no seed workflow or runtime integration.
- Permanent coverage is missing for the logging, browser-cookie, and bot boundaries. See [test coverage](4-use-case-test-refactor.md).

## Documentation corrections

The project uses PostgreSQL, not SQLite/libSQL. Husky has a pre-commit hook that invokes server checks for staged server files. The workspace lists `client`, but no client app exists. `expires_at` is present on API keys. IDs are PostgreSQL `text`, not native `uuid` columns.

Older review claims about nullable LLM output or missing audit columns are not treated as confirmed runtime defects here; revisit them against actual requirements and the installed SDK before changing code.
