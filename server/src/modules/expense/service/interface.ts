import type {
  CreateExpenseInput,
  CreateExpenseOutput,
  FindExpenseByMessageIdInput,
  FindExpenseByMessageIdOutput,
  ParseExpenseInput,
  ParseExpenseOutput,
} from "./dto";
import type { DbTx, Tx } from "@/pkg/db";

export interface ExpensesService {
  createExpense(input: CreateExpenseInput, transaction: Tx): Promise<CreateExpenseOutput>;
  findExpenseByMessageId(
    userId: FindExpenseByMessageIdInput["userId"],
    messageId: FindExpenseByMessageIdInput["messageId"],
    ctx?: DbTx
  ): Promise<FindExpenseByMessageIdOutput | undefined>;
  parseExpense(input: ParseExpenseInput): Promise<ParseExpenseOutput>;
}
