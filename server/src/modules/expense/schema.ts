import { sql } from "drizzle-orm";
import { check, date, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { categories } from "@/modules/category/schema";
import { messages } from "@/modules/message/schema";
import { users } from "@/modules/user/schema";

export const expenses = pgTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id").references(() => messages.id, { onDelete: "set null" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    itemName: text("item_name").notNull(),
    amount: numeric("amount").notNull(),
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
    check(
      "expenses_amount_positive_finite_whole",
      sql`${t.amount} > 0 AND ${t.amount} < 'Infinity'::numeric AND ${t.amount} = trunc(${t.amount})`
    ),
    check("expenses_currency_idr", sql`${t.currency} = 'IDR'`),
    index("expenses_user_id_date_idx").on(t.userId, t.expenseDate),
    index("expenses_message_id_idx").on(t.messageId),
    index("expenses_category_id_idx").on(t.categoryId),
  ]
);
