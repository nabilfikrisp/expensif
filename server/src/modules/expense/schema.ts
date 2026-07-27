import { index, numeric, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { categories } from "@/modules/category/schema";
import { messages } from "@/modules/message/schema";
import { users } from "@/modules/user/schema";

export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id").references(() => messages.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    categoryId: text("category_id").references(() => categories.id),
    itemName: text("item_name").notNull(),
    amount: numeric("amount").notNull(),
    currency: text("currency").notNull().default("IDR"),
    expenseDate: text("expense_date").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("expenses_user_id_date_idx").on(t.userId, t.expenseDate),
    index("expenses_message_id_idx").on(t.messageId),
  ]
);
