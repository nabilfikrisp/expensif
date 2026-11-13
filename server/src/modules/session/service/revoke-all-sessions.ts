import { and, eq, isNull, sql } from "drizzle-orm";
import type { RevokeAllSessionsInput, RevokeAllSessionsOutput } from "./dto";
import { sessions } from "@/modules/session/schema";
import type { Tx } from "@/pkg/db";

export function initRevokeAllSessions() {
  return async function revokeAllSessions(
    userId: RevokeAllSessionsInput["userId"],
    tx: Tx
  ): Promise<RevokeAllSessionsOutput> {
    await tx
      .update(sessions)
      .set({ revokedAt: sql`clock_timestamp()` })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  };
}
