import { generateText, Output } from "ai";
import { z } from "zod";
import type { Llm } from "@/pkg/llm";

// Model output is separate from database and use-case DTOs.
const expenseParseSchema = z.object({
  item_name: z
    .string()
    .min(1)
    .describe("The item or combined description when several items share one total"),
  amount: z
    .string()
    .regex(/^[1-9][0-9]*(?![\s\S])/, "Amount must be positive whole rupiah as a digit string")
    .describe(
      'Normalized whole-rupiah amount as a digit string, e.g. 15k becomes "15000" and 1,5jt becomes "1500000". No separators, suffixes, currency labels, or rounding.'
    ),
  currency: z.string().default("IDR").describe("Original currency code; never convert currencies"),
  date: z.iso.date().describe("Date in YYYY-MM-DD format"),
  category: z.string().describe("Category slug from the provided list"),
  note: z.string().optional().describe("Optional note or description"),
});

export type ParsedExpense = Omit<z.infer<typeof expenseParseSchema>, "currency"> & {
  currency: "IDR";
};

export async function execParseExpense(
  llm: Llm,
  text: string,
  categories: { name: string; slug: string }[]
): Promise<ParsedExpense> {
  const categoryList = categories.map((c) => `- ${c.name} (${c.slug})`).join("\n");

  const { output } = await generateText({
    model: llm.model,
    output: Output.object({ schema: expenseParseSchema }),
    system: [
      "You parse expense messages into structured data.",
      "Return one expense per message. When several items share one total, preserve them in one combined item_name and use that total; never invent per-item prices.",
      'Example: "gua beli rokok, mie, es teh, totalnya 50k" has item_name "rokok, mie, es teh" and amount "50000".',
      "Available categories:",
      categoryList,
      "",
      `Today is ${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} in Asia/Jakarta.`,
      'Interpret relative dates like "kemarin", "yesterday", "last week", "2 days ago" in Asia/Jakarta.',
      'Normalize the amount to a digit string: "15.000" and "15k" become "15000"; "1.5jt" and "1,5jt" become "1500000".',
      'Indonesian conventions apply: dots group thousands, commas mark decimals. A decimal dot is also allowed with shorthand ("1.5jt").',
      "Suffixes k/rb/ribu mean thousand; jt/juta mean million. Expand shorthand in the amount field; return only digits as a JSON string, never a JSON number.",
      "Only positive whole rupiah and IDR are supported. Never round fractional rupiah or convert foreign currency.",
      "Preserve explicit currency in the currency field, even if unsupported. Default to IDR only when currency is absent; Rp/rupiah mean IDR.",
      "",
      'Return ONLY a JSON object with exactly these keys: "item_name", "amount", "currency", "date", "category", "note".',
      "No markdown, no code fences, no explanation. Just the JSON object.",
    ].join("\n"),
    prompt: text,
  });

  return {
    ...output,
    currency: z.literal("IDR").parse(output.currency),
  };
}
