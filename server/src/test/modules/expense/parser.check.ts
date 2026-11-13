// Run manually from server/: pnpm test:standalone:expense-parser
import assert from "node:assert/strict";

import { execParseExpense } from "@/modules/expense/parser";
import { initEnv } from "@/pkg/env";
import { initLlm } from "@/pkg/llm";

const env = initEnv();
const model = env.OPENROUTER_MODEL;
const llm = initLlm(env.OPENROUTER_API_KEY, model);
const categories = [
  { name: "Food", slug: "food" },
  { name: "Other", slug: "other" },
];
const cases = [
  { text: "Bakso Rp15.000 tanggal 6 November 2026", amount: "15000", date: "2026-11-06" },
  { text: "Bakso 15k tanggal 6 November 2026", amount: "15000", date: "2026-11-06" },
  { text: "Makan malam 1,5jt tanggal 6 November 2026", amount: "1500000", date: "2026-11-06" },
  { text: "Makan malam 1.5jt tanggal 6 November 2026", amount: "1500000", date: "2026-11-06" },
  { text: "Bakso 15 ribu kemarin", amount: "15000" },
  {
    text: "gua beli rokok, mie, es teh, totalnya 50k",
    amount: "50000",
    daysAgo: 0,
    items: ["rokok", "mie", "es teh"],
  },
];

console.log(
  `Evaluating ${cases.length} messages with ${model}; at most ${cases.length * 3} model attempts including SDK retries.`
);
// ponytail: a small manual smoke evaluation; expand the fixed cases when real parsing failures recur.
for (const scenario of cases) {
  const started = new Date();
  const result = await execParseExpense(llm, scenario.text, categories);
  assert.equal(result.amount, scenario.amount, scenario.text);
  assert.equal(result.currency, "IDR", scenario.text);
  if (scenario.items) {
    for (const item of scenario.items) {
      assert.ok(result.item_name.toLowerCase().includes(item), `${scenario.text}: missing ${item}`);
    }
    assert.ok(
      categories.some((category) => category.slug === result.category),
      scenario.text
    );
  } else {
    assert.equal(result.category, "food", scenario.text);
  }
  const relativeDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(started.getTime() - (scenario.daysAgo ?? 1) * 86_400_000));
  assert.equal(result.date, scenario.date ?? relativeDate, scenario.text);
  console.log(`Passed: ${scenario.text}`);
}
