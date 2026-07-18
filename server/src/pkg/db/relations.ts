import { defineRelations } from "drizzle-orm";
import { categories } from "../../modules/category/schema.js";
import { expenses } from "../../modules/expense/schema.js";
import { messages } from "../../modules/message/schema.js";
import { users, apiKeys, linkedAccounts } from "../../modules/user/schema.js";

export const relations = defineRelations(
  { users, apiKeys, linkedAccounts, categories, messages, expenses },
  (h) => ({
    users: {
      apiKeys: h.many.apiKeys(),
      linkedAccounts: h.many.linkedAccounts(),
      messages: h.many.messages(),
      expenses: h.many.expenses(),
    },
    apiKeys: {
      user: h.one.users(),
    },
    linkedAccounts: {
      user: h.one.users(),
    },
    messages: {
      user: h.one.users(),
      linkedAccount: h.one.linkedAccounts({
        from: h.messages.linkedAccountId,
        to: h.linkedAccounts.id,
      }),
      expenses: h.many.expenses(),
    },
    expenses: {
      user: h.one.users(),
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
