import type { ExpensesService } from "../service/interface";
import { initIngestExpense } from "./ingest-expense";
import type { ExpenseUseCase } from "./interface";
import type { LinkedAccountService } from "@/modules/linked-account/service/interface";
import type { MessageService } from "@/modules/message/service/interface";
import type { Db } from "@/pkg/db";

interface InitExpenseUseCase {
  db: Db;
  linkedAccountService: LinkedAccountService;
  messageService: MessageService;
  expenseService: ExpensesService;
}

export function initExpenseUseCase({
  db,
  linkedAccountService,
  messageService,
  expenseService,
}: InitExpenseUseCase): ExpenseUseCase {
  return {
    ingestExpense: initIngestExpense({ db, linkedAccountService, messageService, expenseService }),
  };
}
