# Share application assembly with tests

Problem: Tests recreate the application's dependency and route wiring independently. Production assembly can drift without failing endpoint tests.

Evidence: The [production entry point](../../server/src/index.ts) and [test helper](../../server/src/test/helper.ts) separately construct services, authentication middleware, rate limiters, and route registration.

Done when:

- Production and HTTP integration tests use one reusable application assembly path through the existing `init*` factories.
- Tests supply the dedicated test database, test configuration, and explicit rate-limit overrides through that path.
- Importing or assembling the application does not bind HTTP sockets, start Telegram polling, or register process signal handlers; executable startup owns those effects.
- Existing endpoint coverage exercises the shared route registration, and a runnable check verifies that assembly alone does not start transports.

Scope: Preserve the controller/service/use-case split and dependency injection through factory arguments. No dependency-injection framework or new repository layer is required.
