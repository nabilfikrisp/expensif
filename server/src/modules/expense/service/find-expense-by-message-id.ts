import { and, eq, getTableColumns } from "drizzle-orm";
import { expenses } from "../schema";
import type { FindExpenseByMessageIdInput, FindExpenseByMessageIdOutput } from "./dto";
import { categories } from "@/modules/category/schema";
import type { Db, DbTx } from "@/pkg/db";

interface InitFindExpenseByMessageIdDeps {
  db: Db;
}

export function initFindExpenseByMessageId({ db }: InitFindExpenseByMessageIdDeps) {
  return async function findExpenseByMessageId(
    userId: FindExpenseByMessageIdInput["userId"],
    messageId: FindExpenseByMessageIdInput["messageId"],
    ctx: DbTx = db
  ): Promise<FindExpenseByMessageIdOutput | undefined> {
    const belongsToUser = eq(expenses.userId, userId);
    const comesFromMessage = eq(expenses.messageId, messageId);
    const matchingExpenses = await ctx
      .select({ ...getTableColumns(expenses), categorySlug: categories.slug })
      .from(expenses)
      .leftJoin(categories, eq(expenses.categoryId, categories.id))
      .where(and(belongsToUser, comesFromMessage))
      .limit(1);

    return matchingExpenses.at(0);
  };
}
