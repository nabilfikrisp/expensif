# Move ingestion schema coverage into persistence integration tests

Problem: Expense and message database rules currently have standalone schema tests. Move this coverage into service or use-case integration tests when ingestion persistence is implemented, without duplicating assertions.

Evidence: The [expense service](../../server/src/modules/expense/service.ts) only parses. [Expense schema tests](../../server/src/test/modules/expense/schema.test.ts) cover amount/currency constraints; [message schema tests](../../server/src/test/modules/message/schema.test.ts) cover composite source identity and unlinking.

Blocked by: [Message and expense persistence](p1-persist-messages-and-expenses.md).

Done when:

- Persistence service or use-case tests exercise the existing cases against the dedicated PostgreSQL test database and migrated schema.
- Coverage includes exact whole-rupiah storage, rejection of invalid amounts and non-IDR currencies, platform-generated idempotency keys, duplicates after unlinking or relinking, and nullable source metadata. Replace composite-identity assertions with the approved idempotency contract once its migration is applied.
- Standalone schema tests are removed once equivalent coverage passes. Retain parser tests.

Scope: This item does not authorize implementing persistence or removing current coverage early.
