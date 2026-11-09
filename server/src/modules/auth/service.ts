import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import { createHash, createHmac } from "node:crypto";

import { AuthError, isTokenVerificationError } from "@/modules/auth/error";
import { users } from "@/modules/user/schema";
import type { Db } from "@/pkg/db";
import { isUniqueConstraintError } from "@/pkg/db/error";
import type { EnvSchema } from "@/pkg/env";

export function initAuthService(env: EnvSchema, db: Db) {
  return {
    encodeSecret(raw: string, type: TokenType = "access"): Uint8Array {
      return createHmac("sha256", raw).update(type).digest();
    },
    async verifyToken(token: string, secret: Uint8Array): Promise<JWTPayload> {
      const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
      return payload;
    },
    async register(email: string, password: string, name: string) {
      const id = crypto.randomUUID();
      const passwordHash = await hashPassword(password);

      try {
        await db.insert(users).values({ id, email, passwordHash, name });
      } catch (err: unknown) {
        if (isUniqueConstraintError(err)) {
          throw AuthError.emailAlreadyRegistered();
        }
        throw err;
      }

      const accessSecret = this.encodeSecret(env.JWT_SECRET, "access");
      const refreshSecret = this.encodeSecret(env.JWT_SECRET, "refresh");

      const accessToken = await signToken(
        { sub: id },
        accessSecret,
        env.ACCESS_TOKEN_EXPIRES_IN_MINUTES
      );
      const refreshToken = await signToken(
        { sub: id, type: "refresh" },
        refreshSecret,
        env.REFRESH_TOKEN_EXPIRES_IN_DAYS
      );

      const csrfToken = crypto.randomUUID();

      return { accessToken, refreshToken, csrfToken };
    },
    async login(email: string, password: string) {
      const user = (await db.select().from(users).where(eq(users.email, email)).limit(1)).at(0);

      if (!user) {
        throw AuthError.invalidCredentials();
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        throw AuthError.invalidCredentials();
      }

      const accessSecret = this.encodeSecret(env.JWT_SECRET, "access");
      const refreshSecret = this.encodeSecret(env.JWT_SECRET, "refresh");

      const accessToken = await signToken(
        { sub: user.id },
        accessSecret,
        env.ACCESS_TOKEN_EXPIRES_IN_MINUTES
      );
      const refreshToken = await signToken(
        { sub: user.id, type: "refresh" },
        refreshSecret,
        env.REFRESH_TOKEN_EXPIRES_IN_DAYS
      );

      const csrfToken = crypto.randomUUID();

      return { accessToken, refreshToken, csrfToken };
    },
    async refresh(token: string) {
      const refreshSecret = this.encodeSecret(env.JWT_SECRET, "refresh");
      let payload: JWTPayload;
      try {
        payload = await this.verifyToken(token, refreshSecret);
      } catch (error) {
        if (isTokenVerificationError(error)) {
          throw AuthError.invalidToken();
        }
        throw error;
      }
      if (payload.type !== "refresh") {
        throw AuthError.invalidToken();
      }
      if (payload.sub === undefined) {
        throw AuthError.invalidToken();
      }

      const userId = payload.sub;
      const accessSecret = this.encodeSecret(env.JWT_SECRET, "access");

      const accessToken = await signToken(
        { sub: userId },
        accessSecret,
        env.ACCESS_TOKEN_EXPIRES_IN_MINUTES
      );
      const newRefreshToken = await signToken(
        { sub: userId, type: "refresh" },
        refreshSecret,
        env.REFRESH_TOKEN_EXPIRES_IN_DAYS
      );

      const csrfToken = crypto.randomUUID();

      return { accessToken, refreshToken: newRefreshToken, csrfToken };
    },
  };
}

type TokenType = "access" | "refresh";

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;
const COST = 12;

const prehash = (plain: string): string =>
  createHash("sha256").update(plain.normalize("NFKC"), "utf8").digest("base64");

export async function hashPassword(plain: string): Promise<string> {
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

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain.isWellFormed() || plain.length > MAX_LENGTH) {
    return false;
  }
  return await bcrypt.compare(prehash(plain), hash);
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

export type AuthService = ReturnType<typeof initAuthService>;
