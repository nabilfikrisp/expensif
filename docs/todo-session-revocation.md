# Session revocation: manual implementation checklist

Work from the repository root. Use rotating opaque refresh tokens. The web targets are a 5-minute access JWT, a 2-hour idle window, and a 24-hour absolute session limit. Existing refresh JWTs may stop working.

## 1. Add the session schema and migration

- [ ] Create `sessions` with `id`, `user_id`, `token_hash`, `prev_token_hash`, `rotated_at`, `last_used_at`, `absolute_expires_at`, and `revoked_at`. Use UUIDs for `id` and `user_id`, a cascading user foreign key, a unique current token hash, and an index on `user_id`. The previous hash and rotation timestamp are initially null.
- [ ] Export the schema from `server/src/pkg/db/schema.ts`. Obtain explicit approval for this migration before generating or executing it. If an existing migration covers the change, apply it without regenerating. Have the maintainer commit generated SQL before applying it; never use `drizzle-kit push` or `db:push`.

## 2. Configure lifetimes

- [ ] Configure the access, idle, and absolute lifetimes to match the targets above. Use a 30-second grace window.
- [ ] Update environment examples and configuration documentation when behavior changes.

## 3. Create and refresh sessions

- [ ] Generate a random 32-byte opaque refresh token and store only its SHA-256 hash. Create a session on login and registration; coordinate user and session creation in a transaction. Follow the `init*` factories and layer rules in [architecture](architecture.md).
- [ ] In one transaction, find the session by current or previous hash and lock the row. Check revocation, idle expiry, and absolute expiry using the current database time after the lock is acquired. Ordinary access JWT validation does not query sessions.
- [ ] For the current hash, rotate to a new token, move the current hash to `prev_token_hash`, and update `rotated_at` and `last_used_at`. Issue an access JWT and set the new refresh cookie after commit.
- [ ] For the previous hash inside the grace window, update `last_used_at` and issue only an access JWT; do not rotate or set the refresh cookie. For the previous hash outside the window, revoke the session and commit before returning an error. Reject unknown hashes normally.
- [ ] Never extend the absolute deadline. Update `last_used_at` only for successful refreshes. Remove refresh JWT signing while retaining access JWT signing.
- [ ] Only the immediately previous token can be recognized as reuse. Older tokens are rejected without identifying their session or triggering revocation. A holder of the previous token can trigger session revocation after the grace window; a thief who wins a refresh race can obtain the current token. These are accepted trade-offs.

## 4. Revoke on logout and update cookies

- [ ] Revoke the session on logout by setting `revoked_at`. Serialize logout and refresh by locking the same session row; check revocation within the refresh transaction. Clear cookies even if revocation fails, and return an error for database failures. Missing or unknown tokens may succeed.
- [ ] Keep refresh cookies `HttpOnly` and secure, with their lifetime bounded by session expiry. Preserve CSRF protection; resolve cross-site CSRF bootstrap and browser deployment details in the [session proposal](session-revocation.md).

## 5. Add maintenance

- [ ] Revoke all sessions on password reset; on password change, preserve the current session or issue a new session after revocation. Require a fresh password for sensitive actions when those actions are implemented.
- [ ] Support logout of other devices without revoking the current session, or issue a new session after revoking all. Active-session listing is optional.
- [ ] Schedule cleanup of expired sessions. Enforce expiry independently of cleanup.

## 6. Verify

- [ ] Test current-token rotation, grace-window concurrency, reuse outside the window, unknown and older tokens, and session revocation. Verify a grace response does not replace the refresh cookie and reuse revocation survives commit.
- [ ] Test refresh versus logout, expiry after waiting for the row lock, idle and absolute deadlines, registration rollback, database failures, and CSRF validation. Test refresh responses arriving after logout, including across tabs.
- [ ] Run `pnpm --dir server lintformat`. Integration tests truncate application tables: follow the dedicated test database setup in the [README](../README.md#checks-and-tests), stop the development database first, then run `pnpm --dir server test:run`.
- [ ] Update existing status and configuration documentation where behavior changes.

## 7. When building the frontend

- [ ] Handle refresh responses arriving after logout; already-issued access JWTs can remain valid until expiry.
- [ ] Implement the CSRF bootstrap appropriate to the dashboard deployment.
