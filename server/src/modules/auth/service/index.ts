import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import { createHash, createHmac } from "node:crypto";
import { initChangePassword } from "./change-password";
import type {
  EncodeSecretInput,
  EncodeSecretOutput,
  IssueAccessTokenInput,
  IssueAccessTokenOutput,
  VerifyTokenInput,
  VerifyTokenOutput,
} from "./dto";
import type { AuthService } from "./interface";
import { initLogin } from "./login";
import { initRegister } from "./register";
import { initVerifyCurrentPassword } from "./verify-current-password";
import { AuthError } from "@/modules/auth/error";
import type { Db } from "@/pkg/db";
import type { EnvSchema } from "@/pkg/env";

interface InitAuthServiceDeps {
  env: EnvSchema;
  db: Db;
}

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;
const COST = 12;

const prehash = (plain: string): string =>
  createHash("sha256").update(plain.normalize("NFKC"), "utf8").digest("base64");

async function hashPassword(plain: string): Promise<string> {
  if (!plain.isWellFormed()) {
    throw AuthError.invalidPasswordUnicode();
  }
  if (plain.length < MIN_LENGTH) {
    throw AuthError.invalidPasswordMinLength(MIN_LENGTH);
  }
  if (plain.length > MAX_LENGTH) {
    throw AuthError.invalidPasswordMaxLength(MAX_LENGTH);
  }
  return await bcrypt.hash(prehash(plain), COST);
}

async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain.isWellFormed() || plain.length > MAX_LENGTH) {
    return false;
  }
  return await bcrypt.compare(prehash(plain), hash);
}

function encodeSecret(
  raw: EncodeSecretInput["raw"],
  type: EncodeSecretInput["type"] = "access"
): EncodeSecretOutput {
  return createHmac("sha256", raw).update(type).digest();
}

async function verifyToken(
  token: VerifyTokenInput["token"],
  secret: VerifyTokenInput["secret"]
): Promise<VerifyTokenOutput> {
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  return payload;
}

async function signToken(
  payload: JWTPayload,
  secret: Uint8Array,
  expiresIn: string
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(secret);
}

export function initAuthService({ env, db }: InitAuthServiceDeps): AuthService {
  const verifyCurrentPassword = initVerifyCurrentPassword({ verifyPassword });

  async function issueAccessToken(
    userId: IssueAccessTokenInput["userId"]
  ): Promise<IssueAccessTokenOutput> {
    const secret = encodeSecret(env.JWT_SECRET, "access");

    return signToken({ sub: userId }, secret, env.ACCESS_TOKEN_EXPIRES_IN_MINUTES);
  }

  return {
    encodeSecret,
    verifyToken,
    register: initRegister({ db, hashPassword }),
    login: initLogin({ verifyPassword }),
    verifyCurrentPassword,
    changePassword: initChangePassword({ verifyCurrentPassword, hashPassword }),
    issueAccessToken,
  };
}
