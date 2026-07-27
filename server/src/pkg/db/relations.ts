import { defineRelations } from "drizzle-orm";
import { categories } from "@/modules/category/schema";
import { expenses } from "@/modules/expense/schema";
import { messages } from "@/modules/message/schema";
import { users, apiKeys, linkedAccounts } from "@/modules/user/schema";

export const relations = defineRelations(
  { users, apiKeys, linkedAccounts, categories, messages, expenses },
  (h) => ({
    users: {
      apiKeys: h.many.apiKeys(),
      linkedAccounts: h.many.linkedAccounts(),
      messages: h.many.messages(),
      expenses: h.many.expenses(),
    },
    apiKeys: { user: h.one.users({ from: h.apiKeys.userId, to: h.users.id }) },
    linkedAccounts: { user: h.one.users({ from: h.linkedAccounts.userId, to: h.users.id }) },
    messages: {
      user: h.one.users({ from: h.messages.userId, to: h.users.id }),
      linkedAccount: h.one.linkedAccounts({
        from: h.messages.linkedAccountId,
        to: h.linkedAccounts.id,
      }),
      expenses: h.many.expenses(),
    },
    expenses: {
      user: h.one.users({ from: h.expenses.userId, to: h.users.id }),
      message: h.one.messages({
        from: h.expenses.messageId,
        to: h.messages.id,
      }),
      category: h.one.categories({
        from: h.expenses.categoryId,
        to: h.categories.id,
      }),
    },
    categories: {
      expenses: h.many.expenses(),
    },
  })
);
