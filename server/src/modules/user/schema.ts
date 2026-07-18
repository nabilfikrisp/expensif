import { index, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    keyHash: text("key_hash").notNull(),
    label: text("label"),
    createdAt: text("created_at").notNull(),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
  },
  (t) => [index("api_keys_key_hash_idx").on(t.keyHash)]
);

export const linkedAccounts = sqliteTable(
  "linked_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    platform: text("platform").notNull(),
    platformUserId: text("platform_user_id").notNull(),
    platformUsername: text("platform_username"),
    linkedAt: text("linked_at").notNull(),
  },
  (t) => [unique("linked_accounts_platform_user_unique").on(t.platform, t.platformUserId)]
);
