import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { linkedAccounts } from "@/modules/linked-account/schema";
import { users } from "@/modules/user/schema";

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    linkedAccountId: text("linked_account_id").references(() => linkedAccounts.id, {
      onDelete: "set null",
    }),
    rawText: text("raw_text").notNull(),
    platform: text("platform").notNull(),
    externalConversationId: text("external_conversation_id"),
    externalMessageId: text("external_message_id"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    parseStatus: text("parse_status").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("messages_user_id_idx").on(t.userId),
    index("messages_linked_account_id_idx").on(t.linkedAccountId),
  ]
);
