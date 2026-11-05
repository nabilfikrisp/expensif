# Test coverage

Status: use-case test refactor and API-key HTTP coverage implemented. Run the suite using the [root README](../README.md#checks-and-tests).

## Current organization

| Suite                                                            | Responsibility                                                                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `server/src/test/auth/`                                          | Register, login, refresh, logout, and current-user HTTP behavior                                                         |
| `server/src/test/api-key/`                                       | Generate, list, revoke, and delete HTTP behavior; consumption service validation and lock-wait expiry                    |
| `server/src/test/linked-account/linked-account.use-case.test.ts` | Redemption results, persisted ownership, optional username, rollback, error mapping, single-use concurrency, and burning |
| `server/src/test/db/`                                            | Concurrent independent transactions and PostgreSQL constraint-error detection                                            |

The refactor removed duplicate success/concurrency assertions and checks of transaction-object identity. Observable rollback and persisted state remain the source of confidence in transaction boundaries.

HTTP tests use `app.request` and response schemas. The shared helper mounts auth and API-key routes, raises rate limits for tests, and creates services/use cases against real PostgreSQL. Global setup applies committed migrations. Files run sequentially because they share a database; individual tests may explicitly exercise concurrent operations.

## Remaining gaps

- Linked-account HTTP authentication, validation, ownership, and error responses: these routes are not mounted in the shared test app.
- Browser cookie visibility and refresh flow; request-level cookie-header assertions do not emulate a browser.
- HTTP logging redaction and escaped-string handling.
- Telegram command behavior and continued processing after update failures.
- Expense parser output validation and future persistence behavior.

The temporary `review-regressions.check.ts` used during the review fixes was removed. It is not part of the permanent suite.

## Last verification

The latest code-fix run passed 69 tests across 13 files. Typechecking and formatting passed; lint had one existing unused-`db` warning in the expense service. These are recorded results, not a guarantee of the result after future changes.
