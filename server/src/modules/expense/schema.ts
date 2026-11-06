import { date, index, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { categories } from "@/modules/category/schema";
import { messages } from "@/modules/message/schema";
import { users } from "@/modules/user/schema";

export const expenses = pgTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id").references(() => messages.id, { onDelete: "set null" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    itemName: text("item_name").notNull(),
    // Exact decimal strings: 18 integer digits and 2 fractional digits. PostgreSQL rounds excess scale.
    amount: numeric("amount", { precision: 20, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("IDR"),
    expenseDate: date("expense_date", { mode: "string" }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("expenses_user_id_date_idx").on(t.userId, t.expenseDate),
    index("expenses_message_id_idx").on(t.messageId),
    index("expenses_category_id_idx").on(t.categoryId),
  ]
);
