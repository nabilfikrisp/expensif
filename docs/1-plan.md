# Auth Module Integration Tests with Vitest

## Goal

Add integration tests for the auth module using Vitest + in-memory SQLite. Tests exercise the full HTTP request lifecycle (middleware, validation, auth, database) via Hono's `app.request()`.

## Scope

- Auth endpoints only: `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`
- In-memory SQLite database with real migrations
- No mocking of auth service — real service, real DB
- Dedicated `test/` folder with single `initTest()` helper

## Files to Create/Modify

| File | Action | Purpose |
|---|---|---|
| `server/package.json` | Edit | Add `vitest` devDep, add `test` / `test:run` scripts |
| `server/vitest.config.ts` | Create | Path aliases (`@/*` → `./src/*`), node environment |
| `server/test/init.ts` | Create | Single `initTest()` that returns `{ app, db, client, env, authService }` |
| `server/test/auth.test.ts` | Create | Auth endpoint integration tests |

## Step-by-Step

### Step 1: Install vitest

```bash
cd server && pnpm add -D vitest
```

Add scripts to `server/package.json`:

```json
"test": "vitest",
"test:run": "vitest run"
```

### Step 2: Create `server/vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
  },
});
```

### Step 3: Create `server/test/init.ts`

This file exports a single `initTest()` function that:

1. Creates an in-memory libsql client (`:memory:`)
2. Reads `src/pkg/db/migrations/20260718153133_initial_migration/migration.sql`
3. Splits the SQL by `--> statement-breakpoint` and executes each statement
4. Initializes Drizzle db with relations via `initDb` (or manually with `drizzle({ client, relations })`)
5. Creates a test `EnvSchema` with:
   - `JWT_SECRET`: a 32+ char test secret
   - `DATABASE_URL`: `":memory:"`
   - `NODE_ENV`: `"test"`
   - Other required fields: dummy values (not used in auth tests)
6. Initializes `authService` via `initAuthService(env, db)`
7. Initializes `authRoutes` via `initAuthRoutes(env, authService)`
8. Creates a silent pino logger (`level: "silent"`)
9. Builds the full Hono app via `initHttp(env, logger, [{ prefix: "auth", app: authRoutes }])`
10. Returns `{ app, db, client, env, authService }`

Key implementation notes:
- Use `createClient({ url: ":memory:" })` directly, not `initDb(":memory:")` — because `initDb` doesn't expose the raw client needed for migration execution
- After creating the client, run migrations manually before calling `drizzle({ client, relations })`
- The logger must be created with `initLogger({ NODE_ENV: "test", LOG_LEVEL: "silent" }` or equivalent — check how `initLogger` works in `src/pkg/logger/index.ts`

### Step 4: Create `server/test/auth.test.ts`

Each test calls `initTest()` in `beforeEach` to get a fresh DB and app.

Test cases:

```
describe("Auth endpoints")

  POST /api/v1/auth/register
    ✓ returns 201 with accessToken
    ✓ sets refresh_token cookie
    ✓ returns 409 when email already exists

  POST /api/v1/auth/login
    ✓ returns 200 with accessToken for valid credentials
    ✓ returns 401 for wrong password
    ✓ returns 401 for nonexistent email

  POST /api/v1/auth/refresh
    ✓ returns 200 with new accessToken given valid refresh cookie
    ✓ returns 401 without refresh cookie
    ✓ returns 401 with invalid refresh token

  POST /api/v1/auth/logout
    ✓ clears refresh_token cookie

  GET /api/v1/auth/me
    ✓ returns 200 with user data given valid Bearer token
    ✓ returns 401 without Authorization header
    ✓ returns 401 with invalid token
```

Testing pattern:

```ts
const res = await app.request("/api/v1/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "test@example.com", password: "pass123", name: "Test" }),
});
expect(res.status).toBe(201);
const body = await res.json();
expect(body.data.accessToken).toBeDefined();
```

For cookie-related tests, use `res.headers.get("set-cookie")` to inspect the `refresh_token` cookie.

For authenticated tests (`GET /me`), register a user first, then use the returned accessToken in the `Authorization: Bearer <token>` header.

## Commands

```bash
# In server/
pnpm add -D vitest
pnpm test            # watch mode
pnpm test:run        # single run (CI)
```

## Not in Scope

- Expense module tests (future)
- Telegram bot tests
- Unit tests for individual service functions
- Client package testing
