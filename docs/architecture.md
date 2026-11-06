---
status: active
updated: 2026-11-06
---

# Architecture

This document defines the layering rules and holds maintainer rationale for them.

## Mandatory rules

These rules apply now. Future improvements require a maintainer decision; they are not implementation shortcuts.

1. Assemble dependencies through `init*` factories in the [composition root](../server/src/index.ts). Pass service and database instances as dependencies; do not import instances directly from other files. Type imports and factory imports are allowed.
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

## Known exceptions

These existing exceptions are not patterns to copy or authorization to fix code outside an assigned task.

| Exception                                                                                                   | Evidence                                                                               |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| The expense service receives `db` without using it. Retain this dependency for now, by maintainer decision. | `initExpenseService` in [expense/service.ts](../server/src/modules/expense/service.ts) |

## Rationale

> **Maintainer-only:** Agents must not rewrite or complete these reasons. Unresolved reasons are marked `TODO(maintainer)`.

### Why `init*` factories and the controller/service/use-case split

> **FUTURE POSSIBILITY:** Introduce behavioral interfaces between layers so consumers depend on explicit operation contracts rather than concrete service and use-case types such as `ReturnType<typeof initApiKeyService>`. Separate DTOs are established; behavioral interfaces are not yet required.

Reason: Everything is explicit, each layer has its own job, and ownership is clear.

### Why direct imports of service or database instances are forbidden

Reason: Because it violates the rule that each layer has its own responsibility and ownership.

### Why PostgreSQL

Reason: SQLite (libSQL) produced `SQLITE_BUSY` errors and is not suited to a web app; PostgreSQL runs as its own instance.

### Why linking uses one transaction

Mechanics: [redeemApiKey](../server/src/modules/linked-account/use-case.ts).

Reason: Linking uses one transaction because it calls three services whose database changes must all roll back if any step fails.

### Why consumption locks before checking expiry

Mechanics and comments: `consumeApiKey` in [api-key/service.ts](../server/src/modules/api-key/service.ts).

Reason: Expiry must be checked when consumption can proceed, including any time spent waiting for a lock

### Why the Drizzle release candidate

Reason: The Drizzle release candidate is close to stable, and we expect compatibility with the stable release, though breaking changes remain possible before it.

### Why HTTP and Telegram share one process

Reason: It saves on process costs on the VPS.

### Why an operation requires a use case rather than a service

Reason: An operation only calls/creates a use case when a transaction occurs. A controller may choose to call either a use case or a service, but not both. Once it uses a use case, it continues using use cases.

### Why bot startup failure must fail the whole process

Reason: Because our app depends on it; the main flow won't work if the bot fails to start.

### Why tests use Drizzle schema references

Reason: So that if migrations change a column or table, it will be caught.
