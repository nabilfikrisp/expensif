import type {
  ChangePasswordInput,
  ChangePasswordOutput,
  LoginInput,
  LoginOutput,
  LogoutAllInput,
  LogoutAllOutput,
  LogoutInput,
  LogoutOutput,
  RefreshSessionInput,
  RefreshSessionOutput,
  RegisterInput,
  RegisterOutput,
} from "./dto";

export interface AuthUseCase {
  register(
    email: RegisterInput["email"],
    password: RegisterInput["password"],
    name: RegisterInput["name"]
  ): Promise<RegisterOutput>;
  login(email: LoginInput["email"], password: LoginInput["password"]): Promise<LoginOutput>;
  refreshSession(token: RefreshSessionInput["token"]): Promise<RefreshSessionOutput>;
  changePassword(
    userId: ChangePasswordInput["userId"],
    currentPassword: ChangePasswordInput["currentPassword"],
    newPassword: ChangePasswordInput["newPassword"]
  ): Promise<ChangePasswordOutput>;
  logoutAll(
    userId: LogoutAllInput["userId"],
    currentPassword: LogoutAllInput["currentPassword"]
  ): Promise<LogoutAllOutput>;
  logout(token: LogoutInput["token"]): Promise<LogoutOutput>;
}
