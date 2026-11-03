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
| `listApiKeys(userId, filters?)` | Paginated, filterable by `label`, `status` (active/revoked/all). Default `"active"`. Status derived from `revoked_at` |
| `consumeApiKey(plainKey, tx)` | Atomic verify + burn in one UPDATE: hash, check not revoked/used/expired (via `expires_at > CURRENT_TIMESTAMP`), set `last_used_at`. Returns `userId` or throws `keyInvalid`. Single SQL statement inside transaction |
| `burnApiKey(plainKey, tx)` | Mark key as used without validation. Used for group chat leak prevention - burns leaked key silently |
| `revokeApiKey(userId, keyId)` | Soft revoke (set `revoked_at`) |
| `deleteApiKey(userId, keyId)` | Hard delete |

### Step 2: Linked Account Service + Use Case ✅

`server/src/modules/linked-account/service.ts` — receives `db`.

| Method | Description |
|--------|-------------|
| `linkAccount(userId, platform, platformUserId, username?, tx)` | Insert, handles unique constraint → throws `accountAlreadyLinked` |
| `getLinkedAccount(platform, platformUserId)` | Find by `(platform, platform_user_id)`, throws `accountNotFound` if missing |
| `getUserByLinkedAccount(platform, platformUserId)` | Join with `users`, returns userId/name/email |
| `unlinkAccount(userId, accountId)` | Delete, throws `accountNotFound` if missing |

`server/src/modules/linked-account/use-case.ts` — orchestrates services.

| Method | Description |
|--------|-------------|
| `redeemApiKey(token, platform, platformUserId, username?)` | Transaction wraps `consumeApiKey(token, tx)` + `linkAccount(...)` + `getUser(userId)`. Returns `{ userName, userEmail }`. Translates `ApiKeyError` → `LinkedAccountError.keyInvalid()` at transaction boundary |
| `burnApiKey(token)` | Burns key without linking (group chat leak prevention). Calls `apiKeyService.burnApiKey(token, db)` |

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

### Step 6: Link Bot Command ✅

`server/src/modules/linked-account/controllers/bot.ts`

Handler registers `/link <key>` command. Empty key → usage instructions. Group chat detection → burns key + shows "API key has been disabled" message (prevents group leak). Otherwise calls `linkedAccountUseCase.redeemApiKey(key, "telegram", userId, username)` and maps the result/errors to bot replies.

**Use case orchestrates (inside transaction):**
1. `consumeApiKey(token, tx)` — atomic UPDATE verify + burn
2. `linkAccount(...)` — INSERT `linked_accounts`, unique constraint prevents double-link
3. `getUser(userId, tx)` — fetch name + email
4. Transaction rolls back consume if insert fails (token survives)

**Handler replies:**
- Success → "Linked to {name} ({email})"
- `LinkedAccountError.keyInvalid()` → "Invalid, expired, or already-used key"
- `LinkedAccountError.accountAlreadyLinked()` → "This Telegram account is already linked"
- Generic error → "Couldn't link right now. Please try again later." (log but don't echo)

### Step 7: Linked Account HTTP Routes

`server/src/modules/linked-account/controllers/http/`

| File | Method | Path | Description |
|------|--------|------|-------------|
| `list.ts` | GET | `/linked-accounts` | List user's linked accounts (id, platform, platformUsername, linkedAt) |
| `delete.ts` | DELETE | `/linked-accounts/:id` | Unlink account (calls existing `unlinkAccount` service method) |

Required for visibility + remediation: user sees which accounts are linked and can remove a stolen-token link.

### Step 8: Wire Into Bot

Modify `server/src/pkg/bot/telegram/index.ts` — accept `linkedAccountService`, register link command.

### Step 9: Wire Into Main Entry

Modify `server/src/index.ts`:
- Pass services into bot
- Add `{ prefix: "api-key", app: apiKeyRoutes }`
- Add `{ prefix: "linked-account", app: linkedAccountRoutes }`

### Step 10: Tests

`server/src/test/link.test.ts` — full redeem flow:
- Valid token links successfully
- **Concurrent redeem** (same token, two Telegram IDs) → exactly one wins
- Garbage token, revoked token, expired token (backdate `created_at`) → all rejected
- Already-linked account with fresh token → warning, token still active
- `GET /linked-accounts`, `DELETE /linked-accounts/:id`

---

## Design Decisions

1. **HMAC-SHA256** for API keys (deterministic, unlike bcrypt)
2. **`ek_` prefix** with `ek_****<last-4>` hint (like GitHub/Stripe)
3. **Separate modules** (`api-key/`, `linked-account/`) not under `user/`
4. **User must exist first** — bot only verifies and links (dashboard login is mandatory first step)
5. **Unique constraint** — `(platform, platform_user_id)` prevents double-linking per platform
6. **15-minute TTL, single use** — token expires 15 min after generation (stored as `expires_at` column set at issue time via `datetime(CURRENT_TIMESTAMP, '+N minutes')`), burned on first successful redeem. Matches RFC 8628 device grant semantics (1800s default, single use, hashed at rest). Manual revoke still available via `revokeApiKey`. TTL configurable via `API_KEY_REDEEM_WINDOW_MINUTES` env var
7. **CSRF via Double Submit Cookie** — stateless, no DB storage
8. **DB-generated timestamps** — prevent clock drift
9. **Atomic consume in transaction** — `consumeApiKey` does verify + burn in one UPDATE inside `db.transaction`, preventing double-link race. Transaction rollback restores token if link fails
10. **Derived status** — `active`/`revoked`/`all` computed at read time from `revoked_at`. No scheduler, no drift
11. **Unique constraint enforces single link per platform account** — `(platform, platform_user_id)` prevents one Telegram ID from linking twice. Burn prevents one token from linking multiple accounts
12. **Group chat leak prevention** — Bot detects group chat, burns key via `burnApiKey` without validation, shows "API key has been disabled" message. Defense in depth: key dead before 15-min TTL expires