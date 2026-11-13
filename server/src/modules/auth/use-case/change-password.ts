import type { ChangePasswordInput, ChangePasswordOutput } from "./dto";
import type { AuthService } from "@/modules/auth/service/interface";
import type { SessionService } from "@/modules/session/service/interface";
import type { Db } from "@/pkg/db";

interface InitChangePasswordDeps {
  db: Db;
  authService: AuthService;
  sessionService: SessionService;
}

export function initChangePassword({ db, authService, sessionService }: InitChangePasswordDeps) {
  return async function changePassword(
    userId: ChangePasswordInput["userId"],
    currentPassword: ChangePasswordInput["currentPassword"],
    newPassword: ChangePasswordInput["newPassword"]
  ): Promise<ChangePasswordOutput> {
    await db.transaction(async (tx) => {
      await authService.changePassword(userId, currentPassword, newPassword, tx);
      await sessionService.revokeAllSessions(userId, tx);
    });
  };
}
