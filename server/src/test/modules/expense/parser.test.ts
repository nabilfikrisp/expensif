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
  it.each([
    ["15000", "15000"],
    ["15.000", "15000"],
    ["1.500.000", "1500000"],
    ["15k", "15000"],
    ["1.5jt", "1500000"],
    ["1,5jt", "1500000"],
    ["15 rb", "15000"],
    ["1,5 juta", "1500000"],
    ["1.500k", "1500000"],
    ["1,001k", "1001"],
    ["0,001k", "1"],
    ["15.000,00", "15000"],
    ["9007199254740993", "9007199254740993"],
    ["999999999999999999,00", "999999999999999999"],
    ["1.000001jt", "1000001"],
  ])("accepts normalized model output %s as %s rupiah", async (raw, expected) => {
    const result = await execParseExpense({ model: modelFor(expected) }, `bakso ${raw}`, []);
    expect(result.amount).toBe(expected);
    expect(result.currency).toBe("IDR");
  });

  it.each([
    "",
    "01",
    " 15000",
    "15000 ",
    "15000\n",
    "15k",
    "1,5jt",
    "15.000",
    "0",
    "-1",
    "NaN",
    "Infinity",
    "1,5",
    "15.000,01",
    "0,0001k",
    "1.0000001jt",
    "15.00",
    "1,500.00",
    "1e3",
    "9007199254740993,1",
  ])("rejects invalid or fractional rupiah %s", async (raw) => {
    await expect(execParseExpense({ model: modelFor(raw) }, `bakso ${raw}`, [])).rejects.toThrow();
  });

  it.each(["USD", "EUR", "SGD", "idr"])(
    "rejects currency %s without conversion",
    async (currency) => {
      await expect(
        execParseExpense({ model: modelFor("15", currency) }, `bakso ${currency} 15`, [])
      ).rejects.toThrow();
    }
  );

  it("accepts an amount followed by sentence punctuation", async () => {
    const result = await execParseExpense({ model: modelFor("15000") }, "bakso 15000.", []);
    expect(result.amount).toBe("15000");
  });

  it("rejects numeric model output that could have lost precision", async () => {
    await expect(execParseExpense({ model: modelFor(15000) }, "bakso 15000", [])).rejects.toThrow();
  });

  it.each(["2026-11-06T16:59:59Z", "2026-11-06T17:00:00Z", "2026-12-31T18:00:00Z"])(
    "uses the Jakarta calendar date at %s",
    async (instant) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(instant));
      const today = instant.includes("12-31")
        ? "2027-01-01"
        : instant.includes("16:59")
          ? "2026-11-06"
          : "2026-11-07";
      const model = modelFor("15000", "IDR", today);
      await execParseExpense({ model }, "bakso 15k kemarin", []);
      const system = model.doGenerateCalls[0].prompt.find((message) => message.role === "system");
      expect(system?.content).toContain(`Today is ${today} in Asia/Jakarta.`);
      expect(system?.content).toContain('"kemarin"');
      expect(system?.content).toContain('"15k" become "15000"');
      expect(system?.content).toContain('"1,5jt" become "1500000"');
      expect(system?.content).toContain("never a JSON number");
    }
  );
});
