# Extract each service method into its own file

Problem: Module service factories define multiple operation implementations in one file. Organize each public service method in its own file while preserving the existing service API and architecture.

Evidence: The [API-key](../../server/src/modules/api-key/service.ts), [auth](../../server/src/modules/auth/service.ts), [session](../../server/src/modules/session/service.ts), [linked-account](../../server/src/modules/linked-account/service.ts), and [user](../../server/src/modules/user/service.ts) factories contain multiple method implementations. The [expense service](../../server/src/modules/expense/service.ts) also contains multiple operation implementations.

Done when:

- Each public service method has its implementation in a dedicated, kebab-case file under its module's `services/` directory, including services that currently expose only one method.
- Each module moves its public `init*Service` factory and exported service type from `service.ts` to `services/index.ts`, assembling methods with explicitly supplied dependencies, following the controller folder pattern. Update consumers to import from the module's `services` entry point; exported service types, method signatures, and caller behavior remain compatible.
- Operation files do not import assembled service instances or introduce dependencies on other services. Existing intra-service method dependencies are wired explicitly without relying on `this` or circular imports.
- Private helpers may remain alongside their operation; genuinely shared helpers have a single location within the module. Helper extraction does not require one function per file.
- Existing queries, ownership filters, transaction parameters, row-lock ordering, expiry checks, error translation, and rollback behavior remain unchanged.
- Controllers and use cases continue consuming injected service objects. The controller/service/use-case split, use-case naming, and restriction against a controller calling both services and use cases remain unchanged.
- Existing relevant behavioral tests and `pnpm --dir server lintformat` pass. Database-backed tests run only through the test runner against the dedicated test database; no tests are added solely to mirror the new file layout.

Scope: Service method organization only. Query optimization, use-case extraction or renaming, controller dependency rule changes, database migrations, and new application behavior are outside this item.
