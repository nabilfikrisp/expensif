import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import type { CreateSessionInput, CreateSessionOutput } from "./dto";
import { sessions } from "@/modules/session/schema";
import type { Db, DbTx } from "@/pkg/db";
import type { EnvSchema } from "@/pkg/env";

interface InitCreateSessionDeps {
  db: Db;
  env: Pick<EnvSchema, "SESSION_ABSOLUTE_SECONDS">;
  hashRefreshToken: (token: string) => string;
  sessionExpiresAt: () => SQL<string>;
}

export function initCreateSession({
  db,
  env,
  hashRefreshToken,
  sessionExpiresAt,
}: InitCreateSessionDeps) {
  return async function createSession(
    userId: CreateSessionInput["userId"],
    ctx: DbTx = db
  ): Promise<CreateSessionOutput> {
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
      .returning({ expiresAt: sessionExpiresAt() });

    return { refreshToken, expiresAt: created.expiresAt };
  };
}
