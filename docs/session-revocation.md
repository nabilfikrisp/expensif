---
status: proposed
updated: 2026-11-06
---

# Refresh sessions and logout

This proposal describes the unimplemented refresh-session design for the maintainer's logout decision.

Actual behavior is recorded in [implementation status](status.md#target-vs-actual). This proposal does not authorize implementation or describe shipped behavior.

## Decided behavior

The maintainer selected [current-session logout](product-intent.md#why-a-particular-logout-scope):

- Access JWTs are short-lived. Ordinary API requests validate their signature and claims without a session lookup.
- Refresh tokens belong to server-tracked sessions. Refresh checks that the associated session remains valid.
- Logout revokes only the current refresh session and clears browser cookies. Other sessions remain active.
- Already-issued access JWTs remain usable until expiry, subject to normal token validation. Logout does not immediately revoke them.

The earlier proposal for a per-user cutoff checked on every API request is superseded.

## Token lifetimes

| Token         | Target lifetime | Decision                                |
| ------------- | --------------- | --------------------------------------- |
| Access JWT    | 5 minutes       | Decided by the maintainer               |
| Refresh token | 2 hours         | Decided by the maintainer; fixed window |

The refresh session expires 2 hours after login. Refreshing access tokens does not extend that deadline; any replacement refresh token must retain it.

## Details still to define

- How cookie expiry aligns with the fixed refresh-session deadline.
- Refresh-token format, secure storage representation, rotation, and reuse handling.
- How logout identifies the current session, including missing or expired credentials.
- Concurrent refresh/logout behavior and handling of deleted users.
- Session-table fields and constraints; no schema design is approved by this document.

These are unresolved implementation details, not authorization for agents to choose policies. Do not report successful revocation if its database write fails.

## Migration and acceptance criteria

Schema changes follow the [migration rules](../AGENTS.md#hard-rules) and include [committed PostgreSQL migrations](../server/src/pkg/db/migrations/).

Required scenarios for the future implementation:

- After successful logout, refresh tokens associated with the current session cannot obtain new access tokens.
- An otherwise-valid access JWT issued before logout remains accepted until expiry, then is rejected.
- Access JWTs expire 5 minutes after issuance. Refresh tokens cannot refresh at or after the session's fixed 2-hour deadline, including after repeated refreshes or refresh-token replacement.
- Logging out one session leaves another session for the same user able to refresh.
- Missing or expired cookies still permit clearing browser cookies.
- A fresh login after logout creates an independent usable session, including same-second login.
- Concurrent requests and multiple server processes observe the defined revocation behavior.
- Database failure does not silently claim successful revocation.

Delete this proposal after implementation; behavior belongs in code and tests, and maintainer rationale belongs in [architecture](architecture.md).
