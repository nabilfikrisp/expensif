import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "@/modules/user/schema";

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    keyHash: text("key_hash").notNull(),
    keyHint: text("key_hint").notNull(),
    label: text("label"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
  },
  (t) => [index("api_keys_key_hash_idx").on(t.keyHash)]
);
