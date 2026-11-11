import { AuthError } from "@/modules/auth/error";
import type { AuthService } from "@/modules/auth/service";
import type { SessionService } from "@/modules/session/service";
import type { Db } from "@/pkg/db";

export interface InitAuthUseCase {
  db: Db;
  authService: AuthService;
  sessionService: SessionService;
}

export function initAuthUseCase({ db, authService, sessionService }: InitAuthUseCase) {
  return {
    async register(email: string, password: string, name: string) {
      const result = await db.transaction(async (tx) => {
        const { userId } = await authService.register(email, password, name, tx);
        const session = await sessionService.createSession(userId, tx);
        return { userId, ...session };
      });
      const accessToken = await authService.issueAccessToken(result.userId);
      return { accessToken, refreshToken: result.refreshToken, expiresAt: result.expiresAt };
    },

    async login(email: string, password: string) {
      const result = await db.transaction(async (tx) => {
        const { userId } = await authService.login(email, password, tx);
        const session = await sessionService.createSession(userId, tx);
        return { userId, ...session };
      });
      const accessToken = await authService.issueAccessToken(result.userId);
      return { accessToken, refreshToken: result.refreshToken, expiresAt: result.expiresAt };
    },

    async refreshSession(token: string) {
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
    },

    async changePassword(userId: string, currentPassword: string, newPassword: string) {
      await db.transaction(async (tx) => {
        await authService.changePassword(userId, currentPassword, newPassword, tx);
        await sessionService.revokeAllSessions(userId, tx);
      });
    },

    async logoutAll(userId: string, currentPassword: string) {
      await db.transaction(async (tx) => {
        await authService.verifyCurrentPassword(userId, currentPassword, tx);
        await sessionService.revokeAllSessions(userId, tx);
      });
    },

    async logout(token: string | undefined) {
      if (!token) {
        return;
      }
      await db.transaction(async (tx) => {
        const session = await sessionService.findSessionForRevocation(token, tx);
        if (session) {
          await sessionService.revokeSession(session.id, tx);
        }
        // Unknown tokens cannot identify a session and may be logged out successfully.
      });
    },
  };
}

export type AuthUseCase = ReturnType<typeof initAuthUseCase>;
