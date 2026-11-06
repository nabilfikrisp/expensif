import { generateText, Output } from "ai";
import { z } from "zod";
import type { Llm } from "@/pkg/llm";

// different than db schema
const expenseParseSchema = z.object({
  item_name: z.string().describe("The name of the item (e.g. pizza, bubur ayam, indomie)"),
  amount: z
    .string()
    .describe(
      "Exact amount token copied from the message, including separators and shorthand; exclude currency labels. Never normalize or round."
    ),
  currency: z.string().default("IDR").describe("Original currency code; never convert currencies"),
  date: z.iso.date().describe("Date in YYYY-MM-DD format"),
  category: z.string().describe("Category slug from the provided list"),
  note: z.string().optional().describe("Optional note or description"),
});

export type ParsedExpense = Omit<z.infer<typeof expenseParseSchema>, "currency"> & {
  currency: "IDR";
};

function normalizeRupiah(raw: string): string {
  const match = /^(\d[\d.,]*)(?:\s*(k|rb|ribu|jt|juta))?$/i.exec(raw.trim());
  if (!match) {
    throw new Error("Invalid rupiah amount");
  }
  const [, value, suffix = ""] = match;
  let decimal: string;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(value)) {
    decimal = value.replaceAll(".", "").replace(",", ".");
  } else if (/^\d+(?:,\d+)?$/.test(value)) {
    decimal = value.replace(",", ".");
  } else if (suffix && /^\d+\.\d+$/.test(value)) {
    decimal = value;
  } else {
    throw new Error("Invalid Indonesian amount format");
  }

  const [integer, fraction = ""] = decimal.split(".");
  const multiplier = /^(jt|juta)$/i.test(suffix) ? 1_000_000n : suffix ? 1_000n : 1n;
  const numerator = BigInt(integer + fraction) * multiplier;
  const denominator = 10n ** BigInt(fraction.length);
  if (numerator <= 0n || numerator % denominator !== 0n) {
    throw new Error("Amount must be positive whole rupiah; fractional rupiah cannot be rounded");
  }
  return (numerator / denominator).toString();
}

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
      "Available categories:",
      categoryList,
      "",
      `Today is ${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} in Asia/Jakarta.`,
      'Interpret relative dates like "kemarin", "yesterday", "last week", "2 days ago" in Asia/Jakarta.',
      'Copy the amount token verbatim, including separators and suffixes: "15.000", "15k", "1.5jt", "1,5jt".',
      'Indonesian conventions apply: dots group thousands, commas mark decimals. A decimal dot is also allowed with shorthand ("1.5jt").',
      "Suffixes k/rb/ribu mean thousand; jt/juta mean million. Do not expand shorthand; the application normalizes it exactly.",
      "Only positive whole rupiah and IDR are supported. Never round fractional rupiah or convert foreign currency.",
      "Preserve explicit currency in the currency field, even if unsupported. Default to IDR only when currency is absent; Rp/rupiah mean IDR.",
      "",
      'Return ONLY a JSON object with exactly these keys: "item_name", "amount", "currency", "date", "category", "note".',
      "No markdown, no code fences, no explanation. Just the JSON object.",
    ].join("\n"),
    prompt: text,
  });

  const escapedAmount = output.amount.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sourceAmount = new RegExp(
    `(?<![\\d.,+-])${escapedAmount}(?!\\d|[.,]\\d|\\s*(?:k|rb|ribu|jt|juta)\\b)`,
    "i"
  );
  if (!sourceAmount.test(text)) {
    throw new Error("Parsed amount must be copied verbatim from the source message");
  }
  return {
    ...output,
    amount: normalizeRupiah(output.amount),
    currency: z.literal("IDR").parse(output.currency),
  };
}
