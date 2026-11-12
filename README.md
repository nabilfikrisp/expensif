# Expensif

Expense tracking backend built with TypeScript, Hono, PostgreSQL 17, Drizzle, and a Telegram bot. Natural-language parsing uses the AI SDK through OpenRouter.

## Local setup

Use a current Node.js LTS release (Node.js 24 recommended), pnpm 11.9+, and Docker with Compose v2. Run these commands from the repository root:

```sh
pnpm install
cp server/.env.example server/.env
```

Edit `server/.env`: provide Telegram and OpenRouter credentials, and generate separate random values for `JWT_SECRET` and `API_KEY_SECRET` (at least 32 characters each). Run this command twice to generate them:

```sh
pnpm --dir server exec node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'
```

Start the development database, apply committed migrations, and start the server:

```sh
pnpm db:dev:up
pnpm --dir server db:migrate
pnpm --dir server dev
```

The same process runs expired-session cleanup at startup and daily, alongside HTTP and Telegram long polling. Default HTTP port: 3000. API reference: <http://localhost:3000/api/v1/docs>; OpenAPI JSON: <http://localhost:3000/api/v1/doc>.

## Database migrations

Schema definitions live under `server/src/modules/*/schema.ts`; migrations live under `server/src/pkg/db/migrations/`.

After changing a schema:

```sh
pnpm --dir server db:generate
pnpm --dir server db:migrate
```

Review and commit the generated migration alongside the schema change. If a migration already covers the change, run only `db:migrate`. Never use `drizzle-kit push` or `db:push`. Startup does not apply migrations automatically.

## Checks and tests

```sh
pnpm --dir server lintformat
```

Integration tests use a dedicated PostgreSQL database on `127.0.0.1:5434`; development remains on port 5433. The test runner starts the test container, waits for readiness, and stops it when tests finish or are interrupted. Docker must be available:

```sh
pnpm --dir server test:run
pnpm --dir server test
```

Tests truncate application tables: use only the dedicated test database. Tests do not require real Telegram or OpenRouter credentials. `test` keeps the database running until watch mode exits; both commands accept Vitest arguments. The runner refuses an already running test container or an overlapping run. Stop a manually started test container with `pnpm db:test:down` before using the runner. After forced termination, stop the test container and remove `server/node_modules/.cache/expensif-test.lock` before retrying. Use the server test commands above; root `pnpm test` is a placeholder.

## Documentation

- [Server configuration, routes, and commands](server/README.md)
- [Product intent (target)](docs/product-intent.md)
- [Implementation status and known gaps](docs/status.md)
- [Data model (target)](docs/data-model.md)
- [Architecture rules and rationale](docs/architecture.md)
- [Glossary](docs/glossary.md)
- [Authentication follow-up](docs/auth-follow-up.md)
- [Postman collection](docs/expensif.postman_collection.json)
