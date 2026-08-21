# Migration Plan — DB-Generated Timestamps

## Goal

Replace application-generated timestamps (`new Date().toISOString()`) with database-level defaults across all timestamp columns. This ensures timestamp consistency in multi-server deployments where clock drift between geographically distant servers can cause ordering issues.

## Scope

Every timestamp column gets a database-level default:
- **NOT NULL columns** → `DEFAULT (CURRENT_TIMESTAMP)`
- **Nullable columns** → `DEFAULT NULL` (explicit, matches current behavior of being unset until conditionally set)

## Schema Changes

### `server/src/modules/user/schema.ts`

```ts
import { sql } from "drizzle-orm";

// users
createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),

// api_keys
createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
lastUsedAt: text("last_used_at").default(null),
revokedAt: text("revoked_at").default(null),

// linked_accounts
linkedAt: text("linked_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
```

| Table | Column | Default |
|-------|--------|---------|
| `users` | `created_at` | `(CURRENT_TIMESTAMP)` |
| `api_keys` | `created_at` | `(CURRENT_TIMESTAMP)` |
| `api_keys` | `last_used_at` | `NULL` |
| `api_keys` | `revoked_at` | `NULL` |
| `linked_accounts` | `linked_at` | `(CURRENT_TIMESTAMP)` |

### `server/src/modules/message/schema.ts`

| Table | Column | Default |
|-------|--------|---------|
| `messages` | `received_at` | `(CURRENT_TIMESTAMP)` |

### `server/src/modules/expense/schema.ts`

| Table | Column | Default |
|-------|--------|---------|
| `expenses` | `created_at` | `(CURRENT_TIMESTAMP)` |
| `expenses` | `updated_at` | `(CURRENT_TIMESTAMP)` |

## Code Changes

After adding defaults, remove explicit timestamp values from insert calls where the default handles it:

- `server/src/modules/auth/service.ts` — remove `const now = new Date().toISOString()` and `createdAt: now` from `register()`
- `server/src/modules/user/services/api-key.ts` (when created) — remove `createdAt: now` from `generateApiKey()`
- `server/src/modules/user/services/linked-account.ts` (when created) — remove `linkedAt: now` from `linkAccount()`

**Nullable columns** (`last_used_at`, `revoked_at`) — no code changes needed. They are `null` by default and only set conditionally in application code via `sql`(CURRENT_TIMESTAMP)`` in UPDATE statements:

- `last_used_at` — set when the key is first verified/used
- `revoked_at` — set when the key is manually revoked

Example:
```ts
await db.update(apiKeys).set({ lastUsedAt: sql`(CURRENT_TIMESTAMP)` }).where(...)
```

**Note:** `updatedAt` in `expenses` still needs manual update on edit operations (no `ON UPDATE` trigger in SQLite). Only the initial insert gets the default.

## Timestamp Format Change

| Before | After |
|--------|-------|
| `2026-08-21T14:30:00.000Z` | `2026-08-21 14:30:00` |

SQLite `CURRENT_TIMESTAMP` returns UTC in `YYYY-MM-DD HH:MM:SS` format. No `T` separator, no milliseconds, no `Z` suffix. This is acceptable — timestamps are stored as plain text and not deeply parsed in the current codebase.

## Migration Commands

```bash
# Generate migration from schema changes
pnpm drizzle-kit generate

# Apply migration to database
pnpm drizzle-kit migrate
```

## Verification

After migration:
1. Check that existing rows are unaffected (defaults only apply to new inserts)
2. Insert a test row without specifying `createdAt` — verify it gets a `CURRENT_TIMESTAMP` value
3. Insert a test `api_keys` row without specifying `lastUsedAt`/`revokedAt` — verify they are `null`
4. Run existing tests to ensure nothing breaks
