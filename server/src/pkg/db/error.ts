import { DrizzleQueryError } from "drizzle-orm";

function rootCauseError(err: unknown): Error | null {
  let current: unknown = err;
  while (current instanceof Error && current.cause instanceof Error) {
    current = current.cause;
  }
  return current instanceof Error ? current : null;
}

export function isUniqueConstraintError(err: unknown): boolean {
  // SQLite
  if (rootCauseError(err)?.message.includes("UNIQUE constraint failed")) {
    return true;
  }

  // PostgreSQL
  if (err instanceof DrizzleQueryError && err.cause) {
    const cause = err.cause;
    if ("code" in cause && cause.code === "23505") {
      return true;
    }
  }

  return false;
}

export function isForeignKeyConstraintError(err: unknown): boolean {
  // SQLite
  if (rootCauseError(err)?.message.includes("FOREIGN KEY constraint failed")) {
    return true;
  }

  // PostgreSQL
  if (err instanceof DrizzleQueryError && err.cause) {
    const cause = err.cause;
    if ("code" in cause && cause.code === "23503") {
      return true;
    }
  }

  return false;
}
