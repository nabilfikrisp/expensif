# Codebase Review

## Critical

1. **Authorization header logged in plaintext** — `server/src/pkg/http/logger-middleware.ts:71`. Remove or redact `Authorization` header before logging.

## High

2. **Missing `process.on('unhandledRejection')`** — `server/src/index.ts`. Node.js 15+ terminates on unhandled rejections.

3. **Bot error messages leak internals** — `server/src/modules/expense/controllers/bot.ts:33-37`.

## Medium

4. **Unused `db` param in `initExpenseService`** — `server/src/modules/expense/service.ts:16`.

5. **Categories hardcoded in two places** — `expense/service.ts:6-14` + `category/schema.ts`.

6. **`messages` table never written to** — Schema exists, no inserts.

7. **Unsafe type assertion on `statusCode`** — `auth/controllers/http/index.ts:43`.

8. **LLM output could be null** — `expense/parser.ts:43`.

9. **No `updated_at` on `users` table** — `user/schema.ts`.

10. **Missing `parseStatus`/`currency` constraints** — Free-text columns, no CHECK constraints.

11. **Husky not configured** — `prepare` script exists but no `.husky` directory.

12. **Phantom `client` workspace** — `pnpm-workspace.yaml` lists `client` but doesn't exist.

13. **No database timeout** — `db/index.ts:6`.

## Low

14. Inconsistent naming (`initHTTPLoggerMiddleware` vs `initHttp`)
15. Missing TS strict flags (`noUncheckedIndexedAccess`, `noUnusedLocals`)
16. Hardcoded bcrypt salt rounds
17. `.env.example` has insecure `JWT_SECRET=jwt-token`
18. Misleading `ACCESS_TOKEN_EXPIRES_IN_MINUTES` env var name
19. Stale yarn references in `.gitignore`
