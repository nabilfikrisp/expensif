# Database Migrations (Drizzle)

- **Never** run `drizzle-kit push` (or `db:push`).
- **Always** use the generate + migrate workflow:
  1. `drizzle-kit generate` — creates a SQL migration file from schema changes.
  2. `drizzle-kit migrate` — applies pending migrations to the database.
- Every schema change must produce a committed migration file in the migrations folder. Do not apply schema changes directly to the database.
- If a migration file already covers the intended change, run `migrate` only — do not regenerate or push.

# Package Manager

Always use pnpm