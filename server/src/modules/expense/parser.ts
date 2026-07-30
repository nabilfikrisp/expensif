import { generateText, Output } from "ai";
import { z } from "zod";
import type { initLlm } from "@/pkg/llm";

// different than db schema
const expenseParseSchema = z.object({
  item_name: z.string().describe("The name of the item (e.g. pizza, bubur ayam, indomie)"),
  amount: z.number().positive().describe("The amount in the smallest unit (e.g., rupiah)"),
  currency: z.string().default("IDR").describe("Currency code"),
  date: z.string().describe("Date in YYYY-MM-DD format"),
  category: z.string().describe("Category slug from the provided list"),
  note: z.string().optional().describe("Optional note or description"),
});

export type ParsedExpense = z.infer<typeof expenseParseSchema>;

export async function execParseExpense(
  llm: ReturnType<typeof initLlm>,
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
      `Today is ${new Date().toISOString().slice(0, 10)}.`,
      'Interpret relative dates like "yesterday", "last week", "2 days ago" correctly.',
      'Convert amounts like "50k" to 50000, "1.5jt" to 1500000, etc.',
      "Default currency is IDR.",
      "",
      'Return ONLY a JSON object with exactly these keys: "item_name", "amount", "currency", "date", "category", "note".',
      "No markdown, no code fences, no explanation. Just the JSON object.",
    ].join("\n"),
    prompt: text,
  });

  return output;
}
