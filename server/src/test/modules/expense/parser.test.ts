import { MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { execParseExpense } from "@/modules/expense/parser";

function modelFor(amount: unknown, currency = "IDR", date = "2026-11-07") {
  return new MockLanguageModelV4({
    doGenerate: {
      content: [
        {
          type: "text",
          text: JSON.stringify({ item_name: "bakso", amount, currency, date, category: "food" }),
        },
      ],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 0, text: 0, reasoning: 0 },
      },
      warnings: [],
    },
  });
}

afterEach(() => vi.useRealTimers());

describe("expense parsing", () => {
  it.each(["15000", "9007199254740993"])(
    "preserves normalized amount %s exactly",
    async (amount) => {
      const result = await execParseExpense({ model: modelFor(amount) }, "bakso", []);
      expect(result.amount).toBe(amount);
      expect(result.currency).toBe("IDR");
    }
  );

  it.each([
    "",
    "01",
    " 15000",
    "15000 ",
    "15000\n",
    "15k",
    "0",
    "-1",
    "NaN",
    "Infinity",
    "1.5",
    "15.000",
    "1e3",
  ])("rejects invalid model amount %s", async (amount) => {
    await expect(execParseExpense({ model: modelFor(amount) }, "bakso", [])).rejects.toThrow();
  });

  it.each(["USD", "idr"])("rejects currency %s without conversion", async (currency) => {
    await expect(
      execParseExpense({ model: modelFor("15", currency) }, `bakso ${currency} 15`, [])
    ).rejects.toThrow();
  });

  it("rejects numeric model output that could have lost precision", async () => {
    await expect(execParseExpense({ model: modelFor(15000) }, "bakso 15000", [])).rejects.toThrow();
  });

  it.each([
    ["2026-11-06T16:59:59Z", "2026-11-06"],
    ["2026-11-06T17:00:00Z", "2026-11-07"],
    ["2026-12-31T18:00:00Z", "2027-01-01"],
  ])("uses the Jakarta calendar date at %s", async (instant, today) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(instant));
    const model = modelFor("15000", "IDR", today);
    await execParseExpense({ model }, "bakso 15k kemarin", []);
    const system = model.doGenerateCalls[0].prompt.find((message) => message.role === "system");
    expect(system?.content).toContain(`Today is ${today} in Asia/Jakarta.`);
  });
});
