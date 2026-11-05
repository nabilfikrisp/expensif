import { DrizzleQueryError } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { isForeignKeyConstraintError, isUniqueConstraintError } from "@/pkg/db/error";

function pgError(code: string): Error & { code: string } {
  return Object.assign(new Error("database error"), { code });
}

describe("PostgreSQL constraint error detection", () => {
  it("detects direct and wrapped unique violations", () => {
    const error = pgError("23505");

    expect(isUniqueConstraintError(error)).toBe(true);
    expect(isUniqueConstraintError(new DrizzleQueryError("INSERT", [], error))).toBe(true);
    expect(isUniqueConstraintError(new Error("service error", { cause: error }))).toBe(true);
    expect(isForeignKeyConstraintError(error)).toBe(false);
  });

  it("detects direct and wrapped foreign key violations", () => {
    const error = pgError("23503");

    expect(isForeignKeyConstraintError(error)).toBe(true);
    expect(isForeignKeyConstraintError(new DrizzleQueryError("INSERT", [], error))).toBe(true);
    expect(isUniqueConstraintError(error)).toBe(false);
  });

  it("does not classify unrelated or SQLite errors", () => {
    expect(isUniqueConstraintError(new Error("UNIQUE constraint failed: users.email"))).toBe(false);
    expect(isForeignKeyConstraintError(new Error("FOREIGN KEY constraint failed"))).toBe(false);
    expect(isUniqueConstraintError(pgError("23503"))).toBe(false);
    expect(isForeignKeyConstraintError(pgError("23505"))).toBe(false);
  });
});
