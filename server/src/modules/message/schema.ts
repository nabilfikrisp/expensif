import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { linkedAccounts } from "@/modules/linked-account/schema";
import { users } from "@/modules/user/schema";

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    linkedAccountId: text("linked_account_id").references(() => linkedAccounts.id, {
      onDelete: "set null",
    }),
    rawText: text("raw_text").notNull(),
    externalMessageId: text("external_message_id").unique(),
    parseStatus: text("parse_status").notNull(),
    receivedAt: text("received_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("messages_user_id_idx").on(t.userId),
    index("messages_linked_account_id_idx").on(t.linkedAccountId),
  ]
);
