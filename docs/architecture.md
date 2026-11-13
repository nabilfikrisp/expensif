---
status: active
updated: 2026-11-13
---

# Architecture

This document defines the layering rules and holds maintainer rationale for them.

## Mandatory rules

Changes to these rules require a maintainer decision.

1. Assemble dependencies through `init*` factories in [app.ts](../server/src/app.ts) and [index.ts](../server/src/index.ts). Inject service and database instances; never import them directly. Type and factory imports are allowed.
2. Controllers own request/response contracts, transport validation, coercion, defaults, API metadata, authentication middleware, and responses. Services own operations.
3. Use cases own transactions spanning several services; see [linked-account redemption use case](../server/src/modules/linked-account/use-case/redeem-api-key.ts).
4. Domain errors carry machine-readable codes and HTTP statuses. Route modules use the [shared domain-error handler](../server/src/shared/handle-domain-error.ts) to serialize them at the HTTP boundary. Unknown errors propagate.
5. Follow the applicable parts of the [API-key reference module](../server/src/modules/api-key/) for new modules; do not create unused files.
6. Follow the [fail-loudly rules](../AGENTS.md#fail-loudly). Any component startup failure, including the bot, must fail the process.
7. A controller calls either services or use cases, never both. Once it uses use cases, it continues using use cases.

8. Each module layer uses `service/` or `use-case/` only when that layer exists. Its `index.ts` composes method factories and explicitly returns the module interface; `interface.ts` declares every public method with explicit signatures, preserving existing exported type names and required transaction arguments. Each kebab-case method file exports one `init<Method>(deps)` factory with only its required dependencies. Private helpers stay with their method. Small stateless utilities stay in the layer's `index.ts` without factory wrappers, including utilities exposed by its interface. Small shared helpers also stay there and are injected where needed; larger shared helpers may use a clearly named sibling file.

   Each layer has exactly one `dto.ts` with independently declared, method-named input/output Zod schemas and inferred types. Never derive one method's DTO from another's or import/derive schemas across layers. Interfaces reference their own layer's DTOs; transaction infrastructure types remain explicit. Callers map between layers directly, without shared mapper files. Keep validation at its existing boundary: transport in controllers, workflow input in use cases, operation input in services. Drizzle row types do not belong in use-case DTOs, controller schemas, or interfaces; service DTOs expose them only when already the intended public shape.

   Use cases import service contracts from `service/interface.ts`; controllers import service or use-case interfaces. Consumers never import another module's concrete service or method implementation. Preserve composition-root factory wiring, transaction boundaries, locking, isolation, error codes, idempotency, and operation order. Controllers own independent public schemas with explicit positive field lists and API metadata; storage columns alone must not expand responses.

9. User-owned HTTP resources use the authenticated token's user ID, never a request-supplied owner ID. Services scope reads and mutations to that owner; mutations by ID filter by both resource and owner IDs. Keep cross-user regression coverage for these endpoints.

10. Tests mirror source paths under `server/src/test/`, including module controllers, `service/<method>.test.ts`, `use-case/<method>.test.ts`, and infrastructure under `pkg/`. HTTP files follow endpoint operations; shared setup stays in `test/helper/`.

11. Test database setup and assertions use Drizzle queries and imported schema references. Use raw SQL for PostgreSQL-specific operations, interpolating schema objects for application tables and columns. Integration tests run against committed migrations to verify schema compatibility.

12. Keep routine tests deterministic and free of paid LLM calls. Mocks test application validation, not parsing accuracy. Evaluate parsing manually in `.check.ts` files outside `test:run`, using the application's real LLM, `OPENROUTER_MODEL`, and credentials, without a fallback model. Test database-error mapping through real PostgreSQL failures.

13. Test distinct application behaviors, including successful flows, failures, and important edge cases, through the highest practical entry point, using real application layers and PostgreSQL. Assert observable responses and persisted state. Avoid redundant coverage across layers and coupling tests to internal functions. Keep focused lower-level tests only where broader flows cannot adequately verify the behavior. Each retained lower-level test or group must include a brief comment explaining why broader flows cannot adequately verify the behavior.

    Reason: Catch behavioral regressions while keeping the test suite small and maintainable. Internal refactoring should not require test changes when observable behavior stays the same.

## Rationale

> **Maintainer-only:** Agents must not rewrite or complete these reasons. Unresolved reasons are marked `TODO(maintainer)`.

### Why `init*` factories and the controller/service/use-case split

Reason: Explicit dependencies and distinct layer responsibilities make ownership clear.

### Why direct imports of service or database instances are forbidden

Reason: Direct imports of service or database instances violate the separation of layer responsibilities and ownership.

### Why PostgreSQL

Reason: SQLite (libSQL) produced `SQLITE_BUSY` errors and was unsuitable for this web application. PostgreSQL runs as a separate database instance.

### Why linking uses one transaction

Mechanics: [redeemApiKey](../server/src/modules/linked-account/use-case/redeem-api-key.ts).

Reason: Linking calls three services whose database changes must all roll back if any step fails. One transaction keeps those changes atomic.

### Why consumption locks before checking expiry

Mechanics and comments: `consumeApiKey` in [api-key/service/consume-api-key.ts](../server/src/modules/api-key/service/consume-api-key.ts).

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
