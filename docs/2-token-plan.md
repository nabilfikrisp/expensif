# Server-side token revocation on logout

Status: proposed, not implemented. There is no revocation column, session table, or revocation cache in the current codebase.

## Current behavior

Logout clears the refresh and CSRF cookies. Access and refresh JWTs remain cryptographically valid until expiry. Refresh issues tokens again without invalidating the previous refresh JWT.

## Proposed behavior

Invalidate all sessions for a user on logout. A per-user revocation timestamp in PostgreSQL could be checked by both access-token middleware and refresh. Per-device logout would require a session-based design instead.

Before implementation, resolve timestamp precision: JWT `iat` has second precision, so a strict timestamp cutoff can also reject a login issued in the same second as logout. Also define behavior for concurrent login/logout and deleted users.

Start with database-backed checks. Add caching only if measured traffic requires it, with invalidation across all server processes; a per-process cache alone cannot guarantee immediate revocation everywhere. Do not report successful server-side revocation if its database write fails.

## Migration and acceptance criteria

Any schema change must use Drizzle generate + migrate and include a committed PostgreSQL migration. Do not apply the old SQLite SQL or use schema push.

Required scenarios for the future implementation:

- Logout rejects previously issued access and refresh tokens.
- Missing or expired cookies still permit clearing browser cookies.
- A fresh login after logout works, including same-second issuance.
- Concurrent requests and multiple server processes observe the defined revocation behavior.
- Database failure does not silently claim successful revocation.

This proposal does not authorize or imply that these changes have been shipped.
