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

These open questions do not authorize agents to choose policies.

## Migration and acceptance criteria

Additional acceptance requirements:

- Missing or expired cookies still permit clearing browser cookies.
- A fresh login after logout creates an independent usable session, including same-second login.
- Concurrent requests and multiple server processes observe the defined revocation behavior.
- Database failure does not silently claim successful revocation.

Delete this proposal after implementation; behavior belongs in code and tests, and maintainer rationale belongs in [architecture](architecture.md).
