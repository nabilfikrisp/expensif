import { execParseExpense } from "../parser";
import { parseExpenseOutputSchema } from "./dto";
import type { ParseExpenseInput, ParseExpenseOutput } from "./dto";
import type { CategoryService } from "@/modules/category/service/interface";
import type { Llm } from "@/pkg/llm";

interface InitParseExpenseDeps {
  llm: Llm;
  categoryService: CategoryService;
}

export function initParseExpense({ llm, categoryService }: InitParseExpenseDeps) {
  return async function parseExpense({ text }: ParseExpenseInput): Promise<ParseExpenseOutput> {
    const availableCategories = await categoryService.listCategories();
    const parsedExpense = await execParseExpense(llm, text, availableCategories);
    const resolvedCategory = await categoryService.resolveCategory(parsedExpense.category);

    return parseExpenseOutputSchema.parse({
      itemName: parsedExpense.item_name,
      amount: parsedExpense.amount,
      currency: parsedExpense.currency,
      expenseDate: parsedExpense.date,
      categoryId: resolvedCategory.id,
      categorySlug: resolvedCategory.slug,
      note: parsedExpense.note ?? null,
    });
  };
}
