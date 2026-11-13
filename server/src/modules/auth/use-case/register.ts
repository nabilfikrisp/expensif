import type { RegisterInput, RegisterOutput } from "./dto";
import type { AuthService } from "@/modules/auth/service/interface";
import type { SessionService } from "@/modules/session/service/interface";
import type { Db } from "@/pkg/db";

interface InitRegisterDeps {
  db: Db;
  authService: AuthService;
  sessionService: SessionService;
}

export function initRegister({ db, authService, sessionService }: InitRegisterDeps) {
  return async function register(
    email: RegisterInput["email"],
    password: RegisterInput["password"],
    name: RegisterInput["name"]
  ): Promise<RegisterOutput> {
    const result = await db.transaction(async (tx) => {
      const { userId } = await authService.register(email, password, name, tx);
      const session = await sessionService.createSession(userId, tx);
      return { userId, ...session };
    });
    const accessToken = await authService.issueAccessToken(result.userId);
    return { accessToken, refreshToken: result.refreshToken, expiresAt: result.expiresAt };
  };
}
