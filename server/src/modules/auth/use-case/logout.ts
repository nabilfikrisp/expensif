import type { LogoutInput, LogoutOutput } from "./dto";
import type { SessionService } from "@/modules/session/service/interface";
import type { Db } from "@/pkg/db";

interface InitLogoutDeps {
  db: Db;
  sessionService: SessionService;
}

export function initLogout({ db, sessionService }: InitLogoutDeps) {
  return async function logout(token: LogoutInput["token"]): Promise<LogoutOutput> {
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
  };
}
