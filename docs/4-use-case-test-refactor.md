# Use-case test refactor

Status: implemented. The assessment below describes the original coverage; implementation and validation are recorded at the end.

`server/src/test/linked-account/redeem-api-key.use-case.test.ts` mixes use-case behavior, API-key service rules, and database infrastructure checks. Most scenarios are useful, but several belong elsewhere.

The use case owns the transaction that consumes a key, links the platform account to its owner, retrieves the owner's identity, and maps API-key errors. Its tests should focus on those observable outcomes and atomicity.

## Move coverage to its owner

| Current coverage | Proposed home | Reason |
| --- | --- | --- |
| Independent writes overlap before either transaction commits | Database tests | Never calls `redeemApiKey`; verifies that the database setup supports concurrent transactions. |
| Key expires while consumption waits on an unchanged row lock | API-key service tests | Calls `consumeApiKey` directly and verifies its locking and expiry behavior. |
| Unknown, consumed, revoked, and expired keys | API-key service tests | These are `consumeApiKey` validation rules. Keep a representative invalid-key rejection and error mapping at the use-case level. |

Preserve the locking and expiry regression coverage when moving it. There is currently no API-key service test suite, so moving these cases requires creating one.

## Simplify overlapping or weak assertions

- Merge the first two success tests: assert the returned name and email and the persisted account's owner and platform data. The `linkAccount` spy adds little alongside those outcomes.
- Remove the transaction-identity test once rollback coverage remains in place. Checking that every service receives the same transaction object verifies wiring; rollback tests verify the behavior that wiring must provide.
- If keeping the optional `platformUsername` test, inspect the persisted account. Checking only the returned email does not verify how the missing username is stored.
- Keep one concurrent redemption scenario at the use-case level. The different-platform-ID scenario explicitly prevents the linked-account unique constraint from masking a broken single-use check. Keep the identical-request scenario separately only if it protects a distinct regression or requirement.

## Keep use-case coverage

- Successful redemption returns the owner's identity and persists the expected linked account.
- A representative invalid key is rejected without linking an account.
- `ApiKeyError` is mapped to `LinkedAccountError.keyInvalid`; unrelated errors propagate unchanged.
- A linking failure rolls back key consumption and allows retry.
- A user lookup failure rolls back both key consumption and the account insert.
- An already-linked platform account is rejected without spending the new key.
- Concurrent redemption allows one success and creates one linked account.

The `burnApiKey` tests cover a separate use-case method. They can stay under their own describe block, but the filename would describe the contents more accurately as `linked-account.use-case.test.ts`; splitting them into another file is unnecessary unless that coverage grows.

## API-key HTTP coverage gap

API-key generate, list, revoke, and delete routes exist, but currently have no HTTP tests. `server/src/test/helper.ts` only mounts auth routes in the test app. Existing API-key coverage calls services directly through the linked-account tests, so it does not exercise the HTTP boundary.

Mount the API-key routes in the test app and add HTTP coverage for:

- Successful generate, list, revoke, and delete requests and their response shapes.
- Authentication requirements and request validation.
- User isolation: listing only the authenticated user's keys and preventing revocation or deletion of another user's keys.
- HTTP status codes and error responses for missing or already-revoked keys.

Keep consumption, locking, and expiry rules in service tests; the HTTP tests should cover the behavior exposed by the routes.

## Smallest useful change

Move the two misplaced concurrency tests and merge the success tests first. Then relocate the API-key validation matrix and remove redundant assertions. Preserve security coverage while making each suite's responsibility clear.

## Implementation and validation

- Renamed the use-case suite to `server/src/test/linked-account/linked-account.use-case.test.ts`, merged the success tests, removed transaction-identity and duplicate concurrent-request coverage, and verified that an omitted username is persisted as null. Retained rollback, error mapping, single-use concurrency, and burn coverage.
- Moved key validation and lock-wait expiry coverage into `server/src/test/api-key/consume-api-key.service.test.ts`.
- Moved the independent transaction-overlap regression into `server/src/test/db/concurrency.test.ts`.
- Mounted API-key routes in the test helper and added `generate.test.ts`, `list.test.ts`, `revoke.test.ts`, and `delete.test.ts` under `server/src/test/api-key/`. These follow `server/src/test/auth`: one file per endpoint, explicit `app.request` calls, registration within each test, and response schema validation with `safeParse`. Fixtures and observable state checks use HTTP requests. Coverage includes generation, listing, filtering, pagination, revocation, deletion, authentication, validation, user isolation, response shapes, and error responses.
- The HTTP tests exposed a bug: authentication errors returned 500 because API-key routes only handled `ApiKeyError`. The route error handler now also handles `AuthError`, returning the documented 401 responses.

Validation from `server/`: `pnpm test:run` passed all 69 tests across 13 files. `pnpm lintformat` passed typechecking, linting, and formatting, with one existing unused-parameter warning in `server/src/modules/expense/service.ts`.
