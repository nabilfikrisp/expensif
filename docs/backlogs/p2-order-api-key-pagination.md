# Order API-key pagination

Problem: API-key listing uses offset pagination without deterministic ordering. PostgreSQL may return inconsistent page boundaries, causing keys to repeat or disappear between pages even when the matching rows have not changed.

Evidence: [API-key listing](../../server/src/modules/api-key/service/list-api-keys.ts) applies `limit` and `offset` without `orderBy`.

Done when:

- The listing query orders rows explicitly using a unique tie-breaker, such as creation timestamp followed by key ID.
- Existing ownership scoping, filters, response fields, and pagination metadata remain unchanged.
- HTTP coverage with multiple pages and tied creation timestamps verifies stable ordering and that each matching key appears exactly once across pages when the dataset is unchanged.
- Relevant checks and `pnpm --dir server lintformat` pass. Database-backed checks use only the test runner and dedicated test database; migration execution still requires explicit maintainer approval.

