# Refactor Plan: SQLite → Postgres Migration

## Current State (SQLite)

**Stack**:
- `@libsql/client` with local `file:` DB (WAL mode)
- `drizzle-orm/libsql`
- `serializeTransactions()` wrapper to prevent SQLITE_BUSY

**Problems**:
1. **Event loop blocking**: `@libsql/client` local binding is synchronous. Lock waits block Node event loop.
2. **Single writer**: SQLite only allows one write transaction at a time, even with WAL.
3. **Workaround required**: `serializeTransactions()` queues all transactions in JavaScript to avoid lock contention.
4. **Write throughput bottleneck**: Transactions serialize even when they don't conflict (updating different rows still queued).

**Current test pattern**:
- One DB per test case (`:memory:` or unique file per `beforeEach`)
- 28+ tests = 28+ DB instances created during test run
- Slow but correct isolation

---

## Postgres Migration Benefits

1. **True concurrent writes**: MVCC allows multiple writers without locks
2. **No event loop blocking**: Async I/O, non-blocking driver
3. **No workarounds needed**: Remove `serializeTransactions()`
4. **Production scalability**: Handles high-concurrency workloads naturally

---

## Testing Strategy (Two-Tier)

### Fast Tests (HTTP Integration)

**Files**: `src/test/auth/*.test.ts`

**What they test**: HTTP routes, validation, response format, auth flows

**Pattern**: Transaction rollback wrapper
```typescript
let ctx: TestContext;

beforeAll(async () => {
  ctx = await initTest(); // One shared DB connection
});

beforeEach(async () => {
  await ctx.startTestTransaction();
});

afterEach(async () => {
  await ctx.rollbackTestTransaction();
});

afterAll(async () => {
  await ctx.cleanup();
});
```

**Performance**: ~10ms overhead per test

**Why this works**: These tests don't test transaction behavior itself, just HTTP endpoints.

---

### Slow Tests (Use Case / Transaction Logic)

**Files**: `src/test/**/*.use-case.test.ts`

**What they test**: Transaction isolation, concurrent writes, rollback behavior

**Pattern**: Fresh schema per test
```typescript
let ctx: UseCaseTestContext;

beforeEach(async () => {
  ctx = await initUseCaseTest(); // CREATE SCHEMA test_<uuid>
});

afterEach(async () => {
  await ctx.cleanup(); // DROP SCHEMA CASCADE
});
```

**Performance**: ~50-200ms overhead per test

**Why this is necessary**: Cannot use transaction rollback wrapper when the code under test calls `db.transaction()`. Postgres doesn't support true nested transactions (only savepoints).

---

## Implementation Steps

### 1. Dependencies

```bash
pnpm remove @libsql/client
pnpm add postgres
```

**Versions**:
- `postgres`: ^3.4.0 (recommended Postgres.js driver for Drizzle)
- `drizzle-orm`: 1.0.0-rc.4 (keep current)

---

### 2. Update `src/pkg/db/index.ts`

**Before**:
```typescript
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

function serializeTransactions<T>(...) { /* queue logic */ }

export function initDb(databaseUrl: string) {
  const client = createClient({ url: databaseUrl });
  const db = serializeTransactions(drizzle({ client, relations }));
  return { db, client };
}
```

**After**:
```typescript
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

export function initDb(databaseUrl: string) {
  const client = postgres(databaseUrl);
  const db = drizzle(client, { relations });
  return { db, client };
}

// Remove serializeTransactions entirely
```

---

### 3. Update `drizzle.config.ts`

**Before**:
```typescript
export default defineConfig({
  out: "./src/pkg/db/migrations",
  schema: "./src/pkg/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: { url: dbUrl },
});
```

**After**:
```typescript
export default defineConfig({
  out: "./src/pkg/db/migrations",
  schema: "./src/pkg/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: dbUrl },
});
```

---

### 4. Regenerate Migrations

**SQLite and Postgres have different SQL dialects. Must regenerate all migrations.**

```bash
# Backup old migrations
mv src/pkg/db/migrations src/pkg/db/migrations.sqlite.backup

# Generate fresh Postgres migrations
pnpm db:generate

# Review generated SQL - check for:
# - INTEGER → SERIAL/BIGSERIAL
# - TEXT → VARCHAR (if length limits needed)
# - datetime() → NOW() or CURRENT_TIMESTAMP
# - AUTOINCREMENT → SERIAL
```

---

### 5. Update Test Helper (`src/test/helper.ts`)

**Hardcode test database URL** (prevent wrong env slips):
```typescript
const TEST_DATABASE_URL = "postgres://expensif:test_password@localhost:5432/expensif_test";

function getTestDatabaseUrl(): string {
  // Safety check: never allow production or development DB in tests
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Tests must run with NODE_ENV=test");
  }
  
  // Hardcoded - no env variable to accidentally misconfigure
  return TEST_DATABASE_URL;
}
```

**Fast test pattern**:
```typescript
export async function initTest() {
  const dbUrl = getTestDatabaseUrl();
  const client = postgres(dbUrl);
  const db = drizzle(client, { relations });
  
  await runMigrations(client);
  
  let testTx: any = null;
  
  const startTestTransaction = async () => {
    // Wrap all DB operations in a transaction that we'll rollback
    testTx = await db.transaction(async (tx) => {
      // Store tx for test to use
      return tx;
    });
  };
  
  const rollbackTestTransaction = async () => {
    // Transaction auto-rolls back when callback exits
    testTx = null;
  };
  
  const cleanup = async () => {
    await client.end();
  };
  
  const env = buildEnv(dbUrl);
  const appBuild = buildApp(env, db);
  
  return {
    db,
    client,
    env,
    ...appBuild,
    startTestTransaction,
    rollbackTestTransaction,
    cleanup,
  };
}
```

**Slow test pattern**:
```typescript
export async function initUseCaseTest() {
  const schema = `test_${randomUUID().replace(/-/g, '_')}`;
  const dbUrl = getTestDatabaseUrl();
  
  const client = postgres(dbUrl);
  
  // Create isolated schema for this test
  await client.unsafe(`CREATE SCHEMA "${schema}"`);
  await client.unsafe(`SET search_path TO "${schema}"`);
  
  // Run migrations in this schema
  await runMigrations(client);
  
  const db = drizzle(client, { schema, relations });
  
  const cleanup = async () => {
    await client.unsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await client.end();
  };
  
  const env = buildEnv(dbUrl);
  const appBuild = buildApp(env, db);
  
  return { db, client, env, ...appBuild, cleanup };
}
```

---

### 6. Update Migration Runner

**Current** (`helper.ts:21-44`):
```typescript
async function runMigrations(client: ReturnType<typeof createClient>) {
  // Reads migration files, calls client.migrate(statements)
}
```

**After**:
```typescript
async function runMigrations(client: postgres.Sql) {
  const migrationsDir = path.resolve(import.meta.dirname, "../pkg/db/migrations");
  const folders = fs
    .readdirSync(migrationsDir)
    .filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory())
    .sort();

  for (const folder of folders) {
    const file = path.join(migrationsDir, folder, "migration.sql");
    if (!fs.existsSync(file)) continue;
    
    const sql = fs.readFileSync(file, "utf-8");
    await client.unsafe(sql); // postgres.js uses .unsafe() for raw SQL
  }
}
```

---

### 7. Environment Variables

**Add to `.env`**:
```bash
DATABASE_URL=postgres://expensif:dev_password@localhost:5432/expensif_dev
```

**Add to `.env.test`**:
```bash
NODE_ENV=test
# Note: DATABASE_URL for tests is hardcoded in test/helper.ts
# This prevents accidentally running tests against dev/prod DB
```

**Update `package.json`**:
```json
{
  "scripts": {
    "test": "docker-compose -f docker-compose.test.yml up -d && dotenv -e .env.test -- vitest && docker-compose -f docker-compose.test.yml down",
    "test:run": "docker-compose -f docker-compose.test.yml up -d && dotenv -e .env.test -- vitest run && docker-compose -f docker-compose.test.yml down"
  }
}
```

**Install dotenv-cli** (if not present):
```bash
pnpm add -D dotenv-cli
```

**Update `src/pkg/env.ts`** if DATABASE_URL validation exists.

**Safety**: Test DB URL is hardcoded in `test/helper.ts` with `NODE_ENV=test` check. No risk of wrong DATABASE_URL env leaking into tests.

---

### 8. Schema Changes (if needed)

Review schema files for SQLite-specific types:

**Check**:
- `integer()` → may become `serial()` for auto-increment
- `text()` → may become `varchar()` or `text()` (Postgres distinguishes)
- `sql` template literals with SQLite functions (e.g., `datetime()`)

**Example fix** (`api-key/service.ts:46`):
```typescript
// Before (SQLite)
expiresAt: sql`datetime(CURRENT_TIMESTAMP, ${expireModifier})`

// After (Postgres)
expiresAt: sql`CURRENT_TIMESTAMP + INTERVAL '${sql.raw(env.API_KEY_REDEEM_WINDOW_MINUTES)} minutes'`
```

---

### 9. Local Postgres Setup

**Docker Compose** (`docker-compose.yml`):
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: expensif
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: expensif_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Docker Compose Test** (`docker-compose.test.yml`):
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: expensif
      POSTGRES_PASSWORD: test_password
      POSTGRES_DB: expensif_test
    ports:
      - "5432:5432"
    tmpfs:
      - /var/lib/postgresql/data  # In-memory for faster tests
```

**Start**:
```bash
# Development
docker-compose up -d

# Tests
docker-compose -f docker-compose.test.yml up -d
pnpm test
docker-compose -f docker-compose.test.yml down
```

---

### 10. Migration Checklist

- [ ] Install `postgres`, remove `@libsql/client`
- [ ] Update `db/index.ts` - swap driver, remove `serializeTransactions`
- [ ] Update `drizzle.config.ts` - change dialect
- [ ] Backup old migrations, regenerate with Postgres dialect
- [ ] Update schema files if SQLite-specific SQL found
- [ ] Update `test/helper.ts` - two-tier pattern
- [ ] Add `TEST_DATABASE_URL` to env
- [ ] Set up local Postgres (Docker or native)
- [ ] Run migrations: `pnpm db:migrate`
- [ ] Run tests: `pnpm test`
- [ ] Test production build: `pnpm build && pnpm start`
- [ ] Update deployment config (DATABASE_URL pointing to Postgres instance)

---

## Rollback Plan

If migration fails:

1. **Restore dependencies**:
   ```bash
   pnpm add @libsql/client@^0.17.4
   pnpm remove postgres
   ```

2. **Revert files**:
   ```bash
   git checkout -- src/pkg/db/index.ts drizzle.config.ts src/test/helper.ts
   mv src/pkg/db/migrations.sqlite.backup src/pkg/db/migrations
   ```

3. **Restore DATABASE_URL** to `file:` path

---

## Timeline Estimate

- Dependencies + config: **15 min**
- Migration regeneration: **30 min** (review SQL changes)
- Test helper refactor: **45 min**
- Schema fixes (if any): **30 min**
- Testing + fixes: **1-2 hours**

**Total**: ~3-4 hours for complete migration

---

## Success Criteria

- [ ] All tests pass
- [ ] No `serializeTransactions` in codebase
- [ ] Concurrency test (`redeem-api-key.use-case.test.ts`) passes without serialization
- [ ] Production app runs without errors
- [ ] Migrations apply cleanly to fresh Postgres DB
