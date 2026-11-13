import type { LoginInput, LoginOutput } from "./dto";
import type { AuthService } from "@/modules/auth/service/interface";
import type { SessionService } from "@/modules/session/service/interface";
import type { Db } from "@/pkg/db";

interface InitLoginDeps {
  db: Db;
  authService: AuthService;
  sessionService: SessionService;
}

export function initLogin({ db, authService, sessionService }: InitLoginDeps) {
  return async function login(
    email: LoginInput["email"],
    password: LoginInput["password"]
  ): Promise<LoginOutput> {
    const result = await db.transaction(async (tx) => {
      const { userId } = await authService.login(email, password, tx);
      const session = await sessionService.createSession(userId, tx);
      return { userId, ...session };
    });
    const accessToken = await authService.issueAccessToken(result.userId);
    return { accessToken, refreshToken: result.refreshToken, expiresAt: result.expiresAt };
  };
}
