import { eq } from "drizzle-orm";
import type { LoginInput, LoginOutput } from "./dto";
import { AuthError } from "@/modules/auth/error";
import { users } from "@/modules/user/schema";
import type { Tx } from "@/pkg/db";

interface InitLoginDeps {
  verifyPassword: (plain: string, hash: string) => Promise<boolean>;
}

export function initLogin({ verifyPassword }: InitLoginDeps) {
  return async function login(
    email: LoginInput["email"],
    password: LoginInput["password"],
    tx: Tx
  ): Promise<LoginOutput> {
    // Hold the user lock through session creation so password changes revoke racing logins.
    const user = (
      await tx.select().from(users).where(eq(users.email, email)).limit(1).for("share")
    ).at(0);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw AuthError.invalidCredentials();
    }
    return { userId: user.id };
  };
}
