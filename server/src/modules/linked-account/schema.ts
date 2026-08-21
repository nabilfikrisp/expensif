import { sql } from "drizzle-orm";
import { index, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { users } from "@/modules/user/schema";

export const linkedAccounts = sqliteTable(
  "linked_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    platformUserId: text("platform_user_id").notNull(),
    platformUsername: text("platform_username"),
    linkedAt: text("linked_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("linked_accounts_user_id_idx").on(t.userId),
    unique("linked_accounts_platform_user_unique").on(t.platform, t.platformUserId),
  ]
);
