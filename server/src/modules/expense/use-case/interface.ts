import type { IngestExpenseInput, IngestExpenseOutput } from "./dto";

export interface ExpenseUseCase {
  ingestExpense(input: IngestExpenseInput): Promise<IngestExpenseOutput>;
}
