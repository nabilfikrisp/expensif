import type {
  ChangePasswordInput,
  ChangePasswordOutput,
  EncodeSecretInput,
  EncodeSecretOutput,
  IssueAccessTokenInput,
  IssueAccessTokenOutput,
  LoginInput,
  LoginOutput,
  RegisterInput,
  RegisterOutput,
  VerifyCurrentPasswordInput,
  VerifyCurrentPasswordOutput,
  VerifyTokenInput,
  VerifyTokenOutput,
} from "./dto";
import type { DbTx, Tx } from "@/pkg/db";

export interface AuthService {
  encodeSecret(raw: EncodeSecretInput["raw"], type?: EncodeSecretInput["type"]): EncodeSecretOutput;
  verifyToken(
    token: VerifyTokenInput["token"],
    secret: VerifyTokenInput["secret"]
  ): Promise<VerifyTokenOutput>;
  register(
    email: RegisterInput["email"],
    password: RegisterInput["password"],
    name: RegisterInput["name"],
    tx?: DbTx
  ): Promise<RegisterOutput>;
  login(email: LoginInput["email"], password: LoginInput["password"], tx: Tx): Promise<LoginOutput>;
  verifyCurrentPassword(
    userId: VerifyCurrentPasswordInput["userId"],
    currentPassword: VerifyCurrentPasswordInput["currentPassword"],
    tx: Tx
  ): Promise<VerifyCurrentPasswordOutput>;
  changePassword(
    userId: ChangePasswordInput["userId"],
    currentPassword: ChangePasswordInput["currentPassword"],
    newPassword: ChangePasswordInput["newPassword"],
    tx: Tx
  ): Promise<ChangePasswordOutput>;
  issueAccessToken(userId: IssueAccessTokenInput["userId"]): Promise<IssueAccessTokenOutput>;
}
