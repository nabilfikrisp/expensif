import { parseExpense } from "./parser";
import type { ParsedExpense } from "./parser";
import type { Db } from "@/pkg/db";
import type { Llm } from "@/pkg/llm";

const categories = [
  { name: "Food & Drinks", slug: "food" },
  { name: "Transportation", slug: "transport" },
  { name: "Shopping", slug: "shopping" },
  { name: "Entertainment", slug: "entertainment" },
  { name: "Health", slug: "health" },
  { name: "Bills & Utilities", slug: "bills" },
  { name: "Other", slug: "other" },
];

export function initExpenseService(llm: Llm, db: Db) {
  return {
    parseExpense(text: string): Promise<ParsedExpense> {
      return parseExpense(llm, text, categories);
    },
  };
}

export type ExpensesService = ReturnType<typeof initExpenseService>;
