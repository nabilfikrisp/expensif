import type { RefreshSessionInput, RefreshSessionOutput } from "./dto";
import { AuthError } from "@/modules/auth/error";
import type { AuthService } from "@/modules/auth/service/interface";
import type { SessionService } from "@/modules/session/service/interface";
import type { Db } from "@/pkg/db";

interface InitRefreshSessionDeps {
  db: Db;
  authService: AuthService;
  sessionService: SessionService;
}

export function initRefreshSession({ db, authService, sessionService }: InitRefreshSessionDeps) {
  return async function refreshSession(
    token: RefreshSessionInput["token"]
  ): Promise<RefreshSessionOutput> {
    const result = await db.transaction(async (tx) => {
      const found = await sessionService.findValidSession(token, tx);
      if (!found) {
        return null;
      }
      const { session, matchedToken } = found;
      if (matchedToken === "previousOutsideGrace") {
        await sessionService.revokeSession(session.id, tx);
        // Commit revocation before reporting an authentication failure.
        return null;
      }
      if (matchedToken === "current") {
        const rotated = await sessionService.rotateSessionToken(session.id, tx);
        if (!rotated) {
          return null;
        }
        return {
          userId: session.userId,
          refresh: { token: rotated.newRefreshToken, expiresAt: rotated.expiresAt },
        };
      }

      const accepted = await sessionService.acceptPreviousSessionToken(session.id, tx);
      if (!accepted) {
        // Grace can end between classification and acceptance while we hold the lock.
        const rechecked = await sessionService.findValidSession(token, tx);
        if (rechecked?.matchedToken === "previousOutsideGrace") {
          await sessionService.revokeSession(session.id, tx);
        }
        return null;
      }
      return { userId: session.userId, refresh: null };
    });

    if (!result) {
      throw AuthError.invalidToken();
    }
    const accessToken = await authService.issueAccessToken(result.userId);
    return { accessToken, refresh: result.refresh };
  };
}
