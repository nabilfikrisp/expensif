# Codebase Review

## Critical

1. **Authorization header logged in plaintext** — `server/src/pkg/http/logger-middleware.ts:71`. Remove or redact `Authorization` header before logging.

## High

2. **Rate limiter key is spoofable** — `x-forwarded-for` is client-controlled. Falls back to `"unknown"`.

3. **Missing `process.on('unhandledRejection')`** — `server/src/index.ts`. Node.js 15+ terminates on unhandled rejections.

4. **Bot error messages leak internals** — `server/src/modules/expense/controllers/bot.ts:33-37`.

## Medium

5. **Unused `db` param in `initExpenseService`** — `server/src/modules/expense/service.ts:16`.

6. **Categories hardcoded in two places** — `expense/service.ts:6-14` + `category/schema.ts`.

7. **`messages` table never written to** — Schema exists, no inserts.

8. **Unsafe type assertion on `statusCode`** — `auth/controllers/http/index.ts:43`.

9. **LLM output could be null** — `expense/parser.ts:43`.

10. **No `updated_at` on `users` table** — `user/schema.ts`.

11. **Missing `parseStatus`/`currency` constraints** — Free-text columns, no CHECK constraints.

12. **Husky not configured** — `prepare` script exists but no `.husky` directory.

13. **Phantom `client` workspace** — `pnpm-workspace.yaml` lists `client` but doesn't exist.

14. **No database timeout** — `db/index.ts:6`.

## Low

15. Inconsistent naming (`initHTTPLoggerMiddleware` vs `initHttp`)
16. Missing TS strict flags (`noUncheckedIndexedAccess`, `noUnusedLocals`)
17. Hardcoded bcrypt salt rounds
18. `.env.example` has insecure `JWT_SECRET=jwt-token`
19. Misleading `ACCESS_TOKEN_EXPIRES_IN_MINUTES` env var name
20. Stale yarn references in `.gitignore`
