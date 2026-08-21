# API Key Linker — Implementation Plan

## Overview

Connects bot accounts (Telegram) to dashboard accounts via API keys.

- **Dashboard**: Generate, list, revoke, delete API keys
- **Bot**: `/link <key>` verifies key, creates `linked_accounts` row

**Key format:** `ek_<32 hex>`, returned once. Stored as HMAC-SHA256 hash. Dashboard shows `ek_****<last-4>`.

---

## Completed Steps

### Step 0: DB-Generated Timestamps ✅

All timestamp columns use `CURRENT_TIMESTAMP` defaults. No app-level timestamp passing.

### Step 1: API Key Service ✅

`server/src/modules/api-key/service.ts` — receives `env` + `db`.

| Method | Description |
|--------|-------------|
| `generateApiKey(userId, label?)` | Generate `ek_<32hex>`, HMAC-SHA256 hash, return plaintext + hint |
| `listApiKeys(userId, filters?)` | Paginated, filterable by `label`, `status` |
| `verifyApiKey(plainKey)` | Hash → match → check not revoked → update `last_used_at` |
| `revokeApiKey(userId, keyId)` | Soft revoke (set `revoked_at`) |
| `deleteApiKey(userId, keyId)` | Hard delete |

### Step 2: Linked Account Service ✅

`server/src/modules/linked-account/service.ts` — receives `db` only.

| Method | Description |
|--------|-------------|
| `linkAccount(userId, platform, platformUserId, username?)` | Insert, handles unique constraint → 409 |
| `getLinkedAccount(platform, platformUserId)` | Find by `(platform, platform_user_id)`, 404 if not found |
| `getUserByLinkedAccount(platform, platformUserId)` | Join with `users`, returns userId/name/email |
| `unlinkAccount(userId, accountId)` | Delete, 404 if not found |

### Step 3: Error Classes ✅

**API Key** (`api-key/error.ts`): `keyNotFound` (404), `keyAlreadyRevoked` (400), `keyInvalid` (401)

**Linked Account** (`linked-account/error.ts`): `accountAlreadyLinked` (409), `accountNotFound` (404)

### Step 4: HTTP Routes ✅

`server/src/modules/api-key/controllers/http/`

| File | Method | Path | Description |
|------|--------|------|-------------|
| `generate.ts` | POST | `/api-keys` | Generate key, return plaintext once |
| `list.ts` | GET | `/api-keys` | Paginated list with filters |
| `revoke.ts` | PATCH | `/api-keys/:id` | Soft revoke |
| `delete.ts` | DELETE | `/api-keys/:id` | Hard delete |

Route pattern: `interface XxxRouteDeps { apiKeyService, verifyToken }` + `authMiddleware`.

### Step 5: CSRF Protection ✅

Double Submit Cookie pattern on refresh endpoint.

- Register/login set `refresh_token` (HttpOnly) + `csrf_token` (JS-accessible)
- Refresh validates `csrf_token` cookie == `X-CSRF-Token` header
- Logout clears both cookies

---

## Pending Steps

### Step 6: Rate Limit Refactor

Add `RATE_LIMIT` env var (default `10`). Parent creates `rateLimit(env)` once, passes middleware to routes.

### Step 7: Link Bot Command

`server/src/modules/user/controllers/bot/link.ts`

`/link <key>` flow:
1. Empty key → usage instructions
2. `verifyApiKey(key)` → null → "Invalid or already used"
3. `getLinkedAccount("telegram", userId)` → exists → "Already linked"
4. `linkAccount(userId, "telegram", userId, username)`
5. Reply "Linked to {name} ({email})"

### Step 8: Wire Into Bot

Modify `server/src/pkg/bot/telegram/index.ts` — accept `apiKeyService` + `linkedAccountService`.

### Step 9: Wire Into Main Entry

Modify `server/src/index.ts` — init services, add `{ prefix: "api-key", app: apiKeyRoutes }`.

### Step 10: Tests

`server/src/test/api-key.test.ts` — generate, verify (valid/invalid/revoked), list, revoke.

---

## Design Decisions

1. **HMAC-SHA256** for API keys (deterministic, unlike bcrypt)
2. **`ek_` prefix** with `ek_****<last-4>` hint (like GitHub/Stripe)
3. **Separate modules** (`api-key/`, `linked-account/`) not under `user/`
4. **User must exist first** — bot only verifies and links
5. **Unique constraint** — `(platform, platform_user_id)` prevents double-linking
6. **Manual revoke only** — no key expiration
7. **CSRF via Double Submit Cookie** — stateless, no DB storage
8. **DB-generated timestamps** — prevent clock drift
