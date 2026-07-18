import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users, linkedAccounts } from "../user/schema.js";

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    linkedAccountId: text("linked_account_id").references(() => linkedAccounts.id),
    rawText: text("raw_text").notNull(),
    externalMessageId: text("external_message_id"),
    parseStatus: text("parse_status").notNull(),
    receivedAt: text("received_at").notNull(),
  },
  (t) => [index("messages_user_id_idx").on(t.userId)]
);
