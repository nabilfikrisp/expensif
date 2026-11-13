# Authentication follow-up

Remaining authentication work after backend session implementation. This document preserves deferred scope; it does not assign implementation. Current capabilities and verification limits are recorded in [status](status.md).

## Frontend and browser verification

- [ ] Keep access tokens in memory, refresh on page load, share concurrent refresh requests within each tab, and renew before expiry or retry an API request once after a 401.
- [ ] Implement credentialed CSRF bootstrap for the same-site dashboard subdomain, with same-origin hosting also supported. Use the API contract in [OpenAPI](../server/README.md#http-api) and deployment configuration in the [server README](../server/README.md#configuration).
- [ ] Define and implement logout coordination across tabs so a late refresh response cannot restore signed-in UI or install its access token in memory.
- [ ] Verify browser cookie handling and CSRF bootstrap under both supported hosting arrangements.
- [ ] Add browser tests that delay a successful refresh response until after logout, in one tab and across two tabs sharing a browser session. Verify the UI stays signed out, the late access token is discarded, and any late refresh cookie cannot renew the revoked session.
- [ ] Configure a strict dashboard Content-Security-Policy.

Backend request/response coverage lives in the [refresh](../server/src/test/modules/auth/controllers/http/refresh.test.ts) and [logout](../server/src/test/modules/auth/controllers/http/logout.test.ts) integration tests. Browser tests must exercise actual cookies and frontend state; already-issued access JWTs remain valid until expiry under the [logout decision](product-intent.md#why-a-particular-logout-scope).

## Deferred scope

- [ ] Define password-reset account verification and delivery, then revoke all sessions on reset.
- [ ] Require a fresh password for other sensitive actions when implemented; define their rate limits.

Mobile transport, optional active-session listing, refresh write throttling, and JWT key rotation remain deferred.
