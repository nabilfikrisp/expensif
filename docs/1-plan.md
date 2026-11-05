# API-key linking

Status: implemented. This document describes current behavior, not a pending implementation plan. Full routes and authentication are in the [server README](../server/README.md).

## Keys

- Authenticated users generate keys through `POST /api/v1/api-key`; the plaintext `ek_<32 hex>` value is returned once. PostgreSQL stores an HMAC-SHA256 hash and `ek_****<last-4>` hint.
- Expiry is stored in `expires_at` at issuance using `CURRENT_TIMESTAMP + make_interval(...)`. `API_KEY_REDEEM_WINDOW_MINUTES` defaults to 15.
- `GET /api/v1/api-key` supports label matching, pagination, and `active`, `revoked`, or `all` status filters. Here, `active` means only `revoked_at IS NULL`: used or expired keys can still appear. Redeemability also depends on usage and expiry.
- `PATCH /api/v1/api-key/{id}` revokes an owned key; `DELETE` at the same path deletes it. Neither operation unlinks an existing account.

## Redemption

In a private Telegram chat, `/link <key>` calls `redeemApiKey({ token, platform, platformUserId, platformUsername })`.

The use case opens one PostgreSQL transaction:

1. `consumeApiKey(token, tx)` locks the matching key with `SELECT ... FOR UPDATE`, then conditionally updates it only if unused, unrevoked, and unexpired. Expiry and consumption use `clock_timestamp()` so lock waits count toward expiry.
2. `linkAccount({ tx, userId, platform, platformUserId, platformUsername })` inserts the account.
3. `getUser(userId, tx)` reads the owner's name and email for the response.

Failure rolls back both consumption and linking. API-key domain errors become `LinkedAccountError.keyInvalid()`; unrelated failures propagate. The unique constraint on `(platform, platform_user_id)` prevents a platform account from linking twice, including to different users.

Keys pasted in non-private chats are marked used through `burnApiKey` without linking. Invalid or unknown keys do not reveal whether a key exists. This does not delete the original Telegram message.

## Linked accounts

`GET /api/v1/linked-account` lists the authenticated user's accounts, including `id`, `platform`, `platformUserId`, `platformUsername`, and `linkedAt`. `DELETE /api/v1/linked-account/{id}` unlinks an owned account. Missing and foreign-owned IDs return 404; missing or invalid bearer tokens return 401.

Linking is implemented independently of expense parsing: `/expense` does not yet look up the linked user or persist expenses.

## Coverage

API-key HTTP tests live under `server/src/test/api-key/`. Consumption rules and lock-wait expiry have service tests; linked-account use-case tests cover redemption, rollback, concurrency, and burning. Linked-account HTTP routes are not mounted in the current shared test helper and still need permanent HTTP coverage. See the [test coverage document](4-use-case-test-refactor.md).
