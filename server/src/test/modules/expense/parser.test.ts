import { afterEach, describe, expect, it, vi } from "vitest";

import { execParseExpense } from "@/modules/expense/parser";
import { expenseModel } from "@/test/helper/expense-model";

afterEach(() => vi.useRealTimers());

// Bot flows verify validation and persistence. Prompt inspection is needed to verify
// the date supplied to the model at Jakarta midnight and the year boundary.
describe("expense date policy", () => {
  it.each([
    ["2026-11-06T16:59:59Z", "2026-11-06"],
    ["2026-11-06T17:00:00Z", "2026-11-07"],
    ["2026-12-31T18:00:00Z", "2027-01-01"],
  ])("uses the Jakarta calendar date at %s", async (instant, today) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(instant));
    const model = expenseModel(() =>
      Promise.resolve({
        item_name: "bakso",
        amount: "15000",
        currency: "IDR",
        date: today,
        category: "food",
      })
    );
    await execParseExpense({ model }, "bakso 15k kemarin", []);
    const system = model.doGenerateCalls[0].prompt.find((message) => message.role === "system");
    expect(system?.content).toContain(`Today is ${today} in Asia/Jakarta.`);
  });
});
