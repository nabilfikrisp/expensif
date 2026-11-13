import { and, eq, isNull, sql } from "drizzle-orm";
import type { RevokeSessionInput, RevokeSessionOutput } from "./dto";
import { sessions } from "@/modules/session/schema";
import type { Tx } from "@/pkg/db";

export function initRevokeSession() {
  return async function revokeSession(
    sessionId: RevokeSessionInput["sessionId"],
    tx: Tx
  ): Promise<RevokeSessionOutput> {
    await tx
      .update(sessions)
      .set({
        revokedAt: sql`clock_timestamp()`,
      })
      .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
  };
}
