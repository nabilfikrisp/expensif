import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { FindValidSessionInput, FindValidSessionOutput } from "./dto";
import { sessions } from "@/modules/session/schema";
import type { Tx } from "@/pkg/db";
import type { EnvSchema } from "@/pkg/env";

interface InitFindValidSessionDeps {
  env: Pick<EnvSchema, "SESSION_IDLE_SECONDS">;
  hashRefreshToken: (token: string) => string;
  refreshGraceSeconds: number;
}

export function initFindValidSession({
  env,
  hashRefreshToken,
  refreshGraceSeconds,
}: InitFindValidSessionDeps) {
  return async function findValidSession(
    token: FindValidSessionInput["token"],
    tx: Tx
  ): Promise<FindValidSessionOutput> {
    const tokenHash = hashRefreshToken(token);
    const lockedSession = (
      await tx
        .select({ id: sessions.id })
        .from(sessions)
        .where(or(eq(sessions.tokenHash, tokenHash), eq(sessions.prevTokenHash, tokenHash)))
        .for("update")
    ).at(0);

    if (!lockedSession) {
      return null;
    }

    const result = (
      await tx
        .select({
          session: sessions,
          withinGrace: sql<boolean>`COALESCE(clock_timestamp() < ${sessions.rotatedAt} + make_interval(secs => ${refreshGraceSeconds}::integer), false)`,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.id, lockedSession.id),
            isNull(sessions.revokedAt),
            sql`clock_timestamp() < ${sessions.lastUsedAt} + make_interval(secs => ${env.SESSION_IDLE_SECONDS}::integer)`,
            sql`clock_timestamp() < ${sessions.absoluteExpiresAt}`
          )
        )
    ).at(0);

    if (!result) {
      return null;
    }

    const { session, withinGrace } = result;

    let matchedToken: "current" | "previousWithinGrace" | "previousOutsideGrace" = "current";
    if (session.tokenHash !== tokenHash && session.prevTokenHash !== tokenHash) {
      return null;
    }
    if (session.tokenHash !== tokenHash && withinGrace) {
      matchedToken = "previousWithinGrace";
    }
    if (session.tokenHash !== tokenHash && !withinGrace) {
      matchedToken = "previousOutsideGrace";
    }

    return {
      session,
      matchedToken,
    };
  };
}
