function hasSqlState(err: unknown, sqlState: string): boolean {
  const seen = new Set<unknown>();
  let current: unknown = err;

  while (current !== null && typeof current === "object" && !seen.has(current)) {
    seen.add(current);

    if ("code" in current && current.code === sqlState) {
      return true;
    }

    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}

export function isUniqueConstraintError(err: unknown): boolean {
  return hasSqlState(err, "23505");
}

export function isForeignKeyConstraintError(err: unknown): boolean {
  return hasSqlState(err, "23503");
}
