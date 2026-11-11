import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/modules/user/schema";

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    prevTokenHash: text("prev_token_hash"),
    rotatedAt: timestamp("rotated_at", { withTimezone: true, mode: "string" }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    absoluteExpiresAt: timestamp("absolute_expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)]
);
