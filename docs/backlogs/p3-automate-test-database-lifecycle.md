Problem: Running integration tests requires manually starting and stopping the test database, and its host port conflicts with the development database.

Evidence: [Test Compose configuration](../../docker/compose.test.yml), [test database helper](../../server/src/test/helper.ts), and [test setup](../../README.md#checks-and-tests).

Done when:

- The test database uses a dedicated host port, with the test URL and safety checks updated to match.
- A pnpm-invoked script starts the test container, waits for readiness, runs the tests, and stops the container after success, failure, or interruption. Vitest's existing setup continues to apply migrations.
- The script reports failures through its exit status, leaves the development database alone, and prevents overlapping test runs from sharing the same database.
- Test setup instructions reflect the new workflow.
