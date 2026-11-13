import type { LogoutAllInput, LogoutAllOutput } from "./dto";
import type { AuthService } from "@/modules/auth/service/interface";
import type { SessionService } from "@/modules/session/service/interface";
import type { Db } from "@/pkg/db";

interface InitLogoutAllDeps {
  db: Db;
  authService: AuthService;
  sessionService: SessionService;
}

export function initLogoutAll({ db, authService, sessionService }: InitLogoutAllDeps) {
  return async function logoutAll(
    userId: LogoutAllInput["userId"],
    currentPassword: LogoutAllInput["currentPassword"]
  ): Promise<LogoutAllOutput> {
    await db.transaction(async (tx) => {
      await authService.verifyCurrentPassword(userId, currentPassword, tx);
      await sessionService.revokeAllSessions(userId, tx);
    });
  };
}
