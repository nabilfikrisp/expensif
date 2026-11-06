---
status: active
updated: 2026-11-06
---

# Architecture

This document defines the layering rules and holds maintainer rationale for them.

## Mandatory rules

These rules apply now. Future improvements require a maintainer decision; they are not implementation shortcuts.

1. Assemble dependencies through `init*` factories in the [application assembly](../server/src/app.ts) and [startup entry point](../server/src/index.ts). Pass service and database instances as dependencies; do not import instances directly from other files. Type imports and factory imports are allowed.
2. Controllers own transport: validation, authentication middleware, and responses. Services own operations.
3. A use case owns a transaction spanning several services. The current example is [linked-account/use-case.ts](../server/src/modules/linked-account/use-case.ts).
4. Domain errors carry machine-readable codes and are mapped at the route boundary. Unknown errors propagate; see the [API-key route boundary](../server/src/modules/api-key/controllers/http/index.ts).
5. New modules follow the [API-key reference module](../server/src/modules/api-key/): service, domain errors, database schema, validation schema, and transport controllers. Follow the applicable parts; do not create unused files.
6. Follow the [fail-loudly rules](../AGENTS.md#fail-loudly). Component startup failures, including bot startup failures, must fail the process.
7. A controller calls either services or use cases, never both. Once it uses use cases, it continues using use cases.

8. Each layer owns its DTOs: input and output data shapes. Controllers own transport schemas, validation, coercion, defaults, and API metadata. Services and use cases define their input and output types independently. Similar shapes may be duplicated across layers; a shared source of truth is not required. Typechecking verifies compatibility at call boundaries; tests verify behavior. Behavioral interfaces between layers remain a future possibility.

9. User-owned HTTP resources use the authenticated token's user ID, never a request-supplied owner ID. Services scope reads and mutations to that owner; mutations by resource ID filter by both resource ID and owner ID. Keep cross-user regression coverage when adding or changing these endpoints.

10. Tests mirror source folders under `server/src/test/`: module HTTP tests live in `modules/<module>/controllers/http/`, service and use-case tests beside those folders as `service.test.ts` and `use-case.test.ts`, and infrastructure tests under the matching `pkg/` path. HTTP test files follow endpoint operations; shared setup stays in `test/helper.ts`.

11. Test database setup and assertions use Drizzle queries and imported schema references for application tables and columns. Raw SQL remains appropriate for PostgreSQL-specific operations; interpolate schema objects when those operations reference application tables or columns. Typechecking checks schema references; integration tests against committed migrations check the database matches them.

12. Keep routine tests deterministic and free of paid LLM calls. Use mocks to test application validation, not to claim parsing accuracy. Evaluate parsing with the real application LLM in a manually run `.check.ts` file outside `test:run`, using `OPENROUTER_MODEL` and credentials from the application environment, without a fallback model. Test database-error mapping through real PostgreSQL failures and the application's handling of them.

## Known exceptions

These existing exceptions are not patterns to copy or authorization to fix code outside an assigned task.

| Exception                                                                                                   | Evidence                                                                               |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| The expense service receives `db` without using it. Retain this dependency for now, by maintainer decision. | `initExpenseService` in [expense/service.ts](../server/src/modules/expense/service.ts) |

## Rationale

> **Maintainer-only:** Agents must not rewrite or complete these reasons. Unresolved reasons are marked `TODO(maintainer)`.

### Why `init*` factories and the controller/service/use-case split

> **FUTURE POSSIBILITY:** Introduce behavioral interfaces between layers so consumers depend on explicit operation contracts rather than concrete service and use-case types such as `ReturnType<typeof initApiKeyService>`. Separate DTOs are established; behavioral interfaces are not yet required.

Reason: Explicit dependencies and distinct layer responsibilities make ownership clear.

### Why direct imports of service or database instances are forbidden

Reason: Direct imports of service or database instances violate the separation of layer responsibilities and ownership.

### Why PostgreSQL

Reason: SQLite (libSQL) produced `SQLITE_BUSY` errors and was unsuitable for this web application. PostgreSQL runs as a separate database instance.

### Why linking uses one transaction

Mechanics: [redeemApiKey](../server/src/modules/linked-account/use-case.ts).

Reason: Linking calls three services whose database changes must all roll back if any step fails. One transaction keeps those changes atomic.

### Why consumption locks before checking expiry

Mechanics and comments: `consumeApiKey` in [api-key/service.ts](../server/src/modules/api-key/service.ts).

Reason: Expiry must be checked when consumption can proceed, accounting for time spent waiting for the lock.

### Why the Drizzle release candidate

Reason: The Drizzle release candidate is close to stable, and we expect compatibility with the stable release, though breaking changes remain possible before it.

### Why HTTP and Telegram share one process

Reason: Sharing one process reduces process costs on the VPS.

### Why an operation requires a use case rather than a service

Reason: Use cases are introduced for transactional operations. A controller calls either use cases or services, never both; once it uses use cases, its operations continue through that layer.

### Why bot startup failure must fail the whole process

Reason: The application depends on the bot for its primary flow, which cannot function if the bot fails to start.

### Why tests use Drizzle schema references

Reason: Tests should detect table or column changes introduced by migrations.

### Why live LLM evaluation is separate from routine tests

Reason: Parsing should be evaluated against the real LLM. Run that evaluation separately and manually to avoid incurring LLM costs on every full test run.

### Why database-error tests use real failures

Reason: Database-error tests should exercise the real application and database, rather than rely only on constructed errors.
