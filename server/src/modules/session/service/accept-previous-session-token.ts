import { and, eq, isNull, sql } from "drizzle-orm";
import type { AcceptPreviousSessionTokenInput, AcceptPreviousSessionTokenOutput } from "./dto";
import { sessions } from "@/modules/session/schema";
import type { Tx } from "@/pkg/db";
import type { EnvSchema } from "@/pkg/env";

interface InitAcceptPreviousSessionTokenDeps {
  env: Pick<EnvSchema, "SESSION_IDLE_SECONDS">;
  refreshGraceSeconds: number;
}

export function initAcceptPreviousSessionToken({
  env,
  refreshGraceSeconds,
}: InitAcceptPreviousSessionTokenDeps) {
  return async function acceptPreviousSessionToken(
    sessionId: AcceptPreviousSessionTokenInput["sessionId"],
    tx: Tx
  ): Promise<AcceptPreviousSessionTokenOutput> {
    const result = (
      await tx
        .update(sessions)
        .set({
          lastUsedAt: sql`clock_timestamp()`,
        })
        .where(
          and(
            eq(sessions.id, sessionId),
            isNull(sessions.revokedAt),
            sql`clock_timestamp() < ${sessions.absoluteExpiresAt}`,
            sql`clock_timestamp() < ${sessions.lastUsedAt} + make_interval(secs => ${env.SESSION_IDLE_SECONDS}::integer)`,
            sql`clock_timestamp() < ${sessions.rotatedAt} + make_interval(secs => ${refreshGraceSeconds}::integer)`
          )
        )
        .returning({ id: sessions.id })
    ).at(0);

    if (!result) {
      return null;
    }

    return result;
  };
}
