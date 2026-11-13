import { eq } from "drizzle-orm";
import type { VerifyCurrentPasswordInput, VerifyCurrentPasswordOutput } from "./dto";
import { AuthError } from "@/modules/auth/error";
import { users } from "@/modules/user/schema";
import type { Tx } from "@/pkg/db";

interface InitVerifyCurrentPasswordDeps {
  verifyPassword: (plain: string, hash: string) => Promise<boolean>;
}

export function initVerifyCurrentPassword({ verifyPassword }: InitVerifyCurrentPasswordDeps) {
  return async function verifyCurrentPassword(
    userId: VerifyCurrentPasswordInput["userId"],
    currentPassword: VerifyCurrentPasswordInput["currentPassword"],
    tx: Tx
  ): Promise<VerifyCurrentPasswordOutput> {
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
  };
}
