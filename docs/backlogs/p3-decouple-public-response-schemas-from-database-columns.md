# Decouple public response schemas from database columns

Problem: Public response schemas inherit database columns by default and exclude selected fields. Adding a storage column can unintentionally change the declared API contract even when service projections do not expose that column.

Evidence: The [API-key](../../server/src/modules/api-key/zod-schema.ts), [user](../../server/src/modules/user/zod-schema.ts), and [linked-account](../../server/src/modules/linked-account/zod-schema.ts) response schemas derive from Drizzle select schemas using `.omit()`.

Done when:

- Public response fields are explicitly selected with positive field lists or independently declared transport schemas.
- Adding a database column alone cannot add a field to the declared public response.
- Existing response contracts remain unchanged, and regression coverage checks exact public field sets and exclusion of storage-only fields.
- Controllers retain ownership of API metadata and transport schemas; service and use-case DTOs remain independently defined.

Scope: No database schema changes or migrations are required. Keep explicit service query projections.
