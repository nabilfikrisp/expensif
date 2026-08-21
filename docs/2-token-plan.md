# Server-Side Token Revocation on Logout

## Goal

Immediately invalidate access tokens on logout (instead of waiting up to 15min expiry).

## Approach

Per-user `token_valid_after` timestamp in SQLite + in-memory cache. Checked in `authMiddleware`.

---

## Data Model

```sql
ALTER TABLE users ADD COLUMN token_valid_after text NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
```

Tokens valid only if `iat > token_valid_after`. On logout, set `token_valid_after = now()`.

> "Logout everywhere" — all sessions invalidated. Per-device requires `sessions` table (out of scope).

## In-Memory Cache

`server/src/pkg/cache/token-valid-after.ts` — `Map<string, { value, expiresAt }>` with TTL.

- `get(userId)` — cache or null on miss
- `set(userId, value)` — store with TTL
- `invalidate(userId)` — delete entry

## Changes

| File | Change |
|------|--------|
| `auth/service.ts` | Add `getTokenValidAfter`, `setTokenValidAfter`, revocation check in `refresh` |
| `auth/error.ts` | Add `tokenRevoked()` → 401 |
| `auth/controllers/middleware.ts` | Check `iat <= token_valid_after` after verification |
| `auth/controllers/http/logout.ts` | Read refresh cookie → set `token_valid_after` → clear cookie |
| `auth/controllers/http/index.ts` | Pass `authService` + `refreshSecret` to logout route |

**Logout uses refresh token** (not access token) to identify user — access token may be expired.

## Edge Cases

- **Clock skew:** `<=` comparison — token issued same second as logout is revoked
- **Cache:** In-memory Map, can't fail. DB write failure → log and continue
- **Concurrent logout:** Acceptable race — no data corruption
- **Expired refresh at logout:** Clear cookie, return 200

## Testing

- Middleware rejects tokens with `iat <= token_valid_after`
- Login → use token → logout → same token returns 401
- Refresh token also rejected post-logout
- Logout with expired/missing cookie returns 200
