# Missed Findings (WIP Review)

Things that don't block feature work but will compound into real problems before production. Not in scope of current iteration — but should be addressed before launch.

## Security

### 1. JWT Secret "Separation" Is Meaningless
`server/src/modules/auth/service.ts:13-15`

```typescript
encodeSecret(raw: string, type: TokenType = "access"): Uint8Array {
  const key = type === "refresh" ? raw + ":refresh" : raw;
  return new TextEncoder().encode(key);
}
```

Both token types are signed with the same base key. Appending `:refresh` is not cryptographic separation. If one is compromised, the other follows trivially.

**Fix:** Use two independent env vars (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) or HKDF derivation.

### 2. Rate Limiter Key Is Spoofable
`server/src/modules/auth/controllers/middleware.ts:53`, `server/src/pkg/http/index.ts:29`

```typescript
keyGenerator: (c) => c.req.header("x-forwarded-for") ?? "",
```

- `x-forwarded-for` is client-controlled — trivially spoofed
- When absent, key falls back to `""` — all direct requests share one bucket. One aggressive client rate-limits everyone.

**Fix:** Use a stable, non-spoofable key (e.g., authenticated user ID, or a fingerprint derived from multiple headers). Add a fallback that doesn't collapse to a single bucket.

### 3. Internal Errors Leaked to Users
`server/src/modules/expense/controllers/bot.ts:36`

```typescript
await ctx.api.editMessageText(ctx.chat.id, sent.message_id,
  `❌ Failed to parse: ${error instanceof Error ? error.message : "Unknown error"}`
);
```

LLM provider errors, database errors, or any internal exception message is sent directly to the Telegram user. Exposes stack traces, provider details, and DB structure.

**Fix:** Log the real error, return a generic user-facing message.

### 4. Authorization Header Logged in Plaintext
`server/src/pkg/http/logger-middleware.ts:71`

The full `Authorization` header is included in the logged `headers` object. Bearer tokens end up in plaintext log files.

**Fix:** Redact `Authorization` in the `sanitize()` function, or exclude it from the logged headers entirely.

### 5. Refresh Tokens Not Rotated
`server/src/modules/auth/service.ts:101-105`

The refresh endpoint issues a new token with identical payload and expiry. No rotation, no family tracking. A leaked refresh token works indefinitely until it expires. The `docs/2-token-plan.md` documents how to fix this — it just hasn't been implemented.

**Fix:** Implement token rotation per the existing plan.

## Data Integrity

### 6. Race Condition in Register (FIXED)
`server/src/modules/auth/service.ts:21-32`

Check-then-insert without a transaction. Two concurrent requests with the same email both pass the `existing` check. The UNIQUE constraint catches it, but the error surfaces as a generic 500 instead of a 409.

**Fix:** Wrap in a transaction, or catch the constraint violation and map it to `AuthError.emailAlreadyRegistered()`.

### 7. `ON DELETE CASCADE` Missing on All Foreign Keys
All child tables (`api_keys`, `linked_accounts`, `messages`, `expenses`) use `ON DELETE NO ACTION`. Deleting a user leaves orphaned rows everywhere.

**Fix:** Add `onDelete: "cascade"` to Drizzle FK definitions.

### 8. `messages.external_message_id` Not Unique
`server/src/modules/message/schema.ts:13`

The same Telegram message can be processed multiple times, creating duplicate expenses.

**Fix:** Add a unique constraint on `external_message_id`.

### 9. Missing Indexes on Foreign Keys
`linked_accounts.user_id`, `expenses.category_id`, `messages.linked_account_id` — all lack indexes. Reverse lookups will degrade as data grows.

**Fix:** Add `.index()` on FK columns in Drizzle schema.

### 10. LLM Output Could Be Null
`server/src/modules/expense/parser.ts:43`

`Output.object()` may return `null`, but the return type is `Promise<ParsedExpense>` with no null check. Will throw at runtime if the LLM returns nothing.

**Fix:** Guard against null before accessing properties.

## Reliability

### 11. No DB Connection Timeout
`server/src/pkg/db/index.ts:6`

```typescript
const client = createClient({ url: databaseUrl });
```

No timeout configured. A hung connection blocks indefinitely.

**Fix:** Pass `timeout` option to `createClient`.

### 12. Unsafe Type Cast on Status Code
`server/src/modules/auth/controllers/http/index.ts:43`

```typescript
err.statusCode as ContentfulStatusCode
```

`AuthError.statusCode` is `number`, but Hono expects a specific union type. If someone sets `statusCode: 999`, TypeScript won't catch it.

**Fix:** Narrow the type in `AuthError` or validate at construction time.

### 13. Silent Catch Blocks (3 locations)
- `server/src/modules/auth/controllers/middleware.ts:36`
- `server/src/modules/auth/service.ts:83`
- `server/src/pkg/http/logger-middleware.ts:45`

All discard the original error. Makes debugging harder — the error is swallowed and a generic message is returned.

**Fix:** At minimum, log the error before returning the generic response.

## Code Hygiene

### 14. Categories in Two Places
Hardcoded in `server/src/modules/expense/service.ts:6-14` and also defined as a DB table in `server/src/modules/category/schema.ts`. These will diverge the moment someone adds a category to the DB.

**Fix:** Pick one source of truth. If categories are fixed, remove the DB table. If dynamic, load from DB.

### 15. Hardcoded bcrypt Salt Rounds
`server/src/modules/auth/service.ts:128` — hardcoded to `10`.

**Fix:** Make configurable via env var for production tuning.

### 16. Only 1 of 13 Planned Tests Exists
`server/src/test/auth.test.ts` has a single happy-path test. The 12 remaining cases from `docs/1-plan.md` (duplicate email, wrong password, expired token, etc.) were never written. Test infrastructure is solid — just unused.

### 17. Phantom `client` Workspace
`pnpm-workspace.yaml` references `client` but the directory doesn't exist. Generates warnings on every `pnpm install`.

### 18. Missing `updated_at` on `users` Table
`server/src/modules/user/schema.ts` — no audit trail for profile changes.
