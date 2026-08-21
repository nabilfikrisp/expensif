import { sql } from "drizzle-orm";
import { index, numeric, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { categories } from "@/modules/category/schema";
import { messages } from "@/modules/message/schema";
import { users } from "@/modules/user/schema";

export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id").references(() => messages.id, { onDelete: "set null" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    itemName: text("item_name").notNull(),
    amount: numeric("amount").notNull(),
    currency: text("currency").notNull().default("IDR"),
    expenseDate: text("expense_date").notNull(),
    note: text("note"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("expenses_user_id_date_idx").on(t.userId, t.expenseDate),
    index("expenses_message_id_idx").on(t.messageId),
    index("expenses_category_id_idx").on(t.categoryId),
  ]
);
