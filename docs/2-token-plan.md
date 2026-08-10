# Feature Plan: Server-Side Token Revocation on Logout

## Goal
Ensure that when a user logs out, their access token is immediately invalid for all subsequent requests — not just until it naturally expires (currently up to 15 min).

## Approach
Per-user `token_valid_after` timestamp stored in SQLite, cached in-memory, checked in `authMiddleware`. SQLite is the source of truth; in-memory cache accelerates reads.

---

## 1. Data Model

### SQLite migration (Drizzle)
Add a `token_valid_after` column to the `users` table:

```sql
ALTER TABLE users ADD COLUMN token_valid_after text NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
```

- Every access/refresh token issued at time T is valid only if `iat (seconds) > token_valid_after`.
- On logout, set `token_valid_after = now()`, which invalidates every token issued before this moment.
- Default epoch ensures all existing tokens remain valid after migration.

> This is "logout everywhere" — all sessions for a user are invalidated. Per-device logout would require a `sessions` table with per-session `valid_after` and a `session_id` in JWT claims. Out of scope for now.

---

## 2. In-Memory Cache

**New file:** `server/src/pkg/cache/token-valid-after.ts`

- Simple `Map<string, { value: string, expiresAt: number }>` with configurable TTL.
- TTL = longer of access token lifetime (15m) or refresh token lifetime (7d), so cache miss always means "check DB".
- `get(userId)` — returns cached `token_valid_after` or `null` on miss.
- `set(userId, value)` — stores with TTL.
- `invalidate(userId)` — deletes entry (for logout write-through).

No new dependencies. Fits the SQLite-no-Redis stack.

---

## 3. Token Issuance Changes

**File:** `server/src/modules/auth/service.ts`

No changes needed. `iat` is already set via `.setIssuedAt()` in `signToken()` (line 143). The `jose` library preserves it in the decoded payload. Tokens are not modified.

---

## 4. Auth Service Changes

**File:** `server/src/modules/auth/service.ts`

Add two methods to the object returned by `initAuthService`:

- `getTokenValidAfter(userId: string)` — check cache, on miss query `SELECT token_valid_after FROM users WHERE id = ?`, populate cache, return value.
- `setTokenValidAfter(userId: string, isoNow: string)` — `UPDATE users SET token_valid_after = ? WHERE id = ?`, then `cache.set(userId, isoNow)`.

Add revocation check in `refresh` method (line 78), after verifying the refresh token and extracting `userId`:
1. Call `getTokenValidAfter(userId)`
2. Compare refresh token `iat` against `token_valid_after`
3. If `iat <= token_valid_after`, throw `AuthError.tokenRevoked()`

---

## 5. Logout Endpoint Changes

**File:** `server/src/modules/auth/controllers/http/logout.ts`

Uses the **refresh token** (from cookie) to identify the user — NOT the access token. Reason: the access token may already be expired (15m TTL) by the time the user clicks logout.

New flow:
1. Read `refresh_token` from cookie via `cookieJar.getRefreshCookie(c)`.
2. If missing or expired → clear cookie, return 200 (already logged out).
3. If valid → verify with refresh secret, extract `userId` from `payload.sub`.
4. Call `authService.setTokenValidAfter(userId, new Date().toISOString())`.
5. Clear the refresh_token cookie (existing behavior).
6. Return 200.

**Signature change:** `initLogoutRoute(cookieJar)` → `initLogoutRoute(authService, cookieJar, refreshSecret)`.

**File:** `server/src/modules/auth/controllers/http/index.ts`
- Update `initLogoutRoute` call to pass `authService`, `cookieJar`, and `refreshSecret` (encoded from `env.JWT_SECRET` with type `"refresh"`).

---

## 6. Middleware Changes

**File:** `server/src/modules/auth/controllers/middleware.ts`

Current: verifies JWT signature + expiry + `sub` exists.

New steps after verification:
1. Extract `iat` (number, seconds) and `sub` (userId) from the verified payload.
2. Call `authService.getTokenValidAfter(sub)`.
3. Compare: if `iat <= Date.parse(token_valid_after) / 1000`, reject 401 with `AuthError.tokenRevoked()`.
4. Otherwise proceed as normal.

Adds one in-memory cache lookup (sub-ms) to the hot path. On cache miss, one SQLite query.

---

## 7. Error Handling

**File:** `server/src/modules/auth/error.ts`

Add:
```typescript
static tokenRevoked() {
  return new AuthError("Token has been revoked", 401);
}
```

---

## 8. Edge Cases

- **Clock skew:** Use `<=` comparison — a token issued in the exact same second as logout is treated as revoked.
- **Cache unavailable:** Cache is in-memory `Map`, can't fail. If DB write fails on logout, log and continue (next request falls back to stale DB value, which is still correct).
- **Concurrent logout + in-flight request:** Acceptable race — request either completes with old token or gets rejected; no data corruption.
- **Refresh token expired at logout:** User is effectively already logged out. Just clear cookie and return success.

---

## 9. Testing

- Unit: middleware rejects tokens with `iat <= token_valid_after`.
- Integration: login → use token → logout → same token now returns 401.
- Integration: refresh token also rejected post-logout.
- Edge: logout with expired/missing refresh cookie returns 200 and clears cookie.

---

## 10. Files Changed

| File | Change |
|---|---|
| `server/src/modules/user/schema.ts` | Add `tokenValidAfter` column to `users` table |
| `server/src/pkg/db/migrations/<ts>/migration.sql` | Auto-generated by `drizzle-kit generate` |
| `server/src/pkg/cache/token-valid-after.ts` | **New** — in-memory cache with TTL |
| `server/src/modules/auth/service.ts` | Add `getTokenValidAfter`, `setTokenValidAfter`, revocation check in `refresh` |
| `server/src/modules/auth/error.ts` | Add `tokenRevoked()` |
| `server/src/modules/auth/controllers/middleware.ts` | Add `iat` vs `token_valid_after` check |
| `server/src/modules/auth/controllers/http/logout.ts` | Read refresh token from cookie, update `token_valid_after`, clear cookie |
| `server/src/modules/auth/controllers/http/index.ts` | Pass `authService` + `refreshSecret` to logout route |

---

## 11. Rollout

1. Ship migration (backward compatible — default epoch doesn't break existing sessions).
2. Deploy all changes together (middleware + logout + service + cache).
3. Verify: login → access protected route → logout → same access token returns 401.
