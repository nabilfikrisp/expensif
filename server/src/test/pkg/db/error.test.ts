import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { initTestDb } from "../../helper";

import { apiKeys } from "@/modules/api-key/schema";
import { users } from "@/modules/user/schema";
import { isForeignKeyConstraintError, isUniqueConstraintError } from "@/pkg/db/error";

let ctx: Awaited<ReturnType<typeof initTestDb>>;

beforeAll(async () => {
  ctx = await initTestDb();
  return () => ctx.client.end();
});

beforeEach(async () => ctx.resetDb());

describe("PostgreSQL constraint error detection", () => {
  it("recognizes a real Drizzle unique violation without treating it as a foreign key error", async () => {
    const user = {
      id: crypto.randomUUID(),
      email: "owner@example.com",
      name: "Owner",
      passwordHash: "unused",
    };
    await ctx.db.insert(users).values(user);
    const [result] = await Promise.allSettled([
      ctx.db.insert(users).values({ ...user, id: crypto.randomUUID() }),
    ]);
    expect(result.status).toBe("rejected");
    if (result.status === "fulfilled") {
      throw new Error("Duplicate email was accepted");
    }
    expect(isUniqueConstraintError(result.reason)).toBe(true);
    expect(isForeignKeyConstraintError(result.reason)).toBe(false);
  });

  it("recognizes a real Drizzle foreign key violation without treating it as a unique error", async () => {
    const [result] = await Promise.allSettled([
      ctx.db.insert(apiKeys).values({
        id: "orphan-key",
        userId: crypto.randomUUID(),
        keyHash: "hash",
        keyHint: "hint",
        expiresAt: "2026-11-07T00:00:00Z",
      }),
    ]);
    expect(result.status).toBe("rejected");
    if (result.status === "fulfilled") {
      throw new Error("Missing owner was accepted");
    }
    expect(isForeignKeyConstraintError(result.reason)).toBe(true);
    expect(isUniqueConstraintError(result.reason)).toBe(false);
  });

  it("does not classify unrelated errors, including cyclic causes", () => {
    const error = new Error("Unrelated failure");
    error.cause = error;
    expect(isUniqueConstraintError(error)).toBe(false);
    expect(isForeignKeyConstraintError(error)).toBe(false);
  });
});
