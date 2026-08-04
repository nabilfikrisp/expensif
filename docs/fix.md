# Codebase Review

## Critical

1. **Refresh token rotation disabled** — `server/src/modules/auth/service.ts:101-105`. The code is commented out. A leaked refresh token grants indefinite access. Uncomment or implement proper rotation.

2. **Authorization header logged in plaintext** — `server/src/pkg/http/logger-middleware.ts:71`. The `headers` object includes `Authorization`, and the `sanitize()` regex only catches JWTs inside JSON strings, not header values. Remove or redact the `Authorization` header before logging.

3. **No `ON DELETE CASCADE` on foreign keys** — All child tables (api_keys, linked_accounts, messages, expenses) use `ON DELETE NO ACTION`. Deleting a user leaves orphaned rows everywhere. Add `onDelete: "cascade"` to the Drizzle FK definitions.

4. **Race condition in register** — `server/src/modules/auth/service.ts:21-32`. Check-then-insert without a transaction. Two concurrent registrations with the same email can both pass the check. Wrap in a transaction or catch the constraint violation.

## High

5. **Rate limiter key is spoofable** — `x-forwarded-for` is client-controlled. An attacker can spoof it to bypass rate limiting. When absent, the key falls back to `""`, lumping all direct requests into one bucket.

6. **Missing `process.on('unhandledRejection')`** — `server/src/index.ts`. Node.js 15+ terminates on unhandled rejections by default. The graceful shutdown handlers won't help if an unhandled rejection crashes the process first.

7. **No test framework** — Zero tests anywhere. No vitest/jest in devDependencies, no test scripts. The codebase has no automated test coverage.

8. **No CORS middleware** — `server/src/pkg/http/index.ts`. No `hono/cors` configured. Any external client (including a future frontend) will be blocked by CORS.

9. **`messages.external_message_id` not UNIQUE** — `server/src/modules/message/schema.ts:13`. The same Telegram message can be processed multiple times, creating duplicate expenses.

10. **Bot error messages leak internals** — `server/src/modules/expense/controllers/bot.ts:33-37`. Internal error messages (LLM provider errors, DB errors) are sent directly to Telegram users.

## Medium

11. **Unused `db` param in `initExpenseService`** — `server/src/modules/expense/service.ts:16`. Accepts `db` but never uses it. Parsed expenses are never persisted to the database.

12. **Categories hardcoded in two places** — `server/src/modules/expense/service.ts:6-14` has a static array, but `server/src/modules/category/schema.ts` has a DB table. These will diverge.

13. **`apiKeys` and `linkedAccounts` tables unused** — Schema and relations exist but nothing reads/writes to them. Dead schema adding migration complexity.

14. **`messages` table never written to** — Schema exists, migration exists, but no code ever inserts messages.

15. **Unsafe type assertion on `statusCode`** — `server/src/modules/auth/controllers/http.ts:134`. `err.statusCode as ContentfulStatusCode` is an unsafe cast.

16. **LLM output could be null** — `server/src/modules/expense/parser.ts:43`. `Output.object()` may return `null`, but the return type is `Promise<ParsedExpense>` with no null check.

17. **No `updated_at` on `users` table** — `server/src/modules/user/schema.ts`.

18. **Missing indexes** — `api_keys.user_id`, `linked_accounts.user_id`, `expenses.category_id`, `messages.linked_account_id` all lack indexes for reverse lookups.

19. **Missing `parseStatus`/`currency` constraints** — Free-text columns with no CHECK constraints. Any string can be inserted.

20. **Husky not configured** — `prepare` script exists but no `.husky` directory. Pre-commit hooks aren't running.

21. **Phantom `client` workspace** — `pnpm-workspace.yaml` lists `client` but the directory doesn't exist.

22. **No database timeout** — `server/src/pkg/db/index.ts:6`. `createClient` has no timeout configured.

## Low

23. Inconsistent naming (`initHTTPLoggerMiddleware` vs `initHttp`)
24. `getRefreshCookie` is a trivial wrapper with no added value
25. Missing TS strict flags (`noUncheckedIndexedAccess`, `noUnusedLocals`)
26. Hardcoded bcrypt salt rounds (should be configurable)
27. `.env.example` has insecure `JWT_SECRET=jwt-token` (fails the min 32 validation)
28. Misleading `ACCESS_TOKEN_EXPIRES_IN_MINUTES` env var name (value is a duration string like `15m`)
29. Stale yarn references in `.gitignore`


- No tests (but services are injectable, making tests easy to add)
- No retry/timeout on DB calls (acceptable for local SQLite)
- No health check endpoint (trivial to add later)

- A race condition in register → you understand the happy path, edge cases come later
- Refresh token rotation disabled → conscious decision to defer, not ignorance
- No CORS → you know it exists, just haven't needed it yet