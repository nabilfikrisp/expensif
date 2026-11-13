import { initCreateExpense } from "./create-expense";
import { initFindExpenseByMessageId } from "./find-expense-by-message-id";
import type { ExpensesService } from "./interface";
import { initParseExpense } from "./parse-expense";
import type { CategoryService } from "@/modules/category/service/interface";
import type { Db } from "@/pkg/db";
import type { Llm } from "@/pkg/llm";

interface InitExpensesServiceDeps {
  llm: Llm;
  db: Db;
  categoryService: CategoryService;
}

export function initExpenseService({
  llm,
  db,
  categoryService,
}: InitExpensesServiceDeps): ExpensesService {
  return {
    createExpense: initCreateExpense(),
    findExpenseByMessageId: initFindExpenseByMessageId({ db }),
    parseExpense: initParseExpense({ llm, categoryService }),
  };
}
