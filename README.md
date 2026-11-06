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

The same process starts HTTP and Telegram long polling. Default HTTP port: 3000. API reference: <http://localhost:3000/api/v1/docs>; OpenAPI JSON: <http://localhost:3000/api/v1/doc>.

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

Integration tests use a dedicated PostgreSQL database. Development and test containers both bind `127.0.0.1:5433`, so stop the development server and switch databases before testing:

```sh
pnpm db:dev:down
pnpm db:test:up
pnpm --dir server test:run
pnpm db:test:down
pnpm db:dev:up
```

Tests truncate application tables: use only the dedicated test database. Tests do not require real Telegram or OpenRouter credentials. Use the server test command above; root `pnpm test` is a placeholder.

## Documentation

- [Server configuration, routes, and commands](server/README.md)
- [Product intent (target)](docs/product-intent.md)
- [Implementation status and known gaps](docs/status.md)
- [Data model (target)](docs/data-model.md)
- [Architecture rules and rationale](docs/architecture.md)
- [Glossary](docs/glossary.md)
- [Proposed refresh sessions and logout](docs/session-revocation.md)
- [Postman collection](docs/expensif.postman_collection.json)
