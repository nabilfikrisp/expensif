import { and, eq, isNull, or, sql } from "drizzle-orm";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { sessions } from "@/modules/session/schema";
import type { Db, DbTx, Tx } from "@/pkg/db";
import type { EnvSchema } from "@/pkg/env";

const REFRESH_GRACE_SECONDS = 30;

export function initSessionService(env: EnvSchema, db: Db) {
  return {
    async cleanupExpiredSessions() {
      await db
        .delete(sessions)
        .where(
          or(
            sql`${sessions.absoluteExpiresAt} <= clock_timestamp()`,
            sql`${sessions.lastUsedAt} + make_interval(secs => ${env.SESSION_IDLE_SECONDS}::integer) <= clock_timestamp()`
          )
        );
    },
    async createSession(userId: string, ctx: DbTx = db) {
      const refreshToken = randomBytes(32).toString("base64url");
      const tokenHash = hashRefreshToken(refreshToken);

      const [created] = await ctx
        .insert(sessions)
        .values({
          id: randomUUID(),
          userId,
          tokenHash,
          lastUsedAt: sql`clock_timestamp()`,
          absoluteExpiresAt: sql`clock_timestamp() + make_interval(secs => ${env.SESSION_ABSOLUTE_SECONDS}::integer)`,
        })
        .returning({ expiresAt: sessionExpiresAt(env) });

      return { refreshToken, expiresAt: created.expiresAt };
    },

    async findValidSession(token: string, tx: Tx) {
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
            withinGrace: sql<boolean>`COALESCE(clock_timestamp() < ${sessions.rotatedAt} + make_interval(secs => ${REFRESH_GRACE_SECONDS}::integer), false)`,
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
    },

    async rotateSessionToken(sessionId: string, tx: Tx) {
      const newRefreshToken = randomBytes(32).toString("base64url");
      const newTokenHash = hashRefreshToken(newRefreshToken);

      const result = (
        await tx
          .update(sessions)
          .set({
            tokenHash: newTokenHash,
            prevTokenHash: sql`${sessions.tokenHash}`,
            rotatedAt: sql`clock_timestamp()`,
            lastUsedAt: sql`clock_timestamp()`,
          })
          .where(
            and(
              eq(sessions.id, sessionId),
              isNull(sessions.revokedAt),
              sql`clock_timestamp() < ${sessions.absoluteExpiresAt}`,
              sql`clock_timestamp() < ${sessions.lastUsedAt} + make_interval(secs => ${env.SESSION_IDLE_SECONDS}::integer)`
            )
          )
          .returning({ id: sessions.id, expiresAt: sessionExpiresAt(env) })
      ).at(0);

      if (!result) {
        return null;
      }

      return { newRefreshToken, expiresAt: result.expiresAt };
    },
    async acceptPreviousSessionToken(sessionId: string, tx: Tx) {
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
              sql`clock_timestamp() < ${sessions.rotatedAt} + make_interval(secs => ${REFRESH_GRACE_SECONDS}::integer)`
            )
          )
          .returning({ id: sessions.id })
      ).at(0);

      if (!result) {
        return null;
      }

      return result;
    },
    async findSessionForRevocation(token: string, tx: Tx) {
      const tokenHash = hashRefreshToken(token);
      return (
        (
          await tx
            .select({ id: sessions.id })
            .from(sessions)
            .where(or(eq(sessions.tokenHash, tokenHash), eq(sessions.prevTokenHash, tokenHash)))
            .for("update")
        ).at(0) ?? null
      );
    },
    async revokeAllSessions(userId: string, tx: Tx) {
      await tx
        .update(sessions)
        .set({ revokedAt: sql`clock_timestamp()` })
        .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
    },
    async revokeSession(sessionId: string, tx: Tx) {
      await tx
        .update(sessions)
        .set({
          revokedAt: sql`clock_timestamp()`,
        })
        .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
    },
  };
}

function sessionExpiresAt(env: EnvSchema) {
  return sql<string>`LEAST(${sessions.absoluteExpiresAt}, ${sessions.lastUsedAt} + make_interval(secs => ${env.SESSION_IDLE_SECONDS}::integer))::text`;
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionService = ReturnType<typeof initSessionService>;
