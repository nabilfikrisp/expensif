---
status: proposed
updated: 2026-11-06
---

# Refresh sessions and logout

This proposal records the web dashboard authentication and refresh-session design. Refresh sessions and the dashboard are not implemented; existing authentication behavior is recorded in status.

Actual behavior is recorded in [implementation status](status.md#target-vs-actual). This proposal does not authorize implementation or describe shipped behavior.

## Decided behavior

The maintainer selected [current-session logout](product-intent.md#why-a-particular-logout-scope):

- Access JWTs are short-lived. Ordinary API requests validate their signature and claims without a session lookup.
- Refresh tokens belong to server-tracked sessions. Refresh checks that the associated session remains valid.
- Logout revokes only the current refresh session and clears browser cookies. Other sessions remain active.
- Already-issued access JWTs remain usable until expiry, subject to normal token validation. Logout does not immediately revoke them.
- The static dashboard keeps access tokens in memory, bootstraps with a refresh on page load, and shares concurrent refresh requests within each tab. It renews before expiry or retries an API request once after a 401. Tabs can refresh independently because refresh tokens do not rotate.
- Login and registration create a session with a random 32-byte opaque refresh token; only its SHA-256 hash is stored. Refresh extends idle expiry without exceeding the absolute deadline and reissues the same cookie with its updated lifetime. An invalid or expired session returns 401 and clears the cookie. Logout deletes the current session and clears the cookie even if deletion fails; database failures return an error, while missing or expired cookies succeed. Deleting a user cascades to their sessions.
- Password reset revokes all sessions; voluntary password change revokes all except the current session. Sensitive actions require a fresh password check. Never log tokens; rate-limit login and refresh. A strict dashboard Content-Security-Policy reduces script-injection risk.
- The API permits credentialed CORS only from the exact dashboard origin. The host-only refresh cookie is `HttpOnly`, `Secure`, and scoped to auth endpoints. Refresh and logout use POST. Same-site deployments use `SameSite=Strict`; cross-site deployments require `SameSite=None; Secure`, Origin validation, and a custom CSRF header.
- Session operations, client-specific lifetimes, refresh-token transport helpers, JWT authentication middleware, and transport-neutral response shapes provide extension points for mobile. Mobile transport, token rotation, device listing, logout everywhere, refresh write throttling, and JWT key rotation are deferred.
- A daily cleanup removes expired sessions; expiry enforcement does not depend on cleanup.
- Access JWT claims are minimal (`sub`, `exp`); roles and permissions are loaded server-side. A stolen refresh token remains usable until logout or expiry.

The earlier proposal for a per-user cutoff checked on every API request is superseded.

## Token lifetimes

| Token         | Target lifetime | Decision                                |
| ------------- | --------------- | --------------------------------------- |
| Access JWT    | 5 minutes       | Decided by the maintainer               |
| Refresh session | 2-hour idle window, 24-hour absolute cap | Decided by the maintainer for web |

Refreshing extends the idle deadline up to the absolute deadline established at login. This replaces the earlier fixed two-hour decision.

## Details still to define

- Confirm whether the dashboard and API share a registrable domain; static hosting alone does not determine this. Cross-site deployments must account for browser third-party cookie restrictions.
- Define CSRF bootstrap for a dashboard that cannot read the API's host-only cookies.
- Define expiry checks after lock waits and browser handling of refresh responses that arrive after logout, including across tabs.
- Define how the current session is identified for password changes, and scope password reset and change, sensitive-action reauthentication, rate limiting, and cleanup work.

These open questions do not authorize agents to choose policies.

## Migration and acceptance criteria

Additional acceptance requirements:

- Missing or expired cookies still permit clearing browser cookies.
- A fresh login after logout creates an independent usable session, including same-second login.
- Concurrent requests and multiple server processes observe the defined revocation behavior.
- Database failure does not silently claim successful revocation.

The proposed PostgreSQL session table has a UUID primary key, a cascading UUID user foreign key, a unique refresh-token hash, idle and absolute expiry timestamps, and an index on user ID. The proposed migration is not approved. Each migration requires separate maintainer approval before implementation or execution.

Delete this proposal after implementation; behavior belongs in code and tests, and maintainer rationale belongs in [architecture](architecture.md).
