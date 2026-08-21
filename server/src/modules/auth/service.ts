import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "jose";

import { AuthError } from "@/modules/auth/error";
import { users } from "@/modules/user/schema";
import type { Db } from "@/pkg/db";
import { isUniqueConstraintError } from "@/pkg/db/error";
import type { EnvSchema } from "@/pkg/env";

export function initAuthService(env: EnvSchema, db: Db) {
  return {
    encodeSecret(raw: string, type: TokenType = "access"): Uint8Array {
      const key = type === "refresh" ? raw + ":refresh" : raw;
      return new TextEncoder().encode(key);
    },
    async verifyToken(token: string, secret: Uint8Array): Promise<JWTPayload> {
      const { payload } = await jwtVerify(token, secret);
      return payload;
    },
    async register(email: string, password: string, name: string) {
      const id = crypto.randomUUID();
      const passwordHash = await hashPassword(password);

      try {
        await db.insert(users).values({ id, email, passwordHash, name }).run();
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

      return { accessToken, refreshToken };
    },
    async login(email: string, password: string) {
      const user = await db.select().from(users).where(eq(users.email, email)).get();

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

      return { accessToken, refreshToken };
    },
    async refresh(token: string) {
      const refreshSecret = this.encodeSecret(env.JWT_SECRET, "refresh");
      let payload: JWTPayload;
      try {
        payload = await this.verifyToken(token, refreshSecret);
      } catch {
        throw AuthError.invalidToken();
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

      return { accessToken, refreshToken: newRefreshToken };
    },
    async getUser(userId: string) {
      const user = await db.select().from(users).where(eq(users.id, userId)).get();

      if (!user) {
        throw AuthError.userNotFound();
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
      };
    },
  };
}

type TokenType = "access" | "refresh";

async function hashPassword(plain: string): Promise<string> {
  return await bcrypt.hash(plain, 10);
}

async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(plain, hash);
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
