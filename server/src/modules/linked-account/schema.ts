import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "@/modules/user/schema";

export const linkedAccounts = pgTable(
  "linked_accounts",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    platformUserId: text("platform_user_id").notNull(),
    platformUsername: text("platform_username"),
    idempotencyKey: text("idempotency_key"),
    linkedAt: timestamp("linked_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [
    index("linked_accounts_user_id_idx").on(t.userId),
    unique("linked_accounts_platform_user_unique").on(t.platform, t.platformUserId),
    unique("linked_accounts_idempotency_key_unique").on(t.idempotencyKey),
  ]
);
