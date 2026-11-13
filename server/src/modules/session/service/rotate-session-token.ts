import { and, eq, isNull, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { RotateSessionTokenInput, RotateSessionTokenOutput } from "./dto";
import { sessions } from "@/modules/session/schema";
import type { Tx } from "@/pkg/db";
import type { EnvSchema } from "@/pkg/env";

interface InitRotateSessionTokenDeps {
  env: Pick<EnvSchema, "SESSION_IDLE_SECONDS">;
  hashRefreshToken: (token: string) => string;
  sessionExpiresAt: () => SQL<string>;
}

export function initRotateSessionToken({
  env,
  hashRefreshToken,
  sessionExpiresAt,
}: InitRotateSessionTokenDeps) {
  return async function rotateSessionToken(
    sessionId: RotateSessionTokenInput["sessionId"],
    tx: Tx
  ): Promise<RotateSessionTokenOutput> {
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
        .returning({ id: sessions.id, expiresAt: sessionExpiresAt() })
    ).at(0);

    if (!result) {
      return null;
    }

    return { newRefreshToken, expiresAt: result.expiresAt };
  };
}
