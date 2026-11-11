import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import { createHash, createHmac } from "node:crypto";

import { AuthError } from "@/modules/auth/error";
import { users } from "@/modules/user/schema";
import type { Db, DbTx, Tx } from "@/pkg/db";
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
    async register(email: string, password: string, name: string, tx: DbTx = db) {
      const id = crypto.randomUUID();
      const passwordHash = await hashPassword(password);

      try {
        await tx.insert(users).values({ id, email, passwordHash, name });
      } catch (err: unknown) {
        if (isUniqueConstraintError(err)) {
          throw AuthError.emailAlreadyRegistered();
        }
        throw err;
      }

      return { userId: id };
    },
    async login(email: string, password: string, tx: Tx) {
      // Hold the user lock through session creation so password changes revoke racing logins.
      const user = (
        await tx.select().from(users).where(eq(users.email, email)).limit(1).for("share")
      ).at(0);
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        throw AuthError.invalidCredentials();
      }
      return { userId: user.id };
    },

    async verifyCurrentPassword(userId: string, currentPassword: string, tx: Tx) {
      // Serialize account-wide revocation with login and password changes.
      const user = (
        await tx
          .select({ passwordHash: users.passwordHash })
          .from(users)
          .where(eq(users.id, userId))
          .for("update")
      ).at(0);
      if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
        throw AuthError.invalidCredentials();
      }
    },

    async changePassword(userId: string, currentPassword: string, newPassword: string, tx: Tx) {
      await this.verifyCurrentPassword(userId, currentPassword, tx);
      const passwordHash = await hashPassword(newPassword);
      await tx.update(users).set({ passwordHash }).where(eq(users.id, userId));
    },

    async issueAccessToken(userId: string) {
      const secret = this.encodeSecret(env.JWT_SECRET, "access");

      return signToken({ sub: userId }, secret, env.ACCESS_TOKEN_EXPIRES_IN_MINUTES);
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
