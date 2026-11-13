import { initChangePassword } from "./change-password";
import type { AuthUseCase } from "./interface";
import { initLogin } from "./login";
import { initLogout } from "./logout";
import { initLogoutAll } from "./logout-all";
import { initRefreshSession } from "./refresh-session";
import { initRegister } from "./register";
import type { AuthService } from "@/modules/auth/service/interface";
import type { SessionService } from "@/modules/session/service/interface";
import type { Db } from "@/pkg/db";

interface InitAuthUseCase {
  db: Db;
  authService: AuthService;
  sessionService: SessionService;
}

export function initAuthUseCase({ db, authService, sessionService }: InitAuthUseCase): AuthUseCase {
  return {
    register: initRegister({ db, authService, sessionService }),
    login: initLogin({ db, authService, sessionService }),
    refreshSession: initRefreshSession({ db, authService, sessionService }),
    changePassword: initChangePassword({ db, authService, sessionService }),
    logoutAll: initLogoutAll({ db, authService, sessionService }),
    logout: initLogout({ db, sessionService }),
  };
}
