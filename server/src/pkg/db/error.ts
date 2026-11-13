function hasSqlState(err: unknown, sqlState: string, constraint?: string): boolean {
  const seen = new Set<unknown>();
  let current: unknown = err;

  while (current !== null && typeof current === "object" && !seen.has(current)) {
    seen.add(current);

    if (
      "code" in current &&
      current.code === sqlState &&
      (constraint === undefined || ("constraint" in current && current.constraint === constraint))
    ) {
      return true;
    }

    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}

export function isUniqueConstraintError(err: unknown, constraint?: string): boolean {
  return hasSqlState(err, "23505", constraint);
}

export function isForeignKeyConstraintError(err: unknown): boolean {
  return hasSqlState(err, "23503");
}
