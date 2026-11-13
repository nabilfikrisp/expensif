import { or, sql } from "drizzle-orm";
import type { CleanupExpiredSessionsOutput } from "./dto";
import { sessions } from "@/modules/session/schema";
import type { Db } from "@/pkg/db";
import type { EnvSchema } from "@/pkg/env";

interface InitCleanupExpiredSessionsDeps {
  db: Db;
  env: Pick<EnvSchema, "SESSION_IDLE_SECONDS">;
}

export function initCleanupExpiredSessions({ db, env }: InitCleanupExpiredSessionsDeps) {
  return async function cleanupExpiredSessions(): Promise<CleanupExpiredSessionsOutput> {
    await db
      .delete(sessions)
      .where(
        or(
          sql`${sessions.absoluteExpiresAt} <= clock_timestamp()`,
          sql`${sessions.lastUsedAt} + make_interval(secs => ${env.SESSION_IDLE_SECONDS}::integer) <= clock_timestamp()`
        )
      );
  };
}
