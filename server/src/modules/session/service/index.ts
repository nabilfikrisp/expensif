import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { initAcceptPreviousSessionToken } from "./accept-previous-session-token";
import { initCleanupExpiredSessions } from "./cleanup-expired-sessions";
import { initCreateSession } from "./create-session";
import { initFindSessionForRevocation } from "./find-session-for-revocation";
import { initFindValidSession } from "./find-valid-session";
import type { SessionService } from "./interface";
import { initRevokeAllSessions } from "./revoke-all-sessions";
import { initRevokeSession } from "./revoke-session";
import { initRotateSessionToken } from "./rotate-session-token";
import { sessions } from "@/modules/session/schema";
import type { Db } from "@/pkg/db";
import type { EnvSchema } from "@/pkg/env";

interface InitSessionServiceDeps {
  env: EnvSchema;
  db: Db;
}

export function initSessionService({ env, db }: InitSessionServiceDeps): SessionService {
  const refreshGraceSeconds = 30;
  const hashRefreshToken = (token: string): string =>
    createHash("sha256").update(token).digest("hex");
  const sessionExpiresAt = () =>
    sql<string>`LEAST(${sessions.absoluteExpiresAt}, ${sessions.lastUsedAt} + make_interval(secs => ${env.SESSION_IDLE_SECONDS}::integer))::text`;

  return {
    cleanupExpiredSessions: initCleanupExpiredSessions({ db, env }),
    createSession: initCreateSession({ db, env, hashRefreshToken, sessionExpiresAt }),
    findValidSession: initFindValidSession({ env, hashRefreshToken, refreshGraceSeconds }),
    rotateSessionToken: initRotateSessionToken({ env, hashRefreshToken, sessionExpiresAt }),
    acceptPreviousSessionToken: initAcceptPreviousSessionToken({ env, refreshGraceSeconds }),
    findSessionForRevocation: initFindSessionForRevocation({ hashRefreshToken }),
    revokeAllSessions: initRevokeAllSessions(),
    revokeSession: initRevokeSession(),
  };
}
