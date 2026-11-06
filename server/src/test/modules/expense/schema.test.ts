import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { initTestDb } from "../../helper";

import { expenses } from "@/modules/expense/schema";
import { users } from "@/modules/user/schema";

let ctx: Awaited<ReturnType<typeof initTestDb>>;
const userId = "expense-owner";

beforeAll(async () => {
  ctx = await initTestDb();
  return () => ctx.client.end();
});

beforeEach(async () => {
  await ctx.resetDb();
  await ctx.db
    .insert(users)
    .values({ id: userId, email: "expense@example.com", name: "Owner", passwordHash: "unused" });
});

function insertExpense(amount: string, currency?: string) {
  return ctx.db
    .insert(expenses)
    .values({
      id: crypto.randomUUID(),
      userId,
      itemName: "bakso",
      amount,
      currency,
      expenseDate: "2026-11-06",
    })
    .returning();
}

describe("expense database policy", () => {
  it.each(["1", "9007199254740993", "999999999999999999999999999999"])(
    "stores %s as an exact whole-rupiah value with default IDR",
    async (amount) => {
      const [row] = await insertExpense(amount);
      expect(row.amount).toBe(amount);
      expect(row.currency).toBe("IDR");
    }
  );

  it.each(["0", "-1", "0.999", "1.00000000000000000001", "NaN", "Infinity", "-Infinity"])(
    "rejects %s before any rounding",
    async (amount) => {
      await expect(insertExpense(amount)).rejects.toMatchObject({
        cause: { code: "23514", constraint: "expenses_amount_positive_finite_whole" },
      });
      expect(await ctx.db.select().from(expenses)).toEqual([]);
    }
  );

  it.each(["USD", "idr", ""])("rejects currency %s", async (currency) => {
    await expect(insertExpense("15000", currency)).rejects.toMatchObject({
      cause: { code: "23514", constraint: "expenses_currency_idr" },
    });
  });
});
