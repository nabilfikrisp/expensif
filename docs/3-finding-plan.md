# Missed Findings (WIP Review)

Open issues that should be addressed before production.

## Security

### 1. Rate Limiter Key Is Spoofable

`server/src/pkg/http/rate-limit-middleware.ts` — `x-forwarded-for` is client-controlled. Falls back to `"unknown"` when absent, lumping all direct requests into one bucket.

**Fix:** Use authenticated user ID or multi-header fingerprint.

### 2. Internal Errors Leaked to Users

`server/src/modules/expense/controllers/bot.ts:36` — LLM/DB errors sent directly to Telegram users.

**Fix:** Log real error, return generic message.

### 3. Authorization Header Logged in Plaintext

`server/src/pkg/http/logger-middleware.ts:71` — Bearer tokens in plaintext logs.

**Fix:** Redact `Authorization` in `sanitize()`.

## Data Integrity

### 4. LLM Output Could Be Null

`server/src/modules/expense/parser.ts:43` — `Output.object()` may return `null`, no null check.

**Fix:** Guard against null.

## Reliability

### 5. No DB Connection Timeout

`server/src/pkg/db/index.ts:6` — `createClient` has no timeout.

**Fix:** Pass `timeout` option.

### 6. Unsafe Type Cast on Status Code

`server/src/modules/auth/controllers/http/index.ts:43` — `err.statusCode as ContentfulStatusCode`.

**Fix:** Narrow type or validate at construction.

### 7. Silent Catch Blocks

3 locations discard original errors: `middleware.ts:36`, `auth/service.ts:83`, `logger-middleware.ts:45`.

**Fix:** Log before returning generic response.

## Code Hygiene

### 8. Categories in Two Places

Hardcoded in `expense/service.ts:6-14` + DB table in `category/schema.ts`.

**Fix:** Pick one source of truth.

### 9. Hardcoded bcrypt Salt Rounds

`auth/service.ts:128` — hardcoded to `10`.

**Fix:** Make configurable via env.

### 10. Phantom `client` Workspace

`pnpm-workspace.yaml` lists `client` but directory doesn't exist.

### 11. Missing `updated_at` on Users

`user/schema.ts` — no audit trail for profile changes.
